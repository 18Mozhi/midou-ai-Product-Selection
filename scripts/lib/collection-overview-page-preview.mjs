import path from "node:path";

export const collectionOverviewPageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/collection-overview-page-preview.css";

export function collectionOverviewPagePlugin() {
  return {
    name: "p52-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p52-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(collectionOverviewPageReviewCss).replaceAll("\\\\", "/")}"></head>`,
        );
    },
  };
}
