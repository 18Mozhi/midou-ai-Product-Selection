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
const target = `${base}/action-reviews/P64.json`;
const testFile = "tests/unit/ui-phase2-p64-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/BackupRecoveryCenter.vue",
  "apps/web/src/components/BackupRecoveryDirectory.vue",
];

const definitions = [
  [
    "BR64-LOAD",
    "read",
    "读取或刷新当前备份与恢复只读事实",
    ["32472f95c82e1a43.1"],
    "用户请求读取或刷新当前备份与恢复事实时。",
    "沿用当前 platform:operate GET、既有单飞/15秒客户端等待和服务读取范围；页面只展示最近备份、演练、资产与阻断事实。",
    "页面刷新不是备份、恢复、演练、下载密文或数据库零写入证明。",
  ],
  [
    "BR64-RETRY",
    "read",
    "在失败状态下重新核验备份恢复快照",
    ["a93553a3ba9aa8a6.1", "0227b741c3d451ee.1"],
    "已有快照刷新失败，或首次读取进入可重读且非forbidden/登录跳转分支时。",
    "复用同一只读事实请求；已有快照失败重读沿原快照与请求编号边界，不创建备份或演练。",
    "重读通过不证明真实授权、资产完整性或恢复可用。",
  ],
  [
    "BR64-LOGIN",
    "navigation",
    "会话过期时重新登录",
    ["5587941412d5210f.1"],
    "当前读取明确返回登录过期时。",
    "导航至既有登录入口；不把forbidden状态伪装成可重试，也不复制敏感响应。",
    "导航不证明重新认证成功或具有platform:operate权限。",
  ],
  [
    "BR64-TECH",
    "local",
    "展开资产或阻断事实的技术详情",
    ["1c008f867673db60.1", "1c008f867673db60.2", "1c008f867673db60.3"],
    "桌面/移动资产或阻断记录提供技术详情披露入口时。",
    "只展开响应已返回的追踪/技术字段，不发请求；请求编号复制使用既有共享TechnicalDetails合同。",
    "本页局部披露不证明真实MySQL审计或复制剪贴板权限/读屏验收。",
  ],
  [
    "BR64-DIRECTORY-NAV",
    "navigation",
    "跳转到本页目标、恢复证据或备份资产分区",
    ["cbe3ce9e478ff362.1", "6b6da7e2248b5970.1", "90f85112b27af94e.1"],
    "用户选择本页目录中的事实分区时。",
    "只定位当前页已有锚点，不触发重新读取、创建任务或改变恢复策略。",
    "页内导航不表示所选资产具备完整性、可解密性或恢复资格。",
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

export function buildP64ActionReview() {
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
    "P64 current local candidates need contract rows",
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
    "each P64 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P64 candidate ${record.candidateId}`);
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
    contractAliasReason: "依照P64备份恢复合同当前源身份归组；保留只读读取和真实事实边界。",
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
    pageId: "P64",
    route: "/platform-admin/operations",
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
          file: "apps/web/src/components/ResponsiveDataView.vue",
          rationale:
            "移动资产只读详情由共享组件实现并由既有P38/P46/P47映射归属；本页按P64消费者合同交叉引用，不重复占用共享候选。",
        },
        {
          file: "apps/web/src/components/TableViewControls.vue",
          rationale:
            "列设置、列可见性和冻结为多页共享表格控件，已有共享源动作映射；P64列标签消费者说明由P64组件合同约束。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale:
            "请求编号详情与复制控件为P64/P65共享组件候选，由既有共享源动作映射归属；P64三处调用点仍分别映射到BR64-TECH。",
        },
        {
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale:
            "父入口的会话/权限/读取请求所有者为共享平台管理范围，不把其他域路由动作记为P64局部控件。",
        },
      ],
      remaining:
        "只读详情、表格列设置、请求编号复制及平台父级调用不重复计数；P64本页没有备份、恢复、演练或密文下载执行入口。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "本页只复用ResponsiveDataView的只读资产详情抽屉；共享复制详情由TechnicalDetails处理。不存在备份/恢复/演练执行确认窗。",
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
        "只读资产详情、表格列控件、技术编号复制由共享组件源动作映射负责；本页三处TechnicalDetails调用位置仍按P64映射归组。",
      ],
      remaining:
        "静态动作映射不证明真实platform:operate、MySQL审计、加密强度、隔离恢复演练、备份资格或正式M07-04验收。",
    },
    compositionGaps: [
      "10个当前P64专属组件候选映射至5组页面动作；共享详情/列设置/复制由已有共享组件映射引用。",
      "页面没有创建备份、执行恢复、启动演练、删除资产或下载密文的动作；不得据UI补入执行流程。",
      "本页展示目标和实测分开；null、0、未知、过期与阻断保持服务事实语义，不推导真实恢复能力。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP64ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
