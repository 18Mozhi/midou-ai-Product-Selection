import assert from "node:assert/strict";
import path from "node:path";

export const themeReviewCss = "apps/web/src/components/theme-studio-c.css";

export function previewThemePage(input) {
  const source = input.replaceAll("\r\n", "\n");
  assert.ok(source.includes('class="theme-page theme-page--c"'), "P10 production C root");
  assert.ok(source.includes("PreferenceRadioGroup"), "P10 production radio group");
  assert.ok(source.includes("preference_scope_required"), "P10 scope recovery contract");
  return source;
}

export function themePagePlugin() {
  const componentPath = path
    .resolve("apps/web/src/components/ThemeStudio.vue")
    .replaceAll("\\", "/");
  return {
    name: "p10-production-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/") === componentPath)
        return { code: previewThemePage(source), map: null };
    },
  };
}
