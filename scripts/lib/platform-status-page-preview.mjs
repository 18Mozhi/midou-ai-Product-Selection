import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const statusReviewComponent = "apps/web/src/components/PlatformStatusWorkspace.vue";
export const statusCenterComponent = "apps/web/src/components/PlatformStatusCenterView.vue";
export const statusReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-status-page-preview.css";
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, "P61 unique anchor: " + before);
  return source.replace(before, after);
};

export function previewStatusPage(source) {
  return once(
    source.replaceAll("\r\n", "\n"),
    "'platform-management--status-c': domain === 'status',",
    "'platform-management--status-c': domain === 'status',\n      'platform-management--status-review': domain === 'status',",
  );
}

export const statusPageSources = [
  statusReviewComponent,
  statusCenterComponent,
  "apps/web/src/components/platform-status-topology.ts",
  "apps/web/src/platform-status-center-c.css",
  statusReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/platform-status-page-preview.mjs",
];

export function statusPagePlugin() {
  return {
    name: "p61-production-vue-review",
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
        return { code: previewShellVue(source), map: null };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, statusReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
