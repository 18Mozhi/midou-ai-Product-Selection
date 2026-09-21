import assert from "node:assert/strict";
import path from "node:path";

export const themeReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/theme-page-preview.css";
export function previewThemePage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P10 template bounds");
  const next =
    `<template><main class="theme-page theme-page--review" style="background:#f3f6fb" :data-state="state"><header class="p10-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>外观偏好</b><RouterLink to="/me">个人资料</RouterLink><RouterLink to="/security/mfa">安全设置</RouterLink></header><section class="p10-hero"><p>APPEARANCE PREFERENCES</p><h1>预览与已保存偏好分开显示</h1><span>主题可保存；页面密度只在当前会话生效。</span></section><section class="p10-workspace" aria-live="polite"><div v-if="state==='loading'" ` +
    `class="p10-notice"><b>正在读取已保存偏好</b><span>读取完成前不会把本地默认值描述为服务器确认。</span></div><div v-else-if="['error','forbidden','expired','blocked','conflict'].includes(state)" class="p10-notice p10-error"><b>{{ state==='conflict'?'偏好已在其他窗口更新':state==='expired'?'登录已过期':state==='forbidden'?'无权访问当前偏好范围':state==='blocked'?'尚未选择组织与工作区':'主题偏好暂时无法读取' }}</b><span>{{ state==='conflict'?'刷新最新偏好后重新选择。':'请按当前提示恢复。' }}</span><code v-if="requestId">关联编号：{{ requestId }}</code><RouterLink v-if="state==='expired'" ` +
    `to="/login">重新登录</RouterLink><RouterLink v-else-if="state==='blocked'" to="/select-context">选择工作区</RouterLink><button v-else type="button" @click="load">刷新偏好</button></div><template v-else><section class="p10-status"><b>{{ state==='saved'?'服务器已保存':'本地预览' }}</b><span>{{ state==='saved'?'当前主题已由服务器确认。':dirty?'当前主题尚未保存。':'当前主题与服务器已保存偏好一致。' }}</span></section><section class="p10-choice"><p>界面主题</p><h2>选择预览</h2><div role="radiogroup" aria-label="界面主题"><button v-for="theme in themes" :key="theme.id" ` +
    `type="button" role="radio" :aria-checked="selected===theme.id" :class="{selected:selected===theme.id}" @click="choose(theme.id)"><b>{{ theme.name }}</b><small>{{ theme.caption }}</small><span>{{ selected===theme.id?'当前预览':'选择预览' }}</span></button></div></section><section class="p10-density"><p>页面密度</p><span>只在当前会话生效，不写入服务器。</span><div role="radiogroup" aria-label="页面密度"><button v-for="density in densities" :key="density.id" type="button" role="radio" :aria-checked="selectedDensity===density.id" ` +
    `:class="{selected:selectedDensity===density.id}" @click="chooseDensity(density.id)">{{ density.name }} · {{ density.caption }}</button></div></section><footer><button type="button" :disabled="!dirty" @click="restore">撤销预览</button><button class="p10-primary" type="button" :disabled="!dirty||state==='saving'" @click="save">{{ state==='saving'?'正在保存…':'保存主题' }}</button></footer></template></section></main></template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function themePagePlugin() {
  return {
    name: "p10-actual-vue-review",
    enforce: "pre",
    transform(s, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/ThemeStudio.vue").replaceAll("\\", "/")
      )
        return { code: previewThemePage(s), map: null };
    },
    transformIndexHtml(h) {
      return h
        .replace("<body>", '<body class="p10-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(themeReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
