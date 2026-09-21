import path from "node:path";

export const costRuleReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/cost-rule-page-preview.css";

export function costRulePagePlugin() {
  return {
    name: "p22-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p22-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(costRuleReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
