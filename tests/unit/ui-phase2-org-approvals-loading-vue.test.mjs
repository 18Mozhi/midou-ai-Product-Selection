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
import { previewApprovalsPermission } from "../../scripts/lib/ui-phase2-org-approvals-permission-preview.mjs";
import { previewApprovalsExpired } from "../../scripts/lib/ui-phase2-org-approvals-expired-preview.mjs";
import { previewApprovalsReadFeedback } from "../../scripts/lib/ui-phase2-org-approvals-read-feedback-preview.mjs";
import { readFeedbackVueDriver } from "../../scripts/lib/ui-phase2-org-approvals-read-feedback-driver.mjs";
import {
  approvalsLoadingCss,
  approvalsLoadingAnchor,
  approvalsLoadingReplacement,
  previewApprovalsLoading,
} from "../../scripts/lib/ui-phase2-org-approvals-loading-preview.mjs";
import {
  loadingOutput,
  loadingVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-loading-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = previewApprovalsReadFeedback(
  previewApprovalsExpired(
    previewApprovalsPermission(previewApprovalsParentFrame(read(approvalsParentFile))),
  ),
);
const revised = previewApprovalsLoading(original);

test("loading presentation preserves complete runtime and other views original fallback", () => {
  assert.equal(revised.replace(approvalsLoadingReplacement, approvalsLoadingAnchor), original);
  const before = parse(original).descriptor,
    after = parse(revised).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.deepEqual(after.styles, before.styles);
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: approvalsParentFile,
      id: "p34-loading",
    }).errors,
    [],
  );
  assert.match(approvalsLoadingReplacement, /v-if="state === 'loading'"/);
  assert.match(approvalsLoadingReplacement, /<template v-if="view === 'approvals'">/);
  assert.match(approvalsLoadingReplacement, /<template v-else>正在读取当前组织数据…<\/template>/);
  assert.match(approvalsLoadingReplacement, /aria-hidden="true"/);
  assert.doesNotMatch(approvalsLoadingReplacement, /@click|progressbar|aria-valuenow|setTimeout/);
  const css = read(approvalsLoadingCss);
  assert.match(css, /data-approval-c-view="true"/);
  assert.match(css, /min-height: 0/);
  assert.match(css, /animation: none/);
  assert.doesNotMatch(css, /@keyframes|!important/);
});

test("loading driver preserves previous assertions and validates command modes", () => {
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
  const driver = loadingVueDriver(read(approvalsParentBase)),
    current = checks(driver);
  for (const check of checks(readFeedbackVueDriver(read(approvalsParentBase))))
    assert.ok(current.includes(check), check);
  for (const args of [["--unknown"], ["--smoke", "--capture"], ["--smoke", "--smoke"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-loading-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("previous read-feedback packet remains immutable", () => {
  const folder = "output/playwright/p34-read-feedback-vue-c-r1",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "c9077f463708bb86aa8d634b8ba4be670d8310b8783079a189d9cc0d0deb1543");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});

test("historical loading packet binds source lineage, busy behavior and motion preferences", () => {
  const e = JSON.parse(read(loadingOutput + "/evidence.json"));
  assert.equal(e.kind, "P34-LOADING-VUE-C-r2");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 198);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsParentFile],
    hash(beforeP34OwnerPath(approvalsParentFile, revised)),
  );
  const old = JSON.parse(read("output/playwright/p34-read-feedback-vue-c-r1/evidence.json"));
  assert.deepEqual(e.scenarios, old.scenarios);
  assert.equal(e.scenarios.length, 56);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  for (const width of [1440, 390])
    for (const name of [
      "initial C loading region is status",
      "initial C loading announces busy parent",
      "loading uses compact white C panel",
      "reduced motion loading remains static",
      "normal motion loading also remains static",
      "native disabled initial refresh cannot duplicate reads",
      "background refresh never installs first-load placeholder",
      "native disabled background refresh cannot duplicate reads",
      "successful read clears parent busy state",
    ])
      assert.ok(e.checks.some((c) => c.width === width && c.name === name));
  assert.equal(e.checks.length, 1644);
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 168, writes: 0 },
    { width: 390, parentReads: 168, writes: 0 },
  ]);
  assert.equal(e.screenshots.length, 162);
  for (const image of e.screenshots) {
    const bytes = readFileSync(loadingOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("loading capture refuses existing evidence before starting services", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-loading-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});

test("r1 typography comparison remains an immutable historical packet", () => {
  const folder = "output/playwright/p34-loading-vue-c-r1";
  const bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "da9e33bd83f4d9f33f05c419ead2d4c34fc25e88ec77c669f5460df1ed056e46");
  const e = JSON.parse(bytes);
  assert.equal(e.kind, "P34-LOADING-VUE-C-r1");
  assert.equal(e.approval, "pending");
  for (const image of e.screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});
