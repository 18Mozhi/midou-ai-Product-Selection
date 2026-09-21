import path from "node:path";

export const opportunityDetailReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/opportunity-detail-page-preview.css";

export function opportunityDetailPagePlugin() {
  return {
    name: "p18-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p18-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(opportunityDetailReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
