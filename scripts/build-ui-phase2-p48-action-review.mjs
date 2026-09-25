import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/source-channel-credential-contract-review.md`;
const target = `${base}/action-reviews/P48.json`;
const testFile = "tests/unit/ui-phase2-p48-action-map.test.mjs";
const sourceFiles = [
  "apps/web/src/components/ProviderCompatibilityMatrixDialog.vue",
  "apps/web/src/components/ProviderParserSampleDialog.vue",
  "apps/web/src/components/ProviderParserSampleReview.vue",
  "apps/web/src/components/ProviderSourceCenter.vue",
  "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  "apps/web/src/components/ProviderSourceDirectory.vue",
  "apps/web/src/components/ProviderSourceEditDialog.vue",
  "apps/web/src/components/ProviderSourceFilters.vue",
  "apps/web/src/components/ProviderSourceVersionHistoryDialog.vue",
];

const definitions = {
  "SC48-LOAD": {
    actionId: "SC48-LOAD",
    label: "来源目录读取、刷新与恢复",
    kind: "read",
    condition: "目录首次读取、用户明确刷新，或当前错误状态提供重读入口时。",
    handler:
      "调用现有来源目录 GET；查询失败时保留可用旧快照并显示本次读取追踪。恢复按钮只重读，不触发即时采集或 provider-sources/refresh。",
    remaining: "本地拦截与静态合同不证明真实角色授权、生产读取范围或后端数据正确性。",
  },
  "SC48-LOAD/LOGIN": {
    actionId: "SC48-LOAD-OR-LOGIN",
    label: "按目录失败状态重新读取或重新登录",
    kind: "local",
    contractAliasReason: "同一条件按钮依据当前失败状态选择现有目录重读或登录导航，不合并为服务端写入。",
    condition: "目录失败反馈可见且非读取中。",
    handler: "按现有状态调用目录 GET，或导航至登录页；不重发任何来源配置或采集请求。",
    remaining: "真实会话失效、平台角色与服务端授权仍需独立验证。",
  },
  "SC48-DEFINE": {
    actionId: "SC48-DEFINE",
    label: "进入来源规则目录",
    kind: "navigation",
    condition: "P48 来源目录头部入口可见。",
    handler: "使用现有 RouterLink 导航到来源规则目录 P46；不在 P48 创建或修改来源定义。",
    remaining: "客户端路由可达不证明目标路由的真实角色授权。",
  },
  "SC48-FILTER": {
    actionId: "SC48-FILTER",
    label: "展开筛选与更新本地筛选条件",
    kind: "local",
    condition: "来源筛选区可见。",
    handler: "受控表单阻止原生提交；筛选展开状态和七类查询值交由既有父组件本地过滤/排序，不构造外部采集请求。",
    remaining: "本映射确认源码边界，不代表所有字段组合、URL后退前进或真实浏览器全状态均已验收。",
  },
  "SC48-QUERY": {
    actionId: "SC48-QUERY",
    label: "按来源名称或关键字筛选",
    kind: "local",
    condition: "搜索框可编辑。",
    handler: "更新既有受控搜索值并转发给父组件执行本地目录过滤。",
    remaining: "不扩大为后端全文检索或即时采集请求。",
  },
  "SC48-CATEGORY": {
    actionId: "SC48-CATEGORY",
    label: "按来源业务类别筛选",
    kind: "local",
    condition: "类别筛选字段可见。",
    handler: "转发既有类别值，由当前目录逻辑本地过滤。",
    remaining: "筛选值不改变来源启用或准入规则。",
  },
  "SC48-AVAILABILITY": {
    actionId: "SC48-AVAILABILITY",
    label: "按目录准备/接入状态筛选",
    kind: "local",
    condition: "准备/接入状态筛选字段可见。",
    handler: "转发既有状态值，由当前目录逻辑本地过滤。",
    remaining: "状态筛选不代表服务端授权或来源真实可用。",
  },
  "SC48-MARKET": {
    actionId: "SC48-MARKET",
    label: "按市场筛选",
    kind: "local",
    condition: "父组件提供的市场选项可见。",
    handler: "将既有市场值交给父组件本地过滤，不派生新的市场支持范围。",
    remaining: "不推断目录外部来源覆盖。",
  },
  "SC48-LANGUAGE": {
    actionId: "SC48-LANGUAGE",
    label: "按语言筛选",
    kind: "local",
    condition: "父组件提供的语言选项可见。",
    handler: "将既有语言值交给父组件本地过滤。",
    remaining: "不推断目录外部来源覆盖。",
  },
  "SC48-ACCESS": {
    actionId: "SC48-ACCESS",
    label: "按来源接入模式筛选",
    kind: "local",
    condition: "五种现有接入模式筛选字段可见。",
    handler: "转发既有接入模式筛选值，由父组件本地过滤。",
    remaining: "显示筛选项不新增接入模式或修改安全策略。",
  },
  "SC48-SORT": {
    actionId: "SC48-SORT",
    label: "按业务顺序、待配置、名称或最近成功排序",
    kind: "local",
    condition: "排序选择字段可见。",
    handler: "转发现有排序枚举，由目录视图对已读记录本地排序。",
    remaining: "不改变服务端分页或来源资格判定。",
  },
  "SC48-RESET": {
    actionId: "SC48-RESET",
    label: "恢复筛选默认值",
    kind: "local",
    condition: "筛选区域中重置入口可见。",
    handler: "请求父组件按既有默认值重置筛选；保留 provider_id 等既有路由定位参数。",
    remaining: "重置筛选不等同于返回未限定的全目录。",
  },
  "SC48-PAGE": {
    actionId: "SC48-PAGE",
    label: "来源目录分页",
    kind: "local",
    condition: "有多页结果且对应上一页/下一页可用。",
    handler: "将现有分页意图转给父级，并按当前路由查询读取对应来源目录页。",
    remaining: "隔离测试不证明服务端记录总数或生产分页范围。",
  },
  "SC48-LINK": {
    actionId: "SC48-LINK",
    label: "打开来源 HTTPS 页面",
    kind: "navigation",
    condition: "已登记来源详情包含有效 HTTPS 地址。",
    handler: "打开记录中已登记的 HTTPS 来源页面；不构造或替换目标地址。",
    remaining: "外部站点内容与可用性不由本页验证。",
  },
  "SC48-PROBE": {
    actionId: "SC48-PROBE",
    label: "匿名来源健康烟测",
    kind: "write",
    condition: "仅当已登记公开来源满足现有烟测条件时可触发。",
    handler: "调用现有匿名探针 POST；该操作可能触达外部来源，不是即时采集，不降低来源启用门槛。",
    remaining: "此审阅不批准真实外部请求；须另行验证RBAC、限流、幂等和真实来源结果。",
  },
  "SC48-CONFIG": {
    actionId: "SC48-CONFIG",
    label: "编辑来源采集配置及读取回执",
    kind: "write",
    condition: "用户具备现有配置权限，且来源记录允许打开配置窗。",
    handler:
      "保留 schedule_minutes、timeout_ms、retry_limit、status、reason 与 expected_version 合同。启用公开来源仍先保存停用态、再执行真实烟测，只有 ready 才能以新版本继续启用；部分保存和写后读取失败分别反馈且不自动重发。",
    remaining: "本地用例不证明真实 provider:configure、MySQL版本竞争、外部烟测或审计持久化。",
  },
  "SC48-CONFIG/VERSIONS": {
    actionId: "SC48-CONFIG-VERSION-DIALOG-WIRING",
    label: "配置编辑与版本窗父子事件接线",
    kind: "wiring",
    contractAliasReason: "父级将配置与版本窗的现有属性/事件分开转发至各自子组件，不新增业务动作。",
    condition: "P48来源目录拥有当前来源及对应弹窗状态。",
    handler: "仅转发已存在的配置编辑、读取、保存、版本读取及回滚事件。",
    forwardsTo: ["SC48-CONFIG", "SC48-VERSIONS"],
    remaining: "事件接线映射不证明真实写入或角色权限。",
  },
  "SC48-VERSIONS": {
    actionId: "SC48-VERSIONS",
    label: "查看配置历史并按版本回滚",
    kind: "write",
    condition: "存在可读取的配置历史；仅可回滚项展示回滚操作。",
    handler:
      "读取既有版本列表；回滚提交 target_version、expected_version 与 reason，生成新当前版本，不改写历史。结果追踪和恢复入口只重读目录/历史，不重复 POST。",
    remaining: "隔离用例不证明生产并发冲突、RBAC或MySQL审计结果。",
  },
  "SC48-COMPAT": {
    actionId: "SC48-COMPAT",
    label: "只读查看来源解析兼容矩阵",
    kind: "read",
    condition: "指定来源存在兼容矩阵入口。",
    handler:
      "打开并读取当前适配器版本与保留期内的页面 DOM/HTML 版本证据；只披露摘要、状态和指纹，不读取或展示页面正文。",
    remaining: "读取失败、真实外部页面和保留策略仍需真实环境验证；矩阵不触发采集或自动启用。",
  },
  "SC48-LOGIN": {
    actionId: "SC48-LOGIN",
    label: "进入指定来源网页登录凭证",
    kind: "navigation",
    condition: "来源记录需要网页登录凭证且入口可见。",
    handler: "导航到该来源既有凭证导入深链，沿用现有权限和凭证管理流程。",
    remaining: "不在P48读取、展示或生成Cookie与凭证秘密。",
  },
  "SC48-SAMPLES": {
    actionId: "SC48-SAMPLES",
    label: "固定样本、快照回放与独立复核",
    kind: "write",
    condition: "仅提供真实浏览器作业候选；创建、回放和独立复核分别满足已有服务端条件。",
    handler:
      "固定真实作业快照；回放只重解析已保存快照并记录差异，不启动外部浏览器重采；另一管理员按 review_version 与原因提交审批。回放通过不等于审批通过，也不自动启用来源。",
    remaining: "本地合成响应不证明真实browser_job_id、独立管理员身份、权限、存储或外部浏览器执行。",
  },
  "SC48-ACCEPT": {
    actionId: "SC48-ACCEPT",
    label: "进入1688登录准备检查",
    kind: "navigation",
    condition: "1688来源记录展示启用准备入口。",
    handler: "导航至既有P49门禁检查路由；不在P48绕过检查或直接启用来源。",
    remaining: "真实门禁证据及资格由P49和服务端合同判定。",
  },
  "SC48-PAGE/PROBE/CONFIG/COMPAT/VERSIONS/LOGIN/SAMPLES": {
    actionId: "SC48-DIRECTORY-EVENT-WIRING",
    label: "目录行操作父级事件转发",
    kind: "wiring",
    contractAliasReason: "ProviderSourceDirectory 只转发目录、探针、配置、矩阵、版本、凭证与样本事件至各自现有处理器，不新增来源业务动作。",
    condition: "来源行详情按状态展示对应现有操作。",
    handler: "逐项转发当前行 provider_id 与已有操作意图；资格检查仍由现有组件/API执行。",
    forwardsTo: [
      "SC48-PAGE",
      "SC48-PROBE",
      "SC48-CONFIG",
      "SC48-COMPAT",
      "SC48-VERSIONS",
      "SC48-LOGIN",
      "SC48-SAMPLES",
    ],
    remaining: "目录子组件的事件转发本身不构成新的权限、采集或来源启用能力。",
  },
  "SC48-DETAIL-OPEN": {
    actionId: "SC48-DETAIL-OPEN",
    label: "展开来源行内详情",
    kind: "local",
    sourceContractKeys: ["目录本地详情展开；无API或持久化副作用"],
    contractAliasReason: "现有合同明确这是目录本地详情状态，不对应API或持久化业务动作。",
    condition: "来源目录行可见且未展开。",
    handler: "在当前目录行内展开记录详情并保留触发项焦点归属。",
    remaining: "不另发详情读取请求。",
  },
  "SC48-DETAIL-CLOSE": {
    actionId: "SC48-DETAIL-CLOSE",
    label: "收起来源行内详情",
    kind: "local",
    sourceContractKeys: ["目录本地详情收起并返回触发点"],
    contractAliasReason: "现有合同明确这是目录本地详情状态，不对应API或持久化业务动作。",
    condition: "当前来源详情已展开。",
    handler: "收起当前来源行内详情并将焦点返回对应触发入口。",
    remaining: "不改变筛选、URL或来源记录。",
  },
};

const groupOrder = [
  "SC48-LOAD",
  "SC48-LOAD/LOGIN",
  "SC48-DEFINE",
  "SC48-FILTER",
  "SC48-QUERY",
  "SC48-CATEGORY",
  "SC48-AVAILABILITY",
  "SC48-MARKET",
  "SC48-LANGUAGE",
  "SC48-ACCESS",
  "SC48-SORT",
  "SC48-RESET",
  "SC48-PAGE",
  "SC48-LINK",
  "SC48-PROBE",
  "SC48-CONFIG",
  "SC48-CONFIG/VERSIONS",
  "SC48-VERSIONS",
  "SC48-COMPAT",
  "SC48-LOGIN",
  "SC48-SAMPLES",
  "SC48-ACCEPT",
  "SC48-PAGE/PROBE/CONFIG/COMPAT/VERSIONS/LOGIN/SAMPLES",
  "SC48-DETAIL-OPEN",
  "SC48-DETAIL-CLOSE",
];

export function buildP48ActionReview() {
const sourceText = Object.fromEntries(
  sourceFiles.map((file) => [file, readFileSync(file, "utf8").replaceAll("\r\n", "\n")]),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceText).map(([file, source]) => [
    file,
    createHash("sha256").update(source).digest("hex"),
  ]),
);
const candidates = Object.entries(sourceText).flatMap(([file, source]) =>
  scanSource(source, file).candidates,
);
const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
const localDetailKeys = new Map([
  ["目录本地详情展开；无API或持久化副作用", "SC48-DETAIL-OPEN"],
  ["目录本地详情收起并返回触发点", "SC48-DETAIL-CLOSE"],
]);
const rawP48Records = runContractAudit().records.filter(
  (record) =>
    record.document === contract &&
    sourceFiles.includes(record.sourceFile) &&
    record.temporalScope !== "historical" &&
    ["identity-current", "line-moved"].includes(record.status),
);
const recordsByCandidate = new Map();
for (const record of rawP48Records) {
  const previous = recordsByCandidate.get(record.candidateId);
  if (previous)
    assert.equal(
      previous.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1),
      record.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1),
      `conflicting current P48 contract claims for ${record.candidateId}`,
    );
  else recordsByCandidate.set(record.candidateId, record);
}
const p48Records = [...recordsByCandidate.values()];
assert.equal(p48Records.length, candidates.length, "P48 source scope requires one current contract per candidate");
assert.deepEqual(
  p48Records.map((record) => record.candidateId).sort(),
  candidates.map((candidate) => candidate.candidateId).sort(),
  "P48 mapping source set differs from current Vue candidates",
);

const groups = new Map(groupOrder.map((key) => [key, []]));
const claimByCandidate = new Map();
for (const record of p48Records) {
  const claim = record.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1);
  const match = claim.match(/^(SC48-[A-Z]+(?:-[A-Z]+)*(?:\/[A-Z]+(?:-[A-Z]+)*)*)\s*\//u);
  const key = match?.[1] ?? localDetailKeys.get(claim);
  assert.ok(key && groups.has(key), `unclassified P48 source contract: ${claim}`);
  groups.get(key).push(record.candidateId);
  claimByCandidate.set(record.candidateId, claim);
}
for (const [key, ids] of groups) {
  assert.ok(ids.length, `empty P48 semantic group ${key}`);
  ids.sort();
}

const visualStates = Object.fromEntries(
  ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
    state,
    "not-mapped",
  ]),
);
const targetForGroup = (key) => {
  const definition = definitions[key];
  assert.ok(definition, `missing P48 action definition ${key}`);
  return definition.actionId;
};
const actions = groupOrder.map((key) => {
  const definition = definitions[key];
  const action = {
    actionId: definition.actionId,
    label: definition.label,
    kind: definition.kind,
    sourceCandidateIds: groups.get(key),
    condition: definition.condition,
    handler: definition.handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "actual-vue-review-fixture" }],
    remaining: definition.remaining,
  };
  action.sourceContractKeys = [
    ...new Set(groups.get(key).map((candidateId) => claimByCandidate.get(candidateId))),
  ];
  action.contractAliasReason =
    definition.contractAliasReason ??
    `现有合同对${definition.actionId}的源位置分别说明；此组仅按相同业务语义归并，不扩大动作范围。`;
  if (definition.forwardsTo) {
    action.forwardsTo = definition.forwardsTo.map((target) =>
      definitions[target] ? targetForGroup(target) : target,
    );
    action.forwardBindings = groups.get(key).flatMap((candidateId) => {
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
  if (surfaces.inputs.length)
    inputs[file] = surfaces.inputs.map((input) => input.binding);
}
const review = {
  schemaVersion: 1,
  pageId: "P48",
  route: "/platform-admin/providers/sources",
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
      "四个本地业务 role=dialog 为配置编辑、配置历史、固定样本和兼容矩阵；固定样本窗内另含独立复核子窗。来源行详情是页内展开，不另算弹窗。映射不代表所有字段、错误、焦点及角色组合均已运行验收。",
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
      "此合同只纳入P48路由的九个本地Vue组件；不扩大到ProviderRuntimeSurface、NavigationShell或P49/P50共享路由消费者。",
    ],
    remaining:
      "自建弹窗的DOM焦点、Tab/Escape及父级事件转发需以各自实际Vue用例验证；此源映射不代替无障碍、浏览器历史、KeepAlive或服务端角色验收。",
  },
  compositionGaps: [
    "本登记逐项覆盖九个P48本地Vue源文件的当前83个扫描候选；候选归组依据现有SC48合同，不把候选数当作独立按钮或业务动作总数。",
    "来源规则登记、即时采集、关闭来源、绕过1688门禁均不是P48入口，不因API或其他页面能力而新增。",
    "烟测可能触达外部来源；固定样本创建、快照回放、另一管理员复核是不同写入阶段；本次未执行真实请求。",
    "用户全局视觉授权仅记录在visualApproval；actionApproval、全状态交互、真实RBAC/MySQL/外部来源和正式M07-03生产验收仍未通过。",
  ],
};

assert.equal(candidates.length, 83, "unexpected P48 local source-candidate count");
assert.equal(new Set(actions.map((action) => action.actionId)).size, actions.length);
return review;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP48ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
