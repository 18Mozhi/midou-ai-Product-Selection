import path from "node:path";

export const contentPageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/content-page-preview.css";

export function contentPagePlugin() {
  return {
    name: "p56-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p56-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(contentPageReviewCss).replaceAll("\\\\", "/")}"></head>`,
        );
    },
  };
}
