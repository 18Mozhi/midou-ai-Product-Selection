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
import { previewApprovalsExpired } from "../../scripts/lib/ui-phase2-org-approvals-expired-preview.mjs";
import { expiredVueDriver } from "../../scripts/lib/ui-phase2-org-approvals-expired-driver.mjs";
import {
  approvalsReadFeedbackCss,
  approvalsReadFeedbackReplacement,
  previewApprovalsReadFeedback,
} from "../../scripts/lib/ui-phase2-org-approvals-read-feedback-preview.mjs";
import {
  readFeedbackOutput,
  readFeedbackVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-read-feedback-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = previewApprovalsExpired(
  previewApprovalsPermission(previewApprovalsParentFrame(read(approvalsParentFile))),
);
const revised = previewApprovalsReadFeedback(original);

test("read-feedback preview preserves whole runtime and all earlier error branches", () => {
  assert.equal(
    revised.replace(approvalsReadFeedbackReplacement, approvalsPermissionAnchor),
    original,
  );
  const before = parse(original).descriptor,
    after = parse(revised).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.deepEqual(after.styles, before.styles);
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: approvalsParentFile,
      id: "p34-read-feedback",
    }).errors,
    [],
  );
  assert.match(approvalsReadFeedbackReplacement, /view === 'approvals'/);
  assert.match(
    approvalsReadFeedbackReplacement,
    /noticeKind === 'error' && \['ready', 'empty'\]\.includes\(state\)/,
  );
  assert.match(approvalsReadFeedbackReplacement, /<p>\{\{ notice \}\}<\/p>/);
  assert.match(
    approvalsReadFeedbackReplacement,
    /<button v-if="!\['ready', 'empty'\]\.includes\(state\)" type="button" @click="load\(\)">重新加载<\/button>/,
  );
  assert.doesNotMatch(
    approvalsReadFeedbackReplacement,
    /v-html|href=|RouterLink|@click="load\(\{ background/,
  );
  assert.match(read(approvalsReadFeedbackCss), /scroll-margin-block: 100px/);
  assert.doesNotMatch(read(approvalsReadFeedbackCss), /!important/);
});

test("remaining feedback retains every previous check and rejects invalid options", () => {
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
  const driver = readFeedbackVueDriver(read(approvalsParentBase)),
    current = checks(driver);
  for (const check of checks(expiredVueDriver(read(approvalsParentBase))))
    assert.ok(current.includes(check), check);
  for (const args of [["--unknown"], ["--capture", "--smoke"], ["--smoke", "--smoke"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-read-feedback-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("previous expired packet remains byte-identical", () => {
  const folder = "output/playwright/p34-expired-vue-c-r1",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "006fa7192ddcc8f7c817cb69234326a536019b61cfb7c37d52e8d63604c23d53");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});

test("historical feedback packet binds source lineage, original matrix and32keyboard flows", () => {
  const e = JSON.parse(read(readFeedbackOutput + "/evidence.json"));
  assert.equal(e.kind, "P34-READ-FEEDBACK-VUE-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 194);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsParentFile],
    hash(beforeP34OwnerPath(approvalsParentFile, revised)),
  );
  const old = JSON.parse(read("output/playwright/p34-expired-vue-c-r1/evidence.json"));
  assert.deepEqual(e.scenarios, old.scenarios);
  assert.equal(e.scenarios.length, 56);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  const added = e.scenarios.filter(
    (s) =>
      !["session-expired", "permission-forbidden"].includes(s.failure) &&
      (s.phase === "background" ||
        ["service-blocked", "version-conflict", "network-unavailable"].includes(s.failure)),
  );
  assert.equal(added.length, 32);
  for (const s of added)
    for (const suffix of [
      "one read feedback region",
      "content boundary matches visibility",
      "original failure detail retained",
      "original failure trace retained",
      "native keyboard reaches original recovery",
      "recovery visible and unobscured",
      "disclosure performs no reads",
    ])
      assert.ok(
        e.checks.some(
          (c) => c.width === s.width && c.name === `${s.phase}-${s.target}-${s.failure}: ${suffix}`,
        ),
      );
  assert.equal(e.checks.length, 1606);
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 168, writes: 0 },
    { width: 390, parentReads: 168, writes: 0 },
  ]);
  assert.equal(e.screenshots.length, 160);
  for (const image of e.screenshots) {
    const bytes = readFileSync(readFeedbackOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("read-feedback capture cannot overwrite existing evidence", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-read-feedback-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});
