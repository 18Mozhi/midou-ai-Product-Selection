import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/content-notification-evidence-contract-review.md`;
const target = `${base}/action-reviews/P63.json`;
const testFile = "tests/unit/ui-phase2-p63-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/ApiCoverageOperationCard.vue"];

const definitions = [
  [
    "P63-OP-CURRENT-EVIDENCE",
    "local",
    "展开当前 method/path 操作的五维验证证据",
    ["0555e1f79d8d4038.1"],
    "当前操作卡片提供原生证据披露入口时。",
    "仅展开父级已传入 operation 的正常、鉴权、参数、幂等、故障证据与 test_id/latest_result；不发请求、不运行接口验证。",
    "报告可关联或证据状态显示通过，不等于当前构建、真实生产报告、SQL/RBAC或正式验收通过。",
  ],
  [
    "P63-OP-CURRENT-TRACE",
    "local",
    "展开当前 method/path 操作的请求与追踪编号",
    ["57d520c8f4d3aa77.1"],
    "当前操作卡片提供原生技术追踪披露入口时。",
    "只展示父级传入 operation 的 request_id/trace_id；不重读报告、不发起接口调用或下载。",
    "编号存在不证明关联请求成功，也不代表真实运行链路、敏感信息审查或生产权限已验收。",
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

export function buildP63ActionReview() {
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
    "P63 current local candidates need contract rows",
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
    "each P63 local candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P63 candidate ${record.candidateId}`);
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
    contractAliasReason:
      "沿用P63接口覆盖证据合同的当前候选归属，不扩大到报告读取、接口探测或导出。",
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
    pageId: "P63",
    route: "/platform-admin/api-coverage",
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
          file: "apps/web/src/components/ApiCoverageDashboard.vue",
          rationale:
            "当前页面摘要与明细为纯展示，不含扫描器定义的本地交互候选；不把报告状态展示虚构为刷新或验收按钮。",
        },
        {
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale:
            "P63 父级拥有 superadmin 入口、GET/read、query/status 筛选、重试与共享移动筛选抽屉；由平台管理入口合同交叉引用，不重复占用跨域候选。",
        },
        {
          file: "apps/web/src/components/ResponsiveFilterDrawer.vue",
          rationale: "共享抽屉开关、键盘边界与应用事件已按共享组件源合同归属，不在 P63 重复登记。",
        },
      ],
      remaining:
        "父级读取/筛选调用与共享移动抽屉不重复计数；P63 本地仅有两项逐操作原生证据披露控件。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining:
        "P63 无业务详情弹窗；五维证据和追踪编号由各操作卡片原生 details/summary 展开。移动筛选抽屉属于共享父入口，不冒充本页独立弹窗。",
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
        "ApiCoverageDashboard.vue 当前无本地交互候选；父级 API 读取、筛选及 ResponsiveFilterDrawer 为共享管理中心消费者，需沿其合同验证。",
      ],
      remaining:
        "静态动作映射不证明真实受限报告、全258项API、六角色RBAC、SQL、五维生产探测或正式M07-03验收。",
    },
    compositionGaps: [
      "2个当前操作卡片候选分别映射五维证据和技术追踪原生披露；不计父级共享读取/筛选、报告摘要及数据展示为按钮。",
      "current仅表示method/path目录指纹可关联，不代表build SHA相同、每项验证通过、报告完整或生产权限已验收。",
      "父级查询/结果筛选不重新运行生产接口；不新增下载、探测、批准或报告写入入口。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP63ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
