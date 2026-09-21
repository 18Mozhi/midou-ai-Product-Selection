import test from "node:test";
import {
  beforeP34OwnerPath,
  assertP34HistoricalSourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import ts from "typescript";
import {
  approvalsParentFile,
  previewApprovalsParentFrame,
} from "../../scripts/lib/ui-phase2-org-approvals-parent-frame-preview.mjs";
import { approvalsParentBase } from "../../scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import {
  approvalsPermissionAnchor,
  previewApprovalsPermission,
} from "../../scripts/lib/ui-phase2-org-approvals-permission-preview.mjs";
import { permissionVueDriver } from "../../scripts/lib/ui-phase2-org-approvals-permission-driver.mjs";
import {
  approvalsExpiredCss,
  approvalsExpiredReplacement,
  previewApprovalsExpired,
} from "../../scripts/lib/ui-phase2-org-approvals-expired-preview.mjs";
import {
  expiredOutput,
  expiredVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-expired-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = previewApprovalsPermission(previewApprovalsParentFrame(read(approvalsParentFile)));
const revised = previewApprovalsExpired(original);

test("expired preview preserves runtime, permission branch and existing login instruction", () => {
  assert.equal(revised.replace(approvalsExpiredReplacement, approvalsPermissionAnchor), original);
  const before = parse(original).descriptor,
    after = parse(revised).descriptor;
  assert.equal(before.scriptSetup.content, after.scriptSetup.content);
  assert.deepEqual(before.styles, after.styles);
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: approvalsParentFile,
      id: "p34-expired",
    }).errors,
    [],
  );
  assert.match(approvalsExpiredReplacement, /view === 'approvals' && state === 'expired'/);
  assert.doesNotMatch(approvalsExpiredReplacement, /!data|v-html|RouterLink|href=/);
  assert.ok(
    read("apps/web/src/components/NavigationShell.vue").includes(
      'expired: ["登录已失效", "重新登录后返回当前页面。"]',
    ),
  );
  assert.match(
    approvalsExpiredReplacement,
    /<button type="button" @click="load\(\)">重新加载<\/button>/,
  );
  assert.match(read(approvalsExpiredCss), /\.org-approval-expired-c\s+button/);
  assert.match(read(approvalsExpiredCss), /scroll-margin-block: 100px/);
});

test("expired driver retains every permission assertion and rejects invalid modes", () => {
  const checks = (source) => {
    const ast = ts.createSourceFile("driver.mjs", source, ts.ScriptTarget.Latest, true),
      result = [];
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(ast) === "check")
        result.push(n.getText(ast));
      ts.forEachChild(n, visit);
    };
    visit(ast);
    return result;
  };
  const driver = expiredVueDriver(read(approvalsParentBase)),
    current = checks(driver);
  for (const check of checks(permissionVueDriver(read(approvalsParentBase))))
    assert.ok(current.includes(check), check);
  assert.match(driver, /\.org-approval-expired-c"/);
  assert.doesNotMatch(driver, /\.org-approval-expired-copy/);
  for (const args of [["--unknown"], ["--smoke", "--capture"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-expired-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("approved permission packet remains immutable", () => {
  const folder = "output/playwright/p34-permission-vue-c-r1",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "cc3e8b561550e9094620b644fe01ceb0a39d8ce81791ab4641102115e0b2db6f");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});

test("historical expired packet verifies source lineage, recovery matrix and keyboard flows", () => {
  const e = JSON.parse(read(expiredOutput + "/evidence.json"));
  assert.equal(e.kind, "P34-EXPIRED-VUE-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 190);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsParentFile],
    hash(beforeP34OwnerPath(approvalsParentFile, revised)),
  );
  const old = JSON.parse(read("output/playwright/p34-permission-vue-c-r1/evidence.json"));
  assert.deepEqual(e.scenarios, old.scenarios);
  assert.equal(e.scenarios.length, 56);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  assert.equal(e.checks.length, 1062);
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 168, writes: 0 },
    { width: 390, parentReads: 168, writes: 0 },
  ]);
  for (const width of [1440, 390])
    for (const target of ["summary", "approvals"])
      for (const phase of ["initial", "background"])
        for (const suffix of [
          "one expired region",
          "existing expired title",
          "existing expired copy",
          "native trace opens",
          "actual error retained",
          "actual request id retained",
          "Tab reaches reload",
          "reload is visible and unobscured",
          "trace interaction is read-only",
        ])
          assert.ok(
            e.checks.some(
              (c) =>
                c.width === width && c.name === `${phase}-${target}-session-expired: ${suffix}`,
            ),
          );
  assert.equal(e.screenshots.length, 96);
  for (const image of e.screenshots) {
    const bytes = readFileSync(expiredOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("expired capture refuses to overwrite its evidence", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-expired-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});
