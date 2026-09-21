import assert from "node:assert/strict";
import path from "node:path";

export const registerReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/register-page-preview.css";
export const registerPageSources = [
  registerReviewCss,
  "scripts/lib/register-page-preview.mjs",
  "apps/web/src/components/LocalIdentity.vue",
];

// Review-only template: registration fields, submit branch and local mode transitions are source-owned.
export function previewRegisterPage(input) {
  const source = input.replaceAll("\r\n", "\n");
  const start = source.indexOf("<template>");
  const end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P03 template bounds");
  const next = `<template>
  <main class="identity-page identity-page--review" :data-mode="mode" :data-state="requestState">
    <header class="p03-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>创建访问账号</b><small>公开注册 · 需完成邮箱验证</small></header>
    <section class="p03-hero"><p>ACCOUNT CREATION / STEP 01</p><h1>创建账号后，<br />再完成邮箱验证。</h1><span>注册成功只表示验证邮件进入受控队列，不代表已登录或已获得业务权限。</span></section>
    <section class="p03-workspace" aria-live="polite">
      <header><p>{{ mode === 'verify' ? '等待验证' : mode === 'login' ? '返回登录' : '账号信息' }}</p><h2>{{ mode === 'verify' ? '检查验证邮件' : mode === 'login' ? '欢迎回到智能选品' : '创建本地账号' }}</h2><span>{{ mode === 'verify' ? '验证链接为一次性凭证；完成后请返回登录。' : '使用工作邮箱；密码不会作为草稿持久化。' }}</span></header>
      <div v-if="['error','rate_limited','blocked'].includes(requestState)" class="p03-notice p03-notice--error"><b>{{ requestState === 'rate_limited' ? '请求过于频繁' : requestState === 'blocked' ? '身份服务暂不可用' : '信息需要确认' }}</b><span>{{ message }}</span><small v-if="actionHint">{{ actionHint }}</small><code v-if="requestId">关联编号：{{ requestId }}</code></div>
      <div v-else-if="requestState === 'success' && message" class="p03-notice p03-notice--success"><b>注册已受理</b><span>{{ message }}</span></div>
      <form v-if="mode === 'register'" class="p03-form" @submit.prevent="submit">
        <label><span>邮箱</span><small>用于验证与后续登录</small><input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@company.com" /></label>
        <label><span>密码</span><small>12–128 位</small><input v-model="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="设置安全密码" /></label>
        <label><span>确认密码</span><small>再次输入，不会提交到服务端</small><input v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="再次输入密码" /></label>
        <button class="p03-primary" type="submit" :disabled="requestState === 'loading'">{{ requestState === 'loading' ? '正在安全处理…' : '创建账号' }}</button>
      </form>
      <section v-else-if="mode === 'verify'" class="p03-verify" data-testid="verify">
        <b>验证邮件已进入受控投递队列</b><p>请在邮箱中打开验证链接；未完成验证前，不能进入业务工作区。</p><button class="p03-primary" type="button" @click="switchMode('login')">返回登录</button>
      </section>
      <form v-else class="p03-form" @submit.prevent="submit">
        <label><span>账号</span><input v-model="identifier" type="text" autocomplete="username" required minlength="2" maxlength="254" placeholder="name@company.com 或用户名" /></label>
        <label><span>密码</span><input v-model="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128" placeholder="输入安全密码" /></label>
        <button class="p03-primary" type="submit" :disabled="requestState === 'loading'">{{ requestState === 'loading' ? '正在安全处理…' : '登录' }}</button>
      </form>
      <footer><span v-if="mode === 'register'">已有账号？<button type="button" @click="switchMode('login')">返回登录</button></span><span v-else>验证或登录完成后才解析真实业务入口。</span><RouterLink to="/security/mfa">了解 MFA 设置</RouterLink></footer>
    </section>
    <aside class="p03-boundary"><b>提交边界</b><span>确认密码仅用于浏览器内一致性校验；服务端只接收邮箱和密码。</span><span>无第三方登录、手机号或企业审批入口。</span></aside>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}

export function registerPagePlugin() {
  return {
    name: "p03-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      const target = path.resolve("apps/web/src/components/LocalIdentity.vue").replaceAll("\\", "/");
      if (file === target) return { code: previewRegisterPage(source), map: null };
    },
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P03 body anchor");
      return html
        .replace("<body>", '<body class="p03-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(registerReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
