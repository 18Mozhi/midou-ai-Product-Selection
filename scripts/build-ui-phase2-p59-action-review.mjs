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
const target = `${base}/action-reviews/P59.json`;
const testFile = "tests/unit/ui-phase2-p59-action-review.test.mjs";
const sourceFile = "apps/web/src/components/SecurityOperationsCenter.vue";

const definitions = [
  [
    "SO59-WINDOW",
    "read",
    "切换安全事件与审计时间范围",
    ["4e1ce57777a6a035.1"],
    "用户选择24小时、7天或30天时间范围时。",
    "沿用当前时间窗并调用既有GET；时间窗只影响事件与审计，生命周期集合的范围不变。",
    "范围控件不证明数据库事件完整或所有集合都按时间筛选。",
  ],
  [
    "SO59-LOAD",
    "read",
    "刷新或重试当前安全运营读取",
    ["30a2ab0920048786.1", "282785221153ab14.1"],
    "用户刷新当前视图或在读取错误区域重试时。",
    "复用既有refresh/GET、单飞与当前URL范围；不执行安全处置写操作。",
    "页面读取会由服务写入安全读取审计；静态映射不证明真实权限、HTTP或审计持久化。",
  ],
  [
    "SO59-TECH",
    "local",
    "展开当前安全记录已有技术详情",
    [
      "1c008f867673db60.1",
      "1c008f867673db60.2",
      "1c008f867673db60.3",
      "1c008f867673db60.4",
      "1c008f867673db60.5",
      "1c008f867673db60.6",
      "1c008f867673db60.7",
      "1c008f867673db60.8",
      "1c008f867673db60.9",
      "1c008f867673db60.10",
      "1c008f867673db60.11",
    ],
    "当前记录提供原生details/summary或只读移动详情入口时。",
    "披露GET快照已经返回的关联字段；移动详情沿用五个ResponsiveDataView消费者，不新增读取或安全处置。",
    "披露不证明敏感字段服务端脱敏、移动模态完整读屏或焦点生命周期已全部验收。",
  ],
  [
    "SO59-VIEW",
    "navigation",
    "切换事件、会话、访问凭证或审计调查视图",
    ["904af42413d62768.1"],
    "用户选择四个安全调查视图之一时。",
    "沿用现有RouterLink与路由query状态；只查询当前view，不新增会话撤销、凭证写入或令牌管理。",
    "视图导航不证明目标数据存在或当前身份获准读取。",
  ],
  [
    "SO59-FILTER",
    "read",
    "提交当前安全调查视图搜索与状态条件",
    ["75aeba3a14cd8c5d.1", "36c7b60823abfadf.1"],
    "查询字段及当前view允许的状态值提交时。",
    "复用现有字段/状态选项并按URL读取当前view；搜索语义按当前实体，不扩成其他编号或原始UA。",
    "提交筛选不证明服务端语义、记录总数或跨视图数据授权。",
  ],
  [
    "SO59-RESET",
    "read",
    "清除当前调查视图筛选",
    ["19551c617c5e26da.1"],
    "用户请求重置当前view查询与状态条件时。",
    "沿用resetFilters清除查询状态和分页并重读当前view；时间窗保持既有逻辑。",
    "重置只改变查询范围，不撤销安全对象或删除记录。",
  ],
  [
    "SO59-PAGE",
    "read",
    "翻阅事件、会话、凭证或审计当前视图分页",
    [
      "530875d018a16137.1",
      "59622af06082395d.1",
      "530875d018a16137.2",
      "59622af06082395d.2",
      "530875d018a16137.3",
      "59622af06082395d.3",
      "530875d018a16137.4",
      "59622af06082395d.4",
    ],
    "当前view分页元数据提供有效上一页或下一页且没有请求在途时。",
    "每个view复用main分页游标；凭证view仍与组织令牌游标分开。",
    "本地翻页不证明服务端COUNT或历史集合完整。",
  ],
  [
    "SO59-TOKEN-PAGE",
    "read",
    "翻阅组织令牌独立分页",
    ["dfefdc60704cd1d6.1", "56cd5b08b7c47c21.1"],
    "凭证/令牌视图存在可用组织令牌目标页时。",
    "只更新token游标并发起当前view GET；不与凭证主列表page合并。",
    "独立控件不证明report:read授权或令牌集合已完整读取。",
  ],
  [
    "SO59-MANAGE",
    "navigation",
    "前往独立授权的凭证与档案管理页",
    ["a55873d215f3efac.1"],
    "安全运营页展示凭证管理入口时。",
    "只导航到既有凭证管理路由，由目标页重新执行既有授权。",
    "入口不授予platform:operate，也不代表凭证已查看、修改或撤销。",
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

export function buildP59ActionReview() {
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
    "P59 source candidates need current contract rows",
  );
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P59 candidate must have one semantic owner");
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P59 candidate ${record.candidateId}`);
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
    contractAliasReason: `沿用P59现有SO59源合同对${actionId}精确归属，不扩大安全数据、查询或处置行为。`,
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining,
  }));
  const inputs = scanReviewSurfaces(source, sourceFile).inputs;
  const sourceFiles = [sourceFile];
  const sourceHash = sourceHashes[sourceFile];
  return {
    schemaVersion: 1,
    pageId: "P59",
    route: "/platform-admin/security",
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
        "页面通过5个ResponsiveDataView消费者提供移动详情，不定义局部dialog；共享组件初焦点/Tab/Escape/返焦只按现有消费者证据，不由本映射重复验收。",
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
        "本映射覆盖SecurityOperationsCenter.vue页面局部候选；五处ResponsiveDataView、TechnicalDetails、TableViewControls与NavigationShell内部交互沿各自共享合同验收。",
      ],
      remaining: `静态映射不证明真实platform:secure最小角色、GET事务写入security_operations_views/platform.security.operations.read、MySQL审计、完整读屏或M06-04生产验收。来源指纹SHA-256 ${sourceHash}。`,
    },
    compositionGaps: [
      "逐项覆盖SecurityOperationsCenter.vue的29个当前扫描候选；ResponsiveDataView五消费者作为共享合同交叉引用，不另计局部源按钮。",
      "事件与审计时间窗、四视图主分页、组织令牌独立分页保持不同范围；摘要不替代结果集合。",
      "GET可能事务写读取审计；不新增会话撤销、凭证写入、平台令牌管理或零数据库写入声明。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP59ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
