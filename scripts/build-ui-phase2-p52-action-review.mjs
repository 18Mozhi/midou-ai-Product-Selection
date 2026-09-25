import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/collection-runtime-contract-review.md`;
const target = `${base}/action-reviews/P52.json`;
const testFile = "tests/unit/ui-phase2-p52-action-map.test.mjs";
const sourceFiles = [
  "apps/web/src/components/CollectionRuntimeSurface.vue",
  "apps/web/src/components/CollectionOperationsConsole.vue",
];

const definitions = [
  {
    actionId: "CL52-NAV",
    candidates: ["3c465962052e3b24.1", "ebad8fdaf536f0e3.1", "404044c1ac23071f.1"],
    label: "在采集总览、任务页和浏览器运行间导航",
    kind: "navigation",
    condition: "用户在采集工作区选择三个既有采集页签之一时。",
    handler:
      "仅沿既有路由在采集总览、任务页和浏览器运行页间切换；页签导航不发起总览读取、重放或外部采集。",
    remaining: "目标页签可见不证明目标页面权限、数据范围或服务健康状态。",
  },
  {
    actionId: "CL52-LOAD",
    candidates: ["6d3f7d591719f19f.1", "a397ba517c409773.1", "c7e32d5d2ec42619.1"],
    label: "读取、刷新或重读采集运行总览",
    kind: "read",
    condition: "页面挂载或当前读取状态提供可用的刷新/重试入口时。",
    handler:
      "调用既有 GET /platform/collection/console，并固定组织、工作区、来源、时间、根因及独立分页范围；刷新失败保留上次成功快照，不发起任务写入。",
    remaining: "局部源映射不证明真实 platform:operate、401/403快照策略、MySQL数据或生产超时表现。",
  },
  {
    actionId: "CL52-SCOPE-DRAWER",
    candidates: ["2506d9788c717641.1"],
    label: "提供响应式采集范围筛选抽屉",
    kind: "local",
    condition: "当前总览渲染范围与时间筛选器时。",
    handler:
      "调用既有 ResponsiveFilterDrawer 展示组织、工作区、来源、时间字段；容器本身不提交范围或发起读取。",
    remaining: "共享抽屉的触控、焦点和关闭行为由共享组件合同验收，不由本页调用点代验。",
  },
  {
    actionId: "CL52-SCOPE-FORM",
    candidates: ["9ba7fa048065cd28.1"],
    label: "将范围表单提交意图转给现有范围查询处理器",
    kind: "wiring",
    forwardsTo: ["CL52-SCOPE-APPLY"],
    condition: "用户在筛选抽屉中提交组织、工作区、来源或时间范围时。",
    handler: "阻止浏览器原生表单导航，仅将submit意图转给 applyScope。",
    remaining: "事件映射不验证组织/工作区真实归属和服务端过滤结果。",
  },
  {
    actionId: "CL52-SCOPE-RESET",
    candidates: ["e0774dcb9c606eef.1"],
    label: "将范围重置为现有默认值并读取",
    kind: "read",
    condition: "筛选存在可重置条件且没有批量重放进行中时。",
    handler:
      "清除组织、工作区、来源及根因，恢复24h窗口和两组第一页，再经既有总览 GET 更新页面；不清除或更改后端事实。",
    remaining: "本地表单重置不证明服务端默认范围或成员数据隔离。",
  },
  {
    actionId: "CL52-SCOPE-APPLY",
    candidates: ["002b24e1d917d4a4.1"],
    label: "应用当前范围并读取独立总览事实",
    kind: "read",
    condition: "字段通过现有UUID校验且无批量重放占用时。",
    handler:
      "重置尝试/死信分页并使用当前范围读取；范围提交和分页继续通过各自既有handler，保留来源健康、根因、质量、尝试及死信各自服务端口径。",
    remaining: "静态映射不执行接口、SQL或读取审计，也不证明筛选事实完整性。",
  },
  {
    actionId: "CL52-LINK",
    candidates: ["3a14c060674cdbaa.1"],
    label: "进入总览响应提供的既有管理页面",
    kind: "navigation",
    condition: "总览 GET 返回受支持的管理链接时。",
    handler:
      "使用响应中的六类已有来源、适配器健康、来源目录、任务、浏览器运行和数据质量目标；不根据错误类别自行拼接或扩展目标。",
    remaining: "客户端导航不证明目标页面具备当前角色授权或处理后续问题成功。",
  },
  {
    actionId: "CL52-SOURCE-DETAIL",
    candidates: ["f6229375f6be78df.1", "1c008f867673db60.1"],
    label: "展开来源技术详情",
    kind: "local",
    condition: "来源健康记录提供桌面或移动技术详情 disclosure 时。",
    handler: "按需披露已有来源代码，不改变API数据、来源筛选目录或健康状态。",
    remaining: "技术字段显示不验证真实来源健康、条款授权或提供者响应。",
  },
  {
    actionId: "CL52-SOURCE-LIST",
    candidates: ["a9b7552ee181c72f.1"],
    label: "展开或收起完整来源目录",
    kind: "local",
    condition: "来源目录超过前8项显示阈值时。",
    handler:
      "切换来源目录前8项/全部结果并维持对应区域关系，不改变API数据、来源筛选目录或健康状态。",
    remaining: "目录折叠不验证真实来源健康、条款授权或提供者响应。",
  },
  {
    actionId: "CL52-ROOT-CLEAR",
    candidates: ["4509211b46b0337c.1"],
    label: "清除当前精确错误根因并重新读取",
    kind: "read",
    condition: "当前URL/页面处于精确根因下钻状态且无批量写入时。",
    handler: "清除当前 error_code 并重新读取现有总览，不把根因类别改写成别的错误码。",
    remaining: "不证明服务端根因聚合或清除后的尝试/死信关联事实。",
  },
  {
    actionId: "CL52-ROOT-DRILL",
    candidates: ["644b6cd23fdb966a.1"],
    label: "按真实错误码选择或再次选择根因并下钻",
    kind: "read",
    condition: "当前响应含有根因条目且没有批量重放进行中时。",
    handler:
      "将所选真实 error_code 精确写入已有查询范围，重置尝试/死信页并读取；root_causes仍按死信聚合，不与所有失败尝试数量混算。",
    remaining: "本映射不推断错误类别、修复状态或真实死信数量。",
  },
  {
    actionId: "CL52-ROOT-TECH",
    candidates: ["1c008f867673db60.2"],
    label: "展开根因的原始技术错误码",
    kind: "local",
    condition: "根因条目提供技术详情 disclosure 时。",
    handler: "切换原生 details 的可见性，仅显示响应中的原始错误码。",
    remaining: "本地展开不证明访问审计、读屏播报或错误归因正确。",
  },
  {
    actionId: "CL52-ATTEMPT-DETAIL",
    candidates: ["f6229375f6be78df.2", "1c008f867673db60.3"],
    label: "查看最近尝试的移动/桌面记录及技术详情",
    kind: "local",
    condition: "尝试结果记录当前响应页存在时。",
    handler:
      "在共享 ResponsiveDataView 中展开同一尝试的记录详情，并按需披露现有任务、trace和错误标识；不执行重试。",
    remaining: "ResponsiveDataView抽屉内焦点及记录返焦由共享控件合同负责。",
  },
  {
    actionId: "CL52-ATTEMPT-PAGE",
    candidates: ["e4688d99cdaed726.1", "5c6a30d3ce827bee.1"],
    label: "翻阅最近尝试独立分页",
    kind: "read",
    condition: "尝试记录存在上一页/下一页且页面未刷新或批量写入时。",
    handler: "只改变 attempt_page 并读取；不改变死信分页游标或根因身份。",
    remaining: "本地分页不验证数据库总数、跨范围隔离或尝试归属。",
  },
  {
    actionId: "CL52-BATCH-FAILURES",
    candidates: ["65c7916ab5f0b4d9.1"],
    label: "披露批量重放的明确失败与未知结果条目",
    kind: "local",
    condition: "最近批次存在逐项失败或结果未知记录时。",
    handler: "按需展开现有settlement条目，保留失败与未知结果分类，不再次提交请求。",
    remaining: "本地披露不核实服务端写入终态，未知结果须到对应任务读取核对。",
  },
  {
    actionId: "CL52-BATCH-OPEN",
    candidates: ["660c7a198b93551d.1"],
    label: "展开批量安全重放选择区域",
    kind: "local",
    condition: "死信区域提供原生折叠摘要时。",
    handler: "切换批量重放表单显示，不勾选目标、不创建预览或写入。",
    remaining: "表单展开不代表选择了死信或依赖已恢复。",
  },
  {
    actionId: "CL52-BATCH-SELECT",
    candidates: ["3d7519a5ffaadf88.1"],
    label: "在当前页选择或取消开放死信",
    kind: "local",
    condition: "当前页死信状态为open、批次空闲且结果未处于unknown锁定时。",
    handler:
      "读取checkbox change并更新当前选择；只允许当前页开放死信，最大20条，切页或新响应会按现有逻辑修剪选择。",
    remaining: "本地选择不证明服务端当前状态、授权或请求时仍可重放。",
  },
  {
    actionId: "CL52-BATCH-REASON",
    candidates: ["935c6c8171139c6b.1"],
    label: "编辑批量重放原因并清除过期字段错误",
    kind: "local",
    condition: "未进入批量写入或结果未知锁定状态时。",
    handler: "保留现有500字符上限与输入时清理原因错误；输入变化本身不发出POST。",
    remaining: "本地输入与字段错误不代替服务端原始长度/权限/审计校验。",
  },
  {
    actionId: "CL52-BATCH-PREVIEW",
    candidates: ["9233c1fc5a4723d0.1"],
    label: "校验并冻结批量重放目标、原因与影响预览",
    kind: "local",
    condition:
      "选中1–20条开放死信、原因trim至少2字且原始长度不超过500、无结果未知或其他批次在途时。",
    handler:
      "冻结所选死信、原因、组织/工作区影响和batchId，再打开共享破坏性确认；此按钮不执行POST。",
    remaining: "本地快照预览不证明确认时记录仍开放或服务端授权。",
  },
  {
    actionId: "CL52-DEAD-OPEN-TASK",
    candidates: ["9ebd065e5010fd46.1"],
    label: "进入原任务详情核验死信并受控重放",
    kind: "navigation",
    condition: "当前死信记录提供单任务核查入口时。",
    handler:
      "带既有task_id导航到采集任务详情；不从总览直接调用单任务重放，不绕过P51 task读写权限和原因确认。",
    remaining: "路由存在不证明task详情读取或后续人工重放被授权。",
  },
  {
    actionId: "CL52-DEAD-TECH",
    candidates: ["1c008f867673db60.4"],
    label: "展开当前死信技术关联信息",
    kind: "local",
    condition: "死信记录含有技术详情折叠区时。",
    handler: "切换原生details披露原有错误码、任务ID及组织/工作区ID，不触发重新读取或重放。",
    remaining: "展开映射不证明真实接口脱敏、角色授权或审计访问范围。",
  },
  {
    actionId: "CL52-DEAD-PAGE",
    candidates: ["ead51c4255c6e1f0.1", "19e60ba8660b9f22.1"],
    label: "翻阅开放与已重放死信独立分页",
    kind: "read",
    condition: "死信记录存在上一页/下一页且页面未刷新或批量写入时。",
    handler: "只改变 dead_letter_page 并读取；按既有分页变化清理非当前页勾选，不改变尝试分页。",
    remaining: "本地分页不证明死信状态在提交前未变化。",
  },
  {
    actionId: "CL52-BATCH-WRITE",
    candidates: ["9215901b5115628c.1"],
    label: "确认后逐条提交既有受控批量死信重放",
    kind: "write",
    sourceContractKeys: ["CL52-BATCH / ConfirmDialog cancel与confirm分别走现有取消/确认所有者"],
    contractAliasReason:
      "该父级事件绑定包含cancel与confirm；只有confirm分支进入逐条重放POST，cancel只撤销当前确认快照、不发写请求。",
    condition: "用户通过共享确认短语与影响确认，冻结批次有效且batchBusy=false时。",
    handler:
      "按预览快照顺序逐条POST /platform/collection/tasks/{task_id}/replay；每条body只含reason，幂等键为dead-batch:{batchId}:{task_id}。逐条记录成功/明确失败/未知结果，网络及408/425/429/502/503/504未知时不自动重发，继续处理其余固定目标；结果只表示创建新任务，不代表采集执行成功。",
    remaining:
      "映射不执行真实重放，不证明逐条collection:replay授权、同源校验、MySQL事务/幂等、Worker运行或外部采集结果。",
  },
  {
    actionId: "CL52-BATCH-DIALOG",
    candidates: ["4640753c7de49660.1"],
    label: "调用共享破坏性影响确认窗",
    kind: "local",
    condition: "已冻结批量重放快照并打开确认步骤时。",
    handler:
      "向共享ConfirmDialog传入影响摘要、确认短语及既有cancel/confirm回调；单纯渲染确认窗不提交。",
    remaining: "共享ConfirmDialog内部勾选、短语、焦点及关闭行为不由该调用点映射冒领。",
  },
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

export function buildP52ActionReview() {
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
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const records = runContractAudit().records.filter(
    (record) =>
      record.document === contract &&
      sourceFiles.includes(record.sourceFile) &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) {
    const previous = recordsById.get(record.candidateId);
    if (previous)
      assert.equal(
        previous.claim
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .at(-1),
        record.claim
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .at(-1),
        `conflicting current P52 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(recordsById.size, candidates.length, "P52 sources require current contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      definition.candidates.map((signature) => [signature, definition.actionId]),
    ),
  );
  assert.equal(ownerBySignature.size, candidates.length, "each P52 candidate must have one owner");
  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = ownerBySignature.get(signature);
    assert.ok(actionId, `unmapped P52 candidate ${record.candidateId}`);
    groups.get(actionId).push(record.candidateId);
    claimsByGroup.get(actionId).push(
      record.claim
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .at(-1),
    );
  }

  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map((definition) => {
    const action = {
      actionId: definition.actionId,
      label: definition.label,
      kind: definition.kind,
      sourceCandidateIds: groups.get(definition.actionId).sort(),
      sourceContractKeys: definition.sourceContractKeys ?? [
        ...new Set(claimsByGroup.get(definition.actionId)),
      ],
      contractAliasReason:
        definition.contractAliasReason ??
        `按既有CL52合同对${definition.actionId}精确归属；不增加新的范围、数据或重放行为。`,
      condition: definition.condition,
      handler: definition.handler,
      variants: ["current-route-source-contract"],
      scenes: [],
      visualStates,
      testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
      remaining: definition.remaining,
    };
    if (definition.forwardsTo) {
      action.forwardsTo = definition.forwardsTo;
      action.forwardBindings = action.sourceCandidateIds.flatMap((candidateId) => {
        const candidate = candidateById.get(candidateId);
        return Object.entries(candidate.events ?? {}).map(([event, handler]) => ({
          candidateId,
          event,
          handler,
          targets: action.forwardsTo,
        }));
      });
    }
    if (definition.sourceAbsence) {
      action.sourceAbsence = definition.sourceAbsence;
      action.sourceCandidateApplicability = definition.sourceCandidateApplicability;
    }
    return action;
  });

  const inputs = {};
  for (const file of sourceFiles) {
    const surfaces = scanReviewSurfaces(sourceText[file], file);
    if (surfaces.inputs.length) inputs[file] = surfaces.inputs.map((input) => input.binding);
  }
  return {
    schemaVersion: 1,
    pageId: "P52",
    route: "/platform-admin/collection/overview",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P52没有局部role=dialog定义；范围使用ResponsiveFilterDrawer，移动来源/尝试详情使用ResponsiveDataView，批量重放调用共享破坏性ConfirmDialog。共享内部字段、选中态与焦点规则不重复并入P52页面局部候选。",
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
        "本映射只覆盖采集总览页签宿主与CollectionOperationsConsole；ResponsiveFilterDrawer、ResponsiveDataView、ConfirmDialog、TechnicalDetails和NavigationShell内部交互沿用各自共享合同。",
      ],
      remaining:
        "静态映射不证明platform:operate/collection:replay真实授权、401/403安全呈现、MySQL聚合、批写入幂等、Worker执行、外部采集、全主题缩放/读屏或M07-03验收。",
    },
    compositionGaps: [
      "逐项覆盖CollectionRuntimeSurface.vue与CollectionOperationsConsole.vue的32个当前扫描候选；共享抽屉、ResponsiveDataView及ConfirmDialog内部控件不重复计入P52。",
      "总览读取仅按现有服务端范围/window/error_code及独立分页查询；根因按真实dead-letter error_code筛选，不将平台来源健康误作组织/时间筛选结果。",
      "批量操作仅登记最多20条当前页开放死信的冻结快照和逐条既有重放POST；用户视觉自动通过与动作审批/真实权限/数据库/Worker验收保持分开。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP52ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
