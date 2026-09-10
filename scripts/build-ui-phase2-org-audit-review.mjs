import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationAuditPanel.vue";
export const dependencies = [parentFile, childFile];
const pkg = "org-audit-direction-c";
const text = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const C = (...ids) => ids.map((id) => parentFile + "#" + id);
const U = (...ids) => ids.map((id) => childFile + "#" + id);
const remaining =
  "来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。";
const scene = (name) => ({ package: pkg, scene: name });
const definitions = [
  [
    "OG-REFRESH",
    "刷新审计第一页",
    "read",
    C("b11692c0597885e3.1"),
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load({background:true})，审计分支不读取治理摘要",
    "normal",
  ],
  [
    "OG-RETRY",
    "重新读取",
    "read",
    C("97ed4772fb320d6c.1"),
    ["OG-RETRY"],
    "父读取错误分支",
    "load()保留现有请求与重试合同",
    "error",
  ],
  [
    "EX-P34-RETRY",
    "审批专有恢复排除",
    "excluded",
    C("5ae31bc55551b1dc.1", "08a59be6f793cde6.1"),
    ["OG-RETRY"],
    "仅approvals",
    "审批500/429专有组件不属于P37",
    "normal",
  ],
  [
    "EX-P29-PROFILE",
    "组织资料表单排除",
    "excluded",
    C("d6b520278ab3dd57.1", "5878e30377f290ae.1", "1cbd108c64b5230c.1"),
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary",
    "不包含资料保存或Logo校验",
    "normal",
  ],
  [
    "EX-P30-MEMBERS",
    "成员事件排除",
    "excluded",
    C("6a563eeaa67fea90.1"),
    ["P30全部成员事件父转发，复用M语义"],
    "仅members",
    "不把成员邀请和角色操作计入审计页",
    "normal",
  ],
  [
    "EX-P31-ROLES",
    "资源授权事件排除",
    "excluded",
    C("b09d7923228aabe6.1"),
    ["P31资源授权父转发，复用已有合同"],
    "仅roles",
    "资源授权的创建/延期/撤销不属于审计只读动作",
    "normal",
  ],
  [
    "EX-REASON",
    "其他页面原因调用排除",
    "excluded",
    C("773c2105d1d0d008.1", "35233f910d34fac6.1", "ab6191688d424055.1", "e828f4ab0fdb0415.1"),
    [
      "D-OG-REASON提交/取消父转发",
      "D-OG-REASON组件调用",
      "D-OG-REASON通用成员/邀请/工作区/团队及P31调用",
      "D-OG-REASON令牌轮换/撤销调用",
    ],
    "组件在父层共享挂载，但本页无原因触发器",
    "不宣称父窗不能遗留打开；其跨页生命周期仍需验证",
    "normal",
  ],
  [
    "OG-AUD-FILTER",
    "应用七项精确条件",
    "read",
    U("632bdb5521e9f9f3.1", "34561042e3eccaf3.1"),
    ["OG-AUD-FILTER"],
    "busy禁用提交按钮；字段可编辑",
    "submitFilters归一化、日期检查、同步URL后调用applyFilters",
    "advanced",
  ],
  [
    "OG-AUD-ADVANCED",
    "高级条件展开与收起",
    "local",
    U("1f900020f4fabd5a.1"),
    ["OG-AUD-ADVANCED"],
    "原生details，open绑定四项非空",
    "只展开高级字段，不查询服务器",
    "advanced",
  ],
  [
    "OG-AUD-RESET",
    "重置全部条件",
    "read",
    U("8b5af20889c64af3.1"),
    ["OG-AUD-RESET"],
    "busy禁用",
    "清空七条件和loadedQuery后调用submitFilters重新读第一页",
    "normal",
  ],
  [
    "OG-AUD-SYSTEM",
    "系统连接记录开合",
    "local",
    U("b521afa3371906f1.1"),
    ["OG-AUD-SYSTEM"],
    "有隐藏系统记录且trim后的页内搜索及已用action为空",
    "切换systemEventsExpanded，不删除事实",
    "system_collapsed",
  ],
  [
    "OG-AUD-SELECT",
    "选择审计记录",
    "local",
    U("82a3e8539a9df6fc.1"),
    ["OG-AUD-SELECT"],
    "visibleEvents逐条渲染",
    "choose设置selectedId并清copyState；实际button上role=listitem仍待处理",
    "selected",
  ],
  [
    "OG-AUD-MORE",
    "加载更多",
    "read",
    U("7e32b2d5625cbb6d.1"),
    ["OG-AUD-MORE"],
    "nextCursor且原始loadedQuery为空，busy禁用",
    "loadMore函数prop；纯空格也隐藏按钮，不擅自trim改条件",
    "more_busy",
  ],
  [
    "OG-AUD-COPY-REQUEST",
    "复制请求ID",
    "local",
    U("8c33330215c9d2a4.1"),
    ["OG-AUD-COPY请求/追踪"],
    "selectedEvent存在；源无缺失ID禁用",
    "copy(request_id,'request')，当前记录/代次/路径/组件生命周期保护反馈；实际隔离Vue验证见P37-COPY-OWNERSHIP-REVIEW",
    "request_copied",
  ],
  [
    "OG-AUD-COPY-TRACE",
    "复制追踪ID",
    "local",
    U("84cc90836d3f1955.1"),
    ["OG-AUD-COPY请求/追踪"],
    "selectedEvent存在；源无缺失ID禁用",
    "copy(trace_id,'trace')，不等于请求ID的同一次复制",
    "trace_copied",
  ],
  [
    "OG-TECH",
    "技术详情",
    "local",
    U("1c008f867673db60.1"),
    ["OG-TECH"],
    "selectedEvent存在，原生details",
    "只展示五项技术字段，不打开业务弹窗",
    "technical",
  ],
];
const meanings = {
  loadedQuery:
    "仅搜索已加载操作/对象类型/结果/request_id/trace_id；maxlength160；不检索metadata/actor或resource ID",
  "form.action": "maxlength128，trim后精确操作代码，不是中文模糊搜索",
  "form.outcome": "空/succeeded/failed/blocked，原生select",
  "form.resource_type": "maxlength80，trim后精确类型，不是对象ID",
  "form.request_id": "maxlength128，trim后精确请求ID",
  "form.trace_id": "maxlength128，trim后精确追踪ID",
  "form.occurred_from": "datetime-local，max为结束，提交ISO；无默认必填",
  "form.occurred_to": "datetime-local，min为开始；两端存在且开始更晚时拒绝查询",
};
const controlActions = {
  apply: "OG-AUD-FILTER",
  reset: "OG-AUD-RESET",
  "advanced-closed": "OG-AUD-ADVANCED",
  "advanced-open": "OG-AUD-ADVANCED",
  "system-closed": "OG-AUD-SYSTEM",
  "system-open": "OG-AUD-SYSTEM",
  "event-selected": "OG-AUD-SELECT",
  "event-unselected": "OG-AUD-SELECT",
  more: "OG-AUD-MORE",
  refresh: "OG-REFRESH",
  retry: "OG-RETRY",
  "copy-request": "OG-AUD-COPY-REQUEST",
  "copy-trace": "OG-AUD-COPY-TRACE",
  "technical-closed": "OG-TECH",
  "technical-open": "OG-TECH",
};
export const externalPaths = {
  controls: "output/playwright/p37-controls-review/evidence.json",
  fields: "output/playwright/p37-fields-review/evidence.json",
};
export function readOrgAuditReviewInputs() {
  return {
    sources: Object.fromEntries(dependencies.map((f) => [f, text(f)])),
    packages: new Map([[pkg, JSON.parse(text(`${base}/design/${pkg}/evidence.json`))]]),
    external: Object.fromEntries(
      Object.entries(externalPaths).map(([key, f]) => [key, JSON.parse(text(f))]),
    ),
  };
}
export function buildOrgAuditReview({ sources, external }) {
  const sourceHashes = Object.fromEntries(dependencies.map((f) => [f, hash(sources[f])]));
  const actions = definitions.map(
    ([actionId, label, kind, sourceCandidateIds, sourceContractKeys, condition, handler, s]) => ({
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      contractAliasReason: "按F04完整合同单元格关联；两复制字段分组不增加来源数。",
      condition,
      handler,
      variants: ["source-current"],
      scenes: [scene(s)],
      visualStates: Object.fromEntries(
        ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
          s,
          kind === "excluded" ? "not-applicable-excluded" : "not-mapped",
        ]),
      ),
      testReferences: [
        {
          file: "scripts/verify-ui-phase2-org-audit-controls.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
    }),
  );
  const images = (key, predicate) =>
    external[key].screenshots.filter(predicate).map((s) => ({
      file: path.posix.dirname(externalPaths[key]) + "/" + s.file,
      width: s.width,
      sha256: s.sha256,
    }));
  const surfaceInputs = dependencies
    .flatMap((f) => scanReviewSurfaces(sources[f], f).inputs)
    .map((i) => ({
      ...i,
      meaning: i.file === parentFile ? "P29资料字段，本路由排除" : meanings[i.binding],
      remaining,
      ...(i.file === childFile
        ? {
            fieldEvidence: {
              id: i.binding === "loadedQuery" ? "loaded-query" : "filter-" + i.binding.slice(5),
              screenshots: images("fields", (s) =>
                i.binding === "loadedQuery"
                  ? s.name.startsWith("local-search-")
                  : s.name.startsWith("field-" + i.binding.slice(5) + "-"),
              ),
            },
          }
        : {}),
    }));
  const container = (file, tag, ordinal, shape, sourceBehavior, variants) => ({
    file,
    tag,
    ordinal,
    shape,
    sourceBehavior,
    remaining,
    variants: variants.map(([name, scope, scenes, exclusionReason]) => ({
      name,
      evidenceScope: scope,
      scenes: scenes.map(scene),
      remaining,
      ...(exclusionReason ? { exclusionReason } : {}),
    })),
  });
  return structuredClone({
    schemaVersion: 1,
    pageId: "P37",
    route: "/org-admin/audit",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: base + "/organization-governance-contract-review.md",
    sourceHashes,
    actions,
    inputs: Object.fromEntries(
      dependencies.map((f) => [
        path.posix.basename(f),
        surfaceInputs.filter((i) => i.file === f).map((i) => i.binding),
      ]),
    ),
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "本页无业务弹窗；父共享原因组件及调用来自其他页面，登记排除，不证明跨页关闭。",
    },
    propBindings: [
      {
        component: "OrganizationAuditPanel",
        directive: "else",
        props: {
          events: "rows",
          "next-cursor": "data?.nextCursor ?? null",
          filters: "auditFilters",
          busy: "busy || refreshing",
          "format-time": "fmt",
          "apply-filters": "applyAuditFilters",
          "load-more": "loadMoreAudit",
        },
        events: [],
      },
    ],
    functionProps: [
      {
        prop: "applyFilters",
        parentHandler: "applyAuditFilters",
        actions: ["OG-AUD-FILTER", "OG-AUD-RESET"],
        effect: "loadAuditPage(next)，精确七条件替换首批",
      },
      {
        prop: "loadMore",
        parentHandler: "loadMoreAudit",
        actions: ["OG-AUD-MORE"],
        effect: "loadAuditPage(auditFilters.value,true)，沿现有nextCursor追加",
      },
    ],
    externalEvidence: Object.fromEntries(
      Object.entries(externalPaths).map(([key, f]) => [key, { file: f, sha256: hash(text(f)) }]),
    ),
    externalControlBindings: external.controls.controls.map((c) => {
      const action = actions.find((a) => a.actionId === controlActions[c.id]);
      assert.ok(action || c.source.startsWith("proposal:"), "Unmapped control " + c.id);
      return {
        id: c.id,
        selector: c.selector,
        widths: c.mobile ? [390] : [390, 1440],
        states: c.states,
        actionId: action?.actionId ?? null,
        sourceCandidateIds: action?.sourceCandidateIds ?? [],
        proposalOnly: !action,
        proposalStates: c.disabledProposalOnly ? ["disabled"] : [],
        screenshots: images("controls", (s) => s.control === c.id),
        remaining,
      };
    }),
    externalControlCompositions: images("controls", (s) => s.type === "composition"),
    externalFieldCompositions: images("fields", (s) => s.name.startsWith("combination-")),
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: dependencies,
      includeStructuralContainers: true,
      dependencyHashes: sourceHashes,
      inputs: surfaceInputs,
      containers: [
        container(parentFile, "form", 1, "form-container", "仅summary资料表单", [
          ["summary-excluded", "route-excluded-reference", ["normal"], "本页不呈现资料编辑"],
        ]),
        container(
          parentFile,
          "AuditedReasonDialog",
          1,
          "native-reason-dialog",
          "共享挂载，审计页无本地触发；遗留打开生命周期另验",
          [["other-route-excluded", "route-excluded-reference", ["normal"], "仅其他页面写入调用"]],
        ),
        container(childFile, "aside", 1, "inline-aside", "数据边界说明", [
          ["boundary", "related-scene-only", ["normal"]],
        ]),
        container(childFile, "form", 1, "form-container", "源含七条件和页内搜索；C稿分区不同", [
          ["normal", "proposal-shape-differs", ["normal"]],
          ["advanced", "proposal-shape-differs", ["advanced"]],
          ["range", "proposal-shape-differs", ["range_error"]],
        ]),
        container(childFile, "aside", 2, "inline-aside", "所选记录详情，不是modal", [
          ["selected", "related-scene-only", ["normal", "selected"]],
          ["technical", "related-scene-only", ["technical"]],
        ]),
        container(childFile, "aside", 3, "inline-aside", "无选中记录的提示", [
          ["empty", "related-scene-only", ["empty"]],
        ]),
      ],
      sharedRemaining: [
        "父共享原因的跨页遗留状态不在当前登记中验收。",
        "子源10候选、八模型和四结构都需真实Vue生命周期验证。",
      ],
    },
    approvalRecords: [],
    compositionGaps: [
      "基础筛选和手机详情问题尚未回复，全部P37新图待审。",
      "19控件变体中的三个便捷动作和缺失ID禁用是提案，非生产规则。",
      "原104、字段38、控件172图分别关联，不把独立schema强充通用六态槽。",
      "复制及分页响应归属已做局部保护，不扩大为全部OG-G05通过；查询失败已用条件错位及URL反向恢复仍待处理。",
      "P35既有颜色门授权待答；全73页C实施、部署和签收未完成。",
    ],
    limits: [
      remaining,
      "本地仅复制/分页归属修复；无API/env/权限/数据库或审核批准变更，未部署生产。",
    ],
  });
}
export function validateOrgAuditBindings(review, inputs) {
  assert.deepEqual(review, buildOrgAuditReview(inputs), "P37 registry drift");
  const nodes = [];
  function walk(n) {
    if (n.type === 1 && n.tag === "OrganizationAuditPanel") nodes.push(n);
    for (const c of n.children ?? []) walk(c);
  }
  walk(baseParse(parse(inputs.sources[parentFile]).descriptor.template.content));
  assert.equal(nodes.length, 1);
  const node = nodes[0];
  assert.equal(
    node.props.some((p) => p.type === 7 && p.name === "else"),
    true,
  );
  assert.deepEqual(
    Object.fromEntries(
      node.props
        .filter((p) => p.type === 7 && p.name === "bind")
        .map((p) => [p.arg.content, p.exp.content]),
    ),
    review.propBindings[0].props,
  );
  assert.deepEqual(
    node.props.filter((p) => p.type === 7 && p.name === "on"),
    [],
  );
  const source = inputs.sources[parentFile].replace(/\s+/g, " ");
  assert.match(
    source,
    /applyAuditFilters = \(next: OrganizationAuditFilters\) => loadAuditPage\(next\)/,
  );
  assert.match(source, /loadMoreAudit = \(\) => loadAuditPage\(auditFilters.value, true\)/);
  assert.match(
    source,
    /if \(currentView === "audit"\) \{ const response = await api\(auditPath\(\)\); return \{ value: response.data, requestId: response.request_id \}; \}/,
  );
  assert.match(
    source,
    /return `\/organizations\/\$\{props.organizationId\}\/audit-events\?\$\{query\}`/,
  );
  const candidates = dependencies.flatMap((f) => scanSource(inputs.sources[f], f).candidates);
  assert.deepEqual(
    review.actions.flatMap((a) => a.sourceCandidateIds).sort(),
    candidates.map((c) => c.candidateId).sort(),
  );
  for (const [key, e] of Object.entries(inputs.external)) {
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(text(f)), sha, `${key}:${f}`);
    for (const s of e.screenshots)
      assert.equal(
        hash(readFileSync(path.posix.dirname(externalPaths[key]) + "/" + s.file)),
        s.sha256,
      );
  }
  const controls = review.externalControlBindings;
  assert.equal(controls.length, 19);
  for (const c of controls) {
    assert.equal(c.screenshots.length, c.states.length * c.widths.length);
    if (c.proposalOnly) assert.equal(c.actionId, null);
  }
  assert.deepEqual(
    [...new Set(controls.flatMap((c) => c.sourceCandidateIds))].sort(),
    review.actions
      .filter((a) => a.kind !== "excluded")
      .flatMap((a) => a.sourceCandidateIds)
      .sort(),
  );
  return {
    sourceSites: candidates.length,
    semanticGroups: review.actions.length,
    routeActions: review.actions.filter((a) => a.kind !== "excluded").length,
    writeKinds: 0,
    functionProps: 2,
    controlVariants: 19,
    localModels: 8,
    containers: review.surfaceReview.containers.length,
    controlImages: inputs.external.controls.screenshots.length,
    fieldImages: inputs.external.fields.screenshots.length,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const inputs = readOrgAuditReviewInputs(),
    review = buildOrgAuditReview(inputs);
  const result = validateOrgAuditBindings(review, inputs);
  const target = base + "/action-reviews/P37.json";
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(review, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(text(target)), review);
  console.log(JSON.stringify({ pageId: "P37", ...result, approval: review.approval }));
}
