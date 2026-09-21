import path from "node:path";
export const organizationProfileReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/organization-profile-page-preview.css";
export function organizationProfilePagePlugin() {
  return {
    name: "p29-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p29-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(organizationProfileReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
