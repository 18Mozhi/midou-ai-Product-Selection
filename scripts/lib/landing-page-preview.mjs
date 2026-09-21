import assert from "node:assert/strict";
import path from "node:path";

export const landingReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/landing-page-preview.css";
export const landingPageSources = [
  landingReviewCss,
  "scripts/lib/landing-page-preview.mjs",
  "apps/web/src/components/LandingRedirect.vue",
  "apps/web/src/components/UiStatePanel.vue",
];

// Review-only template; route lookup, retry and expired redirect behavior stay in the original script.
export function previewLandingPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P01 template bounds");
  const next = `<template>
  <main class="landing-redirect landing-redirect--review" aria-live="polite">
    <header class="p01-top"><span>ScoutOps</span><small>入口解析 · 不预设角色或工作区</small></header>
    <section class="p01-hero"><p>正在进入</p><h1>正在确定可进入的工作区</h1><span>先依据当前会话解析真实入口，再进入允许的工作范围。</span></section>
    <aside class="p01-boundary"><b>会话入口 / 只读解析</b><span>加载时不展示可重复动作；失败时仅重新检查，不生成角色、数据或成功结论。</span></aside>
    <section class="p01-workspace" :data-state="state"><header><small>{{ state === 'loading' ? '正在解析' : '需要重新检查' }}</small><h2>{{ state === 'loading' ? '入口仍在确认中' : '当前无法确定入口' }}</h2></header><UiStatePanel :kind="state === 'loading' ? 'loading' : 'blocked'" :request-id="requestId" :primary-label="state === 'loading' ? '正在进入工作台' : '重新检查'" @primary="resolveLanding" /><p class="p01-note">此页只处理入口解析；成功后由原路由替换进入目标页。</p></section>
    <footer><span>无业务侧栏 · 无业务写入</span><span>请求标识仅在失败时显示</span></footer>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function landingPagePlugin() {
  return {
    name: "p01-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        target = path.resolve("apps/web/src/components/LandingRedirect.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewLandingPage(source), map: null };
    },
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P01 body anchor");
      return html
        .replace("<body>", '<body class="p01-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(landingReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
