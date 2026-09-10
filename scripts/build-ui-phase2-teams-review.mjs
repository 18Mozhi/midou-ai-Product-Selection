import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationTeamPanel.vue";
export const dependencies = [
  parentFile,
  childFile,
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
];
export const packageNames = [
  "teams-direction-c",
  "teams-controls-direction-c",
  "teams-fields-direction-c",
];
const remaining =
  "源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。";
// Explicit identities from the organization governance contract, not inferred from labels.
const definitions = [
  [
    parentFile,
    "EX-P34-FIRST-FAILURE",
    "P34首次读取失败转发（非本页）",
    "excluded",
    ["5ae31bc55551b1dc.1"],
    ["OG-RETRY"],
    "仅view===approvals且error、无data、HTTP500；非P33",
    "P33不渲染此分支；P34复用原load()，不计入本页动作",
    null,
    ["normal"],
  ],
  [
    parentFile,
    "OG-REFRESH",
    "刷新团队",
    "read",
    ["b11692c0597885e3.1"],
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load(background)读取summary、teams和members；子busy不包含refreshing",
    "refresh",
    ["normal", "refreshing", "refresh_error"],
  ],
  [
    parentFile,
    "OG-RETRY",
    "重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["OG-RETRY"],
    "父错误分支，无disabled",
    "load()不绕过权限",
    "retry-error",
    ["error", "blocked", "expired", "forbidden", "rate_limited"],
  ],
  [
    parentFile,
    "EX-P29-PROFILE",
    "资料分支排除",
    "excluded",
    ["d6b520278ab3dd57.1", "5878e30377f290ae.1", "1cbd108c64b5230c.1"],
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary",
    "P33不显示资料表单",
    null,
    ["normal"],
  ],
  [
    parentFile,
    "EX-P30-MEMBERS",
    "成员分支排除",
    "excluded",
    ["6a563eeaa67fea90.1"],
    ["P30全部成员事件父转发，复用M语义"],
    "仅members",
    "不计入团队动作",
    null,
    ["normal"],
  ],
  [
    parentFile,
    "EX-P31-ROLES",
    "授权分支排除",
    "excluded",
    ["b09d7923228aabe6.1"],
    ["P31资源授权父转发，复用已有合同"],
    "仅roles",
    "不计入团队动作",
    null,
    ["normal"],
  ],
  [
    parentFile,
    "D-OG-REASON",
    "分配与移除原因",
    "local",
    ["773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1"],
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
    ],
    "成员操作先等原因",
    "共享窗trim至少2字、前端无max；先关闭再写，取消零写",
    "reason-assign-confirm",
    ["reason_assign", "reason_remove", "reason_short", "reason_long"],
  ],
  [
    parentFile,
    "EX-P36-TOKEN",
    "令牌原因排除",
    "excluded",
    ["e828f4ab0fdb0415.1"],
    ["D-OG-REASON令牌轮换/撤销调用"],
    "仅Token函数",
    "共享helper不等于其他页验收",
    null,
    ["normal"],
  ],
  [
    childFile,
    "OG-T-OPEN",
    "打开创建",
    "local",
    ["dea8d744b50ed1f0.1", "9f5ea38e58a26f78.1"],
    ["OG-T-OPEN头部/空态"],
    "头部busy禁用，空态入口无同样绑定",
    "展开聚焦名称，不清草稿",
    "open",
    ["normal", "empty", "create"],
  ],
  [
    childFile,
    "OG-T-CREATE",
    "创建团队",
    "write",
    ["1ea0ce8ecc982edd.1", "bae4e728dfc90592.1"],
    ["OG-T-CREATE"],
    "busy或createBusy防重",
    "四字段经函数prop创建，名称/流程键/原因trim；失败保留，成功清空收起，等待可编辑",
    "create",
    [
      "create_draft",
      "create_optional_empty",
      "create_required",
      "create_busy",
      "create_failure",
      "create_success",
      "create_read_failed",
    ],
  ],
  [
    childFile,
    "OG-T-CANCEL",
    "取消创建",
    "local",
    ["617ab4a17066056a.1"],
    ["OG-T-CANCEL"],
    "仅createBusy禁用及早退",
    "清四字段并收起，不请求服务",
    "cancel-create",
    ["create_draft", "create_busy"],
  ],
  [
    childFile,
    "OG-T-FILTER",
    "状态与筛选重置",
    "local",
    [
      "cde0a7cecbbc9a09.1",
      "18ece981bcb15fca.1",
      "56fb9bb2ac849bf0.1",
      "66725db5db9a8fe8.1",
      "83a359c9f404cb11.1",
    ],
    ["OG-T-FILTER状态/重置/清除"],
    "无busy禁用；空结果按钮需全量非空",
    "all/active/archived及query/sort本地筛选，变化回第一页，重置不清选择或草稿",
    "status-all-available",
    ["catalog", "archived", "filter_empty"],
  ],
  [
    childFile,
    "OG-T-SELECT",
    "选择团队",
    "local",
    ["95629c96c6d7c41b.1"],
    ["OG-T-SELECT"],
    "pageItems，无busy禁用",
    "原id选择；watch清操作成员与反馈，详情按全量数组查找；button role=listitem仍待修",
    "select",
    ["selected", "switched_pending"],
  ],
  [
    childFile,
    "OG-T-PAGE",
    "前后分页",
    "local",
    ["3619d28a163df5ce.1", "d56d9b5edd39513e.1"],
    ["OG-T-PAGE"],
    "结果超过8条展示；边界禁用",
    "本地page减增，不新GET",
    "previous",
    ["catalog", "page_two"],
  ],
  [
    childFile,
    "OG-T-MEMBER",
    "分配与移除成员",
    "write",
    ["9fbd42d272c62579.1", "917ad4e4a5730305.1"],
    ["OG-T-MEMBER分配/移除"],
    "busy或memberBusy防重；未选只提示，归档不额外禁用",
    "等原因后POST action/membership_id/reason，无expected_version；成功后读当前选择有OG-G02风险",
    "assign",
    [
      "member_missing",
      "locked_member",
      "no_members",
      "archived",
      "member_busy",
      "member_failure",
      "member_success",
      "switched_pending",
    ],
  ],
  [
    childFile,
    "OG-T-LINK",
    "成员与工作区入口",
    "navigation",
    ["76054446429e86da.1", "2db399169624cf8a.1"],
    ["OG-T-LINK成员/工作区"],
    "有选择时显示，无busy禁用",
    "RouterLink去成员或工作区，不修改会话范围",
    "members",
    ["selected"],
  ],
  [
    childFile,
    "OG-TECH",
    "技术详情",
    "local",
    ["1c008f867673db60.1"],
    ["OG-TECH"],
    "所选团队存在",
    "原生details展示团队及负责人成员关系ID，不是弹窗/复制",
    "technical",
    ["technical"],
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
const fields = [
  ["form.name", "name", "required/max120，提交trim，等待仍编辑"],
  ["form.lead_membership_id", "lead", "可留空；活动成员不排除锁定账号；负责人创建时加入团队"],
  ["form.default_workflow_key", "workflow", "可留空/max80；trim，不检查流程存在"],
  ["form.reason", "reason", "required/max500，trim，不追加共享原因最短2字规则"],
  ["query", "query", "仅名称/负责人邮箱/流程键，trim小写，不搜索成员名单"],
  ["sort", "sort", "name_asc/members_desc/updated_desc；后两者并列按名称"],
  ["selectedMembershipId", "member", "当前组织活动成员；非原生required；换团队清空，等待仍编辑"],
];
export function buildTeamsReview(sources, packages) {
  const [original, controls, fieldEvidence] = packageNames.map((n) => packages.get(n));
  const dependencyHashes = Object.fromEntries(
    dependencies.map((file) => {
      const sha = createHash("sha256").update(sources[file].replaceAll("\r\n", "\n")).digest("hex");
      for (const e of [original, controls, fieldEvidence])
        assert.equal(e.sourceHashes[file], sha, `stale team source ${file}`);
      return [file, sha];
    }),
  );
  const scenes = (names, pkg = packageNames[0]) => names.map((scene) => ({ package: pkg, scene }));
  const variant = (name, evidenceScope, pkg = packageNames[0]) => ({
    name,
    evidenceScope,
    scenes: scenes([name], pkg),
    remaining,
  });
  const actions = definitions.map(
    ([
      file,
      actionId,
      label,
      kind,
      signatures,
      sourceContractKeys,
      condition,
      handler,
      representative,
      names,
    ]) => {
      const action = {
        actionId,
        label,
        kind,
        sourceCandidateIds: signatures.map((s) => `${file}#${s}`),
        sourceContractKeys,
        contractAliasReason: "按既有OG-T合同分组；控件变体不算新增业务动作。",
        condition,
        handler,
        variants: names,
        scenes: scenes(names),
        visualStates: Object.fromEntries(
          ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
            s,
            kind === "excluded" ? "not-applicable-excluded" : "not-mapped",
          ]),
        ),
        testReferences: packageNames.map((p, i) => ({
          file: [
            "scripts/verify-ui-phase2-teams-c.mjs",
            "scripts/verify-ui-phase2-teams-controls-c.mjs",
            "scripts/verify-ui-phase2-teams-fields-c.mjs",
          ][i],
          evidenceType: "offline-proposal-check-not-Vue",
        })),
        remaining,
      };
      if (representative) {
        const c = controls.controls.find((c) => c.id === representative);
        assert.equal(c.actionId, actionId);
        action.visualStateReferences = {};
        for (const state of c.states) {
          action.visualStates[state] = "scene-reference-not-acceptance";
          action.visualStateReferences[state] = {
            package: packageNames[1],
            scene: `${c.id}-${state}`,
            selector: c.selector,
            catalogControlId: c.id,
          };
        }
        action.controlCatalogBindings = controls.controls
          .filter((c) => c.actionId === actionId)
          .map((c) => ({
            id: c.id,
            selector: c.selector,
            package: packageNames[1],
            sourceCandidateIds: c.signatures.map((s) => `${childFile}#${s}`),
            states: Object.fromEntries(c.states.map((s) => [s, `${c.id}-${s}`])),
          }));
        for (const c of action.controlCatalogBindings)
          action.scenes.push(...scenes(Object.values(c.states), packageNames[1]));
      }
      return action;
    },
  );
  const inputs = [
    ...parentInputs.map((binding) => ({
      file: parentFile,
      binding,
      meaning: "仅P29资料表单，P33排除",
      remaining,
    })),
    ...fields.map(([binding, id, meaning]) => {
      const f = fieldEvidence.fields.find((f) => f.id === id);
      assert.equal(f.model, binding);
      return {
        file: childFile,
        binding,
        meaning,
        remaining,
        fieldEvidence: {
          package: packageNames[2],
          id,
          selector: f.selector,
          states: Object.fromEntries(f.states.map((s) => [s, `${id}-${s}`])),
        },
      };
    }),
  ];
  return {
    schemaVersion: 1,
    pageId: "P33",
    route: "/org-admin/teams",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes: Object.fromEntries([parentFile, childFile].map((f) => [f, dependencyHashes[f]])),
    actions,
    functionProps: [
      {
        file: parentFile,
        component: "OrganizationTeamPanel",
        attribute: "create-team",
        handler: "createTeam",
        consumer: "props.createTeam",
        actionId: "OG-T-CREATE",
      },
      {
        file: parentFile,
        component: "OrganizationTeamPanel",
        attribute: "perform-member-action",
        handler: "teamMemberAction",
        consumer: "props.performMemberAction",
        actionId: "OG-T-MEMBER",
      },
    ],
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "分配/移除共用一个原因窗；创建为内联form，不是第二弹窗。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationTeamPanel.vue": fields.map(([binding]) => binding),
    },
    sharedReasonInput: {
      file: dependencies[2],
      binding: "reason",
      minimumLength: 2,
      maximumLength: null,
      serverMaximumLength: 500,
      remaining: "旧稿max500不是实际前端规则，未获本批批准",
    },
    proposalOnlyControls: controls.controls
      .filter((c) => c.proposalOnly)
      .map((c) => ({ id: c.id, reason: "筛选details是提案新增结构，不计为真实业务控件" })),
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [parentFile, childFile],
      includeStructuralContainers: true,
      dependencyHashes,
      inputs,
      containers: [
        {
          file: parentFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "summary资料表单，teams分支排除",
          remaining,
          variants: [
            { ...variant("normal", "route-excluded-reference"), exclusionReason: "仅summary分支" },
          ],
        },
        {
          file: parentFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior: "分配/移除先等原因，取消零写；关闭后写入",
          remaining,
          variants: [
            ...["reason_assign", "reason_remove", "reason_short", "reason_long"].map((n) =>
              variant(n, "matching-dialog-scene"),
            ),
            ...["composition-assign", "composition-remove"].map((n) =>
              variant(n, "matching-dialog-scene", packageNames[1]),
            ),
          ],
        },
        {
          file: childFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "四字段内联创建；成功/取消清空，失败保留，等待字段仍编辑",
          remaining,
          variants: Object.keys(fieldEvidence.combinations)
            .filter((n) => n.startsWith("create"))
            .map((n) => variant(`composition-${n}`, "matching-inline-form-scene", packageNames[2])),
        },
      ],
      sharedRemaining: [
        "原型不是完整Vue响应性、原生缩放、多主题、多角色或真实权限/审计证明。",
        "成员操作选择区不是原生form，不计第四表单；两张成员组合单独关联该字段。",
      ],
    },
    memberCombinations: scenes(
      ["composition-member-missing", "composition-member-archived"],
      packageNames[2],
    ),
    compositionGaps: [
      "OG-G02：成员请求等待后读取后来选择，可能异常或错误归属；图稿保护未进入Vue。",
      "创建成功清除后续草稿；共享原因max500/晚到结果保护仍属未批准提案；不决定新政策。",
      "代表六态未映射部分仍需适用性审查，不把179个列明控件状态当全部状态空间。",
    ],
    limits: [remaining, "P31/P32局部批准不外推P33；无生产源码/API/env/依赖/权限/部署变化。"],
  };
}

// Validate all catalog and field references, not only a representative of each action.
export function validateTeamsEvidenceBindings(review, packages) {
  const controls = packages.get(packageNames[1]),
    fieldsEvidence = packages.get(packageNames[2]);
  const seen = [],
    signatures = [];
  const shot = (e, scene, predicate) => {
    for (const width of [1440, 390])
      assert.ok(
        e.screenshots.some((s) => s.scene === scene && s.width === width && predicate(s)),
        `missing exact scene ${scene}/${width}`,
      );
  };
  for (const action of review.actions)
    for (const ref of action.controlCatalogBindings || []) {
      assert.equal(ref.package, packageNames[1]);
      const c = controls.controls.find((c) => c.id === ref.id);
      assert.ok(c && !c.proposalOnly);
      assert.equal(c.actionId, action.actionId);
      assert.equal(c.selector, ref.selector);
      assert.deepEqual(
        ref.sourceCandidateIds,
        c.signatures.map((s) => `${childFile}#${s}`),
      );
      for (const id of ref.sourceCandidateIds)
        assert.ok(
          action.sourceCandidateIds.includes(id),
          "source control belongs to another action",
        );
      assert.deepEqual(Object.keys(ref.states), c.states);
      for (const [state, scene] of Object.entries(ref.states))
        shot(
          controls,
          scene,
          (s) =>
            s.control?.id === c.id &&
            s.control.variant === state &&
            s.control.selector === ref.selector &&
            s.control.actionId === action.actionId,
        );
      seen.push(c.id);
      signatures.push(...ref.sourceCandidateIds);
    }
  assert.deepEqual(
    seen.sort(),
    controls.controls
      .filter((c) => !c.proposalOnly)
      .map((c) => c.id)
      .sort(),
    "control omissions or duplicate",
  );
  assert.deepEqual(
    signatures.sort(),
    review.actions
      .flatMap((a) => a.sourceCandidateIds)
      .filter((id) => id.startsWith(childFile + "#"))
      .sort(),
    "child signature omissions",
  );
  for (const input of review.surfaceReview.inputs.filter((i) => i.file === childFile)) {
    const ref = input.fieldEvidence,
      f = fieldsEvidence.fields.find((f) => f.id === ref.id);
    assert.equal(ref.package, packageNames[2]);
    assert.equal(f.model, input.binding);
    assert.equal(f.selector, ref.selector);
    assert.deepEqual(Object.keys(ref.states), f.states);
    for (const [state, scene] of Object.entries(ref.states))
      shot(fieldsEvidence, scene, (s) => s.field === ref.id && s.variant === state);
  }
  for (const ref of review.memberCombinations) {
    assert.equal(ref.package, packageNames[2]);
    shot(fieldsEvidence, ref.scene, (s) => s.composition === true);
  }
  return {
    controls: seen.length,
    sourceSignatures: signatures.length,
    fields: fieldsEvidence.fields.length,
    fieldStates: fieldsEvidence.fields.reduce((n, f) => n + f.states.length, 0),
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const sources = Object.fromEntries(dependencies.map((f) => [f, readFileSync(f, "utf8")]));
  const packages = new Map(
    packageNames.map((p) => [
      p,
      JSON.parse(readFileSync(`${base}/design/${p}/evidence.json`, "utf8")),
    ]),
  );
  const result = buildTeamsReview(sources, packages),
    bindings = validateTeamsEvidenceBindings(result, packages);
  const target = `${base}/action-reviews/P33.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), result);
  console.log(
    JSON.stringify({
      pageId: result.pageId,
      groups: result.actions.length,
      ...bindings,
      approval: result.approval,
    }),
  );
}
