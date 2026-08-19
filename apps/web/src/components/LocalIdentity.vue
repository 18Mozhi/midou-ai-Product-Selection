<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiEnvelope } from "../api-client";
import { publicConfig } from "../config";

type IdentityMode =
  | "login"
  | "register"
  | "forgot"
  | "verify"
  | "reset"
  | "sessions"
  | "mfa"
  | "mfa-challenge"
  | "security-setup";
type RequestState =
  "idle" | "loading" | "success" | "error" | "expired" | "rate_limited" | "blocked";
const params = new URLSearchParams(window.location.search);
const apiRequest = createApiClient(publicConfig.apiBaseUrl);
const pathModes: Record<string, IdentityMode> = {
  "/login": "login",
  "/register": "register",
  "/forgot-password": "forgot",
  "/verify-email": "verify",
  "/reset-password": "reset",
  "/security/mfa": "mfa",
};
const mode = ref<IdentityMode>(
  (params.get("mode") as IdentityMode) || pathModes[window.location.pathname] || "login",
);
const requestState = ref<RequestState>(params.get("state") === "expired" ? "expired" : "idle");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const currentPassword = ref("");
const mfaCode = ref("");
const mfaSecret = ref("");
const recoveryCodes = ref<string[]>([]);
const mfaEnabled = ref(false);
const message = ref("");
const actionHint = ref("");
const requestId = ref("");
const traceId = ref("");
const sessions = ref<
  Array<{
    id: string;
    device_label: string;
    status: string;
    last_seen_at: string;
  }>
>([]);
const securitySetup = ref({
  must_change_password: false,
  must_enroll_mfa: false,
});
const newPassword = ref("");
const title = computed(
  () =>
    ({
      login: "欢迎回到智能选品",
      register: "创建本地账号",
      forgot: "找回密码",
      verify: "验证邮箱",
      reset: "设置新密码",
      sessions: "我的设备会话",
      mfa: "多因素认证",
      "mfa-challenge": "完成安全验证",
      "security-setup": "完成首次安全设置",
    })[mode.value],
);

function switchMode(next: IdentityMode) {
  mode.value = next;
  requestState.value = "idle";
  message.value = "";
  actionHint.value = "";
  requestId.value = "";
  if (next === "sessions") void loadSessions();
  if (next === "mfa") void loadMfa();
}
async function request<T = unknown>(
  path: string,
  body?: Record<string, string>,
  method = "POST",
): Promise<ApiEnvelope<T> | null> {
  requestState.value = "loading";
  message.value = "";
  try {
    const response = await apiRequest<T>(path, {
      method,
      ...(body ? { body } : {}),
    });
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    requestState.value = "success";
    return response.data === undefined ? null : response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      message.value = error.userMessage;
      actionHint.value = error.actionHint;
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      requestState.value =
        error.kind === "rate_limited"
          ? "rate_limited"
          : error.kind === "blocked"
            ? "blocked"
            : "error";
      return null;
    }
    requestState.value = "blocked";
    message.value = "无法连接身份服务。";
    actionHint.value = "检查网络后重试；运维人员可在宝塔查看后端状态。";
    return null;
  }
}
async function enterApplication() {
  const result = await request("/me/landing", undefined, "GET");
  if (result?.data?.route) window.location.assign(result.data.route);
}
async function confirmEmail() {
  const token = params.get("token") || "";
  if (!token) return;
  const result = await request("/auth/email-verification/confirm", { token });
  if (result) {
    message.value = "邮箱验证完成，现在可以返回登录。";
  }
}
async function submit() {
  if (mode.value === "register" && password.value !== confirmPassword.value) {
    requestState.value = "error";
    message.value = "两次输入的密码不一致。";
    return;
  }
  if (mode.value === "login") {
    const result = await request("/auth/login", {
      email: email.value,
      password: password.value,
    });
    if (result?.data?.mfa_required) {
      mode.value = "mfa-challenge";
      requestState.value = "idle";
      message.value = "密码已验证，请输入认证器验证码。";
      return;
    }
    if (result?.data?.security_setup?.required) {
      securitySetup.value = result.data.security_setup;
      currentPassword.value = password.value;
      mode.value = "security-setup";
      requestState.value = "idle";
      message.value = "种子账号必须完成改密和 MFA 后才能进入业务功能。";
      return;
    }
    if (result) await enterApplication();
    return;
  }
  if (mode.value === "register") {
    const result = await request("/auth/register", {
      email: email.value,
      password: password.value,
    });
    if (result) {
      mode.value = "verify";
      message.value = "验证邮件已进入受控投递队列。";
    }
  }
  if (mode.value === "forgot") {
    const result = await request("/auth/password-reset/request", {
      email: email.value,
    });
    if (result) message.value = "如账号存在，重置邮件会进入受控投递队列。";
  }
  if (mode.value === "reset") {
    const token = params.get("token") || "";
    const result = await request("/auth/password-reset/confirm", {
      token,
      new_password: password.value,
    });
    if (result === null && requestState.value === "success")
      message.value = "密码已更新，请重新登录。";
  }
  if (mode.value === "mfa-challenge") {
    const result = await request("/auth/mfa/totp/verify", {
      code: mfaCode.value,
    });
    if (result) await enterApplication();
  }
}
async function loadSessions() {
  const result = await request("/me/sessions", undefined, "GET");
  sessions.value = result?.data || [];
}
async function revoke(id: string) {
  const result = await request(`/me/sessions/${id}`, undefined, "DELETE");
  if (result === null && requestState.value === "success") await loadSessions();
}
async function loadMfa() {
  const result = await request("/me/mfa", undefined, "GET");
  if (result) mfaEnabled.value = Boolean(result.data?.totp_enabled);
}
async function startMfa() {
  const result = await request("/me/mfa/totp/enrollment", {
    current_password: currentPassword.value,
  });
  if (result) {
    mfaSecret.value = result.data.secret;
    message.value = "密钥仅显示于本次绑定，请添加到认证器后输入验证码。";
  }
}
async function confirmMfa() {
  const result = await request("/me/mfa/totp/confirm", { code: mfaCode.value });
  if (result) {
    mfaEnabled.value = true;
    securitySetup.value.must_enroll_mfa = false;
    recoveryCodes.value = result.data.recovery_codes;
    message.value =
      mode.value === "security-setup"
        ? "首次安全设置已完成。请离线保存恢复码，然后重新登录进入业务功能。"
        : "MFA 已启用。请离线保存一次性恢复码。";
  }
}
async function disableMfa() {
  const result = await request(
    "/me/mfa/totp",
    { current_password: currentPassword.value, code: mfaCode.value },
    "DELETE",
  );
  if (result === null && requestState.value === "success") {
    mfaEnabled.value = false;
    message.value = "MFA 已停用，所有会话已撤销，请重新登录。";
  }
}
async function changeSeedPassword() {
  const result = await request("/me/password", {
    current_password: currentPassword.value,
    new_password: newPassword.value,
  });
  if (result === null && requestState.value === "success") {
    securitySetup.value.must_change_password = false;
    password.value = newPassword.value;
    currentPassword.value = "";
    newPassword.value = "";
    mode.value = "login";
    message.value = "密码已修改且旧会话已撤销。请用新密码重新登录并继续绑定 MFA。";
  }
}
onMounted(() => {
  if (mode.value === "verify" && params.get("token")) void confirmEmail();
  if (mode.value === "sessions") void loadSessions();
});
</script>

<template>
  <main class="identity-page" :data-mode="mode" :data-state="requestState">
    <header class="identity-header">
      <a class="identity-brand" href="/"><span>选</span>智能选品</a>
      <p>账号登录与安全验证</p>
    </header>
    <section class="identity-shell">
      <aside class="identity-story" aria-label="智能选品产品说明">
        <p class="identity-kicker">从信号到行动</p>
        <h1>让增长，<em>更有确定性</em></h1>
        <p>账号、密码和会话只在受控后端处理。浏览器不保存认证 Token，也不接触数据库或密钥。</p>
        <div class="identity-orbit" aria-hidden="true"><span>S</span><i></i><i></i><i></i></div>
        <ul>
          <li><strong>安全密码</strong><small>密码不可反向读取</small></li>
          <li><strong>单次令牌</strong><small>验证与重置可追踪</small></li>
          <li><strong>动态双重验证</strong><small>30 秒短时验证码</small></li>
        </ul>
      </aside>

      <section class="identity-card" aria-live="polite">
        <div class="identity-card__head">
          <p>
            {{ mode === "sessions" ? "SECURITY CENTER" : "AI SELECTION ACCOUNT" }}
          </p>
          <h2>{{ title }}</h2>
          <span v-if="mode === 'login'">使用已验证的邮箱和本地密码登录</span>
          <span v-else-if="mode === 'register'">先创建账号，再完成邮箱验证</span>
          <span v-else-if="mode === 'forgot'">无论账号是否存在，页面提示保持一致</span>
          <span v-else-if="mode === 'mfa'">认证器密钥加密保存，恢复码仅显示一次</span>
          <span v-else-if="mode === 'mfa-challenge'">短时挑战保存在浏览器安全凭证中</span>
          <span v-else-if="mode === 'security-setup'">完成全部步骤前，业务后端保持拒绝</span>
        </div>

        <div
          v-if="requestState === 'expired'"
          class="identity-notice identity-notice--warning"
          data-testid="expired"
        >
          <strong>链接已过期</strong>
          <p>验证与重置令牌均为单次使用。请重新申请，不要继续提交旧链接。</p>
        </div>
        <div
          v-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
          class="identity-notice identity-notice--error"
          data-testid="error"
        >
          <strong>{{
            requestState === "rate_limited"
              ? "请求过于频繁"
              : requestState === "blocked"
                ? "身份服务暂不可用"
                : "操作未完成"
          }}</strong>
          <p>{{ message }}</p>
          <small v-if="actionHint">{{ actionHint }}</small
          ><small v-if="requestId">请求标识：{{ requestId }}</small
          ><small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
        </div>
        <div
          v-if="requestState === 'success' && message"
          class="identity-notice identity-notice--success"
        >
          <strong>操作已受理</strong>
          <p>{{ message }}</p>
        </div>

        <form
          v-if="['login', 'register', 'forgot', 'reset', 'mfa-challenge'].includes(mode)"
          @submit.prevent="submit"
        >
          <label v-if="mode === 'mfa-challenge'"
            >认证器验证码或恢复码<input
              v-model="mfaCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
              minlength="6"
              maxlength="32"
              placeholder="6 位验证码"
          /></label>
          <label v-if="!['reset', 'mfa-challenge'].includes(mode)"
            >邮箱<input
              v-model="email"
              type="email"
              autocomplete="email"
              required
              maxlength="254"
              placeholder="name@company.com"
          /></label>
          <label v-if="!['forgot', 'mfa-challenge'].includes(mode)"
            >{{ mode === "reset" ? "新密码" : "密码"
            }}<input
              v-model="password"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              required
              minlength="12"
              maxlength="128"
              placeholder="输入安全密码"
          /></label>
          <label v-if="mode === 'register'"
            >确认密码<input
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              minlength="12"
              maxlength="128"
              placeholder="再次输入密码"
          /></label>
          <div v-if="mode === 'login'" class="identity-form-row">
            <span>登录状态最长保留 30 天，可在安全中心主动退出</span
            ><button type="button" class="text-button" @click="switchMode('forgot')">
              忘记密码？
            </button>
          </div>
          <button class="identity-primary" type="submit" :disabled="requestState === 'loading'">
            {{
              requestState === "loading"
                ? "正在安全处理…"
                : mode === "login"
                  ? "登录"
                  : mode === "register"
                    ? "创建账号"
                    : mode === "forgot"
                      ? "发送重置说明"
                      : mode === "mfa-challenge"
                        ? "验证并登录"
                        : "更新密码"
            }}
          </button>
        </form>

        <div v-else-if="mode === 'verify'" class="identity-centered" data-testid="verify">
          <span class="mail-icon" aria-hidden="true">✉</span>
          <h3>
            {{
              params.get("token")
                ? requestState === "success"
                  ? "邮箱验证完成"
                  : "正在验证邮箱"
                : "检查验证邮件"
            }}
          </h3>
          <p>
            {{
              params.get("token")
                ? "验证链接只使用一次；失败时按上方提示重新申请。"
                : "邮件服务未确认时，生产投递会明确显示受阻，不会假报已发送。"
            }}
          </p>
          <button type="button" @click="switchMode('login')">返回登录</button>
        </div>

        <section
          v-else-if="mode === 'security-setup'"
          class="mfa-panel"
          data-testid="security-setup"
        >
          <div class="mfa-status">
            <span class="is-pending">强制</span>
            <div>
              <strong>种子管理员安全激活</strong>
              <p>单次种子密码不能作为长期凭证；改密后必须启用认证器。</p>
            </div>
          </div>
          <template v-if="securitySetup.must_change_password"
            ><label
              >当前种子密码<input
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="12"
                maxlength="128" /></label
            ><label
              >新的长期密码<input
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="12"
                maxlength="128" /></label
            ><button class="identity-primary" type="button" @click="changeSeedPassword">
              修改密码并撤销当前会话
            </button></template
          >
          <template v-else-if="securitySetup.must_enroll_mfa"
            ><label
              >当前密码<input
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="12"
                maxlength="128" /></label
            ><button v-if="!mfaSecret" class="identity-primary" type="button" @click="startMfa">
              开始绑定认证器
            </button>
            <div v-else class="mfa-setup">
              <p>手动输入密钥</p>
              <code>{{ mfaSecret }}</code
              ><label
                >认证器验证码<input
                  v-model="mfaCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="8" /></label
              ><button class="identity-primary" type="button" @click="confirmMfa">
                确认并完成安全设置
              </button>
            </div></template
          >
          <div v-else class="recovery-codes">
            <strong>安全设置已完成</strong>
            <p>恢复码仅显示本次，请离线保存后重新登录。</p>
            <code v-for="code in recoveryCodes" :key="code">{{ code }}</code
            ><button class="identity-primary" type="button" @click="switchMode('login')">
              返回登录
            </button>
          </div>
        </section>
        <section v-else-if="mode === 'mfa'" class="mfa-panel" data-testid="mfa">
          <div class="mfa-status">
            <span :class="mfaEnabled ? 'is-enabled' : 'is-pending'">{{
              mfaEnabled ? "已启用" : "未启用"
            }}</span>
            <div>
              <strong>认证器 TOTP</strong>
              <p>遵循 RFC 6238；验证码 30 秒更新，允许受控时钟偏差并拒绝重放。</p>
            </div>
          </div>
          <template v-if="!mfaEnabled">
            <label
              >当前密码<input
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="12"
                maxlength="128"
                placeholder="验证当前密码"
            /></label>
            <button v-if="!mfaSecret" class="identity-primary" type="button" @click="startMfa">
              开始绑定认证器
            </button>
            <div v-else class="mfa-setup">
              <p>手动输入密钥</p>
              <code>{{ mfaSecret }}</code
              ><label
                >认证器验证码<input
                  v-model="mfaCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="8"
                  placeholder="6 位验证码" /></label
              ><button class="identity-primary" type="button" @click="confirmMfa">
                确认并启用
              </button>
            </div>
          </template>
          <template v-else>
            <div v-if="recoveryCodes.length" class="recovery-codes">
              <strong>一次性恢复码</strong>
              <p>仅本次显示，请离线保存；每个代码只能使用一次。</p>
              <code v-for="code in recoveryCodes" :key="code">{{ code }}</code>
            </div>
            <div class="mfa-disable">
              <label
                >当前密码<input
                  v-model="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  maxlength="128" /></label
              ><label
                >当前验证码或恢复码<input
                  v-model="mfaCode"
                  autocomplete="one-time-code"
                  maxlength="32" /></label
              ><button type="button" @click="disableMfa">停用并撤销全部会话</button>
            </div>
          </template>
        </section>

        <div v-else class="session-list" data-testid="sessions">
          <div v-if="requestState === 'loading'" class="identity-loading">正在读取本人会话…</div>
          <p v-else-if="sessions.length === 0" class="identity-empty">
            暂无可显示的活动会话；登录失效时请重新登录。
          </p>
          <article v-for="session in sessions" :key="session.id">
            <div>
              <strong>{{ session.device_label }}</strong
              ><small>{{ session.status }} · {{ session.last_seen_at }}</small>
            </div>
            <button type="button" @click="revoke(session.id)">撤销</button>
          </article>
        </div>

        <footer class="identity-card__foot">
          <button
            v-if="mode !== 'register'"
            type="button"
            class="text-button"
            @click="switchMode('register')"
          >
            创建本地账号
          </button>
          <button
            v-if="mode !== 'login'"
            type="button"
            class="text-button"
            @click="switchMode('login')"
          >
            返回登录
          </button>
          <button type="button" class="text-button" @click="switchMode('sessions')">
            查看安全会话
          </button>
          <button type="button" class="text-button" @click="switchMode('mfa')">管理 MFA</button>
          <a
            v-if="mode === 'login' && requestState === 'success'"
            class="text-button"
            href="/select-context"
            >继续选择组织</a
          >
        </footer>
      </section>
    </section>
    <footer class="identity-footer">
      <span>安全状态均有文字说明</span><span>生产运行：仅宝塔管理</span>
    </footer>
  </main>
</template>
