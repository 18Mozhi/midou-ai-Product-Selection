import path from "node:path";

export const collectionTaskPageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/collection-task-page-preview.css";

export function collectionTaskPagePlugin() {
  return {
    name: "p51-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p51-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(collectionTaskPageReviewCss).replaceAll("\\\\", "/")}"></head>`,
        );
    },
  };
}
