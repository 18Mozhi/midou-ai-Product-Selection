import assert from "node:assert/strict";
import path from "node:path";

export const uiStatePageSources = [
  "scripts/lib/ui-state-page-preview.mjs",
  "apps/web/src/components/UiStateShowcase.vue",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/components/ConfirmDialog.vue",
];

// P72 now uses the actual C composition; this guard keeps review runs on that component.
export function previewUiStatePage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    template = source.slice(
      source.indexOf("<template>"),
      source.lastIndexOf("</template>") + "</template>".length,
    );
  assert.ok(template.includes("p72-state-picker"), "P72 C state picker");
  assert.ok(template.includes("p72-confirmation"), "P72 separate confirmation section");
  assert.ok(!template.includes("state-orbit"), "P72 removes the orbit composition");
  return source;
}

export function uiStatePagePlugin() {
  return {
    name: "p72-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        target = path.resolve("apps/web/src/components/UiStateShowcase.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewUiStatePage(source), map: null };
    },
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P72 body anchor");
      assert.equal(html.split("</head>").length, 2, "P72 head anchor");
      return html.replace("<body>", '<body class="p72-review">');
    },
  };
}
