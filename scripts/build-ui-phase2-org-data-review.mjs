import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationDataPanel.vue";
export const dependencies = [parentFile, childFile];
const pkg = "org-data-direction-c";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const C = (...ids) => ids.map((id) => `${parentFile}#${id}`);
const D = (...ids) => ids.map((id) => `${childFile}#${id}`);
const remaining = "源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。";
const scene = (name) => ({ package: pkg, scene: name });
// Explicit meanings reviewed against current handlers and F04 source identities.
const definitions = [
  [
    "OG-REFRESH",
    "刷新组织数据",
    "read",
    C("b11692c0597885e3.1"),
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load({background:true})并行读取summary和data；只在已有data与summary时走后台保留分支",
    "normal",
  ],
  [
    "OG-RETRY",
    "重新加载",
    "read",
    C("97ed4772fb320d6c.1"),
    ["OG-RETRY"],
    "error/blocked/expired/forbidden/rate_limited/conflict父错误分支",
    "load()重新读取summary和data；当前GET客户端重试策略不由图稿决定",
    "error",
  ],
  [
    "EX-P34-RETRY",
    "审批专有重试排除",
    "excluded",
    C("5ae31bc55551b1dc.1", "08a59be6f793cde6.1"),
    ["OG-RETRY"],
    "view===approvals且首次500/429",
    "P35不挂载这两个失败组件转发，不把P34已批准白区移到P35",
    "normal",
  ],
  [
    "EX-P29-PROFILE",
    "组织资料排除",
    "excluded",
    C("d6b520278ab3dd57.1", "1cbd108c64b5230c.1", "5878e30377f290ae.1"),
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary分支",
    "不计资料保存或Logo有效性事件",
    "normal",
  ],
  [
    "EX-P30-MEMBERS",
    "成员事件排除",
    "excluded",
    C("6a563eeaa67fea90.1"),
    ["P30全部成员事件父转发，复用M语义"],
    "仅members分支",
    "无成员邀请/变更",
    "normal",
  ],
  [
    "EX-P31-ROLES",
    "资源授权事件排除",
    "excluded",
    C("b09d7923228aabe6.1"),
    ["P31资源授权父转发，复用已有合同"],
    "仅roles分支",
    "无资源授权写入",
    "normal",
  ],
  [
    "EX-REASON-ORIGINS",
    "其他页原因窗排除",
    "excluded",
    C("773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1", "e828f4ab0fdb0415.1"),
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
      "D-OG-REASON令牌轮换/撤销调用",
    ],
    "父共享原因窗挂载，但P35无发起入口",
    "不推断跨页已打开窗口的生命周期；不算本页业务弹窗",
    "normal",
  ],
  [
    "OG-D-REPORT",
    "前往报表工作台",
    "navigation",
    D("cd1df6927d5a68fd.1"),
    ["OG-D-REPORT"],
    "固定RouterLink",
    "/reports导航，不生成文件或携带下载地址",
    "normal",
  ],
  [
    "OG-D-VIEW",
    "工作区/导出视图",
    "local",
    D("874d2aeb7a9f46f2.1", "26b1ac38e04c362f.1"),
    ["OG-D-VIEW"],
    "两按钮无busy禁用",
    "view本地更新并写原URL键，保留各自筛选，不切会话工作区",
    "exports",
  ],
  [
    "OG-D-W-FILTER",
    "工作区重置",
    "local",
    D("3638b3e1e1d8cad7.1"),
    ["OG-D-W-FILTER重置"],
    "工作区视图",
    "resetWorkspaces只清本视图名称/状态/排序，watch回第一页",
    "workspace_search",
  ],
  [
    "OG-D-W-PAGE",
    "工作区分页",
    "local",
    D("a3740ac6cf7e5072.1", "595d56ce2159fb14.1"),
    ["OG-D-W-PAGE"],
    "有匹配项；首尾边界禁用",
    "本地8条一页，workspacePage更新原URL，无服务端分页请求",
    "workspace_page_two",
  ],
  [
    "OG-D-E-FILTER",
    "导出重置",
    "local",
    D("000799abd17373dd.1"),
    ["OG-D-E-FILTER重置"],
    "导出视图",
    "resetExports清本视图五条件，保留工作区比较筛选",
    "export_search",
  ],
  [
    "OG-D-E-PAGE",
    "导出分页",
    "local",
    D("ad756c5bd12f75ea.1", "17620112cb625463.1"),
    ["OG-D-E-PAGE"],
    "有匹配项；首尾边界禁用",
    "本地10条一页，不扩大后端最近100条读取范围",
    "export_page_two",
  ],
  [
    "OG-TECH",
    "导出技术详情",
    "local",
    D("1c008f867673db60.1"),
    ["OG-TECH"],
    "每条可见导出内原生details",
    "summary展开记录ID，不请求API、不复制、不下载，不把渲染行数计为新动作",
    "technical",
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
const meanings = {
  workspaceQuery: "只搜索工作区名称，trim与中文小写；无maxlength；初始URL截200 UTF-16单位",
  workspaceStatus: "all/active/archived；筛选变化回第一页",
  workspaceSort:
    "total_desc/name_asc/trends_desc/opportunities_desc/tasks_desc/exports_desc；合计非质量分",
  exportQuery: "搜索工作区名称/中文报表类型/中文状态，不搜ID；无maxlength；初始URL截200单位",
  exportWorkspace: "已加载导出workspace_name去重排序，非完整工作区目录；同名合并",
  exportType: "all/opportunity/trend/team；未知值保留在全部内",
  exportStatus: "all/queued/leased/retry_scheduled/succeeded/dead_letter/expired",
  exportSort: "created_desc/created_asc/updated_desc/rows_desc/workspace_asc；只排序已加载记录",
};
const controlBindings = {
  refresh: ["OG-REFRESH", ...C("b11692c0597885e3.1")],
  "refresh-loading": ["OG-REFRESH", ...C("b11692c0597885e3.1")],
  "retry-error": ["OG-RETRY", ...C("97ed4772fb320d6c.1")],
  "retry-forbidden": ["OG-RETRY", ...C("97ed4772fb320d6c.1")],
  "retry-expired": ["OG-RETRY", ...C("97ed4772fb320d6c.1")],
  "retry-rate_limited": ["OG-RETRY", ...C("97ed4772fb320d6c.1")],
  "view-workspaces-available": ["OG-D-VIEW", ...D("874d2aeb7a9f46f2.1")],
  "view-workspaces-selected": ["OG-D-VIEW", ...D("874d2aeb7a9f46f2.1")],
  "view-exports-available": ["OG-D-VIEW", ...D("26b1ac38e04c362f.1")],
  "view-exports-selected": ["OG-D-VIEW", ...D("26b1ac38e04c362f.1")],
  "workspace-reset": ["OG-D-W-FILTER", ...D("3638b3e1e1d8cad7.1")],
  "workspace-previous": ["OG-D-W-PAGE", ...D("a3740ac6cf7e5072.1")],
  "workspace-next": ["OG-D-W-PAGE", ...D("595d56ce2159fb14.1")],
  "export-reset": ["OG-D-E-FILTER", ...D("000799abd17373dd.1")],
  "export-previous": ["OG-D-E-PAGE", ...D("ad756c5bd12f75ea.1")],
  "export-next": ["OG-D-E-PAGE", ...D("17620112cb625463.1")],
  "technical-closed": ["OG-TECH", ...D("1c008f867673db60.1")],
  "technical-open": ["OG-TECH", ...D("1c008f867673db60.1")],
  reports: ["OG-D-REPORT", ...D("cd1df6927d5a68fd.1")],
};
export const externalPaths = {
  controls: "output/playwright/p35-controls-review/evidence.json",
  fields: "output/playwright/p35-fields-review/evidence.json",
  implementation: "output/playwright/p35-export-detail-vue/evidence.json",
  parent: "output/playwright/p35-parent-read-states/evidence.json",
};
export function readOrgDataReviewInputs() {
  return {
    sources: Object.fromEntries(dependencies.map((f) => [f, text(f)])),
    packages: new Map([[pkg, JSON.parse(text(`${base}/design/${pkg}/evidence.json`))]]),
    external: Object.fromEntries(
      Object.entries(externalPaths).map(([k, f]) => [k, JSON.parse(text(f))]),
    ),
  };
}
export function buildOrgDataReview({ sources, external }) {
  const sourceHashes = Object.fromEntries(
    dependencies.map((f) => [f, hash(sources[f].replaceAll("\r\n", "\n"))]),
  );
  const actions = structuredClone(definitions).map(
    ([
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      condition,
      handler,
      sceneName,
    ]) => ({
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      contractAliasReason: "复用F04明确合同；选中变体与重复渲染不增加源码动作数。",
      condition,
      handler,
      variants: ["source-current"],
      scenes: [scene(sceneName)],
      visualStates: Object.fromEntries(
        ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
          s,
          kind === "excluded" ? "not-applicable-excluded" : "not-mapped",
        ]),
      ),
      testReferences: [
        {
          file: "scripts/verify-ui-phase2-org-data-controls.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
    }),
  );
  const imageReferences = (key, predicate) =>
    external[key].screenshots.filter(predicate).map((s) => ({
      file: `${path.posix.dirname(externalPaths[key])}/${s.file}`,
      width: s.width,
      sha256: s.sha256,
    }));
  const inputs = [
    ...parentInputs.map((binding) => ({
      file: parentFile,
      binding,
      meaning: "P29组织资料分支，P35排除",
      remaining,
    })),
    ...external.fields.fields.map((f) => ({
      file: childFile,
      binding: f.model,
      meaning: meanings[f.model],
      remaining,
      fieldEvidence: {
        id: f.id,
        selector: `#${f.id}`,
        screenshots: imageReferences("fields", (s) => s.name.startsWith(`${f.id}-`)),
      },
    })),
  ];
  return structuredClone({
    schemaVersion: 1,
    pageId: "P35",
    route: "/org-admin/data",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P35无本地业务弹窗；技术details是行内披露。父共享原因窗仅排除本页发起入口，不推断跨页终态。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationDataPanel.vue": external.fields.fields.map((f) => f.model),
    },
    propBindings: [
      {
        component: "OrganizationDataPanel",
        condition: "view === 'data'",
        props: { data: "data", "format-time": "fmt" },
        events: [],
        meaning: "仅数据与时间格式函数；子组件无emit/fetch写入，也没有busy prop",
      },
    ],
    externalEvidence: Object.fromEntries(
      Object.entries(externalPaths).map(([k, f]) => [k, { file: f, sha256: hash(text(f)) }]),
    ),
    externalControlBindings: external.controls.controls.map((c) => ({
      id: c.id,
      selector: c.selector,
      widths: c.widths,
      states: c.states,
      proposalOnly: !!c.proposalOnly,
      actionId: controlBindings[c.id]?.[0] ?? null,
      sourceCandidateIds: controlBindings[c.id]?.slice(1) ?? [],
      screenshots: imageReferences("controls", (s) => s.controlId === c.id),
      scope: "独立旧稿原生控件区域，不是全组适用性或真实Vue批准",
    })),
    externalFieldCompositions: imageReferences("fields", (s) => s.name.includes("-composition-")),
    externalImplementationImages: imageReferences("implementation", () => true),
    parentReadEvidence: {
      review: "P35-PARENT-READ-STATES-REVIEW.md",
      evidence: externalPaths.parent,
      checks: external.parent.checks.length,
      scenarios: external.parent.scenarios.length,
      screenshots: external.parent.screenshots.length,
      scope:
        "实际App双视图/双端点/两阶段/七故障/双端隔离HTTP；旧界面技术证据，不是C批准或真实后端/权限/生产验收",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: dependencies,
      includeStructuralContainers: true,
      dependencyHashes: sourceHashes,
      inputs,
      containers: [
        {
          file: parentFile,
          tag: "form",
          ordinal: 1,
          shape: "form-container",
          sourceBehavior: "仅summary组织资料表单，P35排除",
          remaining,
          variants: [
            {
              name: "summary-excluded",
              evidenceScope: "route-excluded-reference",
              exclusionReason: "view===summary非data",
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
          sourceBehavior: "共享原因窗仍挂载；P35无发起入口",
          remaining,
          variants: [
            {
              name: "no-local-origin",
              evidenceScope: "route-excluded-reference",
              exclusionReason: "本页动作不调用ask；其他页已打开窗口生命周期另验",
              scenes: [scene("normal")],
              remaining,
            },
          ],
        },
        ...[
          [
            1,
            "observed-at",
            "头部行内观测时间，读取data.observed_at并沿用formatTime；不是抽屉或实时一致性保证",
          ],
          [2, "quality-notice", "持续的数量不等于数据质量说明及报表入口；无关闭或新建/下载行为"],
        ].map(([ordinal, name, sourceBehavior]) => ({
          file: childFile,
          tag: "aside",
          ordinal,
          shape: "inline-aside",
          sourceBehavior,
          remaining,
          variants: [
            {
              name,
              evidenceScope: "related-scene-only",
              scenes: [scene("normal"), scene("exports")],
              remaining,
            },
          ],
        })),
      ],
      sharedRemaining: [
        "源扫描4容器：2父共享/他页结构及2子行内说明，不等于P35有4个业务弹窗。",
        "子组件details、section、列表不是原生dialog或抽屉；父真实异常、路由归属和生命周期另验。",
      ],
    },
    approvalRecords: ["P35-MOBILE-EXPORT-DETAIL-APPROVAL.md"],
    compositionGaps: [
      "独立控件/字段图通过额外精确验证关联；未改旧清单格式或冒充统一六态图包，因此通用六态槽继续not-mapped。",
      "父级七类故障/刷新/鉴权替换已由独立双视图实际App矩阵核对；对应C设计图和实际实施未完成，不能用P34区域批准代替。",
      "手机导出详情及null/0已有局部批准；生成/重试和新筛选组合未答不通过。",
      "完整URL历史、缓存/多实例/组织切换、主题密度、200%缩放、真实API/SQL/RBAC和全73页生产验收待完成。",
    ],
    limits: [remaining, "无生产/API/OpenAPI/环境/依赖/数据库/部署变化；本登记不能授予批准。"],
  });
}
export function validateOrgDataBindings(review, inputs) {
  const expected = buildOrgDataReview(inputs);
  for (const key of [
    "externalEvidence",
    "externalControlBindings",
    "externalFieldCompositions",
    "externalImplementationImages",
    "parentReadEvidence",
    "propBindings",
    "inputs",
    "approvalRecords",
  ])
    assert.deepEqual(review[key], expected[key], `changed ${key}`);
  assert.deepEqual(review.surfaceReview.inputs, expected.surfaceReview.inputs);
  for (const [key, e] of Object.entries(inputs.external)) {
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(text(f)), sha, `${key} stale source ${f}`);
    for (const s of e.screenshots)
      assert.equal(
        hash(readFileSync(`${path.posix.dirname(externalPaths[key])}/${s.file}`)),
        s.sha256,
        s.file,
      );
  }
  const controls = review.externalControlBindings;
  assert.equal(controls.length, 25);
  assert.equal(controls.filter((c) => c.proposalOnly).length, 6);
  for (const c of controls) {
    assert.equal(c.screenshots.length, c.widths.length * c.states.length);
    if (c.proposalOnly) {
      assert.equal(c.actionId, null);
      assert.deepEqual(c.sourceCandidateIds, []);
    } else {
      const a = review.actions.find((a) => a.actionId === c.actionId);
      assert.ok(a && a.kind !== "excluded");
      assert.ok(c.sourceCandidateIds.every((id) => a.sourceCandidateIds.includes(id)));
    }
    const source = inputs.external.controls.controls.find((s) => s.id === c.id);
    for (const state of c.states)
      for (const width of c.widths) {
        const shot = inputs.external.controls.screenshots.find(
          (s) => s.controlId === c.id && s.variant === state && s.width === width,
        );
        assert.ok(shot && c.screenshots.some((s) => s.file.endsWith(`/${shot.file}`)));
        assert.equal(shot.proposalOnly, !!source.proposalOnly);
      }
  }
  assert.deepEqual(
    [...new Set(controls.flatMap((c) => c.sourceCandidateIds))].sort(),
    review.actions
      .filter((a) => a.kind !== "excluded")
      .flatMap((a) => a.sourceCandidateIds)
      .sort(),
  );
  return {
    sourceSites: review.actions.flatMap((a) => a.sourceCandidateIds).length,
    existingControlVariants: 19,
    proposedControlVariants: 6,
    localFields: 8,
    fieldImages: inputs.external.fields.screenshots.length,
    fieldCompositions: review.externalFieldCompositions.length,
    implementationImages: review.externalImplementationImages.length,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const inputs = readOrgDataReviewInputs(),
    review = buildOrgDataReview(inputs),
    result = validateOrgDataBindings(review, inputs),
    target = `${base}/action-reviews/P35.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(review, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(text(target)), review);
  console.log(JSON.stringify({ pageId: "P35", ...result, approval: review.approval }));
}
