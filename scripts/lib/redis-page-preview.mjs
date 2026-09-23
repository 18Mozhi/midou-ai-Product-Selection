import assert from "node:assert/strict";
import path from "node:path";
import { shellReviewCss } from "./ui-phase2-shell-vue-preview.mjs";

export const redisReviewCss = "apps/web/src/redis-resilience.css";
export const redisPageSources = [
  redisReviewCss,
  shellReviewCss,
  "scripts/lib/redis-page-preview.mjs",
];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P67 unique anchor: " + before);
  return value.replace(before, after);
};

export function previewRedisPage(input) {
  const source = input.replaceAll("\r\n", "\n");
  assert.ok(source.includes('class="redis-resilience redis-resilience--c"'));
  for (const component of [
    "RedisResilienceSummary",
    "RedisResourceEvidence",
    "RedisKeyspaceSample",
  ])
    assert.ok(source.includes(component));
  return source;
}

export function redisPagePlugin() {
  return {
    name: "p67-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/RedisResilienceCenter.vue"))
        return { code: previewRedisPage(source), map: null };
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
