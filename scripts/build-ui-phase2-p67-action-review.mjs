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
const target = `${base}/action-reviews/P67.json`;
const testFile = "tests/unit/ui-phase2-p67-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/RedisResilienceCenter.vue"];

const definitions = [
  [
    "RD67-LOAD",
    "read",
    "读取或刷新 Redis 运行事实",
    ["58a7337b2cdfab3b.1"],
    "用户请求刷新当前Redis探针与韧性事实时。",
    "沿用既有单飞、15秒前端超时和快照/失败读取编号归属；不重启Redis、不清理键或发起恢复。",
    "读取成功/失败及保存的运行观测不等于真实恢复、MySQL零写入或全量Redis配置验收。",
  ],
  [
    "RD67-RETRY",
    "read",
    "在 Redis 读取失败后重新核验",
    ["a93553a3ba9aa8a6.1", "d45ddc5db7a2701f.1"],
    "已有成功快照刷新失败，或首次失败为非expired且非forbidden的可重试状态时。",
    "复用当前只读运行事实GET；失败/空响应追踪与保留快照追踪分开，不执行Redis写入。",
    "重新核验不证明探针、MySQL观测写入、权限或运行策略状态已恢复。",
  ],
  [
    "RD67-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "读取明确返回expired会话时。",
    "导航至现有登录入口；forbidden仍显示权限拒绝，不伪装为expired。",
    "导航不证明重新登录、platform:operate或审计权限已取得。",
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

export function buildP67ActionReview() {
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
      assert.match(contractClaim(record), /RD67-CURRENT-/u);
    recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P67 current local candidates need contract rows",
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
    "each P67 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P67 candidate ${record.candidateId}`);
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
      "依据P67 Redis韧性合同中的当前源控件身份归组；不扩展到重启、恢复、清键或配置修改。",
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
    pageId: "P67",
    route: "/platform-admin/redis",
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
          rationale: "父级平台管理入口拥有GET、权限、审计和登录状态；此处仅映射Redis专属页面控件。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale:
            "三个追踪披露/复制实例复用共享TechnicalDetails合同；P67只交叉引用，不重复占用共享候选。",
        },
      ],
      remaining:
        "父级读取所有者和共享技术披露/复制不重复计数；告警action_hint为文字，不是自动执行入口。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining:
        "P67无业务模态、抽屉、确认框或表单；三个技术详情/追踪披露点使用共享TechnicalDetails。",
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
        "TechnicalDetails三个调用方均只披露各自成功快照或最近失败追踪；共享组件交互按原合同复用。",
      ],
      remaining:
        "静态动作映射不证明真实Redis探针、MySQL审计、platform:operate/RBAC、故障恢复或正式M07-03验收。",
    },
    compositionGaps: [
      "P67当前仅4个页面本地候选：读取/两类重读/登录；共享TechnicalDetails的三个追踪消费者按相应快照或失败ID区分。",
      "无重启、恢复、清键、连接信息复制或配置变更按钮；告警提示仅文本，不自动执行。",
      "探针失败的零值是未知/占位，不是实测健康；采样、持久化与整体韧性结果互不替代。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP67ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
