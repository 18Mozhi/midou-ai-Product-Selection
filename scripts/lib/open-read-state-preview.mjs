import assert from "node:assert/strict";
import path from "node:path";
export const openReadCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-open-read-preview.css";
export function previewOpenReadState(source) {
  let count = 0;
  const result = source.replace(
    /<h3 id="open-read-state-title">([\s\S]*?)<\/h3>/g,
    (_all, body) => {
      count++;
      return '<h2 id="open-read-state-title">' + body + "</h2>";
    },
  );
  assert.equal(count, 2, "P60 loading/failure heading anchors");
  return result;
}
export function openReadPlugin() {
  return {
    name: "open-read-c-review-only",
    enforce: "pre",
    transform(source, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/OpenPlatformCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewOpenReadState(source), map: null };
      return null;
    },
    transformIndexHtml(html) {
      assert.equal(html.split("</head>").length, 2);
      return html.replace(
        "</head>",
        `<link rel="stylesheet" href="/@fs/${path.resolve(openReadCss).replaceAll("\\", "/")}"></head>`,
      );
    },
  };
}
