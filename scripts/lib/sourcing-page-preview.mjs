import path from "node:path";

export const sourcingReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/sourcing-page-preview.css";

export function sourcingPagePlugin() {
  return {
    name: "p21-actual-vue-review",
    enforce: "pre",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p21-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(sourcingReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
