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
const target = `${base}/action-reviews/P58.json`;
const testFile = "tests/unit/ui-phase2-p58-action-review.test.mjs";
const sourceFile = "apps/web/src/components/CommercialOperationsCenter.vue";

const definitions = [
  [
    "CO58-LOAD",
    "read",
    "读取或刷新商业运营快照",
    ["c989a362f5cc118d.1", "d776ea6a30d93887.1"],
    "用户刷新当前商业运营视图或读取失败后重试时。",
    "调用既有load与GET；沿用URL中的组织、筛选和两个分页状态，失败保留已读快照。",
    "静态映射不证明真实会话、RBAC、服务端统计口径或生产读取成功。",
  ],
  [
    "CO58-NEW",
    "local",
    "从页面任一新建入口打开同一草稿窗",
    ["be51bdf2cdf9a55b.1", "63cd4281b5c9bba9.1"],
    "用户在页头或目录中请求新建方案时。",
    "设置现有creatingPlan窗口状态；不创建草稿、不启用方案，也不分配组织额度。",
    "打开窗口不证明后续POST、RBAC或幂等写入结果。",
  ],
  [
    "CO58-CURRENT-WORKSPACE",
    "local",
    "切换方案目录与组织配额工作区",
    ["97ebdc1b722c2d96.1", "dc703a87b7ae511f.1"],
    "用户选择方案目录或组织配额任务线时。",
    "只切换reviewTask本地视图，不触发组织读取或任何配额写入。",
    "本地视图切换不代表组织已经读取或授权。",
  ],
  [
    "CO58-ORG-READ",
    "read",
    "读取输入的组织配额范围",
    ["493a928ba76cfd75.1", "ad67cce2619c5349.1"],
    "组织ID表单提交且没有读取请求在途时。",
    "使用现有UUID输入、URL状态与页面GET读取组织、分配、用量和调整；不新增组织搜索接口。",
    "输入UUID及本地GET不证明组织身份或真实RBAC。",
  ],
  [
    "CO58-ORG-CLEAR",
    "read",
    "清除组织范围并返回全局方案目录",
    ["b48d0677e26f41b1.1"],
    "用户清除当前组织范围且读取空闲时。",
    "清除输入与组织URL参数、重置调整历史页并读取现有全局目录。",
    "清除范围不删除组织或配额数据。",
  ],
  [
    "CO58-SUSPEND",
    "local",
    "准备暂停当前组织配额",
    ["242e3015fcd7a833.1"],
    "当前分配可暂停且页面展示暂停入口时。",
    "准备既有版本化suspend POST、expected_version与原因并显示影响确认；点击本身不提交。",
    "确认窗打开不证明暂停已执行或审计已写入。",
  ],
  [
    "CO58-RESUME",
    "local",
    "准备恢复当前组织配额",
    ["13e46057d2fb04d8.1"],
    "当前分配可恢复且页面展示恢复入口时。",
    "准备既有版本化resume POST与原因并显示影响确认；点击本身不提交。",
    "确认窗打开不证明恢复已执行或额度已生效。",
  ],
  [
    "CO58-END",
    "local",
    "准备结束当前组织配额分配",
    ["dd38746d8ffdb0c3.1"],
    "当前分配未结束且页面展示结束入口时。",
    "准备既有版本化end POST与原因并显示影响确认；点击本身不提交。",
    "确认窗打开不证明分配已结束或外部限制已发生。",
  ],
  [
    "CO58-ASSIGN",
    "local",
    "准备首次分配或变更组织配额方案",
    ["b892a7fa2cef5f0a.1", "9e4e87ab21464529.1"],
    "组织已读取，用户提交方案、周期和原因表单时。",
    "按现有表单生成分配/变更确认意图；沿用当前页active方案及版本，暂不POST。",
    "预览中的额度影响不证明服务端有效额度或真实用量。",
  ],
  [
    "CO58-ADJUST",
    "local",
    "准备新增单计量项人工额度调整",
    ["ee61aee8d61107d7.1", "813b6f6555c53581.1"],
    "组织有未结束分配且调整量通过当前前端校验时。",
    "非零调整进入现有影响确认；保留计量项、有效期、原因和分配身份，不直接POST。",
    "本地预览不证明后端时间语义、当前有效额度或审计结果。",
  ],
  [
    "CO58-REVOKE",
    "local",
    "准备撤销当前页的一条活动调整",
    ["f89ab4cc10f2272c.1"],
    "当前调整记录原状态为active并显示撤销入口时。",
    "准备带expected_version及既有原因的撤销POST确认意图；只针对该调整记录。",
    "列表状态不证明此刻仍生效；准备意图不代表撤销完成。",
  ],
  [
    "CO58-ADJ-PAGE",
    "read",
    "翻阅组织调整历史的独立分页",
    ["30584d1112c65a3f.1", "dcf33a943a6cf78c.1"],
    "目标调整页处于服务端分页边界内且没有读取请求在途时。",
    "只更新adjustment_page并读取；不更改方案目录page。",
    "本地分页不验证服务端总数或历史记录完整性。",
  ],
  [
    "CO58-FILTER",
    "read",
    "查询商业方案目录筛选",
    ["6ccee5bf5f08a84f.1", "dd360735505349d1.1"],
    "用户提交查询或状态筛选且读取空闲时。",
    "保留现有query/status允许值，重置方案目录页并经GET读取；不作用于组织用量。",
    "筛选提交不证明服务端过滤语义或授权。",
  ],
  [
    "CO58-RESET",
    "read",
    "清空方案目录筛选",
    ["2f1b49bdefe2e793.1"],
    "读取空闲时用户请求重置筛选。",
    "清空query/status、回到目录第一页并读取当前方案目录。",
    "重置筛选不清理服务端数据。",
  ],
  [
    "CO58-EDIT-OPEN",
    "local",
    "打开所选方案的编辑草稿窗",
    ["b9b9138a457290a7.1"],
    "当前方案行提供编辑入口时。",
    "将当前已读方案字段与expected_version复制到本地编辑草稿，不发送请求。",
    "打开编辑器不证明版本仍然最新或有保存权限。",
  ],
  [
    "CO58-ACTIVATE",
    "local",
    "准备启用草稿方案",
    ["08f74ebab8ffdc18.1"],
    "当前行状态为draft且显示快捷启用入口时。",
    "以当前方案值和expected_version准备既有PATCH确认意图；不直接启用。",
    "启用入口不证明活动组织分配、写入或审计结果。",
  ],
  [
    "CO58-RETIRE",
    "local",
    "准备退役启用中的方案",
    ["3bb72b8a5d05954f.1"],
    "当前行状态为active且显示快捷退役入口时。",
    "以当前方案值和expected_version准备既有PATCH确认意图；不直接退役。",
    "退役入口不证明未来服务端分配行为或写入成功。",
  ],
  [
    "CO58-PAGE",
    "read",
    "翻阅方案目录独立分页",
    ["b80d8e0853709211.1", "56d050ac5ca9e0cd.1"],
    "目标方案目录页处于当前服务端分页边界内且读取空闲时。",
    "只更新page并读取；不更改调整历史页。",
    "本地分页不验证服务端COUNT、筛选语义或生产数据。",
  ],
  [
    "CO58-CREATE-DIALOG",
    "local",
    "呈现并关闭创建方案草稿窗",
    ["151c3c8c32d92c80.1", "30d28c64a162319d.1", "c172959eea18c58e.1", "64a8d5e746c9adce.1"],
    "创建窗口实例打开、关闭或收到原生cancel事件时。",
    "沿用原生dialog、现有关闭守卫和忙碌禁关行为；取消仅关闭窗口，不撤销已发事务。",
    "窗口结构和关闭不代表表单通过服务端校验或草稿已写入。",
  ],
  [
    "CO58-CREATE",
    "write",
    "提交新建配额方案草稿",
    ["de9a0d9bc0232967.1", "2be90b500fbc2735.1"],
    "创建字段通过浏览器约束且mutating=false时。",
    "仅由表单提交既有POST /platform/commercial/plans，带原字段、reason、Origin/幂等键所有者与忙碌保护；成功创建draft，不自动启用或分配。",
    "静态源映射不证明真实RBAC、未知POST结果策略、MySQL事务或审计。",
  ],
  [
    "CO58-EDIT-DIALOG",
    "local",
    "呈现、键盘关闭或取消编辑方案窗",
    ["2580b7a172938724.1", "fdd65c58da16291a.1", "be9bcd04e462aa25.1"],
    "编辑方案实例打开且尚未转换为影响确认时。",
    "使用现有原生dialog与Escape守卫；取消丢弃本地编辑草稿，不改方案。",
    "局部窗口映射不证明完整读屏、键盘和生产权限。",
  ],
  [
    "CO58-SAVE-PREPARE",
    "local",
    "将编辑表单转换为版本化保存确认意图",
    ["c272d770b0c006ce.1", "5dc1a96390934ee9.1"],
    "编辑字段通过表单约束并提交时。",
    "调用既有savePlan构造PATCH与expected_version/reason，关闭编辑窗并转入影响确认；此步不写入。",
    "预览影响不证明真实组织影响、版本有效或保存已执行。",
  ],
  [
    "CO58-CONFIRM-DIALOG",
    "local",
    "呈现或取消商业配额影响确认窗",
    ["d3b00b7eb8292418.1", "5a1af08abe5636bc.1", "53e49d44934e8397.1"],
    "任一既有商业写操作已准备pending意图时。",
    "展示当前影响快照；Escape或取消清空pending，不提交POST/PATCH。",
    "确认界面不证明影响计算与后端状态完全一致。",
  ],
  [
    "CO58-CONFIRM",
    "write",
    "确认并提交当前商业配额变更",
    ["5c175a797dcf657a.1", "0406cc973c1194af.1"],
    "存在pending操作且mutating=false，用户显式确认时。",
    "仅此确认表单调用pending中既有path/method/body及幂等键；写后重读快照并显示现有结果反馈。",
    "不代表真实platform:operate授权、MySQL事务/审计、请求未知处理或配额实际强制执行。",
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

export function buildP58ActionReview() {
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
    const old = recordsById.get(record.candidateId);
    if (old) assert.equal(contractClaim(old), contractClaim(record));
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P58 source candidates need current contract rows",
  );
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P58 candidate must have one semantic owner");
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = owner.get(signature);
    assert.ok(actionId, `unmapped P58 candidate ${record.candidateId}`);
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
    contractAliasReason: `沿用P58现有CO58源合同对${actionId}精确归属，不扩大商业范围、字段或API行为。`,
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining,
  }));
  const inputs = scanReviewSurfaces(source, sourceFile).inputs;
  const shared = [
    "本映射覆盖CommercialOperationsCenter.vue页面局部候选；共享NavigationShell、技术详情及基础样式组件内部交互不重复计入P58。",
  ];
  return {
    schemaVersion: 1,
    pageId: "P58",
    route: "/platform-admin/commercial",
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
        "页面定义创建、编辑、影响确认三个原生dialog；静态映射不替代真实浏览器焦点、读屏、RBAC、商业写入或审计验收。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [sourceFile],
      dependencyHashes: sourceHashes,
      inputScope: "reviewed-subset-of-shared-source",
      inputs: [],
      containerScope: "reviewed-subset-of-shared-source",
      containers: [],
      sharedRemaining: shared,
      remaining:
        "源码映射与既有本地测试不证明真实会话/RBAC、未知POST结果策略、MySQL事务审计、生产配额效果或完整M06-06验收。",
    },
    compositionGaps: [
      "逐项覆盖CommercialOperationsCenter.vue的43个当前候选；共享壳层和技术详情内部控件按共享合同处理。",
      "显式区分准备影响确认与确认提交；创建仅创建draft，其他组织/方案写操作均经现有影响确认。",
      "不推定未知POST结果可安全重提，不新增价格、计费、收费套餐、组织选择API或配额执行行为。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP58ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
