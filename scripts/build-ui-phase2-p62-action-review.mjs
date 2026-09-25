import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/log-backup-release-contract-review.md`;
const target = `${base}/action-reviews/P62.json`;
const testFile = "tests/unit/ui-phase2-p62-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/PlatformLogCenter.vue",
  "apps/web/src/components/ResponsiveFilterDrawer.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
];

const definitions = [
  [
    "LG62-LOAD",
    "read",
    "读取或重读当前链路日志",
    ["d37ca26c235aab7a.1", "fa83b88a7082fbd5.1"],
    "用户刷新日志或读取状态提供重新加载入口时。",
    "复用当前query/source条件、最近200条读取、既有15秒单飞与快照归属；不导出CSV。",
    "重读不证明SQL范围/记录完整或拥有真实日志读取权限。",
  ],
  [
    "LG62-FILTER-OPEN",
    "local",
    "打开移动端日志筛选抽屉",
    ["e4314256fea2aeac.1", "7e0fa28eaeb1cc09.1"],
    "用户在窄屏日志台请求调整当前搜索或运行面时。",
    "打开现有ResponsiveFilterDrawer；抽屉入口和组件调用不应用筛选或发GET。",
    "打开抽屉不证明筛选已应用。",
  ],
  [
    "LG62-FILTER-DRAWER",
    "local",
    "管理移动日志筛选抽屉开关与键盘边界",
    [
      "28fb788b88500472.1",
      "e03968eb8d9e92a8.1",
      "483082db5a776bf3.1",
      "df1390feb7424a07.1",
      "cd956325fcd081da.1",
    ],
    "移动筛选抽屉打开、关闭、收到键盘事件或提交表单时。",
    "沿用现有遮罩/按钮关闭、Tab与Escape处理；form提交时只关闭抽屉，检索仍由拥有者应用。",
    "局部源映射不代表所有设备读屏/焦点恢复均已验收。",
  ],
  [
    "LG62-APPLY",
    "read",
    "应用搜索词与运行面筛选",
    ["ef169b3c5b08be4e.1", "280c88beee4f3de8.1"],
    "用户通过桌面或抽屉提交当前日志查询条件时。",
    "使用既有query/source、URL规范化及读取生命周期，查询不扩展到未声明字段或时间范围。",
    "提交不证明服务端检索、排序或审计范围正确。",
  ],
  [
    "LG62-RESET",
    "read",
    "恢复默认日志筛选并重新读取",
    ["d2bd484790411f68.1"],
    "用户请求重置当前检索条件时。",
    "清除搜索和运行面条件，再走既有读取处理；不清空已读审计/日志记录。",
    "重置筛选不是删除日志或清除服务器审计。",
  ],
  [
    "LG62-EXPORT-OPEN",
    "local",
    "准备当前筛选CSV审计导出原因流程",
    ["f457c74d5cac0e80.1", "5d23ad02d6538b9c.1"],
    "导出未忙且用户启动当前检索结果CSV导出时。",
    "打开既有审计原因流程；导出入口仅准备意图，不因打开而创建文件或提交导出请求。",
    "流程打开不证明原因校验、审计写入或CSV生成。",
  ],
  [
    "LG62-EXPORT-DIALOG",
    "local",
    "呈现日志导出原因窗并允许取消",
    [
      "2c239372ff0167e8.1",
      "0a9c82c5c5fb1fd7.1",
      "0b86489e495d6b17.1",
      "f850a4abcc7ccc3a.1",
      "8724bc1f65aaf63a.1",
    ],
    "导出原因窗口由既有所有者打开时。",
    "展示原生审计原因窗；Escape/顶部/底部取消只关闭当前原因流程，不发导出POST。",
    "局部定义不证明跨离页/迟到请求的完整浏览器生命周期。",
  ],
  [
    "LG62-EXPORT",
    "write",
    "提交审计原因并导出当前规范化日志条件CSV",
    ["13b398e8ab4b93d3.1", "7aa809a5cd2d2124.1", "e7e63c4215a43738.1"],
    "原因通过既有最短/最多300字约束且导出不在途时，用户明确提交。",
    "沿用父级当前拥有者提交带审计原因的导出请求；服务按同一条件重新查询最新200条生成CSV，不是DOM快照。取消分支不写入；下载只发生在有效成功响应后。",
    "不证明真实CSV、MySQL审计/RBAC、离页迟到下载归属或失败后可安全重发。",
  ],
  [
    "LG62-TRACE",
    "local",
    "披露链路、快照读取、最近失败及最近导出追踪编号",
    ["d7ff6351cbc06807.1", "8189528db997f296.1", "f71cf4e0c63914cf.1", "be642d45b3e34274.1"],
    "当前日志响应、成功快照、失败读取或导出操作提供追踪编号时。",
    "只展开各自当前归属的原生技术详情，不混用读/写requestId，不新增请求。",
    "显示关联编号不证明关联请求成功或后端日志脱敏正确。",
  ],
  [
    "LG62-TASK",
    "navigation",
    "从异常日志跳转到关联采集任务",
    ["af1fa7b422aa7bcd.1", "1b10ffebcf6798fe.1"],
    "当前异常记录提供真实关联任务ID和可用目标时。",
    "使用当前记录携带的任务目标导航，不创建、重试或重放任务。",
    "存在跳转目标不证明任务当前存在或用户可读取。",
  ],
  [
    "LG62-PROVIDER",
    "navigation",
    "从异常日志跳转到关联来源配置",
    ["c4b53a994d00ca34.1", "ec46ae5cddba062a.1"],
    "当前异常记录提供真实关联来源ID和可用目标时。",
    "使用当前行既有来源目标导航，不修改来源配置或凭证。",
    "链接不证明来源配置当前有效或具备编辑权限。",
  ],
  [
    "LG62-IDS",
    "local",
    "展开或查看日志记录编号与技术详情",
    ["5d0b99550cb761b8.1", "1c008f867673db60.1"],
    "桌面/移动当前记录提供事件编号或技术详情披露入口时。",
    "查看响应中已有编号/技术字段，手机使用既有移动详情，不发新读取或导出请求。",
    "编号披露不代表完整链历史、原始payload或敏感标识可导出。",
  ],
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}
function contractClaim(record) {
  return record.claim
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .at(-1);
}

export function buildP62ActionReview() {
  const sourceText = Object.fromEntries(sourceFiles.map((file) => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(
    Object.entries(sourceText).map(([file, source]) => [
      file,
      createHash("sha256").update(source).digest("hex"),
    ]),
  );
  const candidates = Object.entries(sourceText).flatMap(
    ([file, source]) => scanSource(source, file).candidates,
  );
  const records = runContractAudit().records.filter(
    (record) =>
      sourceFiles.includes(record.sourceFile) &&
      record.document === contract &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) {
    const previous = recordsById.get(record.candidateId);
    if (previous) assert.equal(contractClaim(previous), contractClaim(record));
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P62 current local source candidates need contract rows",
  );
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(
    owner.size,
    candidates.length,
    "each P62 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P62 candidate ${record.candidateId}`);
    groupedIds.get(actionId).push(record.candidateId);
    groupedClaims.get(actionId).push(contractClaim(record));
  }
  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map(([actionId, kind, label, , condition, handler, remaining]) => ({
    actionId,
    kind,
    label,
    sourceCandidateIds: groupedIds.get(actionId).sort(),
    sourceContractKeys: [...new Set(groupedClaims.get(actionId))],
    contractAliasReason: `沿用P62日志中心合同对${actionId}精确归属，不扩大筛选、导出字段或日志范围。`,
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining,
  }));
  const inputs = {};
  for (const [file, source] of Object.entries(sourceText)) {
    const found = scanReviewSurfaces(source, file).inputs;
    if (found.length) inputs[file] = found.map((item) => item.binding);
  }
  return {
    schemaVersion: 1,
    pageId: "P62",
    route: "/platform-admin/logs",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    pageScopeExclusions: {
      sharedFiles: [
        {
          file: "apps/web/src/components/ResponsiveDataView.vue",
          rationale: "调用链事件的共享移动详情；不重复纳入P62专属候选。",
        },
        {
          file: "apps/web/src/components/TableViewControls.vue",
          rationale: "日志表格的共享列设置/密度控件，内部交互沿共享表格合同。",
        },
        {
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale: "P62路由所有者与已有状态/过滤/请求编号由共同管理中心维护。",
        },
      ],
      remaining:
        "共享详情、列设置与父路由读取所有者不重复计数；父级所持P62读写调用沿已有共享合同核验。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P62包含共享筛选抽屉、审计原因窗及每行ResponsiveDataView移动详情；本动作映射不替代所有消费者的真实焦点、离页和迟到下载生命周期验收。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: sourceFiles,
      dependencyHashes: sourceHashes,
      inputScope: "reviewed-subset-of-shared-source",
      inputs: [],
      containerScope: "reviewed-subset-of-shared-source",
      containers: [],
      sharedRemaining: [
        "P62局部来源含PlatformLogCenter、ResponsiveFilterDrawer和AuditedReasonDialog；ResponsiveDataView、TableViewControls及PlatformManagementCenter父所有者仅作为共享消费者/合同交叉引用。",
      ],
      remaining:
        "静态映射不证明真实platform:operate/RBAC、security audit、SQL查询/导出、完整CSV、真实浏览器下载或M06-02/M07-03验收。",
    },
    compositionGaps: [
      "覆盖三个P62局部源码文件的32个当前候选，包含筛选抽屉与审计原因窗共享组件；共享数据详情/表格控件内部不重复计数。",
      "日志结果最多为当前规范化条件下最新200条；CSV请求由服务重新查询，不得称为不可变DOM快照。",
      "查询、导出、取消、读/写追踪编号和迟到下载分开；本图不推定离页会取消已提交服务器导出。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP62ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
