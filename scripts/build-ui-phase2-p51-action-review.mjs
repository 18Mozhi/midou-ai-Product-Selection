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
const target = `${base}/action-reviews/P51.json`;
const testFile = "tests/unit/ui-phase2-p51-action-map.test.mjs";
const sourceFiles = [
  "apps/web/src/components/CollectionRuntimeSurface.vue",
  "apps/web/src/components/CollectionTaskCenter.vue",
];

const definitions = [
  {
    actionId: "CL51-NAV",
    candidates: [
      "3c465962052e3b24.1",
      "ebad8fdaf536f0e3.1",
      "404044c1ac23071f.1",
      "a0dc06b99ac90370.1",
    ],
    label: "在采集总览、任务页和浏览器运行间导航",
    kind: "navigation",
    condition: "用户在采集工作区中选择三个既有采集页签之一时。",
    handler:
      "仅沿既有路由在采集总览、当前任务页和浏览器运行页间切换；页签导航不读取任务详情、不创建任务或执行采集。",
    remaining: "导航可见性不证明目标路由的数据范围、权限或运行服务状态。",
  },
  {
    actionId: "CL51-LOAD",
    candidates: ["d1849db8e18799fd.1", "4ec44b3c83794aca.1"],
    label: "读取、刷新或重读当前任务列表",
    kind: "read",
    condition: "页面首次进入，或用户在可用状态显式刷新/重试时。",
    handler:
      "调用既有任务列表 GET，固定当前页与状态参数；刷新失败保留已有快照并展示错误，首次失败按当前状态面处理，不发起任务写入。",
    remaining: "本地动作映射不证明真实 collection:replay 权限、MySQL 结果或线上超时表现。",
  },
  {
    actionId: "CL51-STATE-PRIMARY",
    candidates: ["3a210e63ca5a7831.1"],
    label: "将状态面主操作接到列表读取处理器",
    kind: "wiring",
    forwardsTo: ["CL51-LOAD"],
    condition: "列表状态面提供主操作，且当前状态允许重读时。",
    handler: "只将 UiStatePanel 的既有 primary 事件转发给任务列表 load；不形成独立请求路径。",
    remaining: "静态事件关系不验证真实未授权、会话过期或 API 恢复结果。",
  },
  {
    actionId: "CL51-FILTER",
    candidates: ["7e6436ac5e8e9b15.1"],
    label: "切换服务端任务状态筛选",
    kind: "read",
    condition: "状态筛选器可用且当前读取未被更新请求取代时。",
    handler:
      "状态变化清除当前页文本查询并回到第一页；保留既有 URL 同步与带状态参数的列表 GET。文本输入本身只筛选当前已返回页，不扩展为全库搜索。",
    remaining: "状态目录完整性和真实服务端筛选语义仍需用运行数据验证。",
  },
  {
    actionId: "CL51-PAGE",
    candidates: ["680ca05fdeabfdbf.1", "cda5e997a43d64c9.1"],
    label: "翻阅当前服务端分页结果",
    kind: "read",
    condition: "存在上一页/下一页且列表没有正在读取时。",
    handler:
      "按既有 page、page_size=50 和可选 status 查询下一页；翻页清除当前页文本筛选，越界保护与 reduced-motion 滚动沿用当前实现。",
    remaining: "分页指标仅代表服务端返回页与 meta.total，不证明跨组织数据隔离。",
  },
  {
    actionId: "CL51-EMPTY-RECOVERY",
    candidates: ["16620352511db5c2.1"],
    label: "重读空列表或返回全部状态",
    kind: "read",
    condition: "服务端返回空结果时显示相应恢复入口。",
    handler:
      "全部状态下只重读当前队列；指定状态的空结果可清除状态、页码及当前页文本条件后读取全部状态。不会补造普通采集任务创建入口。",
    remaining: "合成空态不证明真实队列为空或恢复请求成功。",
  },
  {
    actionId: "CL51-DETAIL-OPEN",
    candidates: ["dfaa056b9550313b.1", "5efbd64729e57af0.1"],
    label: "从桌面行或手机记录打开完整任务详情",
    kind: "navigation",
    condition: "当前任务记录提供桌面查看或移动端完整详情入口时。",
    handler:
      "桌面查看沿既有 task 查询参数进入详情；手机入口先结束共享记录抽屉再进入同一完整任务详情，并记录稳定返焦目标。任务 GET 由 task 路由变化触发。",
    remaining: "本页映射不验收共享 ResponsiveDataView 抽屉内部的全部焦点与角色状态。",
  },
  {
    actionId: "CL51-DETAIL-READ",
    candidates: ["33bc529b8390aa3d.1"],
    label: "重试当前任务详情读取",
    kind: "read",
    condition: "任务详情进入明确的可重试读取失败状态时。",
    handler:
      "对当前 URL 中的任务 ID 重读既有任务详情 GET；详情先清理旧对象并以 detailSequence 隔离迟到响应，不重放任务。",
    remaining: "本地失败样例不证明真实详情权限、历史事件完整性或服务端响应。",
  },
  {
    actionId: "CL51-DETAIL-DISMISS",
    candidates: ["6b55734308f206c3.1"],
    label: "仅在点击详情遮罩本身时关闭详情",
    kind: "local",
    condition: "详情遮罩处于打开状态，且按下目标就是遮罩本身时。",
    handler:
      "继续使用 mousedown.self 守卫，只关闭当前详情并沿 closeDetail 的既有历史回退/查询清理路径处理；点击面板内容不触发关闭。",
    remaining: "静态映射不证明触控设备、浏览器历史或读屏器行为。",
  },
  {
    actionId: "CL51-DETAIL-DIALOG",
    candidates: ["ed8b70dc2e6170f2.1"],
    label: "为任务详情提供原生对话框语义",
    kind: "local",
    condition: "详情处于 loading、error 或 loaded 任一可见状态时。",
    handler:
      "复用当前 role=dialog、aria-modal、稳定标题和描述关联；确认重放打开期间详情保持 inert。",
    remaining: "静态属性不等同于真实辅助技术读屏或完整模态隔离验收。",
  },
  {
    actionId: "CL51-DETAIL-KEYBOARD",
    candidates: ["d3da42ac8f789e3b.1"],
    label: "处理详情 Escape 关闭与可见控件 Tab 循环",
    kind: "local",
    condition: "任务详情打开且键盘事件落在详情面板内时。",
    handler:
      "将键盘事件交给既有 detailKeydown：Escape 关闭；Tab/Shift+Tab 仅在当前可见、可聚焦控件边界循环，不扩展焦点集合到隐藏控件。",
    remaining: "源语义映射不覆盖所有浏览器、缩放、读屏器或共享确认窗内部焦点行为。",
  },
  {
    actionId: "CL51-DETAIL-CLOSE",
    candidates: ["30e32a01e61d8558.1"],
    label: "关闭 loading、error 或 loaded 中的任务详情",
    kind: "navigation",
    condition: "详情头部的常驻关闭入口可见时。",
    handler:
      "调用统一 closeDetail，取消当前客户端详情读取、清理详情/重放草稿，并按打开来源使用 router.back 或删除 task 查询参数；关闭后尝试返回稳定触发控件。",
    remaining: "静态路径映射不证明所有历史栈形态均可恢复焦点。",
  },
  {
    actionId: "CL51-MOBILE-TECH",
    candidates: ["1c008f867673db60.1"],
    label: "从移动任务记录进入技术详情",
    kind: "local",
    condition: "移动端任务记录提供技术详情入口时。",
    handler: "沿用 ResponsiveDataView 的既有完整任务详情入口，不新增第二套任务读取或重放动作。",
    remaining: "共享移动记录抽屉的内部生命周期不由本页面局部合同冒领。",
  },
  {
    actionId: "CL51-RECOVERY-ANCHOR",
    candidates: ["96164ff76e31b8d8.1"],
    label: "定位到当前死信任务的人工重放区域",
    kind: "local",
    condition: "当前死信详情展示“进入重放”入口时。",
    handler: "只定位至当前详情中的重放表单，不执行提交、预览之外的写入或外部采集。",
    remaining: "页面内锚点可达性不证明重放依赖已经恢复。",
  },
  {
    actionId: "CL51-RECOVERY-NAV",
    candidates: ["9334ac0d41264e22.1"],
    label: "按任务阻塞或终态进入既有恢复页面",
    kind: "navigation",
    condition: "任务状态/错误码满足既有 recoveryAction 分支时。",
    handler:
      "登录/验证码受阻进入凭证页，robots/source_changed 进入来源设置，终止失败/部分完成进入采集总览；这些入口不声明目标修复已成功。",
    remaining: "导航目标存在不证明目标页权限、配置更改或任务恢复结果。",
  },
  {
    actionId: "CL51-ROBOTS-DISCLOSURE",
    candidates: ["d499af7185a1f039.1"],
    label: "按需展开已返回的 robots 判定摘要",
    kind: "local",
    condition: "当前子查询详情含有 robots 判定对象时。",
    handler:
      "展开原生 details，披露后端已返回的裁决版本、匹配 user-agent 和有限预览；不重新抓取 robots.txt，不展示原始任务 target 或凭证。",
    remaining: "展开行为不证明当前网站政策或生产采集器实际遵守结果。",
  },
  {
    actionId: "CL51-TECH-DISCLOSURE",
    candidates: ["79686f2d00e174f0.1"],
    label: "按需展开任务技术关联标识",
    kind: "local",
    condition: "任务详情已成功读取且用户需要核对诊断信息时。",
    handler:
      "展开原生 details 展示任务、组织、工作区、请求和错误标识；不披露内部 target_json、租约令牌或凭证。",
    remaining: "本地渲染映射不证明真实接口脱敏、角色授权或审计访问策略。",
  },
  {
    actionId: "CL51-REPLAY-OPEN",
    candidates: ["5046ae27ac1c3e07.1"],
    label: "打开现有死信任务人工重放确认",
    kind: "local",
    condition: "当前详情状态为 dead_letter、原因 trim 后至少 2 字且未提交时。",
    handler:
      "仅打开共享 ConfirmDialog 并保留固定当前原因/任务上下文；此按钮本身不 POST，确认期间底层详情 inert。",
    remaining: "静态映射不证明真实依赖已修复或用户有 collection:replay 权限。",
  },
  {
    actionId: "CL51-REPLAY-WRITE",
    candidates: ["acbca874b622fd25.1"],
    label: "确认后为当前死信创建新的人工重放任务",
    kind: "write",
    sourceContractKeys: ["CL51-REPLAY / cancel、replay"],
    contractAliasReason:
      "该宿主事件绑定同时转发确认取消与确认提交；仅 confirm 分支进入既有 replay POST，cancel 分支只关闭确认窗且不写入。",
    condition:
      "用户确认共享二次确认，原任务仍为当前 dead_letter 详情，理由 trim 后 2–500 字且未有写入占用。",
    handler:
      "仅调用 POST /platform/collection/tasks/{id}/replay，body 只含 reason，沿用共享客户端 Idempotency-Key；后端创建 scheduled 新任务并保留旧历史。网络、超时、限流及网关类结果未知时明确要求先重读核对，不自动重复 POST。",
    remaining:
      "本合同不执行真实死信重放，不证明 collection:replay/RBAC、MySQL 事务、Worker 执行、幂等或外部采集成功。",
  },
  {
    actionId: "CL51-REPLAY-DIALOG",
    candidates: ["e9f14f18f727a992.1"],
    label: "调用共享死信重放二次确认窗",
    kind: "local",
    condition: "页面已有有效重放意图并展示共享 ConfirmDialog 时。",
    handler:
      "传入既有任务影响说明、确认短语及 cancel/confirm 回调；挂载确认窗不单独发出任务写请求。",
    remaining: "共享 ConfirmDialog 内部按钮状态和焦点循环属于共享控件合同，不在P51本地候选计数内。",
  },
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

export function buildP51ActionReview() {
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
        `conflicting current P51 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(recordsById.size, candidates.length, "P51 sources require current contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      definition.candidates.map((signature) => [signature, definition.actionId]),
    ),
  );
  assert.equal(ownerBySignature.size, candidates.length, "each P51 candidate must have one owner");
  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = ownerBySignature.get(signature);
    assert.ok(actionId, `unmapped P51 candidate ${record.candidateId}`);
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
        `按既有CL51合同对${definition.actionId}精确归属，不增加新建任务或重放路径。`,
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
    return action;
  });

  const inputs = {};
  for (const file of sourceFiles) {
    const surfaces = scanReviewSurfaces(sourceText[file], file);
    if (surfaces.inputs.length) inputs[file] = surfaces.inputs.map((input) => input.binding);
  }
  return {
    schemaVersion: 1,
    pageId: "P51",
    route: "/platform-admin/collection",
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
        "P51本地任务详情为一个role=dialog，重放调用共享ConfirmDialog；移动任务记录由ResponsiveDataView详情抽屉承载。此映射只列本页宿主与共享采集页签，不重复计共享抽屉/确认窗/导航壳内部候选。",
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
        "本映射只覆盖采集页签宿主和任务页组件；ResponsiveDataView、ConfirmDialog、UiStatePanel、NavigationShell和API客户端共享交互继续以各自合同为准。",
      ],
      remaining:
        "静态映射不代表真实平台RBAC、MySQL任务/死信、Worker/Python执行、外部采集、全主题/缩放/读屏或M07-03验收通过。",
    },
    compositionGaps: [
      "逐项覆盖CollectionRuntimeSurface.vue与CollectionTaskCenter.vue的26个当前扫描候选；共享移动详情、确认窗和导航壳的内部候选不重复并入P51局部计数。",
      "手动重放只登记既有dead_letter POST与reason字段；不增加任务创建、状态修改、自动重试或外部采集动作。",
      "用户视觉自动通过与动作映射分开记录；actionApproval、真实collection:replay授权、MySQL、Worker终态、读屏和正式M07-03签收仍未通过。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP51ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
