import assert from "node:assert/strict";
import path from "node:path";

export const loginReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/login-page-preview.css";
export const loginPageSources = [
  loginReviewCss,
  "scripts/lib/login-page-preview.mjs",
  "apps/web/src/components/LocalIdentity.vue",
];

// Review-only template. The identity script retains every real route, request and validation branch.
export function previewLoginPage(input) {
  const source = input.replaceAll("\r\n", "\n");
  const start = source.indexOf("<template>");
  const end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P02 template bounds");
  const next = `<template>
  <main class="identity-page identity-page--review" :data-mode="mode" :data-state="requestState">
    <header class="p02-top">
      <RouterLink class="p02-brand" to="/"><span>ScoutOps</span><b>身份核验</b></RouterLink>
      <small>公开入口 · 不预设业务权限</small>
    </header>
    <section class="p02-shell">
      <aside class="p02-context" aria-label="当前身份任务">
        <p>IDENTITY / ACCESS</p>
        <h1>先完成身份核验，<br />再进入获准范围。</h1>
        <span>登录、挑战与首次设置是不同的安全步骤，不会被包装成一次无感提交。</span>
        <ol>
          <li :class="{ 'is-current': mode === 'login' }"><b>01</b><span>账号与密码</span></li>
          <li :class="{ 'is-current': mode === 'mfa-challenge' }"><b>02</b><span>认证器挑战</span></li>
          <li :class="{ 'is-current': mode === 'security-setup' }"><b>03</b><span>首次安全设置</span></li>
        </ol>
        <footer><span>受后端规则约束</span><span>不保存敏感草稿</span></footer>
      </aside>
      <section class="p02-workspace" aria-live="polite">
        <header>
          <p>{{ mode === 'mfa-challenge' ? '安全挑战' : mode === 'security-setup' ? '首次设置' : '账号登录' }}</p>
          <h2>{{ title }}</h2>
          <span v-if="mode === 'login'">使用已验证邮箱或唯一用户名。</span>
          <span v-else-if="mode === 'mfa-challenge'">密码已验证，请输入认证器验证码或恢复码。</span>
          <span v-else-if="mode === 'security-setup'">完成改密、重新登录与认证器绑定后才可进入业务。</span>
        </header>
        <div v-if="route.query.reason === 'authentication_required'" class="p02-notice p02-notice--info">
          <b>需要登录</b><span>请先完成身份核验，再返回受保护的工作区。</span>
        </div>
        <div v-if="['error', 'rate_limited', 'blocked'].includes(requestState)" class="p02-notice p02-notice--error">
          <b>{{ requestState === 'rate_limited' ? '请求过于频繁' : requestState === 'blocked' ? '身份服务暂不可用' : '操作未完成' }}</b>
          <span>{{ message }}</span><small v-if="actionHint">{{ actionHint }}</small>
          <code v-if="requestId">关联编号：{{ requestId }}</code>
        </div>
        <div v-if="requestState === 'success' && message" class="p02-notice p02-notice--success">
          <b>操作已受理</b><span>{{ message }}</span>
        </div>
        <form v-if="['login', 'mfa-challenge'].includes(mode)" class="p02-form" @submit.prevent="submit">
          <label v-if="mode === 'login'"><span>账号</span><small>邮箱或唯一用户名</small><input v-model="identifier" type="text" autocomplete="username" required minlength="2" maxlength="254" placeholder="name@company.com 或用户名" /></label>
          <label v-if="mode === 'login'"><span>密码</span><small>12–128 位</small><input v-model="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128" placeholder="输入安全密码" /></label>
          <label v-if="mode === 'mfa-challenge'"><span>认证器验证码或恢复码</span><small>6–32 位；可直接输入恢复码</small><input v-model="mfaCode" inputmode="numeric" autocomplete="one-time-code" required minlength="6" maxlength="32" placeholder="输入验证码或恢复码" /></label>
          <div v-if="mode === 'login'" class="p02-form-row"><span>登录状态最长保留 30 天，可在安全中心主动退出。</span><button type="button" @click="switchMode('forgot')">忘记密码？</button></div>
          <button class="p02-primary" type="submit" :disabled="requestState === 'loading'">{{ requestState === 'loading' ? '正在安全处理…' : mode === 'mfa-challenge' ? '验证并登录' : '登录' }}</button>
        </form>
        <section v-else-if="mode === 'security-setup'" class="p02-security" data-testid="security-setup">
          <div class="p02-security-status"><b>强制安全设置</b><span>{{ securitySetup.must_change_password ? '先改密' : securitySetup.must_enroll_mfa ? '请绑定认证器' : '恢复码仅显示本次' }}</span></div>
          <template v-if="securitySetup.must_change_password">
            <label><span>当前种子密码</span><input v-model="currentPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" /></label>
            <label><span>新的长期密码</span><input v-model="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" /></label>
            <button class="p02-primary" type="button" @click="changeSeedPassword">修改密码并撤销当前会话</button>
          </template>
          <template v-else-if="securitySetup.must_enroll_mfa">
            <label><span>当前密码</span><input v-model="currentPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" /></label>
            <button v-if="!mfaSecret" class="p02-primary" type="button" @click="startMfa">开始绑定认证器</button>
            <div v-else class="p02-mfa-secret"><p>手动输入密钥</p><code>{{ mfaSecret }}</code><label><span>认证器验证码</span><input v-model="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" /></label><button class="p02-primary" type="button" @click="confirmMfa">确认并完成安全设置</button></div>
          </template>
          <div v-else class="p02-recovery"><b>安全设置已完成</b><span>请离线保存恢复码，然后重新登录。</span><code v-for="code in recoveryCodes" :key="code">{{ code }}</code><button class="p02-primary" type="button" @click="switchMode('login')">返回登录</button></div>
        </section>
        <footer class="p02-actions" v-if="mode === 'login'"><span>首次使用？<button type="button" @click="switchMode('register')">创建账号</button></span><RouterLink to="/security/mfa">了解 MFA 设置</RouterLink></footer>
        <footer class="p02-boundary"><span>身份通过后才解析业务入口</span><span>不展示角色、数据或虚构成功状态</span></footer>
      </section>
    </section>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}

export function loginPagePlugin() {
  return {
    name: "p02-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      const target = path
        .resolve("apps/web/src/components/LocalIdentity.vue")
        .replaceAll("\\", "/");
      if (file === target) return { code: previewLoginPage(source), map: null };
    },
    transformIndexHtml(html) {
      assert.equal(html.split("<body>").length, 2, "P02 body anchor");
      return html
        .replace("<body>", '<body class="p02-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(loginReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
