import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/shared-shell-role-state-contract-review.md`;
const target = `${base}/action-reviews/P73.json`;
const testFile = "tests/unit/ui-phase2-p73-action-review.test.mjs";
const sourceFiles = ["apps/web/src/components/NotFoundPage.vue"];
const definitions = [
  [
    "NF-BRAND",
    "navigation",
    "从404恢复页返回主页",
    ["ad49e2f05ad189d6.1"],
    "用户点击页面品牌链接时。",
    "通过当前RouterLink导航到固定/home入口，不回退浏览器history。",
    "离开404页后目标页面的请求/会话权限不属于本页零API结论。",
  ],
  [
    "NF-RETURN",
    "navigation",
    "返回最近有效的已登记页面",
    ["0b84761726a96f8e.1"],
    "未知路径页始终提供主恢复入口时。",
    "使用导航记忆解析且已由router.resolve接受的recentDestination.fullPath；未登记/解析失败回/home；不修改storage。",
    "导航记忆检查不等于完整URL安全、跨账号隔离、目标会话有效或HTTP状态为404。",
  ],
  [
    "NF-HOME",
    "navigation",
    "最近目标不是主页时提供独立主页入口",
    ["7ed277e44773eac9.1"],
    "仅当recentDestination.path不等于/home时显示次链接。",
    "使用固定/home RouterLink；主页query不会被本次导航链接注入。",
    "条件入口不证明目的页面已登录、获授权或目标请求成功。",
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

export function buildP73ActionReview() {
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
  const recordsById = new Map(records.map((record) => [record.candidateId, record]));
  assert.equal(recordsById.size, candidates.length, "P73 current candidates need contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P73 current candidate must have one owner");
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P73 candidate ${record.candidateId}`);
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
      "依据P73公开fallback当前源码与共享壳层/恢复合同逐项归组，不扩展到目标页面行为。",
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
    pageId: "P73",
    route: "/:pathMatch(.*)*",
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
          file: "apps/web/src/App.vue",
          rationale:
            "公开fallback选择、route.meta装配与DEV内页排除由父路由/App构建合同负责，不是NotFound页面候选。",
        },
        {
          file: "apps/web/src/router/navigation-memory.ts",
          rationale: "最近目的地写入与输入校验是共享导航记忆合同；本页只消费解析后的有效目标。",
        },
      ],
      remaining:
        "本页候选限品牌/home与最近目标的3条导航；没有history.back、搜索、联系支持、表单或确认写入。",
    },
    dialogs: {
      kind: "none-in-current-source",
      remaining: "页面没有弹窗、表单、业务提交、重试或撤销动作。",
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
        "recentDestination消费与路径校验引用共享导航记忆合同；目标页的业务请求/权限不纳入404驻留页。",
      ],
      remaining:
        "静态映射不证明真实HTTP 404、生产内部路由不可达、目标页鉴权、真实存储异常或完整URL安全。",
    },
    compositionGaps: [
      "P73当前3个页面候选归为品牌主页、最近有效目标和条件主页3条导航。",
      "页面驻留期间不调用业务API；点击导航离开后不能继续宣称零请求或无需鉴权。",
      "当前未知路径可见文本可能包含path，query/hash不展示；敏感路径截图仍须使用隔离样例。",
      "SPA fallback画面、HTTP响应状态、目标页权限与跨标签导航记忆为不同验收面。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP73ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
