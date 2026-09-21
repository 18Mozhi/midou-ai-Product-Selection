import path from "node:path";
export const automationReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/automation-page-preview.css";
export const automationRowReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/automation-page-review-r1.css";
export function automationPagePlugin() {
  return {
    name: "p27-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p27-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(automationReviewCss).replaceAll("\\", "/")}"><link rel="stylesheet" href="/@fs/${path.resolve(automationRowReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
