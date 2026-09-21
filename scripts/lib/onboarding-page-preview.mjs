import assert from "node:assert/strict";
import path from "node:path";
export const onboardingReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/onboarding-page-preview.css";
export const onboardingPageSources = [
  onboardingReviewCss,
  "scripts/lib/onboarding-page-preview.mjs",
  "apps/web/src/components/OnboardingGuide.vue",
];
export function previewOnboardingPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P09 template bounds");
  const next =
    `<template><main class="onboarding-page onboarding-page--review" style="background:#f3f6fb" data-testid="onboarding"><header class="p09-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>快速引导</b><RouterLink to="/">跳过引导</RouterLink></header><section class="p09-hero"><p>{{ page.eyebrow }}</p><h1>{{ page.title }}</h1><span>{{ page.copy }}</span></section><section class="p09-workspace" aria-live="polite"><div class="p09-stage" aria-hidden="true"><span>{{ page.mark }}</span><i></i><i></i></` +
    `div><ul><li v-for="point in page.points" :key="point"><b>✓</b>{{ point }}</li></ul><p class="p09-boundary">这是说明内容，不表示功能已启用、范围已选定或任务已经完成。</p></section><footer class="p09-actions"><div aria-label="引导步骤"><button v-for="index in 3" :key="index" type="button" :aria-label="\`前往第 \${index} 步\`" :aria-current="step===index?'step':undefined" @click="step=index">{{ index }}</button></div><div><button v-if="step>1" class="p09-secondary" type="button" @click="previous">上一步</button><button v-if="step<3" ` +
    `class="p09-primary" type="button" @click="next">下一步</button><RouterLink v-else class="p09-primary" to="/">进入智能选品</RouterLink></div></footer><small>第 {{ step }} / 3 步 · 步骤只保存在当前页面</small></main></template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function onboardingPagePlugin() {
  return {
    name: "p09-actual-vue-review",
    enforce: "pre",
    transform(s, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/OnboardingGuide.vue").replaceAll("\\", "/")
      )
        return { code: previewOnboardingPage(s), map: null };
    },
    transformIndexHtml(h) {
      return h
        .replace("<body>", '<body class="p09-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(onboardingReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
