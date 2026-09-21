import assert from "node:assert/strict";
import path from "node:path";

export const resetPasswordReviewCss = "design-plans/ui-phase-2-2026-09-07/implementation/reset-password-page-preview.css";
export const resetPasswordPageSources = [resetPasswordReviewCss, "scripts/lib/reset-password-page-preview.mjs", "apps/web/src/components/LocalIdentity.vue"];

export function previewResetPasswordPage(input) {
  const source = input.replaceAll("\r\n", "\n"), start = source.indexOf("<template>"), end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P06 template bounds");
  const next = `<template>
  <main class="identity-page identity-page--review" style="background:#f3f6fb" :data-mode="mode" :data-state="requestState">
    <header class="p06-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>设置新密码</b><small>一次性链接 · token 不展示</small></header>
    <section class="p06-hero"><p>PASSWORD RESET</p><h1>{{ requestState === 'success' ? '密码已更新' : requestState === 'expired' ? '链接已过期' : ['error','rate_limited','blocked'].includes(requestState) ? '更新未完成' : '设置新的登录密码' }}</h1><span>新密码仅在本次提交中发送；更新成功后不会自动登录。</span></section>
    <section class="p06-workspace" aria-live="polite">
      <div v-if="requestState === 'expired'" class="p06-notice p06-warning"><b>链接已过期</b><span>重置链接为单次使用。请重新申请，不要继续使用旧链接。</span></div>
      <div v-else-if="['error','rate_limited','blocked'].includes(requestState)" class="p06-notice p06-error"><b>{{ requestState === 'rate_limited' ? '请求过于频繁' : requestState === 'blocked' ? '身份服务暂不可用' : '更新未完成' }}</b><span>{{ message }}</span><small v-if="actionHint">{{ actionHint }}</small><code v-if="requestId">关联编号：{{ requestId }}</code></div>
      <div v-else-if="requestState === 'success' && message" class="p06-notice p06-success"><b>密码已更新</b><span>{{ message }}</span></div>
      <form v-if="mode === 'reset' && requestState !== 'success'" @submit.prevent="submit"><label><span>新密码</span><small>至少 12 位；不在页面显示或保存链接 token。</small><input v-model="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="输入安全密码" /></label><button class="p06-primary" type="submit" :disabled="requestState === 'loading'">{{ requestState === 'loading' ? '正在安全处理…' : '更新密码' }}</button></form>
      <section v-else-if="requestState === 'success'" class="p06-next"><b>下一步：重新登录</b><p>已更新密码不会自动创建登录状态；请使用新密码重新登录。</p><button class="p06-primary" type="button" @click="switchMode('login')">返回登录</button></section>
      <section v-else class="p06-next"><b>需要重新申请链接？</b><p>当前页面不虚构重发操作；请从找回密码入口发起新的受控请求。</p><button class="p06-primary" type="button" @click="switchMode('forgot')">找回密码</button></section>
      <footer><button v-if="requestState !== 'success'" type="button" @click="switchMode('login')">返回登录</button><RouterLink to="/security/mfa">了解 MFA 设置</RouterLink></footer>
    </section>
    <footer class="p06-boundary">不显示 token · 不自动登录 · 不新增确认密码字段</footer>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}

export function resetPasswordPagePlugin() {
  return { name: "p06-actual-vue-review", enforce: "pre", transform(source, id) { if (id.replaceAll("\\", "/") === path.resolve("apps/web/src/components/LocalIdentity.vue").replaceAll("\\", "/")) return { code: previewResetPasswordPage(source), map: null }; }, transformIndexHtml(html) { return html.replace("<body>", '<body class="p06-review">').replace("</head>", `<link rel="stylesheet" href="/@fs/${path.resolve(resetPasswordReviewCss).replaceAll("\\", "/")}"></head>`); } };
}
