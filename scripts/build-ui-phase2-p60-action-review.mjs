import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/commercial-security-open-platform-contract-review.md`;
const target = `${base}/action-reviews/P60.json`;
const testFile = "tests/unit/ui-phase2-p60-action-review.test.mjs";
const sourceFile = "apps/web/src/components/OpenPlatformCenter.vue";

const definitions = [
  [
    "OP60-LOAD",
    "read",
    "读取当前组织和开放平台目录快照",
    [
      "05407b8a7159149a.1",
      "88a9882a80ac28a2.1",
      "5367bd616a3abe62.1",
      "a67ea3327ba9afd7.1",
      "e4c0454be34c0156.1",
    ],
    "用户提交组织读取、刷新当前目录或从首读错误重试时。",
    "复用现有load及同一GET返回的Client/Webhook/投递集合；重试不重发之前的写操作。",
    "页面读取/重读不证明真实最小权限、所有集合完整或真实投递成功。",
  ],
  [
    "OP60-SECRET",
    "local",
    "复制一次性密钥或在确认保存后清除",
    ["32b3ac036c571c07.1", "0b5f3917e5414006.1"],
    "已有写响应在当前组织/视图归属下返回一次性密钥时。",
    "复制只调用浏览器剪贴板；用户确认安全保存后清除当前内存值并使迟到密钥响应失效。",
    "本地复制/清除不证明外部凭证系统已保存或撤销服务器端密钥。",
  ],
  [
    "OP60-TRACE",
    "local",
    "展开当前读取操作关联编号",
    ["217f0846e7bba1ee.1"],
    "当前读取操作存在可披露的追踪编号时。",
    "展开当前已记录的读取编号，不发起API或业务写入。",
    "追踪编号披露不代表其对应操作成功或可用于认证。",
  ],
  [
    "OP60-TECH",
    "local",
    "披露Client、Webhook与投递记录已有技术详情",
    [
      "1c008f867673db60.1",
      "1c008f867673db60.2",
      "1c008f867673db60.3",
      "1c008f867673db60.4",
      "1c008f867673db60.5",
      "1c008f867673db60.6",
      "1c008f867673db60.7",
      "1c008f867673db60.8",
    ],
    "当前读取快照提供技术详情展开入口时。",
    "仅披露已读响应中的非密钥关联字段；沿用三个ResponsiveDataView移动详情和原生技术信息展开。",
    "Details展开不证明日志脱敏、密钥不可达的完整生命周期或读屏行为全部验收。",
  ],
  [
    "OP60-VIEW",
    "local",
    "切换Client、Webhook与投递记录工作区",
    ["378899e48c4d8c4e.1", "e16baed7fd7574cb.1", "b224f20b7d8e3bc6.1"],
    "用户选择三个开放平台工作区之一时。",
    "只变更本地activeView并呈现当前GET已有集合/摘要；不因切换额外读取。",
    "工作区摘要仅按既有组织范围，不等于当前过滤结果总数。",
  ],
  [
    "OP60-OPEN-CREATE",
    "local",
    "打开Client或Webhook填写与确认流程",
    ["4fe0f29d19fbaf47.1"],
    "用户在当前组织范围下启动对应创建流程时。",
    "调用既有共享创建容器和真实Client/Webhook表单；组件调用本身不创建对象。",
    "表单打开不证明组织有效、创建权限或密钥已生成。",
  ],
  [
    "OP60-EVENT",
    "local",
    "切换Webhook真实事件订阅项",
    ["b70e50f696b891f1.1"],
    "Webhook草稿的事件复选项发生变化时。",
    "只切换现有四个已支持事件的草稿数组，不扩大事件集合或发送回调。",
    "本地勾选不证明Worker能投递或外部接收端已订阅。",
  ],
  [
    "OP60-CREATE-PREPARE",
    "local",
    "校验并准备Client或Webhook创建确认",
    ["7a625f6edefd5043.1"],
    "Client/Webhook字段通过现有校验且没有操作在途时。",
    "依据activeView调用既有创建处理器并产生共享确认意图；不直接发POST。",
    "创建确认预览不代表账号、Webhook或一次性密钥已创建。",
  ],
  [
    "OP60-FILTER",
    "read",
    "应用当前集合搜索、状态、排序与每页数",
    ["1a48a72d882d501b.1", "cec60f4bd63b9b5e.1"],
    "用户提交当前工作区过滤条件时。",
    "按现有集合独立query/status/sort/page_size调用load；组织范围保持当前状态。",
    "客户端过滤意图不证明服务端计数或同值排序稳定。",
  ],
  [
    "OP60-RESET",
    "read",
    "重置当前集合过滤条件",
    ["2f1b49bdefe2e793.1", "2c7db35d039ef2f4.1"],
    "用户通过常规重置或空结果清除筛选时。",
    "恢复当前view已有默认query/status/sort/page/pageSize并按既有流程读取。",
    "重置过滤不撤销、删除或重放任何平台资源。",
  ],
  [
    "OP60-CLIENT-ROTATE",
    "local",
    "准备轮换当前接口访问账号密钥",
    ["f8b804e268ceefea.1", "7510ef03037c8a3a.1"],
    "当前Client为active且页面显示轮换入口时。",
    "生成既有版本化rotate确认与原因流程；旧对象/范围/限额语义由服务处理，入口本身不POST。",
    "轮换意图不证明旧密钥失效、新密钥生成或权限持久化。",
  ],
  [
    "OP60-CLIENT-REVOKE",
    "local",
    "准备撤销当前接口访问账号",
    ["1c4ff4af0e8fd8d3.1", "1df8fceeaa98b0b3.1"],
    "当前Client状态允许且页面显示撤销入口时。",
    "准备既有expected_version/reason/destructive影响确认；取消不会撤销账号。",
    "撤销入口不证明服务端访问已终止、审计已提交或账号可恢复。",
  ],
  [
    "OP60-HOOK-STATUS",
    "local",
    "准备启用或停用当前Webhook",
    ["dd00f77d258cbab6.1", "3a8f13d630c643d0.1"],
    "当前Webhook行提供状态切换入口时。",
    "保留既有Webhook字段、目标版本及原因，经单独确认执行PATCH状态切换。",
    "本页状态切换入口不是完整Webhook编辑表单。",
  ],
  [
    "OP60-HOOK-TEST",
    "local",
    "准备向当前Webhook提交真实测试事件",
    ["1f4e699773a73075.1", "aafad6da5f70f220.1"],
    "Webhook处于active且测试入口可用时。",
    "准备既有test确认/原因流程；后续响应queued为受理，不等于外部投递成功。",
    "打开测试确认不代表已访问DNS、Worker或外部收件端。",
  ],
  [
    "OP60-HOOK-ROTATE",
    "local",
    "准备轮换当前Webhook签名密钥",
    ["861b950a0ddc1651.1", "861b950a0ddc1651.2"],
    "当前Webhook提供轮换入口且没有写操作在途时。",
    "准备既有版本化rotate请求与原因确认；新签名密钥仍仅在首次响应短暂显示。",
    "轮换入口不代表密钥已改变或真实外部回调已验证。",
  ],
  [
    "OP60-REPLAY",
    "local",
    "准备基于成功或死信记录创建新投递",
    ["92629450188f4d4f.1", "92629450188f4d4f.2"],
    "当前delivery状态为succeeded或dead_letter且显示重放入口时。",
    "准备现有带原因的重放确认；新投递独立创建，原投递历史保持不变。",
    "重放入口或HTTP 202只代表受理，不代表Worker发送、接收端响应或最终成功。",
  ],
  [
    "OP60-PAGE",
    "read",
    "翻阅当前集合独立分页",
    ["5535b1d4b215afda.1", "266a3696f502c16e.1"],
    "当前集合分页元数据提供有效目标页且没有读取请求在途时。",
    "只调整activeView对应集合的页码；Client/Webhook/Delivery游标继续独立。",
    "本地分页不验证服务端COUNT或稳定排序。",
  ],
  [
    "OP60-ACTION-REASON",
    "local",
    "校验并收集高风险操作原因",
    ["f371f0b36489e592.1", "55ddee7e496796ca.1"],
    "已有轮换、撤销、Webhook动作或重放准备需要原因时。",
    "由共享原因弹窗校验1–500字符并把原因交还当前pending操作；取消仅清理原因流程。",
    "原因弹窗不提交目标动作，也不证明后续请求获准。",
  ],
  [
    "OP60-CONFIRM-DIALOG",
    "local",
    "呈现开放平台资源影响确认窗",
    ["0e765674026efce4.1"],
    "已有创建、账号动作、Webhook动作或投递重放意图等待确认时。",
    "调用共享确认组件展示当前对象和影响；取消不调用接口。",
    "确认窗本身不证明账号状态变化、外发回调或密钥更新。",
  ],
  [
    "OP60-CONFIRM",
    "write",
    "确认并发送当前Open Platform操作",
    ["7dff4b4ffb8ff617.1"],
    "共享确认组件发出confirm且当前pending操作存在时。",
    "仅confirm事件由既有confirm/call发送原path、method、body、同源与幂等头；cancel只清空pending。写响应与后续读取结果分开报告，202代表queued，一次性secret受当前组织/view生命周期约束。",
    "静态映射不证明platform_token:manage、同源/幂等、真实MySQL审计、密钥隔离或外部Worker/回调最终成功。",
  ],
];

function readSource() {
  return readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
}
function contractClaim(record) {
  return record.claim
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .at(-1);
}

export function buildP60ActionReview() {
  const source = readSource();
  const sourceHashes = { [sourceFile]: createHash("sha256").update(source).digest("hex") };
  const candidates = scanSource(source, sourceFile).candidates;
  const records = runContractAudit().records.filter(
    (record) =>
      record.document === contract &&
      record.sourceFile === sourceFile &&
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
    "P60 source candidates need current contract rows",
  );
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P60 candidate must have one semantic owner");
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P60 candidate ${record.candidateId}`);
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
    contractAliasReason: `沿用P60现有OP60源合同对${actionId}精确归属，不扩大平台权限、投递事件或密钥行为。`,
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining,
  }));
  const inputs = scanReviewSurfaces(source, sourceFile).inputs;
  const sourceHash = sourceHashes[sourceFile];
  return {
    schemaVersion: 1,
    pageId: "P60",
    route: "/platform-admin/open-platform",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs: inputs.length ? { [sourceFile]: inputs.map((input) => input.binding) } : {},
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P60调用共享OpenCreateDialog、OpenActionReasonDialog与ConfirmDialog；其内部字段、Tab/Escape/焦点及一次性密钥窗口生命周期按共享合同复验，本文件只映射消费者。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [sourceFile],
      dependencyHashes: sourceHashes,
      inputScope: "reviewed-subset-of-shared-source",
      inputs: [],
      containerScope: "reviewed-subset-of-shared-source",
      containers: [],
      sharedRemaining: [
        "本映射覆盖OpenPlatformCenter.vue页面候选；OpenCreateDialog、OpenActionReasonDialog、ConfirmDialog、ResponsiveDataView、TechnicalDetails与NavigationShell内部交互沿各自共享合同验收。",
      ],
      remaining: `源码映射不证明真实platform_token:manage、Client/Webhook的MySQL事务与审计、Worker外部投递、签名/密钥安全或M06-05生产验收。来源指纹SHA-256 ${sourceHash}。`,
    },
    compositionGaps: [
      "逐项覆盖OpenPlatformCenter.vue的44个当前候选；共享创建、原因、确认与详情子组件内部控件只交叉引用其自身合同。",
      "三个工作区及三个过滤/分页范围保持独立；读取、写后读取、HTTP 202与外部回调终态不得混为一谈。",
      "一次性密钥仅首次响应展示并受组织/view/生命周期归属保护；本映射不新增密钥存储或自动重试行为。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP60ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
