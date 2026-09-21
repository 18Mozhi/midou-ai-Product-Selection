import path from "node:path";

export const organizationDataPageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/organization-data-page-preview.css";

export function organizationDataPagePlugin() {
  return {
    name: "p35-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p35-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(organizationDataPageReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
