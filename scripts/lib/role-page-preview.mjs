import path from "node:path";

export const rolePageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/role-page-preview.css";

export function rolePagePlugin() {
  return {
    name: "p31-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p31-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(rolePageReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
