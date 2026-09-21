import path from "node:path";
export const notificationReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/notification-page-preview.css";
export function notificationPagePlugin() {
  return {
    name: "p26-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p26-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(notificationReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
