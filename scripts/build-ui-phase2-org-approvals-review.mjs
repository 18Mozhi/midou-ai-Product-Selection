import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationApprovalPanel.vue";
export const failureFile = "apps/web/src/components/OrganizationApprovalFirstFailure.vue";
export const dependencies = [parentFile, childFile, failureFile];
export const packageNames = [
  "org-approvals-direction-c",
  "org-approvals-controls-direction-c",
  "org-approvals-fields-direction-c",
  "org-approvals-parent-direction-c",
];
const hash = (s) => createHash("sha256").update(s.replaceAll("\r\n", "\n")).digest("hex");
const ids = (file, values) => values.map((v) => `${file}#${v}`);
const C = (...v) => ids(parentFile, v),
  A = (...v) => ids(childFile, v),
  F = (...v) => ids(failureFile, v);
const remaining =
  "源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。";
const templateKey =
  "OG-A-TEMPLATE-FILTER重置/分页/已批准手机空结果清除；清除后焦点回搜索，不写业务数据";
// Explicit source identities and meanings, never inferred from rendered labels.
const definitions = [
  [
    "OG-REFRESH",
    "刷新组织审批",
    "read",
    C("b11692c0597885e3.1"),
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load({background:true})并行summary与approvals；普通后台失败保留两份旧数据，401/403替换内容",
    "refresh",
  ],
  [
    "OG-RETRY",
    "错误后重新加载",
    "read",
    [...C("97ed4772fb320d6c.1"), ...F("54b14787946c2f69.1")],
    ["OG-RETRY", "OG-RETRY 手机首次500/429恢复按钮"],
    "父错误分支；F仅首次无data/HTTP500或429/手机可见，桌面保留原按钮",
    "新F仅emit reload；父原load()，没有新的请求策略、权限或自动倒计时",
    "retry-error",
  ],
  [
    "WIRE-P34-RETRY",
    "失败区域重试转发",
    "wiring",
    C("5ae31bc55551b1dc.1", "08a59be6f793cde6.1"),
    ["OG-RETRY"],
    "仅P34无data，error/HTTP500或rate_limited/HTTP429分支",
    "@reload原样转发load()；不是第三个业务读取动作",
    null,
  ],
  [
    "EX-P29-PROFILE",
    "组织资料排除",
    "excluded",
    C("d6b520278ab3dd57.1", "1cbd108c64b5230c.1", "5878e30377f290ae.1"),
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary非approvals",
    "不计P29资料保存与Logo校验",
    null,
  ],
  [
    "EX-P30-MEMBERS",
    "成员事件排除",
    "excluded",
    C("6a563eeaa67fea90.1"),
    ["P30全部成员事件父转发，复用M语义"],
    "仅members",
    "本页不邀请或修改成员",
    null,
  ],
  [
    "EX-P31-ROLES",
    "授权事件排除",
    "excluded",
    C("b09d7923228aabe6.1"),
    ["P31资源授权父转发，复用已有合同"],
    "仅roles",
    "本页不创建或修改授权",
    null,
  ],
  [
    "EX-REASON-ORIGINS",
    "其他页原因窗调用排除",
    "excluded",
    C("773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1", "e828f4ab0fdb0415.1"),
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
      "D-OG-REASON令牌轮换/撤销调用",
    ],
    "P34无原因窗发起入口，父仍挂载共享组件",
    "不把其他页调用算本页弹窗；跨页已打开窗口归属仍另验",
    null,
  ],
  [
    "OG-A-VIEW",
    "记录/模板阅读视图",
    "local",
    A("00f81ad5e8a2f732.1", "86f59f25b64551b6.1"),
    ["OG-A-VIEW"],
    "无busy禁用，保留各自筛选",
    "section写入原URL键；不发审批或模板写入",
    "view-requests-available",
  ],
  [
    "OG-A-REQUEST-FILTER",
    "审批重置与分页",
    "local",
    A("f376017b5e1818c0.1", "184674807c82ee93.1", "3169b6613d3ce948.1"),
    ["OG-A-REQUEST-FILTER重置/分页"],
    "筛选字段无busy禁用；分页按边界禁用，8行一页",
    "resetRequests只清本视图五条件；翻页仅本地列表及URL，不扩最近100条读取上限",
    "request-reset",
  ],
  [
    "OG-A-TEMPLATE-FILTER",
    "模板重置、清除与分页",
    "local",
    A("2a3781fdd41e7df6.1", "0b242741fe22e1a9.1", "0ab42724896b9cf9.1", "97e57c58af0dc63f.1"),
    [templateKey],
    "6行一页；新清除仅模板非空且无匹配、手机可见",
    "resetTemplates保留记录条件；已实施空结果清除回焦搜索，不扩大为桌面新增动作",
    "template-reset",
  ],
  [
    "OG-A-SELECT",
    "选择模板版本详情",
    "local",
    A("f6777d94811ef9af.1"),
    ["OG-A-SELECT"],
    "当前页模板按钮；归档仍可读，无busy禁用",
    "selectedTemplateId；详情从全部filteredTemplates取选中或首项，翻页不保证选中属于当前页",
    "select",
  ],
  [
    "OG-TECH",
    "折叠技术详情与请求追踪",
    "local",
    [...A("1c008f867673db60.1", "1c008f867673db60.2"), ...F("479570dac45574ea.1")],
    ["OG-TECH审批/模板", "OG-TECH 真实请求追踪展开/折叠，无API"],
    "审批/模板details；新F追踪仅真实requestId非空",
    "原生details，本页不复制、不弹窗、不发API；新F不是旧子技术详情图的获批范围",
    "request-technical-closed",
  ],
  [
    "OG-A-LINK",
    "审批工作台与组织审计",
    "navigation",
    A("cb237b82e3d08902.1", "a8c2e662cd00ee63.1"),
    ["OG-A-LINK审批/审计"],
    "只读页面底部RouterLink",
    "固定/tasks/approvals和/org-admin/audit，不切工作区、不携审批ID，不承诺精准直达",
    "approvals",
  ],
];
const parentInputs = [
  "form.name",
  "form.logo_url",
  "form.timezone",
  "form.data_retention_days",
  "form.default_workspace_id",
  "form.reason",
];
const fieldMeanings = {
  requestQuery:
    "标题/模板名/工作区名，trim中文小写；不搜索技术ID，无输入maxlength，URL恢复截200 UTF-16单位",
  requestStatus: "all/pending/approved/rejected/cancelled；改变条件回第一页",
  requestWorkspace: "按已返回模板的工作区名称筛选；同名合并，不伪造工作区ID选项",
  requestResource: "all/task/opportunity_decision；未知类型只能在all内显示",
  requestSort: "created_desc/created_asc/title_asc/status_asc；状态按显示文案排序",
  templateQuery:
    "模板名/工作区名，trim中文小写；不搜索节点或ID，无输入maxlength，URL恢复截200 UTF-16单位",
  templateStatus: "all/published/draft/archived；归档模板可阅读",
  templateWorkspace: "已返回模板工作区名称去重；同名合并，非新业务筛选规则",
  templateResource: "all/task/opportunity_decision，不修改会话工作区",
  templateSort:
    "name_asc/updated_desc/nodes_desc/workspace_asc；updated_desc按current_version而不是更新时间",
};
const scene = (name, pkg = packageNames[0]) => ({ package: pkg, scene: name });
export function buildOrgApprovalsReview(sources, packages) {
  const controls = packages.get(packageNames[1]),
    fields = packages.get(packageNames[2]),
    parent = packages.get(packageNames[3]);
  const dependencyHashes = Object.fromEntries(dependencies.map((f) => [f, hash(sources[f])]));
  for (const evidence of packages.values())
    for (const file of dependencies)
      if (evidence.sourceHashes[file])
        assert.equal(evidence.sourceHashes[file], dependencyHashes[file], `stale ${file}`);
  const actions = structuredClone(definitions).map(
    ([
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      condition,
      handler,
      representative,
    ]) => {
      const action = {
        actionId,
        label,
        kind,
        sourceCandidateIds,
        sourceContractKeys,
        contractAliasReason: "复用F04显式合同；同义入口、字段和渲染行数不新增业务动作。",
        condition,
        handler,
        variants: ["source-current"],
        scenes: [scene("normal")],
        visualStates: Object.fromEntries(
          ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
            s,
            kind === "excluded"
              ? "not-applicable-excluded"
              : kind === "wiring"
                ? "not-applicable-wiring"
                : "not-mapped",
          ]),
        ),
        testReferences: [
          {
            file: "scripts/verify-ui-phase2-org-approvals-controls-c.mjs",
            evidenceType: "offline-proposal-check-not-Vue",
          },
        ],
        remaining,
      };
      if (kind === "wiring") {
        action.forwardsTo = ["OG-RETRY"];
        action.forwardBindings = sourceCandidateIds.map((candidateId) => ({
          candidateId,
          event: "@reload",
          handler: "load()",
          targets: ["OG-RETRY"],
        }));
      }
      if (representative) {
        const control = controls.controls.find((c) => c.id === representative);
        assert.equal(control.actionId, actionId);
        action.visualStateReferences = {};
        for (const state of control.states) {
          action.visualStates[state] = "scene-reference-not-acceptance";
          action.visualStateReferences[state] = {
            ...scene(`${control.id}-${state}`, packageNames[1]),
            selector: control.selector,
            catalogControlId: control.id,
          };
        }
        action.representativeBoundary =
          "六态仅此旧稿代表控件；不自动覆盖其他入口、新F区域或全状态适用性。";
        action.controlCatalogBindings = controls.controls
          .filter((c) => !c.proposalOnly && c.actionId === actionId)
          .map((c) => ({
            id: c.id,
            package: packageNames[1],
            selector: c.selector,
            widths: c.widths,
            sourceCandidateIds: c.parentControl
              ? C(actionId === "OG-REFRESH" ? "b11692c0597885e3.1" : "97ed4772fb320d6c.1")
              : A(...c.signatures),
            states: Object.fromEntries(c.states.map((s) => [s, `${c.id}-${s}`])),
          }));
        action.scenes.push(
          ...action.controlCatalogBindings.flatMap((c) =>
            Object.values(c.states).map((n) => scene(n, packageNames[1])),
          ),
        );
      }
      return action;
    },
  );
  const inputs = [
    ...parentInputs.map((binding) => ({
      file: parentFile,
      binding,
      meaning: "P29资料分支，P34排除",
      remaining,
    })),
    ...fields.fields.map((f) => ({
      file: childFile,
      binding: f.binding,
      meaning: fieldMeanings[f.binding],
      remaining,
      fieldEvidence: {
        package: packageNames[2],
        id: f.id,
        selector: f.selector,
        states: Object.fromEntries(
          fields.cases.filter((c) => c.fieldId === f.id).map((c) => [c.state, c.id]),
        ),
      },
    })),
  ];
  return {
    schemaVersion: 1,
    pageId: "P34",
    route: "/org-admin/approvals",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes: dependencyHashes,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P34无业务弹窗。共享父原因窗无本页发起入口；模板详情article、技术details和aside说明都不是弹窗。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationApprovalPanel.vue": fields.fields.map((f) => f.binding),
      "OrganizationApprovalFirstFailure.vue": [],
    },
    propBindings: [
      {
        component: "OrganizationApprovalPanel",
        condition: "view===approvals",
        props: {
          templates: "data?.templates ?? []",
          approvals: "rows",
          summary: "data?.summary ?? {}",
          "status-text": "statusText",
          "summary-text": "summaryText",
          "format-time": "fmt",
        },
        events: [],
        meaning: "被动读取，无新增函数prop业务动作，也无busy传入；普通后台失败时筛选继续可用",
      },
    ],
    proposalOnlyControls: controls.controls
      .filter((c) => c.proposalOnly)
      .map((c) => ({
        id: c.id,
        package: packageNames[1],
        widths: c.widths,
        selector: c.selector,
        states: Object.fromEntries(c.states.map((s) => [s, `${c.id}-${s}`])),
        reason:
          c.id === "template-clear-empty"
            ? "历史提案标记保留；仅手机默认空结果组合已单独实施，不外推桌面或所有按钮状态"
            : "提案新增便捷结构，尚未成为本页真实源动作",
      })),
    implementedBindings: structuredClone(controls.implementedBindings),
    parentStates: parent.scenes.map((s) => ({
      id: s.id,
      phase: s.phase ?? null,
      replace: s.replace,
      failure: s.failure?.id ?? null,
      scene: scene(s.id, packageNames[3]),
      scope: "替换/保留行为依据真实父测试；外观仍逐区域审核",
    })),
    fieldCompositions: fields.compositions.map((c) => scene(c.id, packageNames[2])),
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: dependencies,
      includeStructuralContainers: true,
      dependencyHashes,
      inputs,
      containers: [
        {
          file: parentFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "summary组织资料表单，P34不展示",
          remaining,
          variants: [
            {
              name: "summary-excluded",
              evidenceScope: "route-excluded-reference",
              exclusionReason: "view===summary非approvals",
              scenes: [scene("normal")],
              remaining,
            },
          ],
        },
        {
          file: parentFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior: "父共享组件仍挂载，但P34无原因发起动作；不推断跨页已打开窗口终态",
          remaining,
          variants: [
            {
              name: "no-local-origin",
              evidenceScope: "route-excluded-reference",
              exclusionReason: "本页只有读/局部筛选/导航，没有ask调用入口",
              scenes: [scene("normal")],
              remaining,
            },
          ],
        },
        {
          file: childFile,
          tag: "aside",
          ordinal: 1,
          shape: "inline-aside",
          sourceBehavior: "持续的只读组织治理说明，无关闭动作；不是抽屉或对话框",
          remaining,
          variants: [
            {
              name: "readonly-notice",
              evidenceScope: "related-scene-only",
              scenes: [scene("normal"), scene("templates")],
              remaining,
            },
          ],
        },
      ],
      sharedRemaining: [
        "三个结构记录不等于三个本页弹窗；本页业务弹窗为0。",
        "模板详情article不被结构扫描当dialog；首版/无变化/差异阅读保持只读。",
      ],
    },
    implementationEvidence: [
      {
        review: "P34-MOBILE-EMPTY-VUE-REVIEW.md",
        evidence: "output/playwright/p34-mobile-template-filters/evidence.json",
        scope: "已批准手机筛选与空结果；以该报告列出的实际证据路径为准，不代表全页",
      },
      {
        review: "P34-FIRST-FAILURE-VUE-REVIEW.md",
        evidence: "output/playwright/p34-first-failure-vue/evidence.json",
        asOfCommit: "d2d566c2fceeef6ab1754f409475e2cf7582b8ef",
        scope:
          "历史首次500实施证据，固定在限流接入前提交；156检查52基线像素对比。当前500未变由新限流基线比较证明，不重标旧图为当前全状态验证",
      },
      {
        review: "P34-RATE-LIMIT-VUE-REVIEW.md",
        evidence: "output/playwright/p34-rate-limit-vue/evidence.json",
        scope: "仅首次无data/HTTP429/<=760；176检查52基线对比，保留旧500及其他状态；未生产验收",
      },
      {
        review: "P34-PARENT-READ-STATES-REVIEW.md",
        evidence: "output/playwright/p34-parent-read-states/evidence.json",
        scope: "实际App隔离HTTP56场景712检查；不是后端SQL/权限/真实网络或整页C批准",
      },
    ],
    approvalRecords: [
      "P34-MOBILE-FILTER-COMPOSITION-APPROVAL.md",
      "P34-MOBILE-EMPTY-COMPOSITION-APPROVAL.md",
      "P34-MOBILE-FIRST-FAILURE-COMPOSITION-APPROVAL.md",
      "P34-PERMISSION-TONE-R2-APPROVAL.md",
      "P34-MOBILE-RATE-LIMIT-COMPOSITION-APPROVAL.md",
    ],
    compositionGaps: [
      "顶部刷新仍待审；权限r2仅措辞批准未实施；限流手机白区组合已局部接入Vue，未部署。",
      "新失败F的其他按钮态、17父状态适用性及手机返回目录/筛选折叠尚未完整实施批准。",
      "同名工作区、最长内容、200%缩放、主题密度、全角色、组织切换/卸载/多实例时序及真实SQL/RBAC仍待验。",
      "source-reviewed不是整页完成；此前网络白色区域问题仍待用户答复。",
    ],
    limits: [remaining, "不修改API/OpenAPI/环境/依赖/数据库或部署；不以图册数量代替完整状态分母。"],
  };
}

export function validateOrgApprovalsBindings(review, packages) {
  const controls = packages.get(packageNames[1]),
    fields = packages.get(packageNames[2]),
    parent = packages.get(packageNames[3]);
  const seen = [];
  const shot = (pkg, sceneName, width, predicate = () => true) =>
    assert.ok(
      packages
        .get(pkg)
        .screenshots.some((s) => s.scene === sceneName && s.width === width && predicate(s)),
      `missing exact image ${sceneName}/${width}`,
    );
  for (const a of review.actions)
    for (const ref of a.controlCatalogBindings ?? []) {
      const c = controls.controls.find((c) => c.id === ref.id);
      assert.ok(c && !c.proposalOnly);
      assert.equal(ref.package, packageNames[1]);
      assert.equal(c.actionId, a.actionId);
      assert.equal(ref.selector, c.selector);
      assert.deepEqual(ref.widths, c.widths);
      const expected = c.parentControl
        ? C(a.actionId === "OG-REFRESH" ? "b11692c0597885e3.1" : "97ed4772fb320d6c.1")
        : A(...c.signatures);
      assert.deepEqual(ref.sourceCandidateIds, expected);
      for (const id of expected) assert.ok(a.sourceCandidateIds.includes(id));
      assert.deepEqual(Object.keys(ref.states), c.states);
      for (const [state, name] of Object.entries(ref.states))
        for (const width of ref.widths)
          shot(
            ref.package,
            name,
            width,
            (s) =>
              s.control?.id === c.id &&
              s.control.selector === c.selector &&
              s.control.actionId === a.actionId &&
              s.control.variant === state,
          );
      seen.push(c.id);
    }
  assert.deepEqual(
    seen.sort(),
    controls.controls
      .filter((c) => !c.proposalOnly)
      .map((c) => c.id)
      .sort(),
    "missing or duplicate catalog control",
  );
  assert.deepEqual(review.implementedBindings, controls.implementedBindings);
  assert.deepEqual(
    review.implementedBindings.map((b) => b.sourceSignature),
    ["97e57c58af0dc63f.1"],
  );
  assert.deepEqual(review.implementedBindings[0].widths, [390]);
  assert.ok(controls.sourceSignatures.includes(review.implementedBindings[0].sourceSignature));
  const expectedChildIds = controls.sourceSignatures.map((s) => `${childFile}#${s}`).sort();
  assert.deepEqual(
    review.actions
      .flatMap((a) => a.sourceCandidateIds)
      .filter((s) => s.startsWith(childFile + "#"))
      .sort(),
    expectedChildIds,
    "child source omissions",
  );
  assert.deepEqual(
    review.proposalOnlyControls.map((c) => c.id).sort(),
    controls.controls
      .filter((c) => c.proposalOnly)
      .map((c) => c.id)
      .sort(),
  );
  for (const ref of review.proposalOnlyControls) {
    const c = controls.controls.find((c) => c.id === ref.id);
    assert.deepEqual(ref.widths, c.widths);
    assert.equal(ref.selector, c.selector);
    assert.equal(ref.package, packageNames[1]);
    assert.deepEqual(Object.keys(ref.states), c.states);
    for (const [state, n] of Object.entries(ref.states))
      for (const width of ref.widths)
        shot(
          ref.package,
          n,
          width,
          (s) => s.control?.id === c.id && s.control.variant === state && s.proposalOnly,
        );
  }
  const fieldIds = [];
  for (const input of review.surfaceReview.inputs.filter((i) => i.file === childFile)) {
    const r = input.fieldEvidence,
      f = fields.fields.find((f) => f.id === r.id);
    assert.equal(r.package, packageNames[2]);
    assert.equal(f.binding, input.binding);
    assert.equal(f.selector, r.selector);
    const cases = fields.cases.filter((c) => c.fieldId === f.id);
    assert.deepEqual(r.states, Object.fromEntries(cases.map((c) => [c.state, c.id])));
    for (const [state, n] of Object.entries(r.states))
      for (const width of [1440, 390])
        shot(
          r.package,
          n,
          width,
          (s) =>
            s.field?.id === f.id &&
            s.field.binding === f.binding &&
            s.field.selector === r.selector &&
            s.field.state === state,
        );
    fieldIds.push(f.id);
  }
  assert.deepEqual(
    fieldIds,
    fields.fields.map((f) => f.id),
  );
  assert.deepEqual(
    review.fieldCompositions,
    fields.compositions.map((c) => scene(c.id, packageNames[2])),
  );
  for (const r of review.fieldCompositions)
    for (const w of [1440, 390]) shot(r.package, r.scene, w);
  assert.deepEqual(
    review.parentStates.map((s) => s.id),
    parent.scenes.map((s) => s.id),
  );
  for (const r of review.parentStates) {
    const original = parent.scenes.find((s) => s.id === r.id);
    assert.equal(r.phase, original.phase ?? null);
    assert.equal(r.replace, original.replace);
    assert.equal(r.failure, original.failure?.id ?? null);
    assert.deepEqual(r.scene, scene(r.id, packageNames[3]));
    for (const w of [1440, 390]) shot(r.scene.package, r.scene.scene, w);
  }
  return {
    controls: seen.length,
    proposalOnlyControls: review.proposalOnlyControls.length,
    sourceSites: review.actions.reduce((n, a) => n + a.sourceCandidateIds.length, 0),
    fields: fieldIds.length,
    fieldStates: fields.cases.length,
    fieldCompositions: review.fieldCompositions.length,
    parentStates: review.parentStates.length,
  };
}

export function readOrgApprovalsReviewInputs() {
  return {
    sources: Object.fromEntries(dependencies.map((f) => [f, readFileSync(f, "utf8")])),
    packages: new Map(
      packageNames.map((p) => [
        p,
        JSON.parse(readFileSync(`${base}/design/${p}/evidence.json`, "utf8")),
      ]),
    ),
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const { sources, packages } = readOrgApprovalsReviewInputs(),
    review = buildOrgApprovalsReview(sources, packages),
    result = validateOrgApprovalsBindings(review, packages),
    target = `${base}/action-reviews/P34.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(review, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), review);
  console.log(JSON.stringify({ pageId: "P34", ...result, approval: review.approval }));
}
