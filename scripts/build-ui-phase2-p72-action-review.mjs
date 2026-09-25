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
const target = `${base}/action-reviews/P72.json`;
const testFile = "tests/unit/ui-phase2-p72-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/UiStateShowcase.vue",
  "apps/web/src/components/UiStatePanel.vue",
];

const definitions = [
  [
    "ST72-HOME",
    "navigation",
    "返回 ScoutOps 首页",
    ["6716f11d5cb87664.1"],
    "用户点击开发演示顶部品牌入口时。",
    "按当前Vue Router品牌链接导航到既有首页；不持久化演示状态或改变返回路径合同。",
    "导航本身不证明首页授权或任何业务操作已发生。",
  ],
  [
    "ST72-SELECT",
    "local",
    "选择一个开发态界面状态",
    ["7f48e1357c8dae41.1"],
    "审核者选择八种合法状态之一时。",
    "沿既有query.state更新单个合法值，保留其他query；合法同态不增加history，清空当前actionResult。",
    "状态是演示选择，不代表真实用户/服务权限或故障事实；非法/重复query回退策略不在按钮动作中重写。",
  ],
  [
    "ST72-ACTIONS",
    "local",
    "触发当前状态卡片的演示主/次动作",
    ["b2a9d9fdd632dd45.1", "589e8eedc7c9c864.1", "3eebdb6b72e10446.1"],
    "当前状态卡片展示主动作，或其已有次动作可用且非loading时。",
    "UiStatePanel只emit primary/secondary；父级依八态表执行本地actionResult、既有导航或恢复示例；loading不展示动作。",
    "“重新尝试/申请权限”等演示文案不代表真实重试、权限申请、网络或业务写入。",
  ],
  [
    "ST72-CONFIRM-DEMO",
    "local",
    "打开并完成本地高影响确认演示",
    ["659be34503b475d2.1", "5cb580b48eea94d3.1", "2067b78f30a4668d.1"],
    "用户打开演示确认窗，满足确认勾选和trim后短语匹配并显式确认时。",
    "打开/取消只改变本地状态；确认仅设置confirmed=true并关闭，无API、授权撤销、持久化或审计。",
    "共享ConfirmDialog键盘/焦点/遮罩行为仍由共享合同负责；本示例不得推断其他调用方或真实授权流程。",
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

export function buildP72ActionReview() {
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
  const currentDocuments = new Set([contract, `${base}/provider-definition-contract-review.md`]);
  const records = runContractAudit().records.filter(
    (record) =>
      sourceFiles.includes(record.sourceFile) &&
      currentDocuments.has(record.document) &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) recordsById.set(record.candidateId, record);
  assert.equal(recordsById.size, candidates.length, "P72 current candidates need contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(owner.size, candidates.length, "each P72 current candidate must have one owner");
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P72 candidate ${record.candidateId}`);
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
      "依据P72开发专用状态演示当前源候选、八态合同与UiStatePanel当前候选逐项归组，不扩大为生产业务动作。",
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
    pageId: "P72",
    route: "/ui-states",
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
            "该组件是跨页面共享定义；P72仅映射演示调用点和当前事件接线，内部checkbox/短语/键盘控件由共享合同复核。",
        },
        {
          file: "apps/web/src/App.vue",
          rationale: "DEV条件导入、query入口和生产剥离是路由/构建边界，不是本页面业务控件动作。",
        },
      ],
      remaining:
        "UiStatePanel两项候选在P72子组件调用上下文内归入示例动作；不代表该共享组件其他调用方已审核。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "唯一演示确认窗仅维护本地状态；没有实际异步提交、业务撤销、API或审计。确认组件内部交互继续引用共享合同。",
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
        "八态状态选择是一个v-for源码点而非一个运行时按钮；ConfirmDialog字段与键盘行为属于共享组件合同。",
      ],
      remaining:
        "静态映射不证明生产不可达、DEV query隔离、bundle剥离、全主题/密度或完整辅助技术验收。",
    },
    compositionGaps: [
      "P72当前8个候选归入品牌导航、八态选择、卡片演示动作及纯本地确认演示四类动作。",
      "loading无卡片动作；八态选择与确认文案是开发演示，不代表真实状态、权限申请、撤销或持久化。",
      "共享UiStatePanel候选按P72子组件上下文归组，不据此宣称其他消费者语义已复核。",
      "production route/query隔离、bundle剥离及完整主题/无障碍仍按既有合同单独验收。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP72ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
