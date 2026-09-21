import path from "node:path";

export const approvalReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/approval-page-preview.css";

export function approvalPagePlugin() {
  return {
    name: "p25-actual-vue-review",
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p25-review">')
        .replace("</head>", `<link rel="stylesheet" href="/@fs/${path.resolve(approvalReviewCss).replaceAll("\\", "/")}"></head>`);
    },
  };
}
