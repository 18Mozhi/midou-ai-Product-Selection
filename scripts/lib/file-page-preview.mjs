import assert from "node:assert/strict";
import path from "node:path";
import { shellReviewCss } from "./ui-phase2-shell-vue-preview.mjs";

export const fileReviewCss = "apps/web/src/file-resilience.css";
export const filePageSources = [fileReviewCss, shellReviewCss, "scripts/lib/file-page-preview.mjs"];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P69 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Use the production template and stylesheet; only the surrounding shell remains a review fixture.
export function previewFilePage(input) {
  const source = input.replaceAll("\r\n", "\n");
  assert.ok(source.includes('class="file-resilience file-resilience--c"'));
  assert.ok(source.includes("FileResilienceSnapshot"));
  return source;
}
export function filePagePlugin() {
  return {
    name: "p69-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/FileResilienceCenter.vue"))
        return { code: previewFilePage(source), map: null };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        `<link rel="stylesheet" href="/@fs/${path.resolve(shellReviewCss).replaceAll("\\", "/")}"></head>`,
      );
    },
  };
}
