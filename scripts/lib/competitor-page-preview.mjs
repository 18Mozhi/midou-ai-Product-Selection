import path from "node:path";

export const competitorReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/competitor-page-preview.css";

export function competitorPagePlugin() {
  return {
    name: "p19-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p19-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(competitorReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
