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
const target = `${base}/action-reviews/P57.json`;
const testFile = "tests/unit/ui-phase2-p57-action-map.test.mjs";
const sourceFiles = [
  "apps/web/src/components/PlatformNotificationManagement.vue",
  "apps/web/src/components/PlatformMessageWorkbench.vue",
  "apps/web/src/components/PlatformNotificationOperations.vue",
  "apps/web/src/components/PlatformNotificationPagination.vue",
  "apps/web/src/components/PlatformMessageEditor.vue",
  "apps/web/src/components/PlatformNotificationActionDialog.vue",
];

const definitions = [
  {
    actionId: "PN57-MESSAGE-WIRING",
    candidates: ["a84b9b74f461a608.1"],
    label: "将工作台消息编辑与发布/取消意图转给父所有者",
    kind: "wiring",
    forwardsTo: ["PN57-MESSAGE-EDIT", "PN57-MESSAGE-PUBLISH", "PN57-MESSAGE-CANCEL"],
    eventTargets: {
      "@edit": ["PN57-MESSAGE-EDIT"],
      "@action": ["PN57-MESSAGE-PUBLISH", "PN57-MESSAGE-CANCEL"],
    },
    condition: "通知域管理工作台发出当前草稿编辑或动作意图时。",
    handler: "原样转发选中的既有消息对象及publish/cancel动作；编辑和动作后续仍由父状态所有者处理。",
    remaining: "事件接线不等于保存、发布、取消或真实用户投递。",
  },
  {
    actionId: "PN57-MESSAGE-PAGE-WIRING",
    candidates: ["22aeb336eb22dffc.1"],
    label: "转发人工消息草稿目录的独立分页变化",
    kind: "wiring",
    forwardsTo: ["PN57-PAGINATION"],
    eventTargets: { "@change": ["PN57-PAGINATION"] },
    condition: "人工消息目录分页控件发出目标页时。",
    handler: "只把message_page变化转给父页面；不改投递记录pagination或筛选范围。",
    remaining: "本地事件不证明服务端COUNT或实际页记录完整。",
  },
  {
    actionId: "PN57-FILTER-WIRING",
    candidates: ["70cfd76c23fd89d4.1"],
    label: "转发投递记录查询、重置和受控筛选字段",
    kind: "local",
    condition: "用户在投递记录筛选区编辑query/status，选择查询或重置时。",
    handler:
      "query/status维持现有父子v-model，apply/reset只转发给通知域父处理器；筛选只作用于投递记录及其摘要，不作用于消息草稿目录。",
    remaining: "事件转发不证明后端类别语义、邮件可用或收件人过滤事实。",
  },
  {
    actionId: "PN57-NOTIFICATION-PAGE-WIRING",
    candidates: ["ae1971e3fd4a8474.1"],
    label: "转发投递记录列表的独立分页变化",
    kind: "wiring",
    forwardsTo: ["PN57-PAGINATION"],
    eventTargets: { "@change": ["PN57-PAGINATION"] },
    condition: "投递记录分页控件发出目标页时。",
    handler: "只把notification page变化转给父页面，不重置message_page。",
    remaining: "本地事件不证明投递记录送达或服务端总数口径。",
  },
  {
    actionId: "PN57-SELECT",
    candidates: ["4e8bc7691dd553a7.1"],
    label: "选择当前既有草稿或消息查看正文与可用操作",
    kind: "local",
    condition: "人工消息目录当前响应页包含可选消息时。",
    handler:
      "选择现有消息对象；窄屏按既有视口行为打开全文阅读窗，不增加GET、不越过当前分页或筛选。",
    remaining: "当前页选择不代表获取完整目录或具备草稿编辑/动作权限。",
  },
  {
    actionId: "PN57-BODY",
    candidates: ["f095166e216904be.1"],
    label: "展开或收起当前消息完整正文",
    kind: "local",
    condition: "当前消息提供原生details摘要时。",
    handler: "切换已读取正文的原生details可见性；保留换行，不触发读取或写入。",
    remaining: "展开只验证本地呈现，不代表正文未被截断于服务端响应。",
  },
  {
    actionId: "PN57-MESSAGE-EDIT",
    candidates: ["16110d36bb2ca486.1", "bffdaadbcab11ecf.1"],
    label: "从桌面或移动阅读界面编辑当前草稿",
    kind: "local",
    condition: "当前消息仍为draft且对应读取窗未处于同消息忙碌状态时。",
    handler: "向父级发出现有草稿对象；移动入口同时关闭全文阅读窗，后续保存仍使用独立草稿编辑器。",
    remaining: "打开编辑不证明PATCH通过版本/权限校验或保存成功。",
  },
  {
    actionId: "PN57-MESSAGE-PUBLISH",
    candidates: ["ce596c13606836a9.1", "ed205b81aa906e59.1"],
    label: "请求发布当前草稿并进入原因确认",
    kind: "local",
    condition: "当前消息为draft且该消息没有动作请求在途时。",
    handler:
      "转发publish意图；移动入口另关闭全文阅读窗。发布写入须经独立原因窗及父动作所有者，按钮本身不直接发送。",
    remaining: "发布入口不代表真实受众数量、通知插入或投递完成。",
  },
  {
    actionId: "PN57-MESSAGE-CANCEL",
    candidates: ["32d17b035b89285e.1", "b90d52fcfbfbd947.1"],
    label: "请求取消当前未发布草稿并进入原因确认",
    kind: "local",
    condition: "当前消息为draft且该消息没有动作请求在途时。",
    handler:
      "转发cancel意图；移动入口另关闭全文阅读窗。取消写入须经独立原因窗及父动作所有者，不撤回已发布消息。",
    remaining: "取消入口不证明后端版本、权限或审计写入成功。",
  },
  {
    actionId: "PN57-MOBILE-READER",
    candidates: ["eb47900365f5d70b.1", "e4f2d5b4b2005a5b.1", "3d875f94d4ab83b0.1"],
    label: "呈现并关闭移动端完整消息阅读窗",
    kind: "local",
    condition: "窄屏选择消息后原生全文阅读窗打开时。",
    handler:
      "使用原生dialog、已有读取快照和窗口实例归属；Escape由当前实例处理，显式关闭只关闭窗口，不改变消息。",
    remaining: "页面局部映射不代验浏览器原生dialog所有系统读屏与软键盘行为。",
  },
  {
    actionId: "PN57-GOVERNANCE-NAV",
    candidates: ["a2abccb13e9ed5e1.1"],
    label: "导航到既有平台规则总览",
    kind: "navigation",
    condition: "通知运营区域显示治理关联入口时。",
    handler: "只导航到 /platform-admin/governance；不在通知页修改规则或发送设置。",
    remaining: "目标路由可见不证明规则存在或当前会话具备治理操作权限。",
  },
  {
    actionId: "PN57-DELIVERY-TECH",
    candidates: ["apps/web/src/components/PlatformNotificationOperations.vue#1c008f867673db60.1"],
    label: "展开投递记录已有技术字段",
    kind: "local",
    condition: "当前投递记录提供移动技术详情 disclosure 时。",
    handler: "仅披露读取响应已有的技术关联字段，不发送邮件、重试投递或创建记录。",
    remaining: "展开不证明技术字段脱敏或对应真实SMTP/provider结果。",
  },
  {
    actionId: "PN57-PAGINATION",
    candidates: ["3a1c06036af4d8a4.1", "ab6f56976164b3f3.1"],
    label: "由共享分页器呈现并发出上一页/下一页意图",
    kind: "local",
    condition: "任一消息目录或投递目录分页器存在可用上一页/下一页时。",
    handler:
      "共享控件只发出page change；实际调用者分别更新message_page或投递page，边界基于对应响应分页元数据。",
    remaining: "共享组件一个按钮实例的源候选由两个不同分页器消费，不能将两游标合并。",
  },
  {
    actionId: "PN57-EDITOR-DIALOG",
    candidates: ["ee9651365376028e.1", "b1b60a9027feacfb.1"],
    label: "打开草稿新建/编辑原生窗口并处理窗口键盘事件",
    kind: "local",
    condition: "父级已建立当前新建或编辑草稿窗口实例时。",
    handler:
      "根据当前editor身份设置窗口标题、处理Escape与窗口内Tab循环；关闭只结束该实例，不取消已发请求。",
    remaining: "组件局部合同不证明所有主题/角色下的真实读屏和软键盘行为。",
  },
  {
    actionId: "PN57-EDITOR-SAVE-WIRING",
    candidates: ["174bcbcaa3c52308.1"],
    label: "将新建/编辑表单submit意图转发给父保存所有者",
    kind: "wiring",
    forwardsTo: ["PN57-EDITOR-SAVE"],
    condition: "编辑字段通过本地原生约束且用户提交表单时。",
    handler: "阻止原生导航，仅向父级发出save；保留现有创建/更新API所有者与版本锁。",
    remaining: "表单事件不证明服务端版本、同源、幂等、审计或数据库写入结果。",
  },
  {
    actionId: "PN57-EDITOR-CLOSE",
    candidates: ["d2cc265c8fd1ae47.1", "02668382bdda9d3b.1"],
    label: "关闭草稿编辑窗",
    kind: "local",
    condition: "草稿编辑未处于saving状态且用户触发顶部或底部关闭时。",
    handler: "发出close给父级清理当前草稿编辑实例，不提交保存或撤销已发送事务。",
    remaining: "关闭窗不证明未提交的草稿字段已持久化。",
  },
  {
    actionId: "PN57-EDITOR-SAVE",
    candidates: ["e94ca4c02d75da69.1"],
    label: "提交新建或更新草稿表单",
    kind: "local",
    condition: "表单字段通过浏览器校验且saving=false时。",
    handler: "原生submit按钮只触发表单save事件；新建保存仍为draft，不自动发布。",
    remaining: "按钮点击不证明父级请求成功、版本冲突或受众引用可用。",
  },
  {
    actionId: "PN57-ACTION-DIALOG",
    candidates: ["8860caa2eace34ef.1", "8e352812d3e9d460.1"],
    label: "呈现发布/取消专用原因窗并处理键盘关闭",
    kind: "local",
    condition: "父级为当前消息动作建立publish或cancel窗口实例时。",
    handler:
      "按action展示对应原生dialog标题；Escape与Tab循环绑定当前实例，busy时按现有父子合同保护提交。",
    remaining: "dialog存在不证明消息动作已提交或用户可以绕过原因要求。",
  },
  {
    actionId: "PN57-ACTION-SUBMIT-WIRING",
    candidates: ["11191cd13f827990.1"],
    label: "将发布/取消原因表单提交转发至父动作所有者",
    kind: "wiring",
    forwardsTo: ["PN57-ACTION-CONFIRM"],
    condition: "原因达到当前2–300字规则且submitting=false时。",
    handler:
      "阻止原生导航，仅发出submit；发布和取消仍复用父级既有action/expected_version/reason API契约。",
    remaining: "组件事件不证明真实RBAC、受众去重、事务、审计或投递。",
  },
  {
    actionId: "PN57-ACTION-CLOSE",
    candidates: ["ff6f244b760bf0a4.1", "358517db18f8c7cb.1"],
    label: "关闭发布/取消原因填写窗口而不提交动作",
    kind: "local",
    condition: "动作未处于submitting状态且用户触发关闭或取消控件时。",
    handler: "向父级发出close；窗内取消不会发布消息，也不会取消已发布消息。",
    remaining: "关闭原因窗不代表父服务端动作已取消或回滚。",
  },
  {
    actionId: "PN57-ACTION-CONFIRM",
    candidates: ["8623dd504ba5e80f.1"],
    label: "确认发布草稿或取消未发布草稿",
    kind: "local",
    condition: "原因trim长度为2–300且submitting=false时。",
    handler:
      "只提交当前专用原因窗form；发布/取消由父级版本化动作处理，不允许取消入口变成已发布撤回。",
    remaining: "确认按钮启用不证明服务端校验通过、受众插入或站内消息送达。",
  },
];

const parentExclusions = [
  ["bfe687b5e3775fab.1", "仅在内容审核域渲染的PlatformContentCenter调用。"],
  ["5eebd25c337b0a2c.1", "仅在已关闭的email域渲染；P57不是邮件路由。"],
  ["3e86a7a4cbf4b231.1", "显式排除notifications的旧通用域筛选分支。"],
  ["dd1ae8b1dd3126a2.1", "仅在已关闭email域渲染的旧草稿转发。"],
  ["1cb3318f1d3fb321.1", "仅在已关闭email域渲染的邮件行转发。"],
  ["f5cb087b206b4a60.1", "内容审核专用窗口事件，与通知动作窗无关。"],
  ["6ac3264cbd6eac5b.1", "内容审核专用窗口调用，与通知动作窗无关。"],
  ["5b14488b26b010e3.1", "仅在已关闭email域渲染的旧邮件编辑器转发。"],
  ["2c3cf7108ad053c1.1", "共享邮件队列原因窗事件，非P57发布/取消原因窗。"],
  ["4b3a546a74b4e7c1.1", "共享邮件队列原因窗调用，非P57发布/取消原因窗。"],
  ["b285a03c301c82db.1", "邮件队列重试/抑制原因调用，非P57消息发布/取消。"],
];
const sharedParentSignatures = [
  "62c28f83dd77541b.1",
  "79f3cfdde95076be.1",
  "1c008f867673db60.1",
  "f85ae0968844933a.1",
];
const parentSourceFile = "apps/web/src/components/PlatformManagementCenter.vue";

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

export function buildP57ActionReview() {
  const sourceText = Object.fromEntries(sourceFiles.map((file) => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(
    Object.entries(sourceText).map(([file, source]) => [
      file,
      createHash("sha256").update(source).digest("hex"),
    ]),
  );
  const allCandidates = Object.entries(sourceText).flatMap(
    ([file, source]) => scanSource(source, file).candidates,
  );
  const allCandidateIdsBySignature = new Map();
  for (const candidate of allCandidates) {
    const signature = candidate.candidateId.split("#")[1];
    const ids = allCandidateIdsBySignature.get(signature) ?? [];
    ids.push(candidate.candidateId);
    allCandidateIdsBySignature.set(signature, ids);
  }
  const resolveCandidateRef = (reference) => {
    if (reference.includes("#")) return reference;
    const ids = allCandidateIdsBySignature.get(reference) ?? [];
    assert.equal(ids.length, 1, `candidate signature must be file-qualified: ${reference}`);
    return ids[0];
  };
  const candidateIdsByAction = new Map(
    definitions.map((definition) => [
      definition.actionId,
      definition.candidates.map(resolveCandidateRef),
    ]),
  );
  const scopedCandidateIds = new Set([...candidateIdsByAction.values()].flat());
  const candidates = allCandidates.filter((candidate) =>
    scopedCandidateIds.has(candidate.candidateId),
  );
  assert.equal(
    allCandidates.length,
    31,
    "P57 page-component inventory changed; re-scope before mapping",
  );
  assert.equal(candidates.length, 31, "P57 current page-component source scope changed");
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
        contractClaim(previous),
        contractClaim(record),
        `conflicting current P57 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.deepEqual(
    [...recordsById.keys()].filter((id) => scopedCandidateIds.has(id)).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      candidateIdsByAction
        .get(definition.actionId)
        .map((candidateId) => [candidateId, definition.actionId]),
    ),
  );
  const uniqueScopedIds = new Set(candidates.map((candidate) => candidate.candidateId));
  assert.equal(ownerBySignature.size, 31, "each in-scope P57 source position must have one owner");
  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  for (const record of recordsById.values()) {
    if (!scopedCandidateIds.has(record.candidateId)) continue;
    const actionId = ownerBySignature.get(record.candidateId);
    assert.ok(actionId, `unmapped P57 candidate ${record.candidateId}`);
    groups.get(actionId).push(record.candidateId);
    claimsByGroup.get(actionId).push(contractClaim(record));
  }
  assert.equal(
    [...groups.values()].reduce((total, group) => total + group.length, 0),
    uniqueScopedIds.size,
  );

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
        `按既有PN57合同对${definition.actionId}精确归属；不增加其他域、受众或投递行为。`,
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
          targets: definition.eventTargets?.[event] ?? action.forwardsTo,
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
  const parentCandidates = scanSource(readSource(parentSourceFile), parentSourceFile).candidates;
  const exclusions = parentCandidates
    .filter(
      (candidate) =>
        !sharedParentSignatures.some((signature) =>
          candidate.candidateId.endsWith(`#${signature}`),
        ),
    )
    .map((candidate) => {
      const record = parentExclusions.find(([signature]) =>
        candidate.candidateId.endsWith(`#${signature}`),
      );
      assert.ok(record, `unclassified cross-domain parent candidate ${candidate.candidateId}`);
      return { candidateId: candidate.candidateId, reason: record[1] };
    });
  assert.equal(exclusions.length, parentExclusions.length);
  const parentContractRecords = runContractAudit().records.filter(
    (record) => record.document === contract && record.sourceFile === parentSourceFile,
  );
  const sharedParentCandidates = sharedParentSignatures.map((signature) => {
    const candidate = parentCandidates.find((item) => item.candidateId.endsWith(`#${signature}`));
    assert.ok(candidate, `missing shared parent candidate ${signature}`);
    const record = parentContractRecords.find((item) => item.candidateId === candidate.candidateId);
    assert.ok(record && ["identity-current", "line-moved"].includes(record.status));
    return { candidateId: candidate.candidateId, sourceContract: contractClaim(record) };
  });

  return {
    schemaVersion: 1,
    pageId: "P57",
    route: "/platform-admin/notifications",
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
        "P57使用专用PlatformMessageEditor、PlatformNotificationActionDialog、移动原生全文dialog及共享分页器；PlatformManagementCenter中的其他域弹窗和email关闭分支明确排除。共享dialog内部系统读屏/软键盘仍需各自真实环境验收。",
    },
    pageScopeExclusions: {
      sharedParent: parentSourceFile,
      sharedCurrentCandidates: sharedParentCandidates,
      excludedCurrentCandidates: exclusions,
      remaining:
        "PlatformManagementCenter集中持有刷新/状态重读/请求编号和消息动作理由流程；四个P57相关候选只作为共享所有者合同交叉引用，不重复计入通知专属组件源映射。其他11个内容审核、关闭email域、旧通用筛选及邮件队列候选不属于P57。",
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
        "PlatformManagementCenter跨域状态所有者与NavigationShell沿其各自合同复用；PlatformNotificationPagination一个源码按钮由两条独立分页消费者使用，游标仍分开。",
      ],
      remaining:
        "静态映射不证明真实platform:operate/RBAC、收件人去重、站内通知插入、发布/取消审计、邮件服务、真实投递或正式M07-03验收。",
    },
    compositionGaps: [
      "逐项覆盖P57通知域6个专用Vue组件的31个当前候选；PlatformManagementCenter四个通知路径所有者候选通过既有合同交叉引用，其他11个父组件候选明确排除。",
      "投递筛选只影响投递记录/摘要；消息草稿目录使用独立message_page，邮件能力保持关闭，不新增邮件入口或自动投递。",
      "草稿保存、发布和取消仍由既有父级API所有者处理；原因窗取消不写入，取消只针对未发布draft，不撤回已发布消息。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP57ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
