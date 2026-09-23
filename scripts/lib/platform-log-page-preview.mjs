import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";
export const logReviewComponent = "apps/web/src/components/PlatformLogWorkspace.vue";
export const logReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-log-page-preview.css";
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
  return once(
    source.replaceAll("\r\n", "\n"),
    'class="platform-log-center platform-log-center--c"',
    'class="platform-log-center platform-log-center--c platform-log-center--review"',
  );
}
export const logPageSources = [
  logReviewComponent,
  "apps/web/src/components/platform-log-types.ts",
  "apps/web/src/platform-log-center-c.css",
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
