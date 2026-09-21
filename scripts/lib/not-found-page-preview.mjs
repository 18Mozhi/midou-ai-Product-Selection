import assert from "node:assert/strict";
import path from "node:path";

export const notFoundReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/not-found-page-preview.css";
export const notFoundPageSources = [
  notFoundReviewCss,
  "scripts/lib/not-found-page-preview.mjs",
  "apps/web/src/components/NotFoundPage.vue",
  "apps/web/src/navigation-memory.ts",
];

// Review-only: preserves safe destination resolution and heading-focus script byte-for-byte.
export function previewNotFoundPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P73 template bounds");
  const next = `<template>
  <main class="not-found-page not-found-page--review" aria-labelledby="not-found-title">
    <header class="p73-top"><RouterLink to="/home" aria-label="返回智能选品今日行动"><span aria-hidden="true">选</span><b>ScoutOps</b></RouterLink><p>页面恢复边界</p></header>
    <section class="p73-hero"><p>404 / 页面未登记</p><h1 id="not-found-title" ref="heading" tabindex="-1">没有找到这个页面</h1><span>当前地址没有匹配已登记页面。不会把它解释成无权限，也不会展示受限数据。</span></section>
    <section class="p73-workspace"><div class="p73-route"><small>当前地址</small><code :title="route.path" dir="ltr">{{ requestedPath }}</code></div><div class="p73-recovery"><div><small>下一步</small><h2>回到有效工作区</h2><p>恢复入口只使用现有安全路由；没有网络读取或业务数据访问。</p></div><nav aria-label="页面恢复操作"><RouterLink class="not-found-primary" :to="recentDestination.fullPath">{{ hasDistinctRecentDestination ? '返回最近页面' : '返回今日行动' }}</RouterLink><RouterLink v-if="hasDistinctRecentDestination" class="not-found-secondary" to="/home">返回今日行动</RouterLink></nav></div><p class="not-found-continuity"><template v-if="hasDistinctRecentDestination">将返回：{{ recentTitle }}</template><template v-else>将从今日行动重新进入业务流程</template></p></section>
    <aside class="p73-boundary"><b>公开兜底 / 不读业务数据</b><span>未知地址与真实权限状态保持分离；路径仅作本地可读提示。</span></aside>
    <footer class="not-found-footer"><span>当前地址未匹配任何已登记页面</span><span>未调用接口，未读取业务数据</span></footer>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
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
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P73 body anchor");
      return html
        .replace("<body>", '<body class="p73-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(notFoundReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
