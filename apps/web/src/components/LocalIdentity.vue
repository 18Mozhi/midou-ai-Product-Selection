<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import "./local-identity-mfa.css";
import "./local-identity-login.css";
import "./local-identity-registration.css";
import "./local-identity-recovery.css";
import "./local-identity-reset.css";
import "./local-identity-verification.css";
import { useRoute, useRouter } from "vue-router";
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
const route = useRoute();
const router = useRouter();
const apiRequest = createApiClient(publicConfig.apiBaseUrl);
const pathModes: Record<string, IdentityMode> = {
  "/login": "login",
  "/register": "register",
  "/forgot-password": "forgot",
  "/verify-email": "verify",
  "/reset-password": "reset",
  "/security/mfa": "mfa",
};
const publicQueryModes = new Set<IdentityMode>(["login", "register", "forgot", "verify", "reset"]);
const queryMode = params.get("mode") as IdentityMode | null;
const mode = ref<IdentityMode>(
  queryMode && publicQueryModes.has(queryMode)
    ? queryMode
    : pathModes[window.location.pathname] || "login",
);
const requestState = ref<RequestState>(params.get("state") === "expired" ? "expired" : "idle");
const email = ref("");
const identifier = ref("");
const password = ref("");
const confirmPassword = ref("");
const currentPassword = ref("");
const mfaCode = ref("");
const mfaSecret = ref("");
const recoveryCodes = ref<string[]>([]);
const mfaEnabled = ref(false);
const mfaStatus = ref<"unknown" | "loading" | "ready" | "error">("unknown");
const mfaActionBusy = ref(false);
const mfaDisabledByAction = ref(false);
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
type Session = (typeof sessions.value)[number];
interface LoginResult {
  mfa_required?: boolean;
  security_setup?: {
    required: boolean;
    must_change_password: boolean;
    must_enroll_mfa: boolean;
  };
}
const securitySetup = ref({
  must_change_password: false,
  must_enroll_mfa: false,
});
const newPassword = ref("");
const seedPasswordBusy = ref(false);
const title = computed(
  () =>
    ({
      login: "欢迎回到智能选品",
      register: "注册账号",
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
  if (mode.value === "mfa" && next !== "mfa") clearMfaMaterial();
  if (mode.value === "mfa-challenge" && next !== "mfa-challenge") mfaCode.value = "";
  if (mode.value === "security-setup" && next !== "security-setup") {
    currentPassword.value = "";
    newPassword.value = "";
    password.value = "";
    clearMfaMaterial();
  }
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
      if (mode.value === "mfa-challenge" && error.code === "mfa_challenge_invalid") {
        mode.value = "login";
        mfaCode.value = "";
      }
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
  // Every new session restores its authorized tenant before a deep-link redirect.
  const result = await request<{ route: string }>("/me/landing", undefined, "GET");
  if (!result?.data?.route) return;
  const redirect = params.get("redirect");
  await router.replace(
    redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : result.data.route,
  );
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
  if (requestState.value === "loading") return;
  if (mode.value === "register" && password.value !== confirmPassword.value) {
    requestState.value = "error";
    message.value = "两次输入的密码不一致。";
    return;
  }
  if (mode.value === "login") {
    const result = await request<LoginResult>("/auth/login", {
      identifier: identifier.value,
      password: password.value,
    });
    if (result?.data?.mfa_required) {
      mfaCode.value = "";
      password.value = "";
      mode.value = "mfa-challenge";
      requestState.value = "idle";
      message.value = "密码已验证，请输入认证器验证码。";
      return;
    }
    if (result?.data?.security_setup?.required) {
      securitySetup.value = result.data.security_setup;
      currentPassword.value = password.value;
      password.value = "";
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
      message.value = "注册申请已受理，请留意验证邮件。";
    }
  }
  if (mode.value === "forgot") {
    const result = await request("/auth/password-reset/request", {
      email: email.value,
    });
    if (result) message.value = "请求已受理。若该邮箱已注册，请留意重置说明。";
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
    if (result) {
      mfaCode.value = "";
      await enterApplication();
    }
  }
}
async function loadSessions() {
  const result = await request<Session[]>("/me/sessions", undefined, "GET");
  sessions.value = result?.data || [];
}
async function revoke(id: string) {
  const result = await request(`/me/sessions/${id}`, undefined, "DELETE");
  if (result === null && requestState.value === "success") await loadSessions();
}
async function loadMfa() {
  if (mfaStatus.value === "loading") return;
  mfaStatus.value = "loading";
  const result = await request<{ totp_enabled: boolean }>("/me/mfa", undefined, "GET");
  if (result) {
    mfaEnabled.value = Boolean(result.data?.totp_enabled);
    mfaStatus.value = "ready";
  } else {
    mfaStatus.value = "error";
  }
}
function clearMfaMaterial() {
  currentPassword.value = "";
  mfaCode.value = "";
  mfaSecret.value = "";
  recoveryCodes.value = [];
}
async function startMfa() {
  if (mfaActionBusy.value) return;
  mfaActionBusy.value = true;
  try {
    const result = await request<{ secret: string }>("/me/mfa/totp/enrollment", {
      current_password: currentPassword.value,
    });
    if (result) {
      mfaSecret.value = result.data.secret;
      currentPassword.value = "";
      message.value = "密钥仅显示于本次绑定，请添加到认证器后输入验证码。";
    }
  } finally {
    mfaActionBusy.value = false;
  }
}
async function confirmMfa() {
  if (mfaActionBusy.value) return;
  mfaActionBusy.value = true;
  try {
    const result = await request<{ recovery_codes: string[] }>("/me/mfa/totp/confirm", {
      code: mfaCode.value,
    });
    if (result) {
      mfaEnabled.value = true;
      mfaStatus.value = "ready";
      mfaDisabledByAction.value = false;
      securitySetup.value.must_enroll_mfa = false;
      recoveryCodes.value = result.data.recovery_codes;
      mfaSecret.value = "";
      currentPassword.value = "";
      mfaCode.value = "";
      message.value =
        mode.value === "security-setup"
          ? "首次安全设置已完成。请离线保存恢复码，然后重新登录进入业务功能。"
          : "MFA 已启用。请离线保存一次性恢复码。";
    }
  } finally {
    mfaActionBusy.value = false;
  }
}
async function disableMfa() {
  if (mfaActionBusy.value) return;
  mfaActionBusy.value = true;
  try {
    const result = await request(
      "/me/mfa/totp",
      { current_password: currentPassword.value, code: mfaCode.value },
      "DELETE",
    );
    if (result === null && requestState.value === "success") {
      mfaEnabled.value = false;
      mfaStatus.value = "ready";
      mfaDisabledByAction.value = true;
      clearMfaMaterial();
      message.value = "MFA 已停用，所有会话已撤销，请重新登录。";
    }
  } finally {
    mfaActionBusy.value = false;
  }
}
async function changeSeedPassword() {
  if (seedPasswordBusy.value) return;
  const submittedCurrentPassword = currentPassword.value;
  const submittedNewPassword = newPassword.value;
  seedPasswordBusy.value = true;
  try {
    const result = await request("/me/password", {
      current_password: submittedCurrentPassword,
      new_password: submittedNewPassword,
    });
    if (result === null && requestState.value === "success") {
      securitySetup.value.must_change_password = false;
      password.value = submittedNewPassword;
      currentPassword.value = "";
      newPassword.value = "";
      mode.value = "login";
      message.value = "密码已修改且旧会话已撤销。请用新密码重新登录并继续绑定 MFA。";
    }
  } finally {
    seedPasswordBusy.value = false;
  }
}
onMounted(() => {
  if (mode.value === "verify" && params.get("token")) void confirmEmail();
  if (mode.value === "sessions") void loadSessions();
  if (mode.value === "mfa") void loadMfa();
});
onBeforeUnmount(() => clearMfaMaterial());
</script>

<template>
  <main
    v-if="mode === 'mfa'"
    class="p07-mfa-page"
    data-testid="mfa"
    :data-state="mfaStatus"
    :data-request-state="requestState"
  >
    <header class="p07-mfa-top">
      <RouterLink class="p07-mfa-brand" to="/">ScoutOps</RouterLink>
      <span>账号安全</span>
      <small>认证器管理 · 受登录会话保护</small>
    </header>
    <section class="p07-mfa-hero">
      <h1>
        {{
          mfaStatus === "loading" || mfaStatus === "unknown"
            ? "正在读取保护状态"
            : mfaStatus === "error"
              ? "暂时无法读取保护状态"
              : mfaEnabled
                ? "认证器已启用"
                : mfaSecret
                  ? "确认认证器绑定"
                  : "为账号启用认证器"
        }}
      </h1>
      <span>
        {{
          mfaStatus === "loading" || mfaStatus === "unknown"
            ? "尚未读取完成前，不对当前保护状态作出判断。"
            : mfaEnabled
              ? "恢复码只在启用确认后显示；停用会撤销当前账号的全部会话。"
              : "先验证当前密码，再按页面材料完成绑定。"
        }}
      </span>
    </section>
    <section class="p07-mfa-workspace" aria-label="多因素认证设置">
      <div
        v-if="mfaStatus === 'loading' || mfaStatus === 'unknown'"
        class="p07-mfa-notice"
        role="status"
        aria-live="polite"
      >
        <strong>正在读取 MFA 状态</strong>
        <span>正在读取安全设置…</span>
      </div>
      <div
        v-else-if="
          mfaStatus === 'error' || ['error', 'rate_limited', 'blocked'].includes(requestState)
        "
        class="p07-mfa-notice p07-mfa-error"
        role="alert"
      >
        <strong>{{
          requestState === "rate_limited"
            ? "请求过于频繁"
            : requestState === "blocked"
              ? "安全服务暂不可用"
              : "读取或操作未完成"
        }}</strong>
        <span>{{ message || "暂时无法读取当前 MFA 状态。" }}</span>
        <small v-if="actionHint">{{ actionHint }}</small>
        <small v-if="requestId">请求标识：{{ requestId }}</small>
        <small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
        <button
          v-if="mfaStatus === 'error'"
          type="button"
          class="p07-mfa-secondary"
          :disabled="requestState === 'loading'"
          @click="loadMfa"
        >
          {{ requestState === "loading" ? "正在重新读取…" : "重新读取安全状态" }}
        </button>
      </div>
      <div
        v-else-if="requestState === 'success' && message"
        class="p07-mfa-notice p07-mfa-success"
        role="status"
        aria-live="polite"
      >
        <strong>操作已完成</strong>
        <span>{{ message }}</span>
      </div>

      <section
        v-if="mfaStatus === 'ready' && mfaDisabledByAction"
        class="p07-mfa-disabled-success"
        role="status"
        aria-live="polite"
      >
        <strong>认证器已停用</strong>
        <span>认证器已停用，所有会话已退出。请重新登录。</span>
      </section>
      <template v-else-if="mfaStatus === 'ready' && !mfaEnabled">
        <section class="p07-mfa-disabled" aria-label="认证器状态">
          <strong>认证器当前未启用</strong>
          <span>账号目前没有已确认的 TOTP 认证器。</span>
        </section>
        <form v-if="!mfaSecret" class="p07-mfa-step" @submit.prevent="startMfa">
          <p>步骤 1 / 2</p>
          <h2>验证当前密码</h2>

          <label for="p07-enrollment-password">当前密码</label>
          <input
            id="p07-enrollment-password"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            minlength="12"
            maxlength="128"
            required
            placeholder="验证当前密码"
          />
          <button class="p07-mfa-primary" type="submit" :disabled="mfaActionBusy">
            {{ mfaActionBusy ? "正在启动绑定…" : "开始绑定认证器" }}
          </button>
        </form>
        <form v-else class="p07-mfa-step" @submit.prevent="confirmMfa">
          <p>步骤 2 / 2</p>
          <h2>在认证器中完成绑定</h2>
          <span>使用受信任的认证器添加密钥，并输入当前验证码完成确认。</span>
          <label for="p07-mfa-secret">手动输入密钥</label>
          <code id="p07-mfa-secret" class="p07-mfa-secret">{{ mfaSecret }}</code>
          <label for="p07-enrollment-code">认证器验证码</label>
          <input
            id="p07-enrollment-code"
            v-model="mfaCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            minlength="6"
            maxlength="32"
            required
            placeholder="输入验证码"
          />
          <p class="p07-mfa-help">验证码会随时间更新；若已过期，请等待新验证码后重试。</p>
          <button class="p07-mfa-primary" type="submit" :disabled="mfaActionBusy">
            {{ mfaActionBusy ? "正在确认…" : "确认并启用" }}
          </button>
        </form>
        <section
          v-if="recoveryCodes.length"
          class="p07-mfa-recovery"
          aria-labelledby="p07-recovery-title"
        >
          <p>安全恢复</p>
          <h2 id="p07-recovery-title">一次性恢复码</h2>
          <span>仅本次显示，请离线保存；每个代码只能使用一次。</span>
          <code v-for="code in recoveryCodes" :key="code">{{ code }}</code>
        </section>
      </template>
      <template v-else-if="mfaStatus === 'ready' && mfaEnabled">
        <section class="p07-mfa-enabled" aria-label="认证器状态">
          <strong>认证器 TOTP 已启用</strong>
          <span>验证码周期更新。请妥善保管已生成的恢复码。</span>
        </section>
        <section
          v-if="recoveryCodes.length"
          class="p07-mfa-recovery"
          aria-labelledby="p07-recovery-title"
        >
          <p>本次生成的恢复码</p>
          <h2 id="p07-recovery-title">请离线保存</h2>
          <span>这些恢复码只在本次确认后显示，每个代码只能使用一次。</span>
          <code v-for="code in recoveryCodes" :key="code">{{ code }}</code>
        </section>
        <section class="p07-mfa-danger" aria-labelledby="p07-disable-title">
          <p>高影响操作</p>
          <h2 id="p07-disable-title">停用认证器</h2>
          <span>停用后将退出所有设备，请重新登录。</span>
          <form @submit.prevent="disableMfa">
            <label for="p07-disable-password">当前密码</label>
            <input
              id="p07-disable-password"
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              maxlength="128"
              required
              placeholder="验证当前密码"
            />
            <label for="p07-disable-code">当前验证码或恢复码</label>
            <input
              id="p07-disable-code"
              v-model="mfaCode"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="32"
              required
              placeholder="输入验证码或恢复码"
            />
            <button class="p07-mfa-danger-button" type="submit" :disabled="mfaActionBusy">
              {{ mfaActionBusy ? "正在停用并撤销会话…" : "停用并撤销全部会话" }}
            </button>
          </form>
        </section>
      </template>
      <footer class="p07-mfa-footer">
        <RouterLink to="/me?section=security">查看安全会话</RouterLink>
        <RouterLink to="/login">返回登录</RouterLink>
      </footer>
    </section>
  </main>
  <main
    v-else-if="mode === 'login' || mode === 'mfa-challenge' || mode === 'security-setup'"
    class="p02-login-page"
    :data-mode="mode"
    :data-state="requestState"
    :aria-busy="requestState === 'loading' || mfaActionBusy"
    :data-testid="
      mode === 'security-setup'
        ? 'security-setup'
        : mode === 'mfa-challenge'
          ? 'mfa-challenge'
          : 'login'
    "
  >
    <header class="p02-login-top">
      <RouterLink to="/" aria-label="ScoutOps 首页" class="p02-login-brand">ScoutOps</RouterLink>
      <strong>账号登录</strong>
    </header>
    <div class="p02-login-shell">
      <section
        class="p02-login-workspace"
        aria-live="polite"
        :aria-busy="requestState === 'loading' || mfaActionBusy"
        :aria-labelledby="
          mode === 'login'
            ? 'p02-login-title'
            : mode === 'mfa-challenge'
              ? 'p02-challenge-title'
              : 'p02-setup-title'
        "
      >
        <header>
          <h1 v-if="mode === 'login'" id="p02-login-title">安全登录</h1>
          <h1 v-else-if="mode === 'mfa-challenge'" id="p02-challenge-title">验证你的身份</h1>
          <h1 v-else id="p02-setup-title">完成首次安全设置</h1>
          <span v-if="mode !== 'login'">
            {{
              mode === "mfa-challenge"
                ? "输入认证器验证码或一次性恢复码。"
                : securitySetup.must_change_password
                  ? "先更新种子密码；旧会话会被撤销，之后需重新登录。"
                  : securitySetup.must_enroll_mfa
                    ? "先验证当前密码，再绑定认证器并离线保存恢复码。"
                    : "安全设置已完成，可返回登录继续。"
            }}
          </span>
        </header>

        <div
          v-if="requestState === 'expired'"
          class="p02-login-notice p02-login-warning"
          role="status"
        >
          <strong>链接已过期</strong>
          <span>安全链接为单次使用。请重新发起请求，不要继续使用旧链接。</span>
        </div>
        <div
          v-if="route.query.reason === 'authentication_required'"
          class="p02-login-notice"
          role="status"
        >
          <strong>需要登录</strong>
          <span>请先登录，再进入安全会话或 MFA 设置。</span>
        </div>
        <div
          v-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
          class="p02-login-notice p02-login-error"
          role="alert"
          data-testid="error"
        >
          <strong>{{
            requestState === "rate_limited"
              ? "请求过于频繁"
              : requestState === "blocked"
                ? "身份服务暂不可用"
                : "操作未完成"
          }}</strong>
          <span>{{ message }}</span>
          <small v-if="actionHint">{{ actionHint }}</small>
          <small v-if="requestId">请求标识：{{ requestId }}</small>
          <small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
        </div>
        <div v-else-if="message" class="p02-login-notice" role="status" aria-live="polite">
          <strong>{{ requestState === "success" ? "操作已完成" : "当前步骤" }}</strong>
          <span>{{ message }}</span>
        </div>

        <form
          v-if="mode === 'login' || mode === 'mfa-challenge'"
          class="p02-login-form"
          @submit.prevent="submit"
        >
          <template v-if="mode === 'login'">
            <label for="p02-login-identifier">账号（邮箱或用户名）</label>
            <small id="p02-login-identifier-help">使用已验证邮箱或唯一用户名。</small>
            <input
              id="p02-login-identifier"
              v-model="identifier"
              type="text"
              autocomplete="username"
              required
              minlength="2"
              maxlength="254"
              aria-describedby="p02-login-identifier-help"
              placeholder="邮箱或用户名"
            />
            <label for="p02-login-password">密码</label>
            <input
              id="p02-login-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              minlength="12"
              maxlength="128"
              placeholder="输入密码"
            />
            <div class="p02-login-form-row">
              <span>登录状态最多保留 30 天。</span>
              <button type="button" @click="switchMode('forgot')">忘记密码？</button>
            </div>
            <button class="p02-login-primary" type="submit" :disabled="requestState === 'loading'">
              {{ requestState === "loading" ? "正在验证…" : "登录" }}
            </button>
          </template>
          <template v-else>
            <label for="p02-login-mfa-code">认证器验证码或恢复码</label>
            <small id="p02-login-mfa-help">恢复码仅可使用一次。</small>
            <input
              id="p02-login-mfa-code"
              v-model="mfaCode"
              type="text"
              autocomplete="one-time-code"
              required
              minlength="6"
              maxlength="32"
              aria-describedby="p02-login-mfa-help"
              placeholder="输入验证码或恢复码"
            />
            <button class="p02-login-primary" type="submit" :disabled="requestState === 'loading'">
              {{ requestState === "loading" ? "正在验证…" : "验证并继续" }}
            </button>
          </template>
        </form>

        <section v-else class="p02-login-security">
          <form v-if="securitySetup.must_change_password" @submit.prevent="changeSeedPassword">
            <p class="p02-login-step">步骤 1 / 2 · 更新密码</p>
            <label for="p02-seed-current-password">当前种子密码</label>
            <input
              id="p02-seed-current-password"
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              :disabled="seedPasswordBusy"
              required
              minlength="12"
              maxlength="128"
              placeholder="验证当前种子密码"
            />
            <label for="p02-seed-new-password">新的长期密码</label>
            <small id="p02-seed-new-password-help">至少 12 位，最多 128 位。</small>
            <input
              id="p02-seed-new-password"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              :disabled="seedPasswordBusy"
              required
              minlength="12"
              maxlength="128"
              aria-describedby="p02-seed-new-password-help"
              placeholder="设置新的登录密码"
            />
            <button
              class="p02-login-primary"
              type="submit"
              :disabled="seedPasswordBusy || requestState === 'loading'"
            >
              {{ seedPasswordBusy ? "正在更新…" : "更新密码并重新登录" }}
            </button>
          </form>
          <template v-else-if="securitySetup.must_enroll_mfa">
            <p class="p02-login-step">步骤 2 / 2 · 绑定认证器</p>
            <form v-if="!mfaSecret" @submit.prevent="startMfa">
              <label for="p02-seed-enrollment-password">当前密码</label>
              <small id="p02-seed-enrollment-help">用于启动本次认证器绑定。</small>
              <input
                id="p02-seed-enrollment-password"
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="12"
                maxlength="128"
                aria-describedby="p02-seed-enrollment-help"
                required
                placeholder="验证当前密码"
              />
              <button
                class="p02-login-primary"
                type="submit"
                :disabled="mfaActionBusy || requestState === 'loading'"
              >
                {{ mfaActionBusy ? "正在启动绑定…" : "开始绑定认证器" }}
              </button>
            </form>
            <form v-else class="p02-login-confirm" @submit.prevent="confirmMfa">
              <p>手动输入密钥</p>
              <code>{{ mfaSecret }}</code>
              <small id="p02-seed-confirm-help"
                >密钥仅在本次绑定期间显示，请保存在受信任的认证器中。</small
              >
              <label for="p02-seed-confirm-code">认证器验证码</label>
              <input
                id="p02-seed-confirm-code"
                v-model="mfaCode"
                type="text"
                autocomplete="one-time-code"
                minlength="6"
                maxlength="8"
                aria-describedby="p02-seed-confirm-help"
                required
                placeholder="输入当前验证码"
              />
              <button
                class="p02-login-primary"
                type="submit"
                :disabled="mfaActionBusy || requestState === 'loading'"
              >
                {{ mfaActionBusy ? "正在确认…" : "确认并完成安全设置" }}
              </button>
            </form>
          </template>
          <section v-else class="p02-login-complete" role="status">
            <strong>账号安全设置已完成</strong>
            <span>恢复码仅本次显示。请离线保存后返回登录。</span>
            <code v-for="code in recoveryCodes" :key="code">{{ code }}</code>
            <button class="p02-login-primary" type="button" @click="switchMode('login')">
              返回登录
            </button>
          </section>
        </section>

        <footer class="p02-login-actions">
          <template v-if="mode === 'login'">
            <button type="button" @click="switchMode('register')">注册账号</button>
            <RouterLink to="/me?section=security">查看安全会话</RouterLink>
            <RouterLink to="/security/mfa">了解 MFA</RouterLink>
          </template>
          <template v-else>
            <button type="button" @click="switchMode('login')">返回登录</button>
            <RouterLink v-if="mode === 'mfa-challenge'" to="/security/mfa">了解 MFA</RouterLink>
          </template>
        </footer>
      </section>
    </div>
  </main>
  <main
    v-else-if="mode === 'reset'"
    class="p06-reset-page"
    data-testid="reset-password"
    :data-state="requestState"
    :aria-busy="requestState === 'loading'"
  >
    <header class="p06-reset-top">
      <RouterLink to="/" aria-label="ScoutOps 首页">ScoutOps</RouterLink>
      <strong>设置新密码</strong>
    </header>
    <section class="p06-reset-hero" aria-labelledby="p06-reset-title">
      <h1 id="p06-reset-title">
        {{
          requestState === "success"
            ? "密码已更新"
            : requestState === "expired"
              ? "链接已过期"
              : ["error", "rate_limited", "blocked"].includes(requestState)
                ? "更新未完成"
                : "设置新的登录密码"
        }}
      </h1>
      <span>重置后请使用新密码登录。</span>
    </section>
    <section
      class="p06-reset-workspace"
      aria-label="密码重置"
      aria-live="polite"
      :aria-busy="requestState === 'loading'"
    >
      <div
        v-if="requestState === 'expired'"
        class="p06-reset-notice p06-reset-warning"
        role="status"
      >
        <strong>链接已过期</strong>
        <span>重置链接为单次使用。请重新申请，不要继续使用旧链接。</span>
      </div>
      <div
        v-else-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
        class="p06-reset-notice p06-reset-error"
        role="alert"
      >
        <strong>{{
          requestState === "rate_limited"
            ? "请求过于频繁"
            : requestState === "blocked"
              ? "身份服务暂不可用"
              : "更新未完成"
        }}</strong>
        <span>{{ message }}</span>
        <small v-if="actionHint">{{ actionHint }}</small>
        <code v-if="requestId">关联编号：{{ requestId }}</code>
      </div>
      <div
        v-else-if="requestState === 'success' && message"
        class="p06-reset-notice p06-reset-success"
        role="status"
      >
        <strong>密码已更新</strong>
        <span>{{ message }}</span>
      </div>

      <form
        v-if="requestState !== 'expired' && requestState !== 'success'"
        aria-labelledby="p06-reset-title"
        @submit.prevent="submit"
      >
        <label for="p06-new-password">
          <span>新密码</span>
          <small id="p06-password-help">12–128 位。</small>
          <input
            id="p06-new-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            aria-describedby="p06-password-help"
            required
            minlength="12"
            maxlength="128"
            placeholder="输入安全密码"
          />
        </label>
        <button class="p06-reset-primary" type="submit" :disabled="requestState === 'loading'">
          {{ requestState === "loading" ? "正在安全处理…" : "更新密码" }}
        </button>
      </form>
      <section v-else-if="requestState === 'success'" class="p06-reset-next">
        <strong>下一步：重新登录</strong>
        <p>密码已更新，请使用新密码登录。</p>
        <button class="p06-reset-primary" type="button" @click="switchMode('login')">
          返回登录
        </button>
      </section>
      <section v-else class="p06-reset-next">
        <strong>需要重新申请链接？</strong>
        <p>请重新申请重置链接。</p>
        <button class="p06-reset-primary" type="button" @click="switchMode('forgot')">
          找回密码
        </button>
      </section>
      <footer>
        <button v-if="requestState !== 'success'" type="button" @click="switchMode('login')">
          返回登录
        </button>
        <RouterLink to="/security/mfa">了解 MFA 设置</RouterLink>
      </footer>
    </section>
  </main>
  <main
    v-else-if="mode === 'forgot'"
    class="p04-recovery-page"
    data-testid="password-recovery"
    :data-state="requestState"
    :aria-busy="requestState === 'loading'"
  >
    <header class="p04-recovery-top">
      <RouterLink to="/" aria-label="ScoutOps 首页">ScoutOps</RouterLink>
      <strong>账号恢复</strong>
    </header>
    <section class="p04-recovery-shell">
      <section class="p04-recovery-workspace" aria-label="密码恢复请求" aria-live="polite">
        <header>
          <p>恢复请求</p>
          <h2>找回密码</h2>
        </header>
        <div
          v-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
          class="p04-recovery-notice p04-recovery-error"
          role="alert"
        >
          <strong>{{
            requestState === "rate_limited"
              ? "请求过于频繁"
              : requestState === "blocked"
                ? "身份服务暂不可用"
                : "请求未完成"
          }}</strong>
          <span>{{ message || "当前无法完成恢复请求。" }}</span>
          <small v-if="actionHint">{{ actionHint }}</small>
          <small v-if="requestId">请求标识：{{ requestId }}</small>
          <small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
        </div>
        <div
          v-else-if="requestState === 'success' && message"
          class="p04-recovery-notice p04-recovery-success"
          role="status"
        >
          <strong>请求已受理</strong>
          <span>{{ message }}</span>
          <small v-if="requestId">请求标识：{{ requestId }}</small>
        </div>
        <form class="p04-recovery-form" @submit.prevent="submit">
          <label for="p04-recovery-email">
            <span>邮箱</span>
          </label>
          <input
            id="p04-recovery-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            maxlength="254"
            placeholder="name@company.com"
          />
          <button class="p04-recovery-primary" type="submit" :disabled="requestState === 'loading'">
            {{ requestState === "loading" ? "正在安全处理…" : "发送重置说明" }}
          </button>
        </form>
        <footer class="p04-recovery-footer">
          <button type="button" @click="switchMode('login')">返回登录</button>
          <RouterLink to="/security/mfa">了解 MFA 设置</RouterLink>
        </footer>
      </section>
    </section>
  </main>
  <main
    v-else-if="mode === 'register'"
    class="p03-registration-page"
    data-testid="registration"
    :data-state="requestState"
    :aria-busy="requestState === 'loading'"
  >
    <header class="p03-registration-top">
      <RouterLink to="/" aria-label="ScoutOps 首页">ScoutOps</RouterLink>
      <strong>注册账号</strong>
      <small>邮箱验证后方可继续</small>
    </header>
    <section class="p03-registration-hero" aria-labelledby="p03-registration-title">
      <h1 id="p03-registration-title">创建账号<br /></h1>
      <span>注册后请查收邮件并验证邮箱。</span>
    </section>
    <section
      class="p03-registration-workspace"
      aria-label="账号注册"
      aria-live="polite"
      :aria-busy="requestState === 'loading'"
    >
      <header>
        <p>注册信息</p>
        <h2>填写账号资料</h2>
      </header>
      <div
        v-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
        class="p03-registration-notice p03-registration-error"
        role="alert"
      >
        <strong>{{
          requestState === "rate_limited"
            ? "请求过于频繁"
            : requestState === "blocked"
              ? "身份服务暂不可用"
              : "请检查注册信息"
        }}</strong>
        <span>{{ message }}</span>
        <small v-if="actionHint">{{ actionHint }}</small>
        <small v-if="requestId">请求标识：{{ requestId }}</small>
        <small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
      </div>
      <form class="p03-registration-form" @submit.prevent="submit">
        <label for="p03-registration-email">
          <span>邮箱</span>
          <small id="p03-registration-email-help">用于登录及接收一次性验证链接。</small>
          <input
            id="p03-registration-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            maxlength="254"
            aria-describedby="p03-registration-email-help"
            placeholder="name@example.com"
          />
        </label>
        <label for="p03-registration-password">
          <span>密码</span>
          <small id="p03-registration-password-help">至少 12 位；请使用不重复的强密码。</small>
          <input
            id="p03-registration-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="128"
            aria-describedby="p03-registration-password-help"
            placeholder="输入安全密码"
          />
        </label>
        <label for="p03-registration-confirm">
          <span>确认密码</span>
          <small id="p03-registration-confirm-help">请再次输入密码。</small>
          <input
            id="p03-registration-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="128"
            aria-describedby="p03-registration-confirm-help"
            placeholder="再次输入密码"
          />
        </label>
        <button
          class="p03-registration-primary"
          type="submit"
          :disabled="requestState === 'loading'"
        >
          {{ requestState === "loading" ? "正在安全处理…" : "创建账号" }}
        </button>
      </form>
      <footer class="p03-registration-footer">
        <button type="button" @click="switchMode('login')">返回登录</button>
        <RouterLink to="/security/mfa">账号安全说明</RouterLink>
      </footer>
    </section>
  </main>
  <main
    v-else-if="mode === 'verify'"
    class="p05-verification-page"
    data-testid="email-verification"
    :data-state="requestState"
    :aria-busy="requestState === 'loading'"
  >
    <header class="p05-verification-top">
      <RouterLink to="/" aria-label="ScoutOps 首页">ScoutOps</RouterLink>
      <strong>邮箱验证</strong>
    </header>
    <section class="p05-verification-hero">
      <h1>
        {{
          params.get("token") && requestState === "success" && message
            ? "邮箱验证完成"
            : ["error", "rate_limited", "blocked", "expired"].includes(requestState)
              ? "验证未完成"
              : params.get("token")
                ? "正在验证邮箱"
                : "检查验证邮件"
        }}
      </h1>
      <span>请使用注册邮件中的验证链接。</span>
    </section>
    <section class="p05-verification-workspace" aria-label="邮箱验证结果" aria-live="polite">
      <div
        v-if="params.get('token') && requestState === 'success' && message"
        class="p05-verification-notice p05-verification-success"
        role="status"
      >
        <strong>验证完成</strong>
        <span>{{ message }}</span>
      </div>
      <div
        v-else-if="['error', 'rate_limited', 'blocked'].includes(requestState)"
        class="p05-verification-notice p05-verification-error"
        role="alert"
      >
        <strong>{{
          requestState === "rate_limited"
            ? "请求过于频繁"
            : requestState === "blocked"
              ? "身份服务暂不可用"
              : "验证未完成"
        }}</strong>
        <span>{{ message || "身份服务暂时无法完成验证。" }}</span>
        <small v-if="actionHint">{{ actionHint }}</small>
        <small v-if="requestId">关联编号：{{ requestId }}</small>
        <small v-if="traceId && traceId !== requestId">链路标识：{{ traceId }}</small>
      </div>
      <div v-else-if="requestState === 'expired'" class="p05-verification-notice" role="status">
        <strong>链接需要重新确认</strong>
        <span>验证链接已过期，请联系管理员。</span>
      </div>
      <div v-else class="p05-verification-notice" role="status">
        <strong>{{
          params.get("token")
            ? "正在核验链接"
            : requestState === "success" && message
              ? "验证邮件已提交"
              : "尚未提供验证链接"
        }}</strong>
        <span>{{
          params.get("token")
            ? "系统正在自动提交单次验证；无需重复操作。"
            : requestState === "success" && message
              ? message
              : "请打开注册邮件中的验证链接。"
        }}</span>
      </div>

      <section class="p05-verification-next">
        <strong>{{
          params.get("token") && requestState === "success" ? "下一步：返回登录" : "需要帮助？"
        }}</strong>
        <p>
          {{
            params.get("token") && requestState === "success"
              ? "邮箱已验证，请登录。"
              : "链接失效或验证未完成时，请联系管理员。"
          }}
        </p>
        <button type="button" class="p05-verification-primary" @click="switchMode('login')">
          返回登录
        </button>
      </section>
    </section>
  </main>
  <main v-else class="identity-page" :data-mode="mode" :data-state="requestState">
    <header class="identity-header">
      <RouterLink class="identity-brand" to="/"><span>S</span>SCOUTOPS / 智能选品</RouterLink>
    </header>
    <section class="identity-shell">
      <section class="identity-card" aria-live="polite">
        <div class="identity-card__head">
          <p>账号中心</p>
          <h2>{{ title }}</h2>
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
          v-if="route.query.reason === 'authentication_required'"
          class="identity-notice identity-notice--warning"
          data-testid="authentication-required"
        >
          <strong>需要登录</strong>
          <p>请先登录，再进入安全会话或 MFA 设置。</p>
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

        <div class="session-list" data-testid="sessions">
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
          <button type="button" class="text-button" @click="switchMode('register')">
            注册账号
          </button>
          <button type="button" class="text-button" @click="switchMode('login')">返回登录</button>
          <RouterLink class="text-button" to="/me?section=security">查看安全会话</RouterLink>
          <RouterLink class="text-button" to="/security/mfa">管理 MFA</RouterLink>
        </footer>
      </section>
    </section>
  </main>
</template>
