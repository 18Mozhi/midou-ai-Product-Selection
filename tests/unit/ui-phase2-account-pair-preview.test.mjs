import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import {
  previewAccountPair,
  accountPairCss,
} from "../../scripts/lib/ui-phase2-account-pair-preview.mjs";
import { accountPairFixture } from "../../scripts/lib/ui-phase2-account-pair-fixture.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const bindings = (source) => {
  const result = [];
  const visit = (node) => {
    if (node.type === 1)
      for (const property of node.props)
        if (property.type === 7 && ["on", "model"].includes(property.name))
          result.push(
            JSON.stringify([
              property.name,
              property.arg?.content,
              property.exp?.content,
              property.modifiers.map((item) => item.content),
            ]),
          );
    for (const child of node.children ?? []) visit(child);
  };
  visit(baseParse(parse(source).descriptor.template.content));
  return result.sort();
};

for (const [surface, file] of [
  ["parent", parent],
  ["create", "apps/web/src/components/PlatformAccountDialogs.vue"],
  ["detail", "apps/web/src/components/PlatformUserDetailDialog.vue"],
])
  test(`${surface} pair composition preserves all business script, events and models`, () => {
    const source = read(file),
      preview = previewAccountPair(source, surface);
    assert.deepEqual(parse(preview).errors, []);
    assert.equal(
      parse(preview).descriptor.scriptSetup.content,
      parse(source).descriptor.scriptSetup.content,
    );
    assert.deepEqual(bindings(preview), bindings(source));
  });

test("shared account heading follows tab and avoids old direct-child-only hidden heading style", () => {
  const source = read(parent),
    preview = previewAccountPair(source, "parent");
  const directory = read("apps/web/src/components/PlatformAccountDirectoryWorkspace.vue");
  assert.equal(preview, source);
  assert.ok(source.includes("<PlatformAccountDirectoryWorkspace"));
  assert.ok(directory.includes('class="admin-directory-heading"'));
  assert.ok(directory.includes('v-if="props.adminListRoute"'));
  assert.throws(() => previewAccountPair(source, "wrong"));
});

test("pair fixture uses exact original administrator identity rather than user impersonation", () => {
  const source = read("tests/e2e/m06-01-platform-accounts.spec.ts");
  const fixture = accountPairFixture(source);
  assert.equal(fixture.adminDetail.user.id, fixture.overview.admins[0].id);
  assert.notEqual(fixture.adminDetail.user.id, fixture.detail.user.id);
  assert.deepEqual(fixture.adminDetail.memberships, []);
  assert.deepEqual(fixture.adminDetail.sessions, []);
  assert.throws(
    () => accountPairFixture(source.replace("id: adminId,", "id: changedId,")),
    /Original administrator/,
  );
});

test("whole App proposal remains review-only with no business writes or production CSS imports", () => {
  const driver = read("scripts/verify-ui-phase2-account-pair-app.mjs");
  assert.ok(driver.includes('await page.goto(origin + "/platform-admin/users")'));
  assert.ok(driver.includes("await page.goBack()"));
  assert.ok(!driver.includes('method: "POST"'));
  assert.ok(!driver.includes("__p43_review"));
  assert.ok(!read("apps/web/src/main.ts").includes("account-pair-app-preview"));
  assert.ok(!read(parent).includes("account-pair"));
  assert.equal(accountPairCss.length, 6);
});

const packet = "output/playwright/account-pair-app-c-r7";
const manifestHash = "e30ad22719022dd6f525d87e43c79773d624460a5232b3afb24dfaba11097ea7";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("r7 packet binds current sources, four widths, real App composition and all 80 image bytes", () => {
  const bytes = readFileSync(`${packet}/evidence.json`);
  assert.equal(hash(bytes), manifestHash);
  const evidence = JSON.parse(bytes);
  assert.equal(evidence.approval, "pending");
  assert.deepEqual(evidence.visualApproval, {
    decision: "user-approved-remaining-pages-auto",
    source: "design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json",
    sha256: hash(read("design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json")),
  });
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 8);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    180,
  );
  assert.equal(evidence.screenshots.length, 80);
  assert.equal(Object.keys(evidence.sourceHashes).length, 154);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(
      hash(read(file)),
      sha,
      `Current source drift: ${file}; preserve r7 and recapture as a new version`,
    );
  for (const shot of evidence.screenshots) {
    assert.match(shot.file, /^[a-zA-Z0-9-]+\.png$/);
    const image = readFileSync(`${packet}/${shot.file}`);
    assert.equal(hash(image), shot.sha256);
    assert.equal(image.readUInt32BE(16), shot.pixelWidth);
    assert.equal(image.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.ok(run.requests.every((request) => request.key.startsWith("GET ")));
    assert.ok(run.checks.some((check) => check.name === "P44 same shared Vue DOM" && check.actual));
    if (run.mode === "review")
      assert.ok(
        run.checks.some(
          (check) => check.name === "P44 comparison header contained" && check.actual,
        ),
      );
  }
});

test("r6 capture cannot overwrite an existing review packet or start a server", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-account-pair-app.mjs", "--capture", "--revision", "r7"],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EEXIST/);
  assert.ok(!result.stdout.includes("Account pair baseline http"));
  assert.equal(hash(readFileSync(`${packet}/evidence.json`)), manifestHash);
});
