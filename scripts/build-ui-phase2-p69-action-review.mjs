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
const target = `${base}/action-reviews/P69.json`;
const testFile = "tests/unit/ui-phase2-p69-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/FileResilienceCenter.vue"];

const definitions = [
  [
    "FL69-LOAD",
    "read",
    "读取或刷新本机文件存储事实",
    ["cdc9d1538d58eb3c.1"],
    "用户请求刷新当前文件存储/恢复观测时。",
    "沿用既有15秒单飞、最多14秒服务端边界、取消信号与快照/失败追踪归属；不列目录、不下载、不修改文件。",
    "页面读取仍按服务合同检查三根并记录运行观测/审计，不代表真实文件完整性或生产恢复通过。",
  ],
  [
    "FL69-RETRY",
    "read",
    "在文件观测读取失败后重新核验",
    ["21c66441891be768.1", "6a87ca890e2cd293.1"],
    "已有快照刷新失败，或首次错误进入可重试且非expired/forbidden分支时。",
    "重用当前文件观测GET及取消传递；已有快照失败与首次失败编号不混用。",
    "重读不证明所有文件被抽检、真实权限ACL或第三根目录恢复资格。",
  ],
  [
    "FL69-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "读取明确返回expired会话时。",
    "导航至既有登录入口；forbidden保留权限拒绝语义。",
    "导航不证明重新认证、platform:operate或实际文件系统访问权限。",
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

export function buildP69ActionReview() {
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
    "P69 current local candidates need contract rows",
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
    "each P69 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P69 candidate ${record.candidateId}`);
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
    contractAliasReason: "依据P69文件韧性合同中的当前控件身份归组，保留受限只读观察范围。",
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
    pageId: "P69",
    route: "/platform-admin/files",
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
            "父级平台管理入口持有GET、platform:operate、错误/审计归属；本页只映射文件专属动作。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale:
            "三个请求编号详情/复制消费者使用共享技术详情合同；本页区分快照/失败编号，不重复归属共享源。",
        },
      ],
      remaining:
        "progress为只读容量指标，非按钮/可拖动滑块；父级读取、共享复制与技术披露不重复计数。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining:
        "P69无文件详情模态、目录浏览、删除/下载/恢复确认或表单；三个追踪位置复用共享TechnicalDetails。",
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
        "共享技术详情只披露请求ID；本页容量progress名称/值属于指标展示，不构成文件或目录交互动作。",
      ],
      remaining:
        "静态映射不证明真实文件系统权限、三根路径、SQL审计、抽样完整性、恢复或M07-03生产验收。",
    },
    compositionGaps: [
      "P69当前4个页内候选映射只读刷新、快照/首次错误两类重读与expired登录。",
      "三个原生progress展示basis points/10000的只读指标，不计按钮，不允许拖动/修改容量值。",
      "页面无文件浏览/下载/删除/恢复动作；unknown/不可用的10000占位不等于已测磁盘满。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP69ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
