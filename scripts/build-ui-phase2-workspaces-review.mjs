import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationWorkspacePanel.vue";
export const dependencies = [
  parentFile,
  childFile,
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
];
const pkg = "workspaces-direction-c";
const remaining =
  "当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。";
// Explicit existing contract identities; never generate action semantics from labels.
const definitions = [
  [
    parentFile,
    "OG-REFRESH",
    "刷新工作区",
    "read",
    ["b11692c0597885e3.1"],
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load(background)读取组织summary和工作区列表；不是只读所选工作区",
    ["normal", "refreshing", "refresh_error"],
  ],
  [
    parentFile,
    "OG-RETRY",
    "重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["OG-RETRY"],
    "六种错误状态，无disabled绑定",
    "load()，不绕过权限或恢复登录",
    ["error", "blocked", "expired", "forbidden", "rate_limited"],
  ],
  [
    parentFile,
    "EX-P29-PROFILE",
    "资料分支排除",
    "excluded",
    ["d6b520278ab3dd57.1", "5878e30377f290ae.1", "1cbd108c64b5230c.1"],
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary分支",
    "P32不显示资料表单或Logo检查",
    ["normal"],
  ],
  [
    parentFile,
    "EX-P30-MEMBERS",
    "成员分支排除",
    "excluded",
    ["6a563eeaa67fea90.1"],
    ["P30全部成员事件父转发，复用M语义"],
    "仅members分支",
    "不计为工作区动作",
    ["normal"],
  ],
  [
    parentFile,
    "EX-P31-ROLES",
    "授权分支排除",
    "excluded",
    ["b09d7923228aabe6.1"],
    ["P31资源授权父转发，复用已有合同"],
    "仅roles分支",
    "不计为工作区动作",
    ["normal"],
  ],
  [
    parentFile,
    "D-OG-REASON",
    "归档与恢复原因",
    "local",
    ["56b1761955b256ef.1", "f3515ca45998a840.1", "7a51bff83af3db69.1"],
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
    ],
    "workspaceAction先等待共享原因",
    "初始值为归档工作区或恢复工作区；trim至少2字、前端无maxlength；先关闭再写，取消零写",
    ["reason_archive", "reason_restore", "reason_short", "reason_long"],
  ],
  [
    parentFile,
    "EX-P36-TOKEN",
    "令牌原因排除",
    "excluded",
    ["e828f4ab0fdb0415.1"],
    ["D-OG-REASON令牌轮换/撤销调用"],
    "仅Token函数发起",
    "不把共享helper作为其他页面已验收",
    ["normal"],
  ],
  [
    childFile,
    "OG-W-OPEN",
    "打开创建",
    "local",
    ["ee38194d65edc8d9.1", "ea9b5ddcd4502f15.1"],
    ["OG-W-OPEN头部/空态"],
    "头部busy禁用；空目录入口无disabled",
    "openCreate只展开并requestAnimationFrame聚焦名称；不清草稿",
    ["normal", "empty", "create"],
  ],
  [
    childFile,
    "OG-W-CREATE",
    "创建并审计",
    "write",
    ["7c1ff142d1b797a2.1", "bae4e728dfc90592.1"],
    ["OG-W-CREATE"],
    "原生required/pattern；busy或createBusy拒绝重复",
    "submitCreate捕获trim三字段，经函数prop到createWorkspace；成功清空/收起，失败保留；等待期间输入仍可编辑",
    [
      "create",
      "create_invalid",
      "create_required",
      "create_busy",
      "create_failure",
      "create_success",
      "create_read_failed",
    ],
  ],
  [
    childFile,
    "OG-W-CANCEL",
    "取消创建",
    "local",
    ["617ab4a17066056a.1"],
    ["OG-W-CANCEL"],
    "createBusy禁用且函数早退；不是props.busy",
    "cancelCreate清三字段并收起，不请求服务",
    ["create_draft", "create_busy"],
  ],
  [
    childFile,
    "OG-W-STATUS-ALL",
    "全部状态",
    "local",
    ["9aeabb6f832c875d.1"],
    ["OG-W-FILTER状态/重置/清除"],
    "无busy禁用",
    "statusFilter=all；watch回第一页，不主动清所选项",
    ["catalog"],
  ],
  [
    childFile,
    "OG-W-STATUS-ACTIVE",
    "正常使用",
    "local",
    ["18ece981bcb15fca.1"],
    ["OG-W-FILTER状态/重置/清除"],
    "无busy禁用",
    "statusFilter=active；计数仅当前返回数组",
    ["active"],
  ],
  [
    childFile,
    "OG-W-STATUS-ARCHIVED",
    "已归档",
    "local",
    ["56fb9bb2ac849bf0.1"],
    ["OG-W-FILTER状态/重置/清除"],
    "无busy禁用",
    "statusFilter=archived；筛选不等于归档操作",
    ["archived"],
  ],
  [
    childFile,
    "OG-W-RESET",
    "重置筛选",
    "local",
    ["66725db5db9a8fe8.1"],
    ["OG-W-FILTER状态/重置/清除"],
    "始终可用，无空值禁用",
    "清query/status，sort回name_asc；不清选择/创建草稿",
    ["search", "catalog"],
  ],
  [
    childFile,
    "OG-W-CLEAR-EMPTY",
    "空结果清除筛选",
    "local",
    ["009754681935b22a.1"],
    ["OG-W-FILTER状态/重置/清除"],
    "全量有工作区但当前页无结果",
    "同resetFilters；不是创建首项",
    ["filter_empty"],
  ],
  [
    childFile,
    "OG-W-SELECT",
    "选择工作区",
    "local",
    ["b4c1c37e889b3212.1"],
    ["OG-W-SELECT"],
    "pageItems，无busy禁用",
    "selectedWorkspaceId取原id；详情按全量数组，不因筛选隐藏而清空；旧button的role=listitem仍待修",
    ["selected", "search"],
  ],
  [
    childFile,
    "OG-W-PREVIOUS",
    "上一页",
    "local",
    ["3619d28a163df5ce.1"],
    ["OG-W-PAGE"],
    "结果超过8条才显示；page<=1禁用",
    "page-=1，不请求服务",
    ["catalog", "page_two"],
  ],
  [
    childFile,
    "OG-W-NEXT",
    "下一页",
    "local",
    ["d56d9b5edd39513e.1"],
    ["OG-W-PAGE"],
    "结果超过8条才显示；page>=pageCount禁用",
    "page+=1，不请求服务",
    ["catalog", "page_two"],
  ],
  [
    childFile,
    "OG-W-STATE",
    "归档或恢复",
    "write",
    ["08f874283aa537b7.1"],
    ["OG-W-STATE归档/恢复"],
    "busy或活动默认项禁用；performAction仅检查选择和busy",
    "函数prop传所选对象；父按原status确定action，等待原因后读取item.id/version并POST；API仍最终核验默认项",
    [
      "selected",
      "restore",
      "normal",
      "reason_archive",
      "reason_restore",
      "action_busy",
      "action_conflict",
      "default_conflict",
    ],
  ],
  [
    childFile,
    "OG-W-TEAMS",
    "团队与成员入口",
    "navigation",
    ["8300243a415c8c66.1"],
    ["OG-W-LINK团队/概览"],
    "有选中项显示，不受busy禁用",
    "RouterLink /org-admin/teams；不修改当前会话工作区",
    ["selected"],
  ],
  [
    childFile,
    "OG-W-PROFILE",
    "默认工作区设置入口",
    "navigation",
    ["01af8fcac461a03d.1"],
    ["OG-W-LINK团队/概览"],
    "有选中项显示，不受busy禁用",
    "RouterLink /org-admin；不是直接修改默认项",
    ["normal"],
  ],
  [
    childFile,
    "OG-W-TECH",
    "技术详情",
    "local",
    ["1c008f867673db60.1"],
    ["OG-TECH"],
    "所选项存在",
    "原生details展示id/slug，不是弹窗或复制动作",
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
  ["form.name", "required maxlength120；无自动生成，提交trim；等待仍可编辑"],
  [
    "form.slug",
    "required maxlength63，小写字母数字连字符且首尾非连字符；UI拒绝大写，服务另有lowercase归一化",
  ],
  ["form.reason", "required maxlength500；提交trim，不是共享原因窗至少2字规则"],
  ["query", "只查询当前返回name/slug，trim转小写；不查询id/版本/成员数，无maxlength"],
  ["sort", "name_asc/members_desc/updated_desc，后两者并列时名称排序；不发GET"],
];
export function buildWorkspacesReview(sources, evidence, controlsEvidence) {
  const dependencyHashes = Object.fromEntries(
    dependencies.map((file) => {
      assert.equal(typeof sources[file], "string", `missing source ${file}`);
      const sha = createHash("sha256").update(sources[file].replaceAll("\r\n", "\n")).digest("hex");
      assert.equal(evidence.sourceHashes[file], sha, `stale workspace source ${file}`);
      return [file, sha];
    }),
  );
  const scenes = (names) => names.map((scene) => ({ package: pkg, scene }));
  const variant = (name, evidenceScope) => ({
    name,
    evidenceScope,
    scenes: scenes([name]),
    remaining,
  });
  const result = {
    schemaVersion: 1,
    pageId: "P32",
    route: "/org-admin/workspaces",
    status: "source-reviewed-not-runtime-accepted",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes: Object.fromEntries([parentFile, childFile].map((f) => [f, dependencyHashes[f]])),
    actions: definitions.map(
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
        sourceCandidateIds: signatures.map((s) => `${file}#${s}`),
        sourceContractKeys,
        contractAliasReason: "沿既有OG-W合同按具体入口拆分状态/分页/链接；不增加现有业务写入种类。",
        condition,
        handler,
        variants,
        scenes: scenes(variants),
        visualStates: Object.fromEntries(
          ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
            state,
            kind === "excluded" ? "not-applicable-excluded" : "not-mapped",
          ]),
        ),
        testReferences: [
          {
            file: "scripts/verify-ui-phase2-workspaces-c.mjs",
            evidenceType: "offline-proposal-check-not-Vue",
          },
        ],
        remaining,
      }),
    ),
    // Function-valued props are not event candidates in the scanner. Bind them separately.
    functionProps: [
      {
        file: parentFile,
        component: "OrganizationWorkspacePanel",
        attribute: "create-workspace",
        handler: "createWorkspace",
        consumer: "props.createWorkspace",
        actionId: "OG-W-CREATE",
      },
      {
        file: parentFile,
        component: "OrganizationWorkspacePanel",
        attribute: "perform-workspace-action",
        handler: "workspaceAction",
        consumer: "props.performWorkspaceAction",
        actionId: "OG-W-STATE",
      },
    ],
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "一个共享原因窗的归档/恢复两种调用；创建是内联form，不是第二弹窗。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationWorkspacePanel.vue": fields.map(([binding]) => binding),
    },
    sharedReasonInput: {
      file: dependencies[2],
      binding: "reason",
      minimumLength: 2,
      maximumLength: null,
      serverMaximumLength: 500,
      remaining: "旧C稿限制500并不等于真实前端限制；全部组合与生命周期仍待",
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
          meaning: "仅P29资料表单，P32不显示",
          remaining,
        })),
        ...fields.map(([binding, meaning]) => ({ file: childFile, binding, meaning, remaining })),
      ],
      containers: [
        {
          file: parentFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "仅summary资料表单，P32排除",
          remaining,
          variants: [
            {
              ...variant("normal", "route-excluded-reference"),
              exclusionReason: "workspaces分支不渲染summary表单",
            },
          ],
        },
        {
          file: parentFile,
          tag: "AuditedReasonDialog",
          ordinal: 1,
          shape: "native-reason-dialog",
          sourceBehavior: "归档/恢复均先问原因，取消不写；共享组件先关闭再开始写入",
          remaining,
          variants: ["reason_archive", "reason_restore", "reason_short", "reason_long"].map((n) =>
            variant(n, "matching-dialog-scene"),
          ),
        },
        {
          file: childFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "三字段内联创建，成功/取消清空，失败保留；等待仍可输入",
          remaining,
          variants: [
            "create",
            "create_draft",
            "create_invalid",
            "create_required",
            "create_long",
            "create_busy",
            "create_conflict",
            "create_failure",
            "create_success",
            "create_read_failed",
            "create_unknown",
          ].map((n) => variant(n, "related-scene-only")),
        },
      ],
      sharedRemaining: [
        "共享原因窗的原生焦点/销毁/跨路由归属尚未由本页证明。",
        "原92PNG只是上下文，不冒充逐控件六态或真实Vue。",
      ],
    },
    compositionGaps: [
      "原型内联错误、缺失计数区分、原生button语义、未知写结果保护尚未进入真实Vue。",
      "创建成功会清除等待期间后续编辑；归档原因等待与当前组织/目标版本归属仍需具体决策与真实验证。",
    ],
    approval: "pending-user-review",
    limits: [remaining, "P31局部控件批准不自动外推P32整页；没有部署或更改权限/API。"],
  };
  const controlsPackage = "workspaces-controls-direction-c";
  for (const file of dependencies)
    assert.equal(
      controlsEvidence.sourceHashes[file],
      dependencyHashes[file],
      "stale controls source",
    );
  assert.deepEqual(
    Object.keys(controlsEvidence.actionVisualReferences).sort(),
    result.actions
      .filter((a) => a.kind !== "excluded")
      .map((a) => a.actionId)
      .sort(),
    "exact eighteen action representatives",
  );
  for (const action of result.actions) {
    if (action.kind === "excluded") continue;
    const ref = controlsEvidence.actionVisualReferences[action.actionId];
    action.visualStateReferences = {};
    for (const [state, scene] of Object.entries(ref.states)) {
      action.visualStates[state] = "scene-reference-not-acceptance";
      action.visualStateReferences[state] = {
        package: controlsPackage,
        scene,
        selector: ref.selector,
      };
      action.scenes.push({ package: controlsPackage, scene });
    }
    action.additionalControlVariants = Object.entries(controlsEvidence.controlVariantReferences)
      .filter(([, r]) => r.actionId === action.actionId)
      .map(([key, r]) => {
        for (const scene of Object.values(r.states))
          action.scenes.push({ package: controlsPackage, scene });
        return {
          key,
          scope: r.scope,
          package: controlsPackage,
          selector: r.selector,
          states: r.states,
        };
      });
    action.testReferences.push({
      file: "scripts/verify-ui-phase2-workspaces-controls-c.mjs",
      evidenceType: "offline-proposal-check-not-Vue",
    });
    action.remaining =
      "已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。";
  }
  result.compositionGaps.push(
    "新控件稿保留旧原型字段锁定、reason max500及未知结果保护提案；不能用控件图批准这些未确认的生产行为。",
  );
  for (const kind of ["archive", "restore"])
    result.surfaceReview.containers[1].variants.push({
      name: `controls-${kind}-composition`,
      evidenceScope: "matching-dialog-scene",
      scenes: [{ package: controlsPackage, scene: `composition-${kind}` }],
      remaining: "仅原因窗局部组合提案，字段边界与真实生命周期未获批准。",
    });
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const sources = Object.fromEntries(dependencies.map((f) => [f, readFileSync(f, "utf8")]));
  const result = buildWorkspacesReview(
    sources,
    JSON.parse(readFileSync(`${base}/design/${pkg}/evidence.json`, "utf8")),
    JSON.parse(
      readFileSync(`${base}/design/workspaces-controls-direction-c/evidence.json`, "utf8"),
    ),
  );
  const target = `${base}/action-reviews/P32.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), result);
  console.log(
    JSON.stringify({
      pageId: result.pageId,
      groups: result.actions.length,
      approval: result.approval,
    }),
  );
}
