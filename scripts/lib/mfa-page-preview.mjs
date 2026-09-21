import assert from "node:assert/strict";
import path from "node:path";

export const mfaReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/mfa-page-preview.css";
export const mfaPageSources = [
  mfaReviewCss,
  "scripts/lib/mfa-page-preview.mjs",
  "apps/web/src/components/LocalIdentity.vue",
  "apps/web/src/router.ts",
];

export function previewMfaPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P07 template bounds");
  const next = `<template>
  <main class="identity-page identity-page--review" style="background:#f3f6fb" :data-mode="mode" :data-state="requestState" :data-mfa-enabled="mfaEnabled">
    <header class="p07-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>账号安全</b><small>认证器管理 · 受登录会话保护</small></header>
    <section class="p07-hero"><p>MULTI-FACTOR AUTHENTICATION</p><h1>{{ requestState === 'loading' ? '正在读取保护状态' : mfaEnabled ? '认证器已启用' : mfaSecret ? '确认认证器绑定' : '为账号启用认证器' }}</h1><span>{{ requestState === 'loading' ? '尚未读取完成前，不对当前保护状态作出判断。' : mfaEnabled ? '恢复码仅在本次确认后可见；停用是高影响操作。' : '先验证当前密码，再按页面材料完成绑定。' }}</span></section>
    <section class="p07-workspace" aria-live="polite">
      <div v-if="requestState === 'loading'" class="p07-notice"><b>正在读取 MFA 状态</b><span>请等待受保护读取完成，页面不会将未知状态标为“未启用”。</span></div>
      <div v-else-if="['error','rate_limited','blocked'].includes(requestState)" class="p07-notice p07-error"><b>{{ requestState === 'rate_limited' ? '请求过于频繁' : requestState === 'blocked' ? '安全服务暂不可用' : '读取或操作未完成' }}</b><span>{{ message }}</span><small v-if="actionHint">{{ actionHint }}</small><code v-if="requestId">关联编号：{{ requestId }}</code></div>
      <div v-if="requestState === 'success' && message" class="p07-notice p07-status"><b>操作已完成</b><span>{{ message }}</span></div>
      <template v-if="!mfaEnabled && !['loading','error','rate_limited','blocked'].includes(requestState)">
        <section v-if="!mfaSecret" class="p07-step"><p>步骤 1 / 2</p><h2>验证当前密码</h2><span>仅用于启动认证器绑定；密码不在此页显示。</span><label>当前密码<input v-model="currentPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" placeholder="验证当前密码" /></label><button class="p07-primary" type="button" @click="startMfa">开始绑定认证器</button></section>
        <section v-else class="p07-step"><p>步骤 2 / 2</p><h2>在认证器中完成绑定</h2><span>以下是本地审核用替代材料；请在真实环境按受控界面处理。</span><code class="p07-secret">{{ mfaSecret }}</code><label>认证器验证码<input v-model="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="输入验证码" /></label><button class="p07-primary" type="button" @click="confirmMfa">确认并启用</button></section>
        <section v-if="recoveryCodes.length" class="p07-recovery"><p>一次性恢复码</p><b>请离线保存；每个代码只能使用一次。</b><code v-for="code in recoveryCodes" :key="code">{{ code }}</code></section>
      </template>
      <template v-else-if="mfaEnabled && !['loading','error','rate_limited','blocked'].includes(requestState)">
        <section class="p07-status"><b>认证器 TOTP 已启用</b><span>验证码会周期性更新；请保管恢复码，并在必要时使用下方高影响操作。</span></section>
        <section v-if="recoveryCodes.length" class="p07-recovery"><p>本次生成的恢复码</p><b>仅本次显示，请离线保存。</b><code v-for="code in recoveryCodes" :key="code">{{ code }}</code></section>
        <section class="p07-danger"><p>高影响操作</p><h2>停用认证器</h2><span>停用成功后，服务端会撤销全部会话；此页面不会把它画成自动跳转。</span><label>当前密码<input v-model="currentPassword" type="password" autocomplete="current-password" maxlength="128" placeholder="验证当前密码" /></label><label>当前验证码或恢复码<input v-model="mfaCode" autocomplete="one-time-code" maxlength="32" placeholder="输入验证码或恢复码" /></label><button class="p07-danger-button" type="button" @click="disableMfa">停用并撤销全部会话</button></section>
      </template>
      <footer><RouterLink to="/me?section=security">查看安全会话</RouterLink><button type="button" @click="switchMode('login')">返回登录</button></footer>
    </section>
    <footer class="p07-boundary">无二维码、下载或复制功能 · 不把测试材料当真实秘密 · 所有结果都有文字说明</footer>
  </main>
</template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}

export function mfaPagePlugin() {
  return {
    name: "p07-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/LocalIdentity.vue").replaceAll("\\", "/")
      )
        return { code: previewMfaPage(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p07-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(mfaReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
