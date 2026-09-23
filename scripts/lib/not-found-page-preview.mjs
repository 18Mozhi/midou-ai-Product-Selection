import assert from "node:assert/strict";
import path from "node:path";

export const notFoundPageSources = [
  "scripts/lib/not-found-page-preview.mjs",
  "apps/web/src/components/NotFoundPage.vue",
  "apps/web/src/navigation-memory.ts",
];

// P73 now uses the actual C composition; keep review runs on that production component.
export function previewNotFoundPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    template = source.slice(
      source.indexOf("<template>"),
      source.lastIndexOf("</template>") + "</template>".length,
    );
  assert.ok(template.includes("p73-workspace"), "P73 recovery workspace");
  assert.ok(template.includes("公开兜底 / 不读业务数据"), "P73 public fallback boundary");
  assert.ok(!/not-found-orbit|not-found-satellite/.test(template), "P73 removes orbit decoration");
  return source;
}

export function notFoundPagePlugin() {
  return {
    name: "p73-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        target = path.resolve("apps/web/src/components/NotFoundPage.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewNotFoundPage(source), map: null };
    },
  };
}
