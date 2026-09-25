import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/collection-runtime-contract-review.md`;
const target = `${base}/action-reviews/P53.json`;
const testFile = "tests/unit/ui-phase2-p53-action-map.test.mjs";
const sourceFiles = ["apps/web/src/components/CollectionRuntimeCenter.vue"];

const definitions = [
  {
    actionId: "CL53-LOAD",
    candidates: ["b3aff7d1ec82177c.1", "25af292333a00121.1"],
    label: "读取、刷新或从状态面重试网页采集运行快照",
    kind: "read",
    condition: "页面挂载、刷新或当前状态面提供既有重试入口时。",
    handler:
      "调用既有GET /platform/crawler-runtime并保留当前已提交查询、状态和页码；刷新失败时保留已验证快照，不触发回收或浏览器执行。",
    remaining: "源映射不证明真实collection:replay授权、MySQL快照或生产超时行为。",
  },
  {
    actionId: "CL53-RECOVERY-OPEN",
    candidates: ["7287ecd28dcaceb5.1"],
    label: "打开全局过期租约回收确认",
    kind: "local",
    condition: "已有观测快照显示过期租约风险，且页面读写空闲、结果非未知时。",
    handler: "只设置本地确认窗可见；预览显示快照观察数而非承诺执行数，不发送POST。",
    remaining: "打开确认窗不证明服务端此刻仍存在过期租约或调用者有回收权限。",
  },
  {
    actionId: "CL53-RENEW-NAV",
    candidates: ["a9a0bd7b83bfaa17.1"],
    label: "进入既有登录受阻采集任务处理列表",
    kind: "navigation",
    condition: "浏览器档案响应明确标记login_status=expired时。",
    handler:
      "沿既有链接导航到 /platform-admin/collection?status=blocked_login；不续期凭证、不选择或重放单条任务。",
    remaining: "导航目标不证明任务存在、档案续期完成或浏览器登录有效。",
  },
  {
    actionId: "CL53-FILTER-FORM",
    candidates: ["cbea42c5b9e6a6b3.1"],
    label: "将搜索/状态表单提交转给当前筛选处理器",
    kind: "wiring",
    forwardsTo: ["CL53-FILTER-APPLY"],
    condition: "用户提交最近运行的搜索词与状态字段时。",
    handler: "阻止浏览器原生导航，仅将submit意图转给 applyFilters。",
    remaining: "事件接线不验证后端状态过滤或跨组织数据范围。",
  },
  {
    actionId: "CL53-FILTER-APPLY",
    candidates: ["764f755fb3d8ba7c.1"],
    label: "提交运行搜索词与状态筛选",
    kind: "read",
    condition: "筛选表单有效且没有读取或回收进行中时。",
    handler:
      "将草稿搜索trim后提交、页码复位为1，并通过既有GET和URL replace读取；搜索字段、长度上限与允许状态保持现有合同。",
    remaining: "客户端提交不证明服务端真实过滤、列表总数或授权。",
  },
  {
    actionId: "CL53-FILTER-RESET",
    candidates: ["06482162d2eef909.1"],
    label: "清空搜索与状态筛选并读取第一页",
    kind: "read",
    condition: "页面读写空闲时。",
    handler: "恢复空搜索、全部状态和第一页，再经现有GET更新快照；不改变档案、任务或租约事实。",
    remaining: "本地重置不证明服务端默认范围或数据授权。",
  },
  {
    actionId: "CL53-RUN-TECH",
    candidates: ["1c008f867673db60.1"],
    label: "展开当前运行的关联技术标识",
    kind: "local",
    condition: "当前运行记录存在并提供技术详情 disclosure 时。",
    handler: "切换原生details披露已有运行、组织、工作区、错误、请求与链路标识，不发起读取或写入。",
    remaining: "按需披露不证明服务端日志脱敏、访问审计或身份授权。",
  },
  {
    actionId: "CL53-PAGE",
    candidates: ["7219dcd9d87bc4b0.1", "28a360589b0e3c7f.1"],
    label: "翻阅最近运行独立分页",
    kind: "read",
    condition: "运行结果存在多页且读写空闲、目标页处于服务端页数边界内时。",
    handler: "只更新当前page并读取；查询词与状态范围沿用现有URL和服务端分页事实。",
    remaining: "本地分页不验证MySQL总数或生产查询隔离。",
  },
  {
    actionId: "CL53-RECOVER-WRITE",
    candidates: ["b917496c3d588d7b.1"],
    label: "从确认窗事件受控提交全局过期租约回收",
    kind: "write",
    contractAliasReason:
      "沿用源合同CL53-CURRENT-RECOVER；父级确认窗事件绑定同时含cancel和confirm，只有confirm分支进入既有回收POST，cancel仅关闭确认窗。",
    condition:
      "用户在共享确认窗提交确认，且saving=false、recoveryUnknown=false、当前快照检测到过期租约风险时。",
    handler:
      "confirm分支调用既有POST /platform/crawler-runtime/recover-expired，body为空对象；保留现有Origin/Idempotency-Key、权限及全局执行时过期租约范围。结果未知时锁定再次提交；成功后仅重读页面事实，不宣称OS浏览器进程已停止或业务采集已恢复。",
    remaining:
      "本映射不执行真实回收，不证明collection:replay授权、MySQL事务/幂等、有效租约未受影响或生产Python/浏览器状态。",
  },
  {
    actionId: "CL53-RECOVER-DIALOG",
    candidates: ["bc8824b8df3a0c77.1"],
    label: "调用共享过期租约影响确认窗",
    kind: "local",
    condition: "用户打开过期租约回收确认步骤时。",
    handler:
      "向共享ConfirmDialog传入全局过期范围说明、快照影响摘要及现有cancel/confirm事件；单纯渲染确认窗不提交POST。",
    remaining:
      "共享ConfirmDialog内部勾选、确认短语、焦点和关闭行为由共享组件合同负责，不由该调用点代验。",
  },
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

export function buildP53ActionReview() {
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
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const records = runContractAudit().records.filter(
    (record) =>
      record.document === contract &&
      sourceFiles.includes(record.sourceFile) &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) {
    const previous = recordsById.get(record.candidateId);
    if (previous)
      assert.equal(
        contractClaim(previous),
        contractClaim(record),
        `conflicting current P53 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(recordsById.size, candidates.length, "P53 source requires current contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      definition.candidates.map((signature) => [signature, definition.actionId]),
    ),
  );
  assert.equal(ownerBySignature.size, candidates.length, "each P53 candidate must have one owner");
  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = ownerBySignature.get(signature);
    assert.ok(actionId, `unmapped P53 candidate ${record.candidateId}`);
    groups.get(actionId).push(record.candidateId);
    claimsByGroup.get(actionId).push(contractClaim(record));
  }

  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map((definition) => {
    const action = {
      actionId: definition.actionId,
      label: definition.label,
      kind: definition.kind,
      sourceCandidateIds: groups.get(definition.actionId).sort(),
      sourceContractKeys: definition.sourceContractKeys ?? [
        ...new Set(claimsByGroup.get(definition.actionId)),
      ],
      contractAliasReason:
        definition.contractAliasReason ??
        `按既有CL53合同对${definition.actionId}精确归属；不增加新的范围、数据或回收行为。`,
      condition: definition.condition,
      handler: definition.handler,
      variants: ["current-route-source-contract"],
      scenes: [],
      visualStates,
      testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
      remaining: definition.remaining,
    };
    if (definition.forwardsTo) {
      action.forwardsTo = definition.forwardsTo;
      action.forwardBindings = action.sourceCandidateIds.flatMap((candidateId) => {
        const candidate = candidateById.get(candidateId);
        return Object.entries(candidate.events ?? {}).map(([event, handler]) => ({
          candidateId,
          event,
          handler,
          targets: action.forwardsTo,
        }));
      });
    }
    return action;
  });

  const inputs = {};
  for (const file of sourceFiles) {
    const surfaces = scanReviewSurfaces(sourceText[file], file);
    if (surfaces.inputs.length) inputs[file] = surfaces.inputs.map((input) => input.binding);
  }
  return {
    schemaVersion: 1,
    pageId: "P53",
    route: "/platform-admin/collection/browser-runtime",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P53回收操作调用共享ConfirmDialog；移动运行详情使用共享ResponsiveDataView，页面未定义局部role=dialog。共享组件内部字段、选中态及焦点行为沿各自合同验收。",
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
        "本映射只覆盖CollectionRuntimeCenter.vue页面局部候选；UiStatePanel、ConfirmDialog、ResponsiveDataView、TechnicalDetails与NavigationShell内部交互沿各自共享合同验收。",
      ],
      remaining:
        "静态映射不证明真实collection:replay/RBAC、Origin/幂等审计、MySQL租约、Python/OS浏览器状态、外部登录、真实回收或正式M07-03验收。",
    },
    compositionGaps: [
      "逐项覆盖CollectionRuntimeCenter.vue的12个当前扫描候选；共享ConfirmDialog及ResponsiveDataView内部控件不重复计入P53。",
      "运行搜索只读取现有ID/错误码/请求/链路标识，状态、页码及全量档案/统计范围保持当前API合同。",
      "回收按钮只打开共享确认窗；仅确认事件提交现有全局过期租约回收POST，取消不写入，未知结果不重复提交。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP53ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
