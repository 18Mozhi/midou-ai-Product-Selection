import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/status-center-contract-review.md`;
const target = `${base}/action-reviews/P61.json`;
const testFile = "tests/unit/ui-phase2-p61-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/PlatformStatusCenterView.vue",
  "apps/web/src/components/PlatformStatusWorkspace.vue",
];
const parentSourceFile = "apps/web/src/components/PlatformManagementCenter.vue";
const definitions = [
  [
    "P61-TOPOLOGY",
    "navigation",
    "查看实时拓扑",
    ["528025bcfd01008c.1"],
    "用户从异常清单进入实时拓扑页时。",
    "导航到既有topology路由；本页不执行服务重启、恢复或发布。",
    "导航不证明生产依赖状态或目标页权限。",
  ],
  [
    "P61-TOPOLOGY-NODE",
    "navigation",
    "打开单个依赖拓扑节点详情",
    ["5ec3f86a53bdd26b.1"],
    "当前节点由父级拓扑配置提供href时。",
    "只打开该节点现有管理目标；名称、状态、观测时间与依赖关系来自当前快照。",
    "目标链接存在不证明服务真实健康、故障传播或生产观测完整。",
  ],
  [
    "P61-PROPAGATION",
    "navigation",
    "进入当前异常传播核查项处理页",
    ["1c29b9e693b1be23.1"],
    "父级传播核查项提供可用href时。",
    "按当前事实导航到既有处理页；不在P61改变传播状态或执行业务恢复。",
    "核查入口不证明传播推断或后续处置成功。",
  ],
  [
    "P61-COLLECTION",
    "navigation",
    "前往采集任务概览",
    ["4c8c3c0ab5222aee.1"],
    "业务汇总区域提供既有采集任务入口时。",
    "导航到已有采集任务概览，不创建或重放采集任务。",
    "导航不代表采集Worker在线或任务已运行。",
  ],
  [
    "P61-PROVIDER",
    "navigation",
    "前往来源配置目录",
    ["0e70539c0b003023.1"],
    "业务汇总区域提供既有来源管理入口时。",
    "导航至既有来源配置目录，不修改来源配置或凭证。",
    "链接可见不证明来源权限、凭证状态或平台可用。",
  ],
  [
    "P61-WORKSPACE",
    "local",
    "切换状态页四个本地信息分区",
    ["b7ef2bc74a304a7a.1"],
    "用户在需核查、依赖、浏览器会话与业务汇总间切换时。",
    "只更新本地active section及既有aria-pressed/面板关联，不重新GET、不写URL或浏览器存储。",
    "本地分区切换不刷新数据，也不证明全局系统健康。",
  ],
];
const parentExclusions = [
  ["bfe687b5e3775fab.1", "只在内容审核域渲染的组件事件，不属于P61状态页。"],
  ["5eebd25c337b0a2c.1", "只在已关闭email域显示的发送邮件动作。"],
  ["3e86a7a4cbf4b231.1", "非status域的通用目录筛选事件。"],
  ["dd1ae8b1dd3126a2.1", "email域草稿工作台事件。"],
  ["1cb3318f1d3fb321.1", "内容审核及email域记录事件。"],
  ["f5cb087b206b4a60.1", "内容审核专用对话框事件。"],
  ["6ac3264cbd6eac5b.1", "内容审核专用对话框调用。"],
  ["5b14488b26b010e3.1", "email域专用草稿编辑器事件。"],
  ["2c3cf7108ad053c1.1", "email队列专用原因对话框事件。"],
  ["4b3a546a74b4e7c1.1", "email队列专用原因对话框调用。"],
  ["b285a03c301c82db.1", "email队列专用原因流程，不属于系统状态读取/导航。"],
  ["f85ae0968844933a.1", "平台消息发布/取消原因流程，不属于系统状态读取/导航。"],
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

export function buildP61ActionReview() {
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
    "P61 local source candidates need current contract rows",
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
    "each P61 local candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P61 candidate ${record.candidateId}`);
    groupedIds.get(actionId).push(record.candidateId);
    groupedClaims.get(actionId).push(contractClaim(record));
  }
  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const testReference = [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }];
  const actions = definitions.map(([actionId, kind, label, , condition, handler, remaining]) => ({
    actionId,
    kind,
    label,
    sourceCandidateIds: groupedIds.get(actionId).sort(),
    sourceContractKeys: [...new Set(groupedClaims.get(actionId))],
    contractAliasReason: `沿用P61当前状态中心合同对${actionId}精确归属，不增加读取、持久化或运行操作。`,
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: testReference,
    remaining,
  }));
  const inputs = {};
  for (const [file, source] of Object.entries(sourceText)) {
    const scanned = scanReviewSurfaces(source, file).inputs;
    if (scanned.length) inputs[file] = scanned.map((item) => item.binding);
  }

  const parentCandidates = scanSource(readSource(parentSourceFile), parentSourceFile).candidates;
  const sharedSignatures = ["62c28f83dd77541b.1", "79f3cfdde95076be.1", "1c008f867673db60.1"];
  const exclusions = parentCandidates
    .filter(
      (candidate) =>
        !sharedSignatures.some((signature) => candidate.candidateId.endsWith(`#${signature}`)),
    )
    .map((candidate) => {
      const definition = parentExclusions.find(([signature]) =>
        candidate.candidateId.endsWith(`#${signature}`),
      );
      assert.ok(definition, `unclassified shared parent candidate ${candidate.candidateId}`);
      return { candidateId: candidate.candidateId, reason: definition[1] };
    });
  assert.equal(exclusions.length, parentCandidates.length - sharedSignatures.length);
  const parentRecords = runContractAudit().records.filter(
    (record) => record.sourceFile === parentSourceFile,
  );
  const sharedParentCandidates = sharedSignatures.map((signature) => {
    const candidate = parentCandidates.find((item) => item.candidateId.endsWith(`#${signature}`));
    assert.ok(candidate, `missing shared P61 parent candidate ${signature}`);
    const record = parentRecords.find(
      (item) =>
        item.candidateId === candidate.candidateId &&
        item.document.endsWith("content-notification-evidence-contract-review.md"),
    );
    assert.ok(record && ["identity-current", "line-moved"].includes(record.status));
    return { candidateId: candidate.candidateId, sourceContract: contractClaim(record) };
  });
  const parentHash = createHash("sha256").update(readSource(parentSourceFile)).digest("hex");
  return {
    schemaVersion: 1,
    pageId: "P61",
    route: "/platform-admin/status",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    pageScopeExclusions: {
      sharedParent: parentSourceFile,
      sharedParentSha256: parentHash,
      sharedCurrentCandidates: sharedParentCandidates,
      excludedCurrentCandidates: exclusions,
      remaining:
        "PlatformManagementCenter共享持有刷新、读取重试与追踪编号；这三个父级候选仅交叉引用，不重复计入状态专属源位置。其他内容、email、审核和队列控件不属于P61。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining: "P61状态视图没有新增业务确认弹窗；危险操作仍由对应目标页面既有合同负责。",
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
        "本映射覆盖PlatformStatusCenterView和PlatformStatusWorkspace；父级PlatformManagementCenter只交叉引用P61读取所有者候选，NavigationShell与拓扑数据定义沿各自合同验收。",
      ],
      remaining:
        "局部导航与状态读取映射不证明真实生产依赖健康、SQL/RBAC、服务器观测、真实故障恢复或正式M06-02/M07-03验收。",
    },
    compositionGaps: [
      "逐项覆盖两个P61专属Vue子组件的6个源码候选；父级刷新/重试/追踪位置单独按共享合同交叉引用。",
      "四分区切换仅为本地状态；拓扑、异常处理、采集与来源入口只导航，不在P61启动/恢复任何服务。",
      "状态依赖、业务汇总与浏览器标签页会话指标各自按现有事实来源显示，不互相推导为全平台健康率。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP61ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
