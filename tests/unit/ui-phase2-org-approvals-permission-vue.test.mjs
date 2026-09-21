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
import {
  approvalsParentBase,
  approvalsParentCurrentDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import {
  approvalsPermissionCss,
  approvalsPermissionAnchor,
  approvalsPermissionReplacement,
  previewApprovalsPermission,
} from "../../scripts/lib/ui-phase2-org-approvals-permission-preview.mjs";
import {
  permissionOutput,
  permissionVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-permission-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = previewApprovalsParentFrame(read(approvalsParentFile));
const revised = previewApprovalsPermission(original);
const baseDriver = approvalsParentCurrentDriver(read(approvalsParentBase));
const driver = permissionVueDriver(read(approvalsParentBase));
const copy = [
  "查看权限提示",
  "当前无法查看审批内容",
  "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
  "审批内容目前未显示，不代表记录或模板为空。",
];

test("permission composition preserves the whole parent runtime and all previous branches", () => {
  assert.equal(
    revised.replace(approvalsPermissionReplacement, approvalsPermissionAnchor),
    original,
  );
  const before = parse(original).descriptor,
    after = parse(revised).descriptor;
  assert.equal(before.scriptSetup.content, after.scriptSetup.content);
  assert.deepEqual(before.styles, after.styles);
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: approvalsParentFile,
      id: "p34-permission",
    }).errors,
    [],
  );
  assert.match(
    approvalsPermissionReplacement,
    /v-else-if="view === 'approvals' && state === 'forbidden'"/,
  );
  assert.doesNotMatch(approvalsPermissionReplacement, /!data|v-html/);
  assert.match(approvalsPermissionReplacement, /<p>\{\{ notice \}\}<\/p>/);
  assert.match(
    approvalsPermissionReplacement,
    /<code v-if="requestId">\{\{ requestId \}\}<\/code>/,
  );
  assert.match(
    approvalsPermissionReplacement,
    /<button type="button" @click="load\(\)">重新加载<\/button>/,
  );
});

test("approved four copy slots are used with native details and narrowly scoped styles", () => {
  const approval = read("design-plans/ui-phase-2-2026-09-07/P34-PERMISSION-TONE-R2-REVIEW.md");
  for (const text of copy) {
    assert.ok(approval.includes(text));
    assert.ok(approvalsPermissionReplacement.includes(text));
  }
  const css = read(approvalsPermissionCss);
  assert.match(css, /:has\(\.org-approval-permission-c\)\s*\+\s*\.org-admin-state/);
  assert.match(css, /data-approval-c-view="true"/);
  assert.doesNotMatch(css, /!important|org-approval-first-failure/);
  assert.match(approvalsPermissionReplacement, /<details class="org-approval-permission-trace">/);
});

test("permission driver keeps every prior check and rejects unknown options", () => {
  const checks = (source) => {
    const ast = ts.createSourceFile("driver.mjs", source, ts.ScriptTarget.Latest, true),
      found = [];
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(ast) === "check")
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    };
    visit(ast);
    return found;
  };
  const current = checks(driver);
  for (const check of checks(baseDriver)) assert.ok(current.includes(check), check);
  for (const args of [["--unknown"], ["--smoke", "--capture"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-permission-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("historical r3 packet and wording approval image are preserved", () => {
  const folder = "output/playwright/p34-parent-current-c-r3",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "b4bc20a5f58b10d030d155fdc8d64b87cd1d9bb9cb9188bb04d3fa3fe39e4d7c");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
  assert.equal(
    hash(
      readFileSync(
        "output/playwright/p34-permission-tone-r2/background-permission-forbidden-r2-focus-390.png",
      ),
    ),
    "64e7e7d7ab7e2971599d1db317aa03967abbb4b74f63298fe8254d5719220acd",
  );
});

test("historical permission packet binds source lineage, 56 recoveries and eight keyboard flows", () => {
  const e = JSON.parse(read(permissionOutput + "/evidence.json"));
  assert.equal(e.kind, "P34-PERMISSION-VUE-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 186);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsParentFile],
    hash(beforeP34OwnerPath(approvalsParentFile, revised)),
  );
  assert.equal(e.checks.length, 926);
  assert.equal(e.scenarios.length, 56);
  assert.equal(e.scenarios.filter((s) => s.failure === "permission-forbidden").length, 8);
  const old = JSON.parse(read("output/playwright/p34-parent-current-c-r3/evidence.json"));
  assert.deepEqual(e.scenarios, old.scenarios);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 168, writes: 0 },
    { width: 390, parentReads: 168, writes: 0 },
  ]);
  for (const width of [1440, 390])
    for (const target of ["summary", "approvals"])
      for (const phase of ["initial", "background"]) {
        const name = `${phase}-${target}-permission-forbidden`;
        for (const suffix of [
          "one permission region",
          "one accessible reload",
          "actual error retained",
          "actual request id retained",
          "native trace opens",
          "Tab reaches reload",
          "reload is visible and unobscured",
          "trace interaction is read-only",
        ])
          assert.ok(e.checks.some((c) => c.width === width && c.name === name + ": " + suffix));
      }
  assert.equal(e.screenshots.length, 80);
  for (const image of e.screenshots) {
    const bytes = readFileSync(permissionOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("permission capture refuses to overwrite a completed packet", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-permission-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});

test("user approval pins only the displayed mobile permission region", () => {
  const record = read("design-plans/ui-phase-2-2026-09-07/P34-PERMISSION-VUE-C-APPROVAL.md");
  const approvedHash = "a92176b839e741c0c8806f7b38501d5e88168e959000f94b097e22e18572a943";
  assert.equal(
    hash(
      readFileSync(
        permissionOutput + "/background-approvals-permission-forbidden-reload-focus-390.png",
      ),
    ),
    approvedHash,
  );
  assert.ok(record.includes(approvedHash));
  assert.match(record, /这张组合通过，继续其他状态/);
  assert.match(record, /不把80图整个包标为通过/);
  assert.equal(JSON.parse(read(permissionOutput + "/evidence.json")).approval, "pending");
});
