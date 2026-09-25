import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/runtime-resilience-contract-review.md`;
const target = `${base}/action-reviews/P66.json`;
const testFile = "tests/unit/ui-phase2-p66-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/RuntimeTopologyCenter.vue"];

const definitions = [
  [
    "RT66-LOAD",
    "read",
    "读取或刷新服务拓扑与运行事实",
    ["58a7337b2cdfab3b.1"],
    "用户请求刷新当前运行拓扑时。",
    "沿用既有15秒单飞、请求/追踪编号及父级GET；只读快照不触发Worker或节点操作。",
    "页面查看仍可能写入既有平台审计，不等于数据库零写入或实时外部探测。",
  ],
  [
    "RT66-NAV",
    "navigation",
    "跳转节点进程、健康探测、队列调度及告警区段",
    ["ba9adc29c8482881.1", "e9f9ec4727623c2c.1", "937f81b359ccaf21.1", "276f8658e371a562.1"],
    "用户选择拓扑页内目录分区时。",
    "定位当前页面现有区段锚点，不改变过滤、调度或运行状态。",
    "页内导航不是重启、修复或调度执行动作。",
  ],
  [
    "RT66-RETRY",
    "read",
    "在拓扑事实读取失败后重新核验",
    ["a93553a3ba9aa8a6.1", "d45ddc5db7a2701f.1"],
    "已有快照刷新失败，或首次错误属于非forbidden且非expired的可重读分支时。",
    "复用当前只读GET及请求归属；不重启进程、不补跑探测。",
    "重读成功不证明节点、Worker、队列或上游实际健康。",
  ],
  [
    "RT66-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "读取明确返回expired会话时。",
    "导航至既有登录入口；forbidden分支不伪装成登录过期。",
    "导航不证明重新认证、platform:operate或审计权限已取得。",
  ],
  [
    "RT66-PROCESS",
    "local",
    "展开进程最近失败文本",
    ["dac6cbc2991374ba.1"],
    "当前进程观测包含last_failure时。",
    "只披露当前响应中的最近失败文本，不自动重试或重启进程。",
    "失败说明不保证进程完整日志、根因或当前状态仍相同。",
  ],
  [
    "RT66-RESTART",
    "local",
    "展开API/Worker重启观测摘要",
    ["cc99c7c8b16ccff2.1"],
    "当前运行事实提供对应进程重启计数/观测序列时。",
    "展示返回的累计与新增重启观测，不向进程发送重启命令。",
    "采样摘要不是OS进程列表、自动修复结果或完整重启审计。",
  ],
  [
    "RT66-QUEUES",
    "local",
    "切换全部队列与运行/异常队列本地视图",
    ["1c45c779df2fcc7f.1"],
    "用户切换队列列表显示范围时。",
    "只改变本地showAllQueues显示状态，不发请求、不改变队列调度。",
    "筛选后的列表不代表隐藏队列不存在或调度已暂停。",
  ],
  [
    "RT66-POLICY",
    "local",
    "展开单个队列调度策略参数",
    ["e41c915a9e93bf55.1"],
    "当前队列返回调度策略参数时。",
    "只展开所选队列现有返回字段，不编辑优先级/并发/重试配置。",
    "策略摘要不是队列已执行或已达到调度效果的证明。",
  ],
  [
    "RT66-SNAPSHOT",
    "local",
    "披露状态文件异常",
    ["fcf7c9f746bc706b.1"],
    "返回的发布失败计数非零且本页显示状态文件异常入口时。",
    "只展开响应中的异常计数/说明，不写入或修复状态文件。",
    "计数为零仅是当前响应事实，不证明所有状态文件均有效。",
  ],
  [
    "RT66-OBJECT",
    "navigation",
    "打开响应中提供真实href的关联业务对象",
    ["d9de878e4de4767e.1"],
    "返回对象带有真实href时才显示链接。",
    "导航到既有href目标；由目标重新授权，不拼造目标地址、不修改对象。",
    "链接存在不证明对象仍存在或用户有权查看。",
  ],
  [
    "RT66-ALERT",
    "local",
    "展开告警代码、根因与关联业务ID",
    ["1c008f867673db60.1"],
    "当前告警记录提供技术详情时。",
    "只披露当前返回的告警事实，不清除告警、不重放关联业务动作。",
    "详情展开不证明根因、告警完整性或当前影响已解除。",
  ],
  [
    "RT66-BLOCKER",
    "local",
    "展开阻断项技术代码",
    ["1c008f867673db60.2"],
    "当前读取含阻断项且提供技术码披露时。",
    "只查看当前阻断code，不触发恢复、回滚或修复。",
    "阻断码展示不等于阻断已解决或服务已恢复。",
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

export function buildP66ActionReview() {
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
    if (previous && contractClaim(previous) !== contractClaim(record))
      assert.match(contractClaim(record), /RT66-CURRENT-/u);
    recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P66 current local candidates need contract rows",
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
    "each P66 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P66 candidate ${record.candidateId}`);
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
    contractAliasReason: "依据P66服务拓扑合同的当前源身份归组，观察控件不解释为重启或修复命令。",
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
    pageId: "P66",
    route: "/platform-admin/topology",
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
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale:
            "父级持有共享platform:operate GET、读写审计与登录/权限所有权；本页只映射拓扑组件局部候选。",
        },
        {
          file: "apps/web/src/components/NavigationShell.vue",
          rationale: "全局路由壳/导航动作已按共享壳合同归属，P66仅作为当前页消费者。",
        },
      ],
      remaining:
        "父级读取、错误分类与全局导航不重复归属；P66动作均限于查看、重读、页内过滤/披露或既有链接跳转。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining:
        "P66无业务详情dialog、抽屉、确认窗或执行表单；告警、策略和阻断信息使用原生details/summary。",
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
        "PlatformManagementCenter父级读取和NavigationShell全局导航不计入P66局部组件候选；实际平台审计与权限仍需独立证据。",
      ],
      remaining:
        "静态映射不证明真实节点健康、MySQL审计、Linux进程身份/重启、生产调度效果或M08-01正式验收。",
    },
    compositionGaps: [
      "16个当前RuntimeTopologyCenter候选映射至12类只读/本地/导航动作，分别覆盖四分区、失败重读、队列视图、策略、告警及阻断。",
      "重启历史是观测摘要不是执行按钮；队列视图开关只改变本地显示，不改变Worker调度。",
      "公开health/nodes与health/available是独立脱敏入口，不归为本页刷新，也不据此推断节点运行态。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP66ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
