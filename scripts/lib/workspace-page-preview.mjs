import path from "node:path";

export const workspacePageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/workspace-page-preview.css";

export function workspacePagePlugin() {
  return {
    name: "p32-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p32-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(workspacePageReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
