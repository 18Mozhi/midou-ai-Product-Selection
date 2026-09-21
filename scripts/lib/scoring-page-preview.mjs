import path from "node:path";

export const scoringReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/scoring-page-preview.css";

export function scoringPagePlugin() {
  return {
    name: "p17-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p17-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(scoringReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
