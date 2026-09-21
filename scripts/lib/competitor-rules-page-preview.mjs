import path from "node:path";

export const competitorRulesReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/competitor-rules-page-preview.css";

export function competitorRulesPagePlugin() {
  return {
    name: "p20-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p20-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(competitorRulesReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
