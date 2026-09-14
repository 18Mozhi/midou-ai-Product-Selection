import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";
export const statusReviewComponent =
  "design-plans/ui-phase-2-2026-09-07/implementation/StatusWorkspaceReview.vue";
export const statusReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-status-page-preview.css";
export const statusReviewImport = `import StatusWorkspaceReview from "../../../../${statusReviewComponent}";\n`;
const once = (s, a, b) => {
  assert.equal(s.split(a).length, 2, "P61 unique anchor: " + a);
  return s.replace(a, b);
};
export function statusOriginalRegions(source) {
  const ast = baseParse(
      source.slice(source.indexOf("<template>") + 10, source.lastIndexOf("</template>")),
    ),
    nodes = [];
  const walk = (n) => {
    if (n.type === 1) nodes.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(ast);
  const get = (cls) => {
    const found = nodes.filter((n) =>
      n.props.some((p) => p.name === "class" && p.value?.content === cls),
    );
    assert.equal(found.length, 1, cls);
    return found[0];
  };
  const grid = get("platform-status-grid"),
    sections = grid.children.filter((n) => n.type === 1);
  assert.equal(sections.length, 3);
  return {
    grid: grid.loc.source,
    kpis: get("platform-management-kpis").loc.source,
    header: get("platform-topology-header").loc.source,
    lanes: get("platform-topology-lanes").loc.source,
    attention: get("platform-propagation").loc.source,
    session: get("platform-realtime-degradation").loc.source,
    collections: sections[1].loc.source,
    sources: sections[2].loc.source,
  };
}
export function previewStatusPage(source) {
  let s = source.replaceAll("\r\n", "\n"),
    r = statusOriginalRegions(s);
  s = once(s, '<script setup lang="ts">\n', '<script setup lang="ts">\n' + statusReviewImport);
  s = once(
    s,
    "'platform-management--content': domain === 'content',",
    "'platform-management--status-review': domain === 'status',\n      'platform-management--content': domain === 'content',",
  );
  s = once(
    s,
    "<h2>{{ titles[domain][0] }}</h2>",
    `<h1 v-if="domain === 'status'">系统状态</h1><h2 v-else>{{ titles[domain][0] }}</h2>`,
  );
  s = once(
    s,
    "<p>平台运营中心</p>",
    `<p v-if="domain === 'status'">P61 / 运行观测</p><p v-else>平台运营中心</p>`,
  );
  s = once(
    s,
    r.kpis,
    r.kpis.replace(
      `v-if="domain !== 'api-coverage'"`,
      `v-if="domain !== 'api-coverage' && domain !== 'status'"`,
    ),
  );
  const kpis = r.kpis.replace(` v-if="domain !== 'api-coverage'"`, "");
  const attention = r.attention.replace(
    "<h4>当前需核查的传播范围</h4>",
    "<h3>当前需核查的传播范围</h3>",
  );
  const session = r.session.replace("<h4>实时连接退化</h4>", "<h3>实时连接退化</h3>");
  s = once(
    s,
    r.grid,
    `<StatusWorkspaceReview v-if="domain === 'status'" :warning-count="propagationWarnings.length" :observed-at="when(data.observed_at)">
    <template #attention>${attention}</template>
    <template #dependencies>${r.header}${r.lanes}</template>
    <template #session>${session}</template>
    <template #activity><h3>业务汇总</h3>${kpis}<div class="p61-activity-groups">${r.collections}${r.sources}</div></template>
  </StatusWorkspaceReview>`,
  );
  s = once(
    s,
    "    <PlatformManagementFilter",
    `    <p v-if="domain === 'status'" class="p61-review-note">实际 Vue 审核版 · 本地合成观测 · 非生产健康结论 · 尚未部署</p>\n    <PlatformManagementFilter`,
  );
  return s;
}
export const statusPageSources = [
  statusReviewComponent,
  statusReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/platform-status-page-preview.mjs",
];
export function statusPagePlugin() {
  return {
    name: "p61-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replaceAll("\\", "/");
      if (
        normalized ===
        path.resolve("apps/web/src/components/PlatformManagementCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewStatusPage(source), map: null };
      if (
        normalized ===
        path.resolve("apps/web/src/components/NavigationShell.vue").replaceAll("\\", "/")
      )
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            `<header v-if="!opportunityId && routePath !== '/platform-admin/status'" class="role-page-title">`,
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, statusReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
