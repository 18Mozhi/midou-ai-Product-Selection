import assert from "node:assert/strict";
import path from "node:path";
export const forgotPasswordReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/forgot-password-page-preview.css";
export const forgotPasswordPageSources = [
  forgotPasswordReviewCss,
  "scripts/lib/forgot-password-page-preview.mjs",
  "apps/web/src/components/LocalIdentity.vue",
];
export function previewForgotPasswordPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P04 template bounds");
  const next = `<template>
  <main class="identity-page identity-page--review" :data-mode="mode" :data-state="requestState">
    <header class="p04-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>账号恢复</b><small>公开入口 · 不判断账号是否存在</small></header>
    <section class="p04-shell"><aside><p>PASSWORD RECOVERY</p><h1>请求恢复说明，<br />不暴露账号状态。</h1><span>邮箱存在与否都使用相同受理口径；请按实际错误提示重试。</span><footer>无短信 · 无人工核验 · 无倒计时</footer></aside>
    <section class="p04-workspace" aria-live="polite"><header><p>恢复请求</p><h2>{{ mode === 'login' ? '返回登录' : '找回密码' }}</h2><span>输入用于接收一次性验证链接的邮箱。</span></header>
      <div v-if="['error','rate_limited','blocked'].includes(requestState)" class="p04-notice p04-error"><b>{{ requestState === 'rate_limited' ? '请求过于频繁' : requestState === 'blocked' ? '身份服务暂不可用' : '请求未完成' }}</b><span>{{ message }}</span><small v-if="actionHint">{{ actionHint }}</small><code v-if="requestId">关联编号：{{ requestId }}</code></div>
      <div v-else-if="requestState === 'success' && message" class="p04-notice p04-success"><b>请求已受理</b><span>{{ message }}</span></div>
      <form v-if="mode === 'forgot'" @submit.prevent="submit"><label><span>邮箱</span><small>不论账号是否存在，反馈都保持一致</small><input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@company.com" /></label><button class="p04-primary" type="submit" :disabled="requestState === 'loading'">{{ requestState === 'loading' ? '正在安全处理…' : '发送重置说明' }}</button></form>
      <section v-else class="p04-return"><p>已回到登录入口。</p><button class="p04-primary" type="button" @click="switchMode('forgot')">继续找回密码</button></section>
      <footer><button type="button" @click="switchMode('login')">返回登录</button><RouterLink to="/security/mfa">了解 MFA 设置</RouterLink></footer>
    </section></section>
    <div class="p04-boundary"><b>反馈边界</b><span>202 表示请求已受理，不表示邮件已经送达或账号存在。</span></div>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function forgotPasswordPagePlugin() {
  return {
    name: "p04-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        target = path.resolve("apps/web/src/components/LocalIdentity.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewForgotPasswordPage(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p04-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(forgotPasswordReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
