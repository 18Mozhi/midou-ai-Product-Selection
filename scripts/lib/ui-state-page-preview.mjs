import assert from "node:assert/strict";
import path from "node:path";

export const uiStateReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/ui-state-page-preview.css";
export const uiStatePageSources = [
  uiStateReviewCss,
  "scripts/lib/ui-state-page-preview.mjs",
  "apps/web/src/components/UiStateShowcase.vue",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/components/ConfirmDialog.vue",
];

// Review-only template replacement. The production script and all action contracts remain verbatim.
export function previewUiStatePage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P72 template bounds");
  const next = `<template>
  <main class="state-showcase state-showcase--review" :data-kind="current">
    <header class="p72-top"><RouterLink to="/home"><b>选</b><strong>ScoutOps</strong></RouterLink><span>内部开发演示 · 不进入生产构建</span></header>
    <section class="p72-hero"><p>状态组件 / 审核工作区</p><h1>通用状态与确认交互</h1><span>用同一套文字语义、影响范围与下一步，审阅八类非业务状态；不把演示结果当成真实服务结论。</span></section>
    <aside class="p72-boundary"><b>开发专用 · 无 API / 无写入</b><span>状态由 query.state 选择；关联编号和链路编号仅为安全格式演示。</span></aside>
    <nav class="p72-state-picker" aria-label="状态示例"><button v-for="kind in UI_STATE_KINDS" :key="kind" type="button" :aria-pressed="current === kind" aria-controls="ui-state-preview" @click="selectState(kind)"><i aria-hidden="true"></i>{{ labels[kind] }}</button></nav>
    <section class="p72-workspace"><header><div><small>当前预览</small><h2>{{ labels[current] }}状态</h2></div><p>动作仅复现组件合同，不调用业务服务。</p></header><div class="p72-preview"><UiStatePanel id="ui-state-preview" :kind="current" :description="current === 'not_found' ? \`地址可能已变更。可返回最近有效页面 \${recentRoute}，或回到今日行动。\` : undefined" :primary-label="current === 'not_found' ? '返回最近页面' : undefined" :secondary-label="current === 'not_found' ? '返回今日行动' : undefined" request-id="m02-04-request" trace-id="m02-04-trace" @primary="primary" @secondary="secondary" /><p v-if="actionResult" class="state-action-result" role="status">{{ actionResult }}</p><code v-if="current === 'not_found'" class="state-recent-route">最近有效页面：{{ recentRoute }}</code></div></section>
    <section class="p72-confirmation"><div><small>高影响确认演示</small><h2>先明确影响，再允许确认</h2><p>确认仅更新当前组件的本地提示；不会撤销授权、写入审计或调用后端。</p></div><div><button class="open-confirm" type="button" @click="dialogOpen = true">查看高影响确认弹窗</button><p v-if="confirmed" class="confirm-result" role="status">示例确认已完成；未触发任何业务写入。</p></div></section>
    <footer><span>桌面 / 390px / 键盘</span><span>内部状态组件，不代表生产运行状态</span></footer>
    <ConfirmDialog :open="dialogOpen" title="确认撤销示例授权？" description="这是通用确认组件的交互演示，不会请求后端。" impact="仅演示当前弹窗；不修改角色、权限、数据或审计。" confirm-label="确认演示" destructive confirmation-text="确认撤销" @cancel="dialogOpen = false" @confirm="dialogOpen = false; confirmed = true;" />
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
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
      return html
        .replace("<body>", '<body class="p72-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(uiStateReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
