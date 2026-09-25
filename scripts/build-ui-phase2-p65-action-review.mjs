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
const target = `${base}/action-reviews/P65.json`;
const testFile = "tests/unit/ui-phase2-p65-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/ReleaseRolloutCenter.vue"];

const definitions = [
  [
    "RL65-LOAD",
    "read",
    "读取或刷新当前发布事实",
    ["2e6f5b1858278d74.1"],
    "用户请求刷新当前发布/部署捕获事实时。",
    "沿用既有单飞只读load与当前构建身份，不发起发布、迁移、回滚或探针写入。",
    "本地读取不证明当前页面与生产构建一致，也不证明整套发布门已验收。",
  ],
  [
    "RL65-COVERAGE",
    "navigation",
    "由超管打开接口覆盖证据页",
    ["7e7fceb8ddc95b63.1"],
    "当前能力列表包含platform:superadmin且用户打开接口覆盖证据入口时。",
    "导航至既有 /platform-admin/api-coverage 路由，由目标路由再次执行权限检查；不触发发布或API探测。",
    "入口可见不证明目标路由授权、报告真实或接口覆盖验收通过。",
  ],
  [
    "RL65-RETRY",
    "read",
    "在发布事实读取失败后重新核验",
    ["a93553a3ba9aa8a6.1", "0227b741c3d451ee.1"],
    "已有成功快照刷新失败，或首次错误属于可重读且非登录/forbidden分支时。",
    "复用父级既有GET与读取归属；失败重读不切换release、不执行探针。",
    "重新核验不等于重新部署、重放迁移或自动回滚。",
  ],
  [
    "RL65-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "页面明确进入expired会话状态时。",
    "导航至既有登录入口；forbidden状态不伪装为过期或可重试。",
    "导航不证明重新认证、platform:operate或超管权限已取得。",
  ],
  [
    "RL65-NAV",
    "navigation",
    "跳转运行身份、历史观察及动作历史分区",
    ["9d42d660b274b4e7.1", "e6f6630b9e002351.1", "0745c7ca1efdbdf9.1"],
    "用户从页内目录选择当前发布管理分区时。",
    "滚动定位运行身份、历史观察、动作与历史锚点；不调用任何发布或回滚命令。",
    "页内导航仅浏览已加载事实，不证明历史动作可执行。",
  ],
  [
    "RL65-CONFIG-DETAIL",
    "local",
    "展开部署配置指纹详情",
    ["cc981fe4f655ae81.1"],
    "当前页面已读取并提供部署配置指纹披露入口时。",
    "仅展开已有字段，不读取环境文件、密钥、Cookie或服务器本地路径。",
    "指纹披露不等于配置来源独立核验或部署成功。",
  ],
  [
    "RL65-GATE-DETAIL",
    "local",
    "展开桌面/移动发布门指标及阻断原因技术详情",
    ["1c008f867673db60.1", "1c008f867673db60.2", "1c008f867673db60.3"],
    "当前发布事实提供门指标或阻断原因披露入口时。",
    "只展开当前release关联的已返回指标与代码；编号复制沿共享TechnicalDetails处理，不触发写入。",
    "展示门结果不证明真实生产运行、审计事务或正式发布签收。",
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

export function buildP65ActionReview() {
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
      assert.match(contractClaim(record), /RL65-CURRENT-/u);
    recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P65 current local candidates need contract rows",
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
    "each P65 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P65 candidate ${record.candidateId}`);
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
    contractAliasReason: "依据P65发布管理合同当前源身份归组；不将页面浏览控件解释为发布操作。",
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
    pageId: "P65",
    route: "/platform-admin/releases",
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
          rationale: "平台父级持有共享读取/登录归属，P65局部动作仅映射发布域现有组件。",
        },
        {
          file: "apps/web/src/components/ResponsiveDataView.vue",
          rationale:
            "发布门移动只读指标详情由共享组件实现，并已有共享动作映射；P65仅展示消费者语义。",
        },
        {
          file: "apps/web/src/components/TableViewControls.vue",
          rationale: "发布历史的列设置由多页共享表格控件承载，沿既有共享源映射，不重复登记。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale: "请求编号复制及技术披露为共享组件动作，P65的局部详情调用已单独映射。",
        },
      ],
      remaining:
        "父级请求、移动详情、列控制和编号复制沿共享合同引用；当前页面没有部署执行、探针、发布或回滚按钮。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P65只复用ResponsiveDataView的发布门指标只读详情；不含发布、回滚、迁移、批准或探针执行确认窗。",
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
        "P65本页只读指标详情、表格控件及技术编号复制由既有共享组件动作映射负责；本地门状态/详情披露不发业务写请求。",
      ],
      remaining:
        "静态映射不证明真实platform:operate、宝塔发布对象、数据库审计、签名探针、回滚或M07-05验收。",
    },
    compositionGaps: [
      "12个当前ReleaseRolloutCenter候选归入7组页面动作，区分刷新/重试、登录、超管导航、页内目录、配置指纹及发布门详情。",
      "write-probe为独立签名API，不是页面控件；本映射不生成签名、不调用、不部署、不迁移或回滚。",
      "页面展示历史部署捕获事实，不把历史门状态改写为当前构建证明或发布资格。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP65ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
