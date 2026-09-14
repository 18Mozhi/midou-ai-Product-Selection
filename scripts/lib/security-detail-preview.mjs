import assert from "node:assert/strict";
import path from "node:path";

export const securityDetailCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-security-detail-preview.css";

// No source transform: the five original P59 detail slots and shared drawer run unchanged.
export function securityDetailPlugin() {
  return {
    name: "security-detail-review-only",
    transformIndexHtml(html) {
      assert.equal(html.split("</head>").length, 2);
      const href = `/@fs/${path.resolve(securityDetailCss).replaceAll("\\", "/")}`;
      return html.replace("</head>", `<link rel="stylesheet" href="${href}"></head>`);
    },
  };
}
