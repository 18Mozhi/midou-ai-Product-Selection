import assert from "node:assert/strict";
import path from "node:path";

export const landingReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/landing-page-preview.css";
export const landingPageSources = [
  landingReviewCss,
  "scripts/lib/landing-page-preview.mjs",
  "apps/web/src/components/LandingRedirect.vue",
  "apps/web/src/components/LandingRedirectSurface.vue",
  "apps/web/src/components/UiStatePanel.vue",
];

// Review-only template; route lookup, retry and expired redirect behavior stay in the original script.
export function previewLandingPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P01 template bounds");
  const next = `<template>
  <LandingRedirectSurface :state="state" :request-id="requestId" @retry="resolveLanding" />
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function landingPagePlugin() {
  return {
    name: "p01-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        target = path.resolve("apps/web/src/components/LandingRedirect.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewLandingPage(source), map: null };
    },
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P01 body anchor");
      return html
        .replace("<body>", '<body class="p01-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(landingReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
