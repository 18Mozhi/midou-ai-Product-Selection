import path from "node:path";
export const reportReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/report-page-preview.css";
export function reportPagePlugin() {
  return {
    name: "p28-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p28-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(reportReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
