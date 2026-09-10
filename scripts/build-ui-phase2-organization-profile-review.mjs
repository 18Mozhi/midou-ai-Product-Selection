import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const sourceFile = "apps/web/src/components/OrganizationAdminCenter.vue";
const parent = "organization-profile-direction-c",
  controls = "organization-profile-controls-direction-c";
const remaining =
  "具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。";
const definitions = [
  [
    "EX-P34-FIRST-FAILURE",
    "P34首次读取失败转发（非本页）",
    "excluded",
    ["5ae31bc55551b1dc.1", "08a59be6f793cde6.1"],
    ["OG-RETRY"],
    "仅view===approvals、无data，error/HTTP500或rate_limited/HTTP429；非P29",
    "P29不渲染此分支；P34复用原load()，不计入本页动作",
    ["normal"],
  ],
  [
    "OG-REFRESH",
    "刷新组织资料",
    "read",
    ["b11692c0597885e3.1"],
    ["OG-REFRESH"],
    "页首始终显示；loading或refreshing禁用",
    "load({background:true})；三GET成功后按服务端资料替换form并清原因，不承诺保留草稿",
    ["normal", "refreshing", "loading", "refresh_error", "dirty_refresh"],
  ],
  [
    "OG-RETRY",
    "错误后重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["OG-RETRY"],
    "error/blocked/expired/forbidden/rate_limited/conflict状态；按钮无禁用条件",
    "load()重新读取当前组织；不是登录/授权绕过，load后页面替换为加载态",
    ["error", "blocked", "expired", "forbidden", "rate_limited", "conflict_page"],
  ],
  [
    "OG-PROFILE-SAVE",
    "保存并审计",
    "write",
    ["d6b520278ab3dd57.1", "5878e30377f290ae.1"],
    ["OG-PROFILE-SAVE"],
    "summary内联表单；原生校验，busy禁用按钮，submit亦busy早退",
    "submit('/org/admin/profile',{...form,expected_version:data.version},'PATCH')；写成功后重读；OG-G02成功覆盖重读失败仍存在",
    [
      "editing",
      "save_busy",
      "save_error",
      "save_conflict",
      "save_success",
      "write_read_failed",
      "save_timeout",
    ],
  ],
  [
    "OG-PROFILE-LOGO",
    "Logo浏览器有效性",
    "local",
    ["1cbd108c64b5230c.1"],
    ["OG-PROFILE-LOGO浏览器有效性"],
    "summary Logo输入的invalid/input回调；不是业务写入",
    "validateHttps设置HTTPS或空提示；clearFieldValidity清自定义错误，不新增上传/图片请求",
    ["normal", "logo_invalid", "blank_logo"],
  ],
  [
    "EX-P30-MEMBERS",
    "P30成员事件（非本页）",
    "excluded",
    ["6a563eeaa67fea90.1"],
    ["P30全部成员事件父转发，复用M语义"],
    "OrganizationMemberPanel仅view===members；P29 view===summary",
    "成员邀请、角色/状态与筛选转发需在P30核对；P29不渲染该panel",
    ["normal"],
  ],
  [
    "EX-P31-ROLES",
    "P31授权事件（非本页）",
    "excluded",
    ["b09d7923228aabe6.1"],
    ["P31资源授权父转发，复用已有合同"],
    "OrganizationRolePanel仅view===roles；P29 view===summary",
    "授权创建/延期/撤销与筛选分页需在P31核对；P29不渲染该panel",
    ["normal"],
  ],
  [
    "EX-REASON-ORIGINS",
    "共享原因窗的其他页调用",
    "excluded",
    ["773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1", "e828f4ab0fdb0415.1"],
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
      "D-OG-REASON令牌轮换/撤销调用",
    ],
    "新进入P29无发起原因窗的业务入口，但父模板仍装配共享组件",
    "submit资料不ask；成员/邀请/工作区/团队/授权和令牌函数才ask。跨路由已打开原因窗的生命周期另验，不能宣称任何时序都不存在弹窗",
    ["normal"],
  ],
];
const fields = [
  ["form.name", "名称；required、maxlength120，初值data.name", "name_invalid"],
  ["form.logo_url", "Logo；url、https://.*、maxlength2048，可空；输入清自定义错误", "logo_invalid"],
  ["form.timezone", "时区；required、maxlength64，自由文本，不造枚举", "timezone_invalid"],
  [
    "form.data_retention_days",
    "保留天数；v-model.number，number/min30/max3650/required；原生默认step1",
    "retention_invalid",
  ],
  [
    "form.default_workspace_id",
    "默认工作区；required，按当前返回名称展示，不新增active-only过滤",
    "missing_workspace",
  ],
  [
    "form.reason",
    "变更原因；required、maxlength500；成功load清空，保存期间未禁用输入",
    "reason_missing",
  ],
];
const formScenes = [
  "normal",
  "editing",
  "blank_logo",
  "long_name",
  "long_workspace",
  "missing_workspace",
  "no_options",
  "archived_option",
  "refreshing",
  "refresh_error",
  "refresh_success",
  "dirty_refresh",
  "save_busy",
  "save_error",
  "save_conflict",
  "save_success",
  "write_read_failed",
  "save_timeout",
  "logo_invalid",
  "reason_missing",
  "retention_invalid",
  "timezone_invalid",
  "name_invalid",
];
export function buildOrganizationProfileReview(source, evidence, fieldEvidence) {
  const sha = createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex");
  assert.equal(
    evidence.sourceHashes[sourceFile],
    sha,
    "verify current proposal before registration",
  );
  assert.equal(fieldEvidence.sourceHashes[sourceFile], sha, "verify current field proposal");
  assert.deepEqual(
    Object.keys(fieldEvidence.fieldVisualReferences).sort(),
    fields.map(([binding]) => binding).sort(),
    "exact six field evidence required",
  );
  const fieldPackage = "organization-profile-fields-direction-c";
  const ids = (signatures) => signatures.map((s) => `${sourceFile}#${s}`);
  const actions = definitions.map(
    ([actionId, label, kind, signatures, sourceContractKeys, condition, handler, variants]) => {
      const action = {
        actionId,
        label,
        kind,
        sourceCandidateIds: ids(signatures),
        sourceContractKeys,
        contractAliasReason:
          "沿F04完整语义末列显式合并表单/保存及共享原因调用；不从按钮文案推断动作。",
        condition,
        handler,
        variants,
        scenes: variants.map((scene) => ({ package: parent, scene })),
        visualStates: Object.fromEntries(
          ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
            state,
            kind === "excluded" ? "not-applicable-excluded" : "not-mapped",
          ]),
        ),
        testReferences: [
          "scripts/verify-ui-phase2-organization-profile-c.mjs",
          "scripts/verify-ui-phase2-organization-profile-controls-c.mjs",
          "scripts/verify-ui-phase2-organization-profile-fields-c.mjs",
        ].map((file) => ({ file, evidenceType: "offline-proposal-check-not-Vue" })),
        remaining,
      };
      const primary =
        actionId === "OG-PROFILE-LOGO"
          ? fieldEvidence.actionVisualReferences[actionId]
          : evidence.actionVisualReferences[actionId];
      const primaryPackage = actionId === "OG-PROFILE-LOGO" ? fieldPackage : controls;
      if (actionId === "OG-PROFILE-LOGO") assert.ok(primary, "missing Logo field evidence");
      if (["OG-REFRESH", "OG-RETRY", "OG-PROFILE-SAVE"].includes(actionId))
        assert.ok(primary, "missing business control evidence " + actionId);
      if (primary) {
        action.visualStateReferences = {};
        for (const [state, scene] of Object.entries(primary.states)) {
          action.visualStates[state] = "scene-reference-not-acceptance";
          action.visualStateReferences[state] = {
            package: primaryPackage,
            scene,
            selector: primary.selector,
          };
          if (!action.scenes.some((r) => r.package === primaryPackage && r.scene === scene))
            action.scenes.push({ package: primaryPackage, scene });
        }
        action.additionalControlVariants = Object.entries(evidence.controlVariantReferences)
          .filter(([, r]) => r.actionId === actionId)
          .map(([key, ref]) => {
            for (const scene of Object.values(ref.states))
              if (!action.scenes.some((r) => r.package === controls && r.scene === scene))
                action.scenes.push({ package: controls, scene });
            return {
              key,
              scope: "additional-control-variant-not-new-action",
              package: controls,
              selector: ref.selector,
              states: ref.states,
            };
          });
      }
      if (["OG-RETRY", "OG-PROFILE-LOGO"].includes(actionId)) {
        for (const state of ["disabled", "busy"])
          action.visualStates[state] = "not-applicable-source-unrepresented";
        action.sourceStateApplicability = {
          scope: "current-source-presentation-only-not-runtime-or-approval",
          states: ["disabled", "busy"],
          reason:
            "当前对应button/input无disabled、aria-busy或loading绑定，不补造状态。Logo可编辑不是等待保护。",
          handlerBoundary: handler,
          sourceCandidateIds: ids(signatures),
          renderedControlIds: ids(signatures),
          sourceHashes: { [sourceFile]: sha },
        };
      }
      return action;
    },
  );
  return {
    schemaVersion: 1,
    pageId: "P29",
    route: "/org-admin",
    status: "source-reviewed-not-runtime-accepted",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes: { [sourceFile]: sha },
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "本页无初始业务发起入口；共享原因组件仍在父模板，跨路由既有窗不能据静态图排除。",
    },
    inputs: { "OrganizationAdminCenter.vue": fields.map(([binding]) => binding) },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [sourceFile],
      includeStructuralContainers: true,
      dependencyHashes: { [sourceFile]: sha },
      inputs: fields.map(([binding, meaning, scene]) => ({
        file: sourceFile,
        binding,
        meaning,
        relatedScenes: [{ package: parent, scene }],
        visualReferences: {
          package: fieldPackage,
          ...fieldEvidence.fieldVisualReferences[binding],
        },
        remaining: "字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。",
      })),
      containers: [
        {
          file: sourceFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "summary内联资料表单，六字段；原生校验后统一PATCH，无额外确认。",
          remaining,
          variants: [
            ...formScenes.map((name) => ({
              name,
              evidenceScope: "matching-inline-form-scene",
              scenes: [{ package: parent, scene: name }],
              remaining,
            })),
            ...fieldEvidence.combinations.map((name) => ({
              name: `fields-${name}`,
              evidenceScope: "matching-inline-form-scene",
              scenes: [{ package: fieldPackage, scene: `${name}-form` }],
              remaining,
            })),
          ],
        },
        {
          file: sourceFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior:
            "父模板传open/request并转发submit/cancel；初始P29无ask入口，组件并非从源码删除。",
          remaining,
          variants: [
            {
              name: "fresh-summary-no-reason-origin",
              evidenceScope: "route-excluded-reference",
              exclusionReason:
                "只排除P29初始动作发起该窗；其他页面曾开窗后切回的跨缓存状态尚未验证。",
              scenes: [{ package: parent, scene: "normal" }],
              remaining,
            },
          ],
        },
      ],
      sharedRemaining: [
        "P30–P37子组件和共享原因窗全源需分别核对；不以父层排除完成其它页面。",
        "全局缓存/组织隔离、共享诊断及未提交草稿策略仍待，不从Token保护推断资料页安全。",
      ],
    },
    proposalOnlyControls: Object.entries(evidence.controlReferences)
      .filter(([, r]) => r.scope === "proposal-only-not-source-action")
      .map(([id, ref]) => ({
        id,
        actionId: ref.actionId,
        selector: ref.selector,
        states: ref.states,
        reason: "目录/技术详情/结果核验是独立C提案；不进入现有源码业务动作分母。",
      })),
    compositionGaps: [
      "Logo四态及六字段47代表状态/8表单组合已绑定；不是全部字段/角色/主题/密度/软键盘组合。",
      "110字段图、170控件图与74整页图不代表真实Vue已实现；OG-G02和其它生命周期缺口仍存在。",
    ],
    approval: "pending-user-review",
    limits: [remaining, "P16仅独立布局批准不外推P29；本批未部署、未改变API或业务规则。"],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const value = buildOrganizationProfileReview(
    readFileSync(sourceFile, "utf8"),
    JSON.parse(readFileSync(`${base}/design/${controls}/evidence.json`, "utf8")),
    JSON.parse(
      readFileSync(`${base}/design/organization-profile-fields-direction-c/evidence.json`, "utf8"),
    ),
  );
  const target = `${base}/action-reviews/P29.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), value);
  console.log(
    JSON.stringify({ pageId: "P29", groups: value.actions.length, approval: value.approval }),
  );
}
