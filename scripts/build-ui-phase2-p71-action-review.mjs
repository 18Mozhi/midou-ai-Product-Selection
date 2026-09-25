import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/scheduler-capacity-contract-review.md`;
const target = `${base}/action-reviews/P71.json`;
const testFile = "tests/unit/ui-phase2-p71-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/CapacityBoundaryCenter.vue",
  "apps/web/src/components/CapacityBoundaryEvidence.vue",
];

const definitions = [
  [
    "SC71-LOAD",
    "read",
    "读取或刷新容量边界实测事实",
    ["d0414c44eef669b6.1", "4f73abdd0d99fc21.1", "26fe2d5165472bca.1"],
    "用户请求刷新，或在保留快照/首次读取失败后主动重读时。",
    "沿用当前GET与既有读取状态/快照归属；页面会写api_view及平台审计，刷新不是零写入，也不执行压测或恢复。",
    "读取成功不证明同提交签名、实际并发容量、生产权限或隔离恢复通过。",
  ],
  [
    "SC71-ATTEST",
    "write",
    "确认签认归档与隔离恢复演练",
    ["811287f91562f61d.1", "bad94329bde0aecb.1", "0db1bef96a99927a.1"],
    "用户打开现有确认窗、输入既有确认词并明确提交时。",
    "打开不写入，取消仅关闭本地窗口；确认后沿现有body、reason及Idempotency-Key发POST。服务端只验证已存在的归档/恢复证据并记录签认，不启动压测或恢复执行器。",
    "失败或网络未知不证明未签认；服务与仓储当前未证明观测新鲜度、同提交绑定、真实权限/审计或并发幂等验收。",
  ],
  [
    "SC71-FINDING-TECH",
    "local",
    "展开当前容量发现代码与责任角色",
    ["1c008f867673db60.1"],
    "当前容量事实返回发现项并由用户展开技术详情时。",
    "只披露当前响应中的发现代码与角色标签；不读取、不签认、不测量，也不展示原始测量样本或伪造签名。",
    "角色标签不是具体责任人；发现文本不能替代原始采样、构建身份或权限证明。",
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

export function buildP71ActionReview() {
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
  assert.equal(recordsById.size, candidates.length, "P71 current candidates need contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P71 current candidate must have one owner");
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P71 candidate ${record.candidateId}`);
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
      "依据P71容量边界当前源候选与已核对的容量合同逐项归组；未扩展到测量或恢复执行器。",
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
    pageId: "P71",
    route: "/platform-admin/capacity",
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
          file: "apps/web/src/components/ConfirmDialog.vue",
          rationale:
            "确认词/影响说明/取消控件为共享确认组件；P71仅映射本页打开、取消/确认接线与调用点，不重复占用共享候选。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale: "请求ID展示/复制由共享详情组件合同覆盖；本页finding details仅归本地发现动作。",
        },
        {
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale: "父级持有GET、platform:operate授权、错误与审计边界；不重复映射为P71页面候选。",
        },
      ],
      remaining:
        "两类刷新错误重试归入同一现有GET；三处确认候选是开窗、事件绑定和组件调用，并非三次写入。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "仅现有归档与隔离恢复签认确认窗；取消不POST、确认沿现有body。共享焦点细节引用共享合同，不增加测量或恢复弹窗。",
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
        "确认焦点/确认词键盘行为与请求编号复制由共享组件合同覆盖；P71 progress及证据数字均为只读显示。",
      ],
      remaining:
        "静态映射与夹具测试不证明真实容量、签认SQL/并发/审计、RBAC、同提交测量或正式M08-06生产验收。",
    },
    compositionGaps: [
      "P71当前7个本页候选归为容量GET/重读、签认POST与本地发现披露三类动作；共享确认和请求详情内部控件单独引用。",
      "刷新/重读可能写入既有观测及审计；签认只记录对已存在证据的认可，不运行压测、备份或恢复。",
      "规划用户、显示参考线及封顶进度条不构成容量承诺或主机资源占比；缺少SHA/签名不应补画证明。",
      "真实新鲜度、观测/签认记录绑定、事务并发与实际生产验收缺口继续保留。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP71ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
