import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationRolePanel.vue";
export const dependencies = [
  parentFile,
  childFile,
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
  "apps/web/src/use-modal-dialog.ts",
];
const pkg = "roles-direction-c";
const remaining =
  "仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。";
// Source identities and contract keys are reviewed explicitly, never inferred from labels.
const definitions = [
  [
    parentFile,
    "EX-P34-FIRST-FAILURE",
    "P34首次读取失败转发（非本页）",
    "excluded",
    ["5ae31bc55551b1dc.1"],
    ["OG-RETRY"],
    "仅view===approvals且error、无data、HTTP500；非P31",
    "P31不渲染此分支；P34复用原load()，不计入本页动作",
    ["roles"],
  ],
  [
    parentFile,
    "OG-REFRESH",
    "刷新角色权限",
    "read",
    ["b11692c0597885e3.1"],
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load(background)并行读取角色/授权/成员/工作区/当前页授权/可授予成员及三状态计数；现有roles图不证明父级刷新态",
    ["roles"],
  ],
  [
    parentFile,
    "OG-RETRY",
    "重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["OG-RETRY"],
    "六种错误页面显示；无disabled绑定",
    "load()重新读取，不绕过权限；现有roles图不证明父级错误态",
    ["roles"],
  ],
  [
    parentFile,
    "EX-P29-PROFILE",
    "组织资料分支排除",
    "excluded",
    ["d6b520278ab3dd57.1", "1cbd108c64b5230c.1", "5878e30377f290ae.1"],
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "summary分支非P31",
    "不重复计资料提交/Logo检查",
    ["roles"],
  ],
  [
    parentFile,
    "EX-P30-MEMBERS",
    "成员分支排除",
    "excluded",
    ["6a563eeaa67fea90.1"],
    ["P30全部成员事件父转发，复用M语义"],
    "members分支非P31",
    "固定角色分配在P30；不把模板选择当角色写入",
    ["roles"],
  ],
  [
    parentFile,
    "WIRE-ROLES",
    "角色子组件接线",
    "wiring",
    ["b09d7923228aabe6.1"],
    ["P31资源授权父转发，复用已有合同"],
    "view===roles；传busy || refreshing",
    "六个显式事件归到子组件八个目标动作，不重复计业务操作",
    ["grants"],
  ],
  [
    parentFile,
    "D-OG-REASON",
    "撤销原因确认调用",
    "local",
    ["773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1"],
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
    ],
    "撤销先ask，非创建/延期确认",
    "trim至少2字；共享输入无maxlength，API最多500；先关窗再写，取消零写，错误在父页",
    ["revoke", "revoke-invalid"],
  ],
  [
    parentFile,
    "EX-P36-TOKEN-REASON",
    "令牌原因排除",
    "excluded",
    ["e828f4ab0fdb0415.1"],
    ["D-OG-REASON令牌轮换/撤销调用"],
    "P36发起",
    "共享helper不证明其他路由生命周期通过",
    ["roles"],
  ],
  [
    childFile,
    "role.section.{section}",
    "角色/范围/授权分区",
    "local",
    ["24237df37bd7b7e4.1"],
    [],
    "三分区无busy禁用",
    "activeSection本地切换；保留局部筛选与父级创建草稿",
    ["roles", "scopes", "grants"],
  ],
  [
    childFile,
    "role.select.{roleCode}",
    "选择只读模板",
    "local",
    ["f7e8f2a9a0457015.1"],
    [],
    "filteredRoles内，无busy禁用",
    "仅selectedRoleCode；筛选不含原始role.code，选中不在结果时回退首项",
    ["roles", "role-auditor", "role-query-empty"],
  ],
  [
    childFile,
    "role.capability.technical.toggle",
    "技术能力披露",
    "local",
    ["23a85da051801987.1"],
    [],
    "selectedRole存在",
    "原生details/summary，不是弹窗",
    ["role-technical"],
  ],
  [
    childFile,
    "role.capability.filter.reset",
    "重置能力筛选",
    "local",
    ["be3f3fa4fcf2fb2c.1"],
    [],
    "query与group均空禁用",
    "清capabilityQuery/group，不清roleQuery；能力匹配中文及原始能力名",
    ["roles", "matrix-empty"],
  ],
  [
    childFile,
    "role.scope.filter.reset",
    "重置范围筛选",
    "local",
    ["5235116f7947ac74.1"],
    [],
    "query与scope均空禁用",
    "清scopeQuery/filter；成员范围可重叠计数，非互斥总数",
    ["scopes", "scopes-empty"],
  ],
  [
    childFile,
    "grant.create.form.toggle",
    "展开或取消创建",
    "local",
    ["0aac14fac3c56e10.1"],
    [],
    "canManage；无busy禁用",
    "只切showGrantForm，隐藏不会清父级grantForm",
    ["grants", "create-opportunity"],
  ],
  [
    childFile,
    "grant.create.submit",
    "创建授权",
    "write",
    ["27eeda4bb377f413.1", "b75d50f1f8f0cc17.1"],
    [],
    "canManage内联表单；busy或actions空禁按钮；父函数busy早退",
    "POST /org/:organizationId/resource-grants；spread原form、去重actions、trim reason、ISO expires_at；成功清当前草稿部分字段并重读；提交中新增编辑可能被清",
    [
      "create-task",
      "create-opportunity",
      "create-competitor",
      "create-sourcing",
      "create-invalid-expiry",
      "create-busy",
    ],
  ],
  [
    childFile,
    "grant.create.type.change",
    "选择资源类型",
    "local",
    ["f0c0d3b1c8ae684b.1"],
    [],
    "required受控select，忙碌仍可编辑",
    "updateResourceGrantType把actions重置该类型第一动作；保持resource_id，不自动请求资源目录",
    ["create-task", "create-opportunity", "create-competitor", "create-sourcing"],
  ],
  [
    childFile,
    "grant.status.select.{status}",
    "授权状态筛选",
    "read",
    ["8bd3f7b2e5dcb44f.1"],
    [],
    "busy含refreshing时禁用",
    "all/active/expired/revoked；父检查refreshing，设page1后load；不是本地查询",
    ["grants", "grants-filter-empty"],
  ],
  [
    childFile,
    "grant.select.{grantId}",
    "选择当前页授权",
    "local",
    ["a162032f86484b89.1"],
    [],
    "filteredGrants内，无busy禁用",
    "仅selectedGrantId；selectedGrant watcher遇新对象清延期草稿；无选中则保留旧草稿",
    ["grants", "grants-search-empty"],
  ],
  [
    childFile,
    "grant.technical.toggle",
    "披露资源与授权编号",
    "local",
    ["5f937fb211eb5840.1"],
    [],
    "selectedGrant存在",
    "原生details；不执行导航或查询",
    ["grant-technical"],
  ],
  [
    childFile,
    "grant.expiry.submit",
    "更新授权到期时间",
    "write",
    ["201e6ad7077e4318.1", "8c59567be7cef9a3.1"],
    [],
    "canManage且effective_status active；busy禁用",
    "PATCH /org/:organizationId/resource-grants/:id/expiry；expected_version/reason.trim/expires_at；子日期min按原expiry下一分钟与现有min取大，就地表达不得早于或等于原expiry；父函数验未来30天，服务仍最终检查grant_expiry_not_extended；隔离submit替身不证明服务器接受",
    ["grants", "extend-busy"],
  ],
  [
    childFile,
    "grant.revoke.request",
    "请求撤销授权",
    "write",
    ["5be3d5846e4138fa.1"],
    [],
    "canManage且active；busy禁用",
    "先原因确认后POST /org/:organizationId/resource-grants/:id/revoke，expected_version/reason；organizationId及version在await后读取，跨范围归属仍待",
    ["grants", "revoke", "revoke-invalid"],
  ],
  [
    childFile,
    "grant.page.previous",
    "授权上一页",
    "read",
    ["bf5c2f057a07f3f3.1"],
    [],
    "meta.total真；busy或page<=1禁用",
    "updateGrantPage(page-1)，父检查refreshing/page<1后load",
    ["grants"],
  ],
  [
    childFile,
    "grant.page.next",
    "授权下一页",
    "read",
    ["085ead5af6973fef.1"],
    [],
    "meta.total真；busy或page>=pageCount禁用",
    "updateGrantPage(page+1)读新页，不是本地分页；现有单页图不证明可翻页状态",
    ["grants"],
  ],
  [
    childFile,
    "grant.create.form.open",
    "创建首条授权",
    "local",
    ["a6d03f8144116449.1"],
    [],
    "grantTotal===0且canManage，无busy禁用",
    "showGrantForm=true；不直接提交，不把无授权误作无角色",
    ["grants-none", "roles-no-grants"],
  ],
  [
    childFile,
    "grant.status.all",
    "查看全部授权",
    "read",
    ["cd26859a239383fd.1"],
    [],
    "grantTotal>0但meta.total空；busy禁用",
    "父更新status all、page1并读取；不是清grantQuery",
    ["grants-filter-empty"],
  ],
];
const eventTargets = [
  ["@update-grant-type", "updateResourceGrantType", ["grant.create.type.change"]],
  [
    "@update-grant-status",
    "updateResourceGrantStatus",
    ["grant.status.select.{status}", "grant.status.all"],
  ],
  ["@update-grant-page", "updateResourceGrantPage", ["grant.page.previous", "grant.page.next"]],
  ["@create-grant", "createResourceGrant", ["grant.create.submit"]],
  ["@extend-grant", "extendResourceGrant", ["grant.expiry.submit"]],
  ["@revoke-grant", "revokeResourceGrant", ["grant.revoke.request"]],
];
const parentInputs = [
  "form.name",
  "form.logo_url",
  "form.timezone",
  "form.data_retention_days",
  "form.default_workspace_id",
  "form.reason",
];
const childInputs = [
  ["roleQuery", "已加载角色名称/描述/中文能力的trim小写查询；不搜索原始role.code"],
  ["capabilityQuery", "已加载能力中文和原始能力名称查询"],
  ["capabilityGroup", "已加载能力分组选择，不调用API"],
  ["scopeQuery", "已加载成员姓名/邮箱/团队查询"],
  ["scopeFilter", "own/team/workspace/organization本地筛选"],
  ["grantForm.workspace_id", "required，来自当前工作区列表；不扩大读取范围"],
  [
    "grantForm.resource_id",
    "required trim UUID v1–5及变体模式；2026-09-10用户确认保留从真实详情复制UUID，不新增按名称选资源",
  ],
  [
    "grantForm.grantee_membership_id",
    "required，只从grantTargets对象列表选择，不以所有members替代",
  ],
  ["grantForm.actions", "按类型白名单多选；checkbox无原生required，按钮及父函数保护至少一项"],
  ["grantForm.reason", "required trim maxlength500；不同于共享撤销窗前端至少2字且无max"],
  [
    "grantForm.expires_at",
    "required datetime-local；min/max在setup生成；父级提交按当前时间重新检查未来30天",
  ],
  ["grantQuery", "只搜索当前页成员/工作区/中文类型/中文动作；不搜索授权或资源UUID、reason"],
  ["grantMutation.reason", "required trim maxlength500；选中授权对象变化会重置"],
  [
    "grantMutation.expires_at",
    "required datetime-local；默认现在+7天，原期限下一可选分钟与原min取大；就地错误关联；不是原expiry+7天",
  ],
];
export function buildRolesReview(sources, evidence, controlsEvidence, fieldEvidence) {
  const dependencyHashes = Object.fromEntries(
    dependencies.map((file) => {
      assert.equal(typeof sources[file], "string", `missing source ${file}`);
      const sha = createHash("sha256").update(sources[file].replaceAll("\r\n", "\n")).digest("hex");
      // The older 48-image package did not bind use-modal-dialog; bind it as a fresh source read only.
      if (file !== dependencies[4])
        assert.equal(evidence.sourceHashes[file], sha, "verify current roles proposal");
      return [file, sha];
    }),
  );
  const actions = definitions.map(
    ([file, actionId, label, kind, signatures, keys, condition, handler, variants]) => ({
      actionId,
      label,
      kind,
      sourceCandidateIds: signatures.map((sig) => `${file}#${sig}`),
      sourceContractKeys: [actionId],
      priorContractKeys: keys.length ? keys : [actionId],
      contractAliasReason: "源码合同明确身份归一；父事件接线与业务操作分别登记。",
      condition,
      handler,
      variants,
      scenes: variants.map((scene) => ({ package: pkg, scene })),
      visualStates: Object.fromEntries(
        ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
          state,
          kind === "excluded"
            ? "not-applicable-excluded"
            : kind === "wiring"
              ? "not-applicable-wiring"
              : "not-mapped",
        ]),
      ),
      testReferences: [
        {
          file: "scripts/verify-ui-phase2-roles-c.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
    }),
  );
  const wire = actions.find((a) => a.kind === "wiring");
  const controlPackage = "roles-controls-direction-c";
  const fieldPackage = "roles-fields-direction-c";
  assert.deepEqual(
    Object.keys(fieldEvidence.fieldVisualReferences).sort(),
    [...childInputs.map(([binding]) => binding), "grantForm.resource_type", "reason"].sort(),
    "exact sixteen role fields",
  );
  const fieldRef = (binding) => ({
    package: fieldPackage,
    ...fieldEvidence.fieldVisualReferences[binding],
  });
  for (const file of dependencies.slice(0, 4)) {
    assert.equal(
      controlsEvidence.sourceHashes[file],
      dependencyHashes[file],
      "verify current roles controls",
    );
    assert.equal(
      fieldEvidence.sourceHashes[file],
      dependencyHashes[file],
      "verify current roles fields",
    );
  }
  assert.deepEqual(
    Object.keys(controlsEvidence.actionVisualReferences).sort(),
    actions
      .filter(
        (a) =>
          !["wiring", "excluded"].includes(a.kind) &&
          !["OG-REFRESH", "OG-RETRY"].includes(a.actionId),
      )
      .map((a) => a.actionId)
      .sort(),
    "exact eighteen role control representatives",
  );
  for (const action of actions) {
    const primary = controlsEvidence.actionVisualReferences[action.actionId];
    if (!primary) continue;
    action.visualStateReferences = {};
    for (const [state, scene] of Object.entries(primary.states)) {
      action.visualStates[state] = "scene-reference-not-acceptance";
      action.visualStateReferences[state] = {
        package: controlPackage,
        scene,
        selector: primary.selector,
      };
      action.scenes.push({ package: controlPackage, scene });
    }
    action.additionalControlVariants = Object.entries(controlsEvidence.controlVariantReferences)
      .filter(([, ref]) => ref.actionId === action.actionId)
      .map(([key, ref]) => {
        for (const scene of Object.values(ref.states))
          action.scenes.push({ package: controlPackage, scene });
        return {
          key,
          scope: "additional-control-variant-not-new-action",
          package: controlPackage,
          selector: ref.selector,
          states: ref.states,
        };
      });
    action.testReferences.push({
      file: "scripts/verify-ui-phase2-roles-controls-c.mjs",
      evidenceType: "offline-proposal-check-not-Vue",
    });
  }
  wire.forwardsTo = [...new Set(eventTargets.flatMap(([, , targets]) => targets))];
  wire.forwardBindings = eventTargets.map(([event, handler, targets]) => ({
    candidateId: wire.sourceCandidateIds[0],
    event,
    handler,
    targets,
  }));
  const variant = (name, evidenceScope) => ({
    name,
    evidenceScope,
    scenes: [{ package: pkg, scene: name }],
    remaining,
  });
  const value = {
    schemaVersion: 1,
    pageId: "P31",
    route: "/org-admin/roles",
    status: "source-reviewed-not-runtime-accepted",
    contract: `${base}/roles-semantic-contract-review.md`,
    sourceHashes: Object.fromEntries(
      [parentFile, childFile].map((file) => [file, dependencyHashes[file]]),
    ),
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "创建和延期是两个内联form；仅撤销使用一个共享原因窗。其全部生命周期未验收。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationRolePanel.vue": childInputs.map(([binding]) => binding),
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [parentFile, childFile],
      includeStructuralContainers: true,
      dependencyHashes,
      inputs: [
        ...parentInputs.map((binding) => ({
          file: parentFile,
          binding,
          meaning: "P29 summary专属，P31不显示",
          remaining,
        })),
        ...childInputs.map(([binding, meaning]) => ({
          file: childFile,
          binding,
          meaning,
          visualReferences: fieldRef(binding),
          remaining,
        })),
      ],
      containers: [
        {
          file: parentFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "summary资料表单仅P29可达",
          remaining,
          variants: [
            {
              ...variant("roles", "route-excluded-reference"),
              exclusionReason: "summary与roles分支互斥，不拿角色图证明资料表单",
            },
          ],
        },
        {
          file: parentFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior: "撤销原因先关窗再写，取消不写；创建/延期不走此窗",
          remaining,
          variants: ["revoke", "revoke-invalid"].map((v) => variant(v, "matching-dialog-scene")),
        },
        {
          file: childFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "七字段创建授权内联form，不含额外确认弹窗",
          remaining,
          variants: [
            "create-task",
            "create-opportunity",
            "create-competitor",
            "create-sourcing",
            "create-invalid-expiry",
            "create-busy",
          ].map((v) => variant(v, "matching-inline-form-scene")),
        },
        {
          file: childFile,
          tag: "form",
          ordinal: 2,
          shape: "form-container",
          sourceBehavior: "active且canManage时的两字段到期时间表单",
          remaining,
          variants: ["grants", "extend-busy"].map((v) => variant(v, "matching-inline-form-scene")),
        },
      ],
      sharedRemaining: [
        "实际共享撤销reason无maxlength，但服务端max500；各调用方约束及重开生命周期仍待。",
        "use-modal-dialog仅绑定当前源码读取，不宣称旧48图已覆盖此依赖或全部返焦/销毁场景。",
      ],
    },
    controlledInputs: [
      {
        file: childFile,
        value: "grantForm.resource_type",
        actionId: "grant.create.type.change",
        visualReferences: fieldRef("grantForm.resource_type"),
        persistence: "parent-form-ref-only",
        remaining,
      },
    ],
    sharedReasonInput: {
      file: dependencies[2],
      binding: "reason",
      visualReferences: fieldRef("reason"),
      minimumLength: 2,
      maximumLength: null,
      sourceMeaning: "共享前端无max；资源授权API三个写入reason上限500，不代表501字服务端成功",
    },
    compositionGaps: [
      "原48图保留上下文；新42控件378图绑定18代表动作76状态及24变体113状态，44代表槽仍未映射；父页刷新/错误、真实多页、字段六态仍待。单页分页仅disabled，唯一已选授权不证明切换。",
      "提交中草稿归属、刷新重置延期草稿、确认期间切组织、创建成功覆盖重读失败提示仍待真实Vue与产品决策。",
      "用户已确认四项控件视觉；新16字段代表状态与9组合保持待审。UUID复制、共享前端501字/服务端500界线、延期不得早于原值在新子稿明确，所有字段排列/主题密度/软键盘/日期弹层及真实Vue仍待，不新增目录或权限。",
    ],
    approval: "pending-user-review",
    actualVueControlEvidence: {
      review: "P31-VUE-APPROVED-CONTROLS.md",
      evidence: "output/playwright/p31-approved-controls-review/evidence.json",
      verifier: "scripts/verify-ui-phase2-roles-vue-controls.mjs",
      scope:
        "four-approved-control-treatments-and-extension-composition; actual Vue with isolated HTTP, not C layout or production acceptance",
      approval: "four-design-treatments-approved; full-page-and-runtime-pending",
    },
    limits: [
      "P16仅布局通过，不能外推P31或任一按钮状态。",
      "本批登记真实调用链并绑定独立控件图，离线输入演示不修改Vue/API/RBAC/数据库/配置或生产部署。",
    ],
  };
  for (const combo of fieldEvidence.combinations) {
    const target =
      value.surfaceReview.containers[
        combo.startsWith("revoke") ? 1 : combo.startsWith("extend") ? 3 : 2
      ];
    target.variants.push({
      name: combo,
      evidenceScope: combo.startsWith("revoke")
        ? "matching-dialog-scene"
        : "matching-inline-form-scene",
      scenes: [{ package: fieldPackage, scene: `${combo}-form` }],
      remaining,
    });
  }
  return value;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((arg) => ["--write", "--check"].includes(arg)));
  const value = buildRolesReview(
    Object.fromEntries(dependencies.map((file) => [file, readFileSync(file, "utf8")])),
    JSON.parse(readFileSync(`${base}/design/${pkg}/evidence.json`, "utf8")),
    JSON.parse(readFileSync(`${base}/design/roles-controls-direction-c/evidence.json`, "utf8")),
    JSON.parse(readFileSync(`${base}/design/roles-fields-direction-c/evidence.json`, "utf8")),
  );
  const target = `${base}/action-reviews/P31.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), value);
  console.log(
    JSON.stringify({
      pageId: value.pageId,
      groups: value.actions.length,
      approval: value.approval,
    }),
  );
}
