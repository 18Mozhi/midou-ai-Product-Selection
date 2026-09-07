import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07");
const check = process.argv.includes("--check");
if (process.argv.slice(2).some((argument) => argument !== "--check"))
  throw new Error("Only --check is supported");
const digest = (content) =>
  createHash("sha256")
    .update(typeof content === "string" ? content.replace(/\r\n/g, "\n") : content)
    .digest("hex");
const baseline = JSON.parse(await readFile(path.join(root, "baseline.json"), "utf8"));
const definitions = [
  {
    id: "P17",
    title: "评分规则",
    route: "/opportunities/scoring-rules",
    test: "tests/e2e/m04-03-scoring.spec.ts",
    states: {
      versions: "版本列表",
      "create-form": "新建草稿表单",
      preview: "只读影响预览",
      "submit-reason": "提交审批原因",
      "pending-approval": "待审批反馈",
      "approval-restricted": "审批能力受限",
      "readonly-empty": "只读空目录",
    },
  },
  {
    id: "P31",
    title: "组织权限",
    route: "/org-admin/roles",
    test: "tests/e2e/m06-01-organization-admin.spec.ts",
    states: {
      "role-matrix": "固定角色矩阵",
      "data-scopes": "数据范围",
      "resource-grants": "指定资源授权",
      "grants-filter-empty": "授权筛选无结果",
      "grant-create-form": "新增资源授权表单",
      "grant-revoke-reason": "撤销授权原因",
      "roles-without-grants": "有角色而无资源授权",
      "roles-empty": "真实角色目录为空",
    },
  },
  {
    id: "P61",
    title: "系统状态",
    route: "/platform-admin/status",
    test: "tests/e2e/m06-02-platform-dashboard.spec.ts",
    states: {
      "dependency-degraded": "依赖异常",
      "refresh-failed-retained": "刷新失败保留旧数据",
      "refresh-recovered": "重试恢复但依赖仍告警",
    },
  },
];
const shots = [];
const stylesheets = {};
for (const relative of (
  await readdir(path.join(repo, "apps/web/src"), { recursive: true })
).sort()) {
  if (!relative.endsWith(".css")) continue;
  const source = `apps/web/src/${relative.split(path.sep).join("/")}`;
  stylesheets[source] = digest(await readFile(path.join(repo, source), "utf8"));
}
for (const definition of definitions) {
  for (const width of [1440, 390]) {
    for (const [state, label] of Object.entries(definition.states)) {
      const filename = `runtime/representatives/${definition.id}-${width}-${state}`;
      const record = JSON.parse(await readFile(path.join(root, `${filename}.json`), "utf8"));
      assert.equal(record.kind, "vue-existing-e2e-fixture-baseline-not-production");
      assert.equal(record.testStatus, "passed", `${filename}: unfinished/failed test`);
      assert.equal(record.pageId, definition.id);
      assert.equal(record.state, state);
      assert.equal(record.concretePath, definition.route);
      assert.equal(record.viewport.width, width);
      assert.equal(record.file, `${filename}.png`);
      assert.equal(record.sourceFingerprint, baseline.sourceFingerprint);
      assert.equal(record.sourceRevision, baseline.sourceRevision);
      assert.equal(record.sha256, digest(await readFile(path.join(root, record.file))));
      assert.equal(record.testFile, definition.test);
      assert.equal(
        record.testFileSha256,
        digest(await readFile(path.join(repo, definition.test), "utf8")),
      );
      assert.equal(
        record.captureHelperSha256,
        digest(await readFile(path.join(repo, "tests/e2e/helpers/ui-phase2-evidence.ts"), "utf8")),
      );
      assert.equal(record.visualAcceptance, "not-evaluated-baseline-only");
      assert.deepEqual(record.stylesheets, stylesheets);
      assert.equal(record.layout.viewportWidth, width);
      assert.equal(record.pageOverflow, record.layout.documentWidth > width);
      assert.equal(record.userReview, "pending");
      assert.ok(record.assertions.length > 0);
      assert.ok(record.limitations.length >= 3);
      shots.push({ ...record, label, title: definition.title });
    }
  }
}
assert.equal(shots.length, 36);
const data = {
  kind: "vue-fixture-baseline-gallery-not-approved-design",
  sourceFingerprint: baseline.sourceFingerprint,
  sourceRevision: baseline.sourceRevision,
  definitions,
  shots,
};
const output = `window.SCOUTOPS_REPRESENTATIVES = ${JSON.stringify(data).replaceAll("<", "\\u003c")};\n`;
const destination = path.join(root, "representative-review-data.js");
if (check) assert.equal(await readFile(destination, "utf8"), output);
else await writeFile(destination, output);
console.log(`ui_phase2_representatives_${check ? "verified" : "generated"} screenshots=36`);
