import path from "node:path";

export const governancePageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/governance-page-preview.css";

export function governancePagePlugin() {
  return {
    name: "p55-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p55-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(governancePageReviewCss).replaceAll("\\\\", "/")}"></head>`,
        );
    },
  };
}
