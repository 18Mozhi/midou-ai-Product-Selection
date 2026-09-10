import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationMemberPanel.vue";
export const dependencies = [
  parentFile,
  childFile,
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
  "apps/web/src/use-modal-dialog.ts",
];
const pkg = "members-direction-c";
const controls = "members-controls-direction-c";
const fields = "members-fields-direction-c";
const remaining =
  "当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。";
const filterKey = "OG-M-FILTER搜索/状态/角色/团队/排序/重置";
// Exact source identities and semantics are hand-reviewed; labels never determine actions.
const definitions = [
  [
    parentFile,
    "EX-P34-FIRST-FAILURE",
    "P34首次读取失败转发（非本页）",
    "excluded",
    ["5ae31bc55551b1dc.1"],
    ["OG-RETRY"],
    "仅view===approvals且error、无data、HTTP500；非P30",
    "P30不渲染此分支；P34复用原load()，不计入本页动作",
    ["normal"],
  ],
  [
    parentFile,
    "OG-REFRESH",
    "刷新成员资料",
    "read",
    ["b11692c0597885e3.1"],
    ["OG-REFRESH"],
    "页首；loading/refreshing禁用",
    "load({background:true})读summary与members；只有最新load批次写data，api共享诊断/跨范围生命周期仍待",
    ["normal", "refreshing", "refresh_error"],
  ],
  [
    parentFile,
    "OG-RETRY",
    "重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["OG-RETRY"],
    "error/blocked/expired/forbidden/rate_limited/conflict；无禁用绑定",
    "load()；不是权限或登录绕过",
    ["error", "blocked", "expired", "forbidden", "rate_limited"],
  ],
  [
    parentFile,
    "EX-P29-PROFILE",
    "组织资料分支排除",
    "excluded",
    ["d6b520278ab3dd57.1", "1cbd108c64b5230c.1", "5878e30377f290ae.1"],
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "summary专属，P30 view为members",
    "排除profile submit、Logo有效性和保存按钮，不扩大P29批准",
    ["normal"],
  ],
  [
    parentFile,
    "WIRE-MEMBERS",
    "成员子组件事件接线",
    "wiring",
    ["6a563eeaa67fea90.1"],
    ["P30全部成员事件父转发，复用M语义"],
    "view===members",
    "13个显式事件逐一接到本页动作；不把父转发重复当业务操作",
    ["normal"],
  ],
  [
    parentFile,
    "EX-P31-ROLES",
    "独立角色页排除",
    "excluded",
    ["b09d7923228aabe6.1"],
    ["P31资源授权父转发，复用已有合同"],
    "view===roles，非本页成员行角色选择",
    "授权增改撤销留在P31，不在本页创建可编辑角色模板",
    ["normal"],
  ],
  [
    parentFile,
    "D-OG-REASON",
    "共享原因确认与取消调用",
    "local",
    ["773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1"],
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
    ],
    "成员禁用/恢复、分配角色、撤销邀请四变体；通用helper也供其它页",
    "submitAuditedReason/cancelAuditedReason解析promise并先关窗；取消零写；trim至少2字，实际共享textarea无maxlength；后续写结果在父页",
    [
      "reason_disable",
      "reason_restore",
      "reason_role",
      "reason_revoke",
      "reason_short",
      "reason_long",
      "action_busy",
      "action_conflict",
    ],
  ],
  [
    parentFile,
    "EX-P36-TOKEN-REASON",
    "令牌原因调用排除",
    "excluded",
    ["e828f4ab0fdb0415.1"],
    ["D-OG-REASON令牌轮换/撤销调用"],
    "令牌轮换/撤销由P36发起",
    "不因共享原因组件假定跨路由已打开窗口不存在",
    ["normal"],
  ],
  [
    childFile,
    "OG-M-INVITE",
    "创建邀请",
    "write",
    ["3faa2495a550b3c6.1", "0589c9bc31734883.1"],
    ["OG-M-INVITE"],
    "内联表单原生必填；busy按钮禁用/父函数早退",
    "emails换行/逗号/分号拆分、trim小写去重；合法且<=254邮箱逐个POST /org/admin/invitations，{email,role_code,reason}；非原子，403/401中断后未处理尾部丢失/notice覆盖仍在",
    [
      "invite_form",
      "invite_invalid",
      "invite_busy",
      "invite_partial",
      "invite_interrupted",
      "invite_success",
    ],
  ],
  [
    childFile,
    "OG-M-TAB-PENDING",
    "待接受邀请",
    "local",
    ["171dd535ef8757aa.1"],
    ["OG-M-INVITATION-TAB"],
    "aria-pressed表示已选，不是禁用",
    "invitationTab=pending；pending_delivery/pending_acceptance且expires_at>Date.now；不把待投递写成已发送",
    ["normal", "invite_acceptance", "invite_empty"],
  ],
  [
    childFile,
    "OG-M-TAB-EXPIRED",
    "已失效邀请",
    "local",
    ["5fa949f2fa7f314d.1"],
    ["OG-M-INVITATION-TAB"],
    "邀请页签始终可选",
    "invitationTab=expired；expired/revoked或expires_at<=Date.now；保留原始status标签",
    ["invite_expired", "invite_revoked", "invite_boundary"],
  ],
  [
    childFile,
    "OG-M-INVITATION-REVOKE",
    "撤销邀请",
    "write",
    ["4f34de62fea95c43.1"],
    ["OG-M-INVITATION-REVOKE"],
    "pending Tab内逐条显示；busy禁用",
    "invitationAction经原因确认后POST /org/admin/invitations/:id/actions，{action:revoke,expected_version:item.version,reason}，preserveForm:true",
    ["normal", "reason_revoke", "action_busy", "action_conflict"],
  ],
  [
    childFile,
    "OG-M-SEARCH",
    "搜索姓名或邮箱",
    "local",
    ["a8d9441ebc6a59ed.1"],
    [filterKey],
    "输入不因busy禁用",
    "updateMemberQuery设置memberQuery及page=1；已加载items姓名/邮箱小写子串，不扩张其他字段或HTTP",
    ["search", "filter_empty"],
  ],
  [
    childFile,
    "OG-M-STATUS-FILTER",
    "成员有效状态筛选",
    "local",
    ["b937a80e03f88040.1"],
    [filterKey],
    "全部/active/disabled/locked",
    "updateMemberStatus并page=1；关系非active优先，其次账号locked/disabled，不以标签猜状态",
    ["filter_locked", "disabled_locked"],
  ],
  [
    childFile,
    "OG-M-ROLE-FILTER",
    "角色筛选",
    "local",
    ["375006d73f4accaa.1"],
    [filterKey],
    "固定五角色与全部",
    "updateMemberRole并page=1；item.roles.includes，不是单行角色写入",
    ["filter_role", "multiple_roles"],
  ],
  [
    childFile,
    "OG-M-TEAM-FILTER",
    "团队筛选",
    "local",
    ["beaf3d0c1db3450f.1"],
    [filterKey],
    "全部与已加载items.teams去重选项",
    "updateMemberTeam并page=1；按团队值includes，不请求团队目录",
    ["filter_team", "filter_empty"],
  ],
  [
    childFile,
    "OG-M-SORT",
    "成员排序",
    "local",
    ["f3b2f3f668cdb561.1"],
    [filterKey],
    "name_asc/joined_desc/status_asc",
    "updateMemberSort并page=1；拷贝排序，不改服务端成员顺序或joined_at",
    ["normal", "multipage"],
  ],
  [
    childFile,
    "OG-M-RESET",
    "重置成员筛选",
    "local",
    ["9472331a8a7f9e19.1"],
    [filterKey],
    "重置按钮无busy绑定",
    "query/status/role/team清空、sort=name_asc、page=1；不清邀请草稿/Tab或单行角色选择",
    ["normal", "filter_empty"],
  ],
  [
    childFile,
    "OG-TECH",
    "展开成员技术详情",
    "local",
    ["1c008f867673db60.1"],
    ["OG-TECH"],
    "每条member的原生details/summary",
    "现有源只展开成员ID；C提案另外展示version/joined_at，不能当源新增详情API",
    ["technical", "long_member"],
  ],
  [
    childFile,
    "OG-M-ROLE-SELECT",
    "选择单行角色",
    "local",
    ["8583e0c13eca946e.1"],
    ["OG-M-ROLE-SELECT"],
    "memberRoles[id]或首角色或member；无busy禁用",
    "updateMemberRoleSelection仅赋memberRoles[id]；load只缺键初始化，重读后选择陈旧风险OG-G01仍在",
    ["normal", "multiple_roles"],
  ],
  [
    childFile,
    "OG-M-ROLE-ASSIGN",
    "分配所选角色",
    "write",
    ["4842f2b67c787729.1"],
    ["OG-M-ROLE-ASSIGN"],
    "busy禁用；实际role_code在开原因窗前取值",
    "assignRole确认后POST /org/admin/members/:id/roles，{role_code,expected_version:item.version,reason}，preserveForm:true；替换角色不是累加授权",
    ["reason_role", "action_busy", "action_conflict"],
  ],
  [
    childFile,
    "OG-M-STATE",
    "禁用或恢复成员关系",
    "write",
    ["01c67ff42b0489fa.1"],
    ["OG-M-STATE禁用/恢复"],
    "busy禁用；item.status===active为disable，否则restore",
    "memberAction确认后POST /org/admin/members/:id/actions，{action,expected_version:item.version,reason}，preserveForm:true；恢复不解锁账号，自身/最后管理员由服务端保护",
    [
      "reason_disable",
      "reason_restore",
      "disabled_locked",
      "self_forbidden",
      "last_admin",
      "action_busy",
      "action_conflict",
    ],
  ],
  [
    childFile,
    "OG-M-PREV",
    "成员上一页",
    "local",
    ["bc843bc08e306aa8.1"],
    ["OG-M-PAGE"],
    "pageCount>1显示，memberPage<=1禁用",
    "emit updateMemberPage(memberPage-1)；已加载items每页10条，无HTTP或URL写入",
    ["multipage", "page_two"],
  ],
  [
    childFile,
    "OG-M-NEXT",
    "成员下一页",
    "local",
    ["de6415e79bea088d.1"],
    ["OG-M-PAGE"],
    "pageCount>1显示，memberPage>=pageCount禁用",
    "emit updateMemberPage(memberPage+1)；currentMemberPage按结果上限约束",
    ["multipage", "page_two"],
  ],
];
const eventTargets = [
  ["@invite", "inviteMembers", ["OG-M-INVITE"]],
  ["@invitation-action", "invitationAction", ["OG-M-INVITATION-REVOKE"]],
  ["@update-invitation-tab", "invitationTab = $event", ["OG-M-TAB-PENDING", "OG-M-TAB-EXPIRED"]],
  ...[
    ["query", "memberQuery", "OG-M-SEARCH"],
    ["status", "memberStatus", "OG-M-STATUS-FILTER"],
    ["role", "memberRole", "OG-M-ROLE-FILTER"],
    ["team", "memberTeam", "OG-M-TEAM-FILTER"],
    ["sort", "memberSort", "OG-M-SORT"],
  ].map(([suffix, variable, target]) => [
    `@update-member-${suffix}`,
    `\n          ${variable} = $event;\n          memberPage = 1;\n        `,
    [target],
  ]),
  ["@update-member-page", "memberPage = $event", ["OG-M-PREV", "OG-M-NEXT"]],
  [
    "@reset-member-filters",
    "\n          memberQuery = '';\n          memberStatus = '';\n          memberRole = '';\n          memberTeam = '';\n          memberSort = 'name_asc';\n          memberPage = 1;\n        ",
    ["OG-M-RESET"],
  ],
  [
    "@update-member-role-selection",
    "memberRoles[$event.memberId] = $event.role",
    ["OG-M-ROLE-SELECT"],
  ],
  ["@assign-role", "assignRole", ["OG-M-ROLE-ASSIGN"]],
  ["@member-action", "memberAction", ["OG-M-STATE"]],
];
const visibleInputs = [
  ["form.emails", "邀请邮箱textarea必填；无maxlength；分隔/邮箱254边界由父函数校验"],
  ["form.role_code", "必填固定五角色select；选择本身不写入"],
  ["form.reason", "邀请原因必填maxlength500，父函数trim后1–500；不是共享窗的至少2字规则"],
];
export function buildMembersReview(sources, evidence, controlsEvidence, fieldEvidence) {
  const dependencyHashes = Object.fromEntries(
    dependencies.map((file) => {
      assert.equal(typeof sources[file], "string", `missing source ${file}`);
      const sha = createHash("sha256").update(sources[file].replaceAll("\r\n", "\n")).digest("hex");
      assert.equal(evidence.sourceHashes[file], sha, "verify current members proposal");
      assert.equal(controlsEvidence.sourceHashes[file], sha, "verify current members controls");
      assert.equal(fieldEvidence.sourceHashes[file], sha, "verify current members fields");
      return [file, sha];
    }),
  );
  assert.deepEqual(
    Object.keys(fieldEvidence.fieldVisualReferences).sort(),
    [
      "form.emails",
      "form.role_code",
      "form.reason",
      "memberQuery",
      "memberStatus",
      "memberRole",
      "memberTeam",
      "memberSort",
      "memberRoles[member.id] || member.roles[0] || 'member'",
      "reason",
    ].sort(),
    "exact ten members fields",
  );
  const fieldRef = (binding) => ({
    package: fields,
    ...fieldEvidence.fieldVisualReferences[binding],
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
      variants,
    ]) => ({
      actionId,
      label,
      kind,
      sourceCandidateIds: signatures.map((sig) => `${file}#${sig}`),
      sourceContractKeys,
      contractAliasReason:
        "沿F04末列明确细分各筛选/页签/分页；同一源码身份仅归一组，父接线不重复计操作。",
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
          file: "scripts/verify-ui-phase2-members-c.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
    }),
  );
  assert.deepEqual(
    Object.keys(controlsEvidence.actionVisualReferences).sort(),
    actions
      .filter((a) => !["excluded", "wiring"].includes(a.kind))
      .map((a) => a.actionId)
      .sort(),
    "exact reachable members action set",
  );
  for (const action of actions.filter((a) => !["excluded", "wiring"].includes(a.kind))) {
    const primary = controlsEvidence.actionVisualReferences[action.actionId];
    action.visualStateReferences = {};
    for (const [state, scene] of Object.entries(primary.states)) {
      action.visualStates[state] = "scene-reference-not-acceptance";
      action.visualStateReferences[state] = {
        package: controls,
        scene,
        selector: primary.selector,
      };
      action.scenes.push({ package: controls, scene });
    }
    action.additionalControlVariants = Object.entries(controlsEvidence.controlVariantReferences)
      .filter(([, ref]) => ref.actionId === action.actionId)
      .map(([key, ref]) => {
        for (const scene of Object.values(ref.states))
          action.scenes.push({ package: controls, scene });
        return {
          key,
          scope: "additional-control-variant-not-new-action",
          package: controls,
          selector: ref.selector,
          states: ref.states,
        };
      });
    action.testReferences.push({
      file: "scripts/verify-ui-phase2-members-controls-c.mjs",
      evidenceType: "offline-proposal-check-not-Vue",
    });
  }
  const wire = actions.find((a) => a.actionId === "WIRE-MEMBERS");
  wire.forwardsTo = [...new Set(eventTargets.flatMap(([, , targets]) => targets))];
  wire.forwardBindings = eventTargets.map(([event, handler, targets]) => ({
    candidateId: wire.sourceCandidateIds[0],
    event,
    handler,
    targets,
  }));
  const inputMeaning = Object.fromEntries(visibleInputs);
  const variant = (name, evidenceScope) => ({
    name,
    evidenceScope,
    scenes: [
      { package: pkg, scene: name },
      ...(fieldEvidence.combinations.includes(name)
        ? [{ package: fields, scene: `${name}-form` }]
        : []),
    ],
    remaining,
  });
  return {
    schemaVersion: 1,
    pageId: "P30",
    route: "/org-admin/members",
    status: "source-reviewed-not-runtime-accepted",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes: Object.fromEntries(
      [parentFile, childFile].map((file) => [file, dependencyHashes[file]]),
    ),
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "一个共享原因调用的四业务变体，不是四独立dialog；共享定义及完整跨路由生命周期未算全局完成。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": [
        "form.name",
        "form.logo_url",
        "form.timezone",
        "form.data_retention_days",
        "form.default_workspace_id",
        "form.reason",
      ],
      "OrganizationMemberPanel.vue": visibleInputs.map(([binding]) => binding),
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [parentFile, childFile],
      includeStructuralContainers: true,
      dependencyHashes,
      inputs: [
        ...[
          "form.name",
          "form.logo_url",
          "form.timezone",
          "form.data_retention_days",
          "form.default_workspace_id",
          "form.reason",
        ].map((binding) => ({
          file: parentFile,
          binding,
          meaning: "P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单",
          remaining,
        })),
        ...visibleInputs.map(([binding]) => ({
          file: childFile,
          binding,
          meaning: inputMeaning[binding],
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
              ...variant("normal", "route-excluded-reference"),
              exclusionReason: "父summary表单与members分支互斥；不拿本页图证明资料表单状态",
            },
          ],
        },
        {
          file: parentFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior:
            "通用auditedReason从禁用/恢复/角色/撤销调用；服务写入前先关闭，错误在父页面",
          remaining,
          variants: ["reason_disable", "reason_restore", "reason_role", "reason_revoke"].map(
            (name) => variant(name, "matching-dialog-scene"),
          ),
        },
        {
          file: childFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "三字段邀请内联form；表单/submit按钮共用invite事件，无额外原因确认窗",
          remaining,
          variants: [
            "invite_form",
            "invite_invalid",
            "invite_partial",
            "invite_busy",
            "invite_interrupted",
            "invite_success",
            "invite_empty",
            "invite_boundary",
          ].map((name) => variant(name, "matching-inline-form-scene")),
        },
      ],
      sharedRemaining: [
        "共享reason字段在AuditedReasonDialog，required/minimumLength默认2、无maxlength；邀请表单reason已有500上限。六个value/emit字段另在controlledInputs，不能漏算为仅三个可编辑字段。",
        "useAuditedReason新ask取消上个请求，finish先关窗；useModalDialog返焦/销毁与全部调用方跨缓存时序仍待。",
      ],
    },
    controlledInputs: [
      ...[
        ["memberQuery", "OG-M-SEARCH"],
        ["memberStatus", "OG-M-STATUS-FILTER"],
        ["memberRole", "OG-M-ROLE-FILTER"],
        ["memberTeam", "OG-M-TEAM-FILTER"],
        ["memberSort", "OG-M-SORT"],
      ].map(([value, actionId]) => ({
        file: childFile,
        value,
        actionId,
        visualReferences: fieldRef(value),
        persistence: "parent-ref-only-not-URL-or-storage",
      })),
      {
        file: childFile,
        value: "memberRoles[member.id] || member.roles[0] || 'member'",
        actionId: "OG-M-ROLE-SELECT",
        visualReferences: fieldRef("memberRoles[member.id] || member.roles[0] || 'member'"),
        persistence: "parent-memberRoles-ref-only",
      },
    ],
    sharedReasonInput: {
      file: dependencies[2],
      binding: "reason",
      minimumLength: 2,
      maximumLength: null,
      visualReferences: fieldRef("reason"),
      sourceMeaning: "shared source has no maxlength; proposal500 is not production behavior",
    },
    proposalOnlyControls: Object.entries(controlsEvidence.controlReferences)
      .filter(([, ref]) => ref.scope === "proposal-only-not-source-action")
      .map(([id, ref]) => ({
        id,
        actionId: ref.actionId,
        selector: ref.selector,
        states: ref.states,
        reason: "目录/折叠/空结果/反馈说明及中断保留仅提案，不加入源动作分母。",
      })),
    compositionGaps: [
      "十字段74代表状态/八表单组合双端164图已绑定；该新子稿按真实共享前端取消旧提案500上限，仅记录离线意图，不代表服务接受501字或生产已改。全部组合、主题/密度/软键盘仍待。",
      "94旧图保留上下文；新444图绑定19代表动作84状态、22附加变体92状态，另10纯提案40状态和6反馈上下文。仍有30代表槽未映射，不补造native select按下弹出或原因窗提交busy。",
      "独立提案复用busy，而实际父源refreshing与写busy分离；当前只核对被选目标，不代表全页忙碌生命周期或全部字段/角色/主题/密度/软键盘组合通过。",
      "OG-G01角色选择陈旧、OG-G02邀请尾部/notice及通用写后重读、OG-G03原因上限/重开、跨范围迟到回执与全部C真实实现继续待。",
    ],
    approval: "pending-user-review",
    limits: [
      "P16仅独立布局批准，不外推P30。",
      "本批源注册/证据测试，不改业务API、数据库、权限或生产服务，不发邮件。",
    ],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((arg) => ["--write", "--check"].includes(arg)));
  const value = buildMembersReview(
    Object.fromEntries(dependencies.map((file) => [file, readFileSync(file, "utf8")])),
    JSON.parse(readFileSync(`${base}/design/${pkg}/evidence.json`, "utf8")),
    JSON.parse(readFileSync(`${base}/design/${controls}/evidence.json`, "utf8")),
    JSON.parse(readFileSync(`${base}/design/${fields}/evidence.json`, "utf8")),
  );
  const target = `${base}/action-reviews/P30.json`;
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
