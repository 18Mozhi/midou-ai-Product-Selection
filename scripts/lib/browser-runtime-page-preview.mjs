import path from "node:path";

export const browserRuntimePageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/browser-runtime-page-preview.css";

export function browserRuntimePagePlugin() {
  return {
    name: "p53-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p53-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(browserRuntimePageReviewCss).replaceAll("\\\\", "/")}"></head>`,
        );
    },
  };
}
