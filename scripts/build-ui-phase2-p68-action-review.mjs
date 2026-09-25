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
const target = `${base}/action-reviews/P68.json`;
const testFile = "tests/unit/ui-phase2-p68-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/MySqlResilienceCenter.vue"];

const definitions = [
  [
    "MY68-LOAD",
    "read",
    "读取或刷新 MySQL 运行与恢复事实",
    ["99e387027e98dda9.1"],
    "用户请求刷新当前MySQL运行/恢复观测时。",
    "沿用既有15秒单飞、取消信号、请求追踪与快照边界；不执行SQL写入、迁移、备份或恢复。",
    "查看GET本身仍通过既有仓储写入观测/审计；页面不等于数据库零写入或实库资格验收。",
  ],
  [
    "MY68-RETRY",
    "read",
    "在 MySQL 读取失败后重新核验",
    ["21c66441891be768.1", "6a87ca890e2cd293.1"],
    "已有快照刷新失败，或首次错误进入可重试且非expired/forbidden分支时。",
    "沿用当前运行事实GET、请求ID与服务取消传播；不更改连接参数或恢复策略。",
    "重读成功不证明MySQL配置、RPO/RTO或恢复记录已满足生产发布门。",
  ],
  [
    "MY68-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "读取明确返回expired会话时。",
    "导航至既有登录入口；forbidden保持权限拒绝反馈，不误示登录重试。",
    "导航不证明重新认证、platform:operate或数据库审计权限已取得。",
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

export function buildP68ActionReview() {
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
    "P68 current local candidates need contract rows",
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
    "each P68 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P68 candidate ${record.candidateId}`);
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
    contractAliasReason: "依据P68 MySQL运行合同当前控件身份归组，保持只读GET边界。",
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
    pageId: "P68",
    route: "/platform-admin/mysql",
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
            "父级持有platform:operate入口、GET、权限/审计和登录状态；P68只映射页面专属读取控件。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale:
            "三个请求编号展开/复制消费者复用共享组件；P68按成功快照/失败读取追踪区分语义，不重复占有共享候选。",
        },
      ],
      remaining:
        "父级读取所有者与共享技术详情/复制不重复计数；本页不提供SQL/迁移/参数/备份/恢复写入口。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining:
        "P68没有业务模态、抽屉、确认框、表单或表格设置；三处技术追踪使用共享TechnicalDetails。",
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
        "TechnicalDetails调用分别保留当前成功快照/失败读取追踪归属；共享复制器不承载MySQL修改动作。",
      ],
      remaining:
        "静态映射不证明MySQL 5.7真实配置、数据库权限/审计、恢复能力、宝塔环境或正式M07-03验收。",
    },
    compositionGaps: [
      "P68当前4个局部候选映射为只读刷新、两个错误重读分支与expired登录；无筛选、分页、排序或业务表单。",
      "SQL执行、迁移、连接参数修改、备份/恢复不是页面动作，不由 `action_hint` 文本推导新入口。",
      "RPO/RTO、窗口累计与未知/零值保持服务事实，不因视觉状态推断生产恢复资格。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP68ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
