import assert from "node:assert/strict";
import path from "node:path";

export const personalCenterReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/personal-center-page-preview.css";

function replaceTemplate(source, template, label) {
  const normalized = source.replaceAll("\r\n", "\n");
  const start = normalized.indexOf("<template>");
  const end = normalized.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, `${label} template bounds`);
  return normalized.slice(0, start) + template + normalized.slice(end + "</template>".length);
}

export function previewAccountShell(source) {
  return replaceTemplate(
    source,
    `<template><main class="account-shell p11-account-review"><header class="p11-top"><RouterLink to="/" class="p11-brand">ScoutOps</RouterLink><span>个人中心</span><RouterLink to="/select-context">组织与工作区</RouterLink></header><section class="p11-hero"><p>PERSONAL CENTER</p><h1>账号事实与个人操作</h1><span>资料、权限、安全、通知和本人资产按各自读取状态呈现。</span></section><nav class="p11-directory" aria-label="个人中心分区"><RouterLink v-for="item in sections" :key="item.key" :to="{ path: '/me', query: { section: item.key } }" ` +
      `:aria-current="activeSection === item.key ? 'page' : undefined"><b>{{ item.label }}</b><small>{{ activeSection === item.key ? '当前分区' : '打开分区' }}</small></RouterLink><RouterLink to="/settings/theme"><b>外观偏好</b><small>主题与密度</small></RouterLink></nav><section class="p11-content"><nav class="p11-crumb" aria-label="面包屑"><RouterLink to="/">应用入口</RouterLink><span>/</span><b>个人中心</b></nav><PersonalCenter :api-base-url="apiBaseUrl" :initial-section="activeSection" account-shell /></section></main></` +
      `template>`,
    "P11 account shell",
  );
}

export function previewPersonalCenter(source) {
  return replaceTemplate(
    source,
    `<template><section class="personal-center p11-center" aria-live="polite" :data-state="state"><header class="p11-center-head"><div><p>当前账号</p><h2>{{ profile?.display_name || '个人中心' }}</h2><span>账户资料与各分区状态分别呈现，不把尚未读取的内容当作已确认。</span></div><button type="button" @click="load">刷新资料</button></header><p v-if="notice" class="p11-notice">{{ notice }} <code v-if="requestId">关联编号：{{ requestId }}</code></p><p v-else-if="state === 'ready' && sectionsLoading" class="p11-notice">基本资料已显示；正在读取权限、安全、通知和资产。</p>` +
      `<section v-if="state !== 'ready'" class="p11-state"><b>{{ state === 'loading' ? '正在读取个人资料' : '当前无法读取个人资料' }}</b><span>{{ state === 'loading' ? '资料确认前，不显示其他分区的默认值。' : '请重试；如仍失败，请提供关联编号。' }}</span><button v-if="state === 'error'" type="button" @click="load">重新加载</button></section><template v-else><form v-if="tab === 'profile'" class="p11-form" @submit.prevent="saveProfile"><header><p>基本资料</p><h3>可保存的账号资料</h3><span>邮箱只读，不会写入资料更新请求。</span></header><label>邮箱<input :value="profile.email" disabled />` +
      `<small>{{ profile.email_verified_at ? '已验证' : '尚未验证' }}</small></label><label>登录用户名<input v-model="form.username" autocomplete="username" minlength="2" maxlength="32" placeholder="可选；设置后可代替邮箱登录" /><small>2–32 个字符；支持文字、数字、点、下划线和连字符。</small></label><label>显示名称<input v-model="form.display_name" required maxlength="120" /></label><label>头像 HTTPS 地址<input v-model="form.avatar_url" type="url" /></label><label>手机号<input v-model="form.phone" inputmode="tel" /><small>{{ profile.phone_verified_at ? '已验证' ` +
      `: '未验证；系统不会伪造短信验证结果' }}</small></label><label>语言<select v-model="form.locale"><option value="zh-CN">简体中文</option></select></label><label>时区<input v-model="form.timezone" required /></label><label class="wide">修改原因<textarea v-model="form.reason" required maxlength="300"></textarea></label><footer><button type="submit" class="p11-primary">保存资料</button></footer></form><section v-else-if="tab === 'permissions'" class="p11-grid"><article><p>角色</p><h3>当前职责</h3><span ` +
      `v-for="role in authorization.roles" :key="role" class="p11-value">{{ roleName(role) }}</span><span v-if="!authorization.roles.length" class="p11-muted">暂无已确认角色。</span></article><article><p>数据范围</p><h3>读取边界</h3><span v-for="scope in authorization.data_scopes" :key="scope.scope + scope.scope_key" class="p11-value">{{ scopeName(scope.scope) }}<template v-if="scope.scope_key"> · 指定范围</template></span><span v-if="!authorization.data_scopes.length" class="p11-muted">暂无范围记录。</span></article><article ` +
      `class="wide"><p>可执行动作</p><h3>能力目录</h3><div class="p11-caps"><code v-for="capability in authorization.capabilities" :key="capability">{{ capabilityName(capability) }}</code></div><RouterLink v-if="canManageOrganizationToken" to="/org-admin/tokens">管理组织令牌</RouterLink></article></section><section v-else-if="tab === 'security'" class="p11-grid"><article><p>多因素认证</p><h3>独立安全流程</h3><span class="p11-muted">认证器绑定、恢复码和停用在专属安全页处理。</span><RouterLink to="/security/mfa">管理 MFA</RouterLink></article><form ` +
      `@submit.prevent="changePassword"><p>修改密码</p><h3>更新后撤销全部会话</h3><label>当前密码<input v-model="passwordForm.current_password" type="password" autocomplete="current-password" required minlength="12" /></label><label>新密码<input v-model="passwordForm.new_password" type="password" autocomplete="new-password" required minlength="12" /></label><label>确认新密码<input v-model="passwordForm.confirm_password" type="password" autocomplete="new-password" required minlength="12" /></label><button type="submit" ` +
      `class="p11-primary">修改并撤销全部会话</button></form><article class="wide"><p>设备会话</p><h3>会话状态</h3><div v-for="session in sessions" :key="session.id" class="p11-row"><span><b>{{ session.device_label }}</b><small>{{ statusName(session.status) }} · {{ when(session.last_seen_at) }}</small></span><button type="button" @click="revokeSession(session.id)">撤销会话</button></div><span v-if="!sessions.length" class="p11-muted">暂无活动会话。</span></article></section><form v-else-if="tab === 'notifications'" ` +
      `class="p11-form p11-preferences" @submit.prevent="savePreferences"><header><p>通知偏好</p><h3>五项可保存开关</h3><span>保存的是偏好，不等于邮件已成功投递。</span></header><label><input v-model="preferences.in_app_enabled" type="checkbox" />站内通知</label><label><input v-model="preferences.email_enabled" type="checkbox" />邮件通知</label><label><input v-model="preferences.task_enabled" type="checkbox" />任务通知</label><label><input v-model="preferences.approval_enabled" type="checkbox" />审批通知</label><label><input ` +
      `v-model="preferences.competitor_enabled" type="checkbox" />竞品通知</label><footer><button type="submit" class="p11-primary">保存偏好</button></footer></form><section v-else class="p11-grid"><article><p>关注热点</p><h3>本人关注</h3><div v-for="item in assets.followed_trends" :key="item.id" class="p11-row"><RouterLink :to="\`/trends?topic=\${item.id}\`">{{ item.title }}</RouterLink><small>{{ item.market }} · {{ when(item.created_at) }}</small></div><span v-if="!assets.followed_trends.length" class="p11-muted">` +
      `暂无关注热点。</span></article><article><p>我的决策</p><h3>人工记录</h3><div v-for="item in assets.decisions" :key="item.id" class="p11-row"><RouterLink :to="\`/opportunities/\${item.opportunity_id}\`">{{ item.opportunity_name }}</RouterLink><small>{{ decisionName(item.action) }} · {{ when(item.created_at) }}</small></div><span v-if="!assets.decisions.length" class="p11-muted">暂无人工决策。</span></article><article class="wide"><p>我的任务</p><h3>当前待办</h3><div v-for="item in assets.tasks" :key="item.id" class="p11-row">` +
      `<RouterLink to="/tasks">{{ item.title }}</RouterLink><small>{{ statusName(item.status) }} · {{ statusName(item.priority) }} · {{ when(item.due_at) }}</small></div><span v-if="!assets.tasks.length" class="p11-muted">暂无本人任务。</span></article></section></template></section></template>`,
    "P11 personal center",
  );
}

export function personalCenterPagePlugin() {
  const account = path.resolve("apps/web/src/components/AccountShell.vue").replaceAll("\\", "/");
  const personal = path.resolve("apps/web/src/components/PersonalCenter.vue").replaceAll("\\", "/");
  return {
    name: "p11-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replaceAll("\\", "/");
      if (normalized === account) return { code: previewAccountShell(source), map: null };
      if (normalized === personal) return { code: previewPersonalCenter(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p11-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(personalCenterReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
