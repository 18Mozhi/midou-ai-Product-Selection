import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";
export const logReviewComponent =
  "design-plans/ui-phase-2-2026-09-07/implementation/LogWorkspaceReview.vue";
export const logReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-log-page-preview.css";
export const logReviewImport = `import LogWorkspaceReview from "../../../../${logReviewComponent}";\n`;
const once = (s, a, b) => {
  assert.equal(s.split(a).length, 2, "P62 unique anchor: " + a);
  return s.replace(a, b);
};
export function originalLogChain(source) {
  const ast = baseParse(
      source.slice(source.indexOf("<template>") + 10, source.lastIndexOf("</template>")),
    ),
    matches = [];
  const walk = (n) => {
    if (
      n.type === 1 &&
      n.props.some((p) => p.name === "class" && p.value?.content === "platform-log-chain")
    )
      matches.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(ast);
  assert.equal(matches.length, 1);
  return matches[0].loc.source;
}
export function previewLogPage(source) {
  let s = source.replaceAll("\r\n", "\n");
  const chain = originalLogChain(s),
    single = once(
      once(chain, '        v-for="chain in traceChains"\n', ""),
      '        :key="chain.traceId"\n',
      "",
    );
  s = once(s, '<script setup lang="ts">\n', '<script setup lang="ts">\n' + logReviewImport);
  s = once(
    s,
    'class="platform-log-center"',
    'class="platform-log-center platform-log-center--review"',
  );
  s = once(s, "<h2>链路日志</h2>", "<h1>链路日志</h1>");
  s = once(s, '<h3 id="platform-log-read-title">', '<h2 id="platform-log-read-title">');
  s = once(s, "</h3>\n      <p>{{ message", "</h2>\n      <p>{{ message");
  s = once(s, "<p>系统运维</p>", "<p>P62 / 事件检索</p>");
  s = once(
    s,
    chain,
    `<LogWorkspaceReview :chains="traceChains"><template #chain="{ chain }">${single}</template></LogWorkspaceReview>`,
  );
  s = once(
    s,
    '    <ResponsiveFilterDrawer label="筛选链路日志"',
    `    <p class="p62-review-note">实际 Vue 审核版 · 本地合成日志 · 最多返回 200 条，不代表完整链 · 尚未部署</p>\n    <ResponsiveFilterDrawer label="筛选链路日志"`,
  );
  return s;
}
export const logPageSources = [
  logReviewComponent,
  logReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/platform-log-page-preview.mjs",
];
export function logPagePlugin() {
  return {
    name: "p62-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (
        file === path.resolve("apps/web/src/components/PlatformLogCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewLogPage(source), map: null };
      if (
        file === path.resolve("apps/web/src/components/NavigationShell.vue").replaceAll("\\", "/")
      )
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            `<header v-if="!opportunityId && routePath !== '/platform-admin/logs'" class="role-page-title">`,
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, logReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
