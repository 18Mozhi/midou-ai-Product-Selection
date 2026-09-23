import path from "node:path";

export const personalCenterReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/personal-center-page-preview.css";

export function personalCenterPagePlugin() {
  return {
    name: "p11-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p11-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(personalCenterReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
