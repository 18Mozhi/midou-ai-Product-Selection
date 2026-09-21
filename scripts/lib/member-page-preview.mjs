import path from "node:path";

export const memberPageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/member-page-preview.css";

export function memberPagePlugin() {
  return {
    name: "p30-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p30-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(memberPageReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
