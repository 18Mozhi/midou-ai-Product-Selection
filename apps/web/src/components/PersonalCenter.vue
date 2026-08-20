<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ApiClientError, createApiClient, type ApiRequestOptions } from "../api-client";

type PersonalSection = "profile" | "permissions" | "security" | "notifications" | "assets";
const props = withDefaults(
  defineProps<{ apiBaseUrl: string; initialSection?: string; accountShell?: boolean }>(),
  { initialSection: "profile", accountShell: false },
);
const request = createApiClient(props.apiBaseUrl);
const state = ref<"loading" | "ready" | "error">("loading");
const validSections: PersonalSection[] = [
  "profile",
  "permissions",
  "security",
  "notifications",
  "assets",
];
const normalizeSection = (value: string): PersonalSection =>
  validSections.includes(value as PersonalSection) ? (value as PersonalSection) : "profile";
const tab = ref<PersonalSection>(normalizeSection(props.initialSection));
const notice = ref("");
const requestId = ref("");
const profile = ref<any>(null);
const authorization = ref<any>({ roles: [], capabilities: [], data_scopes: [] });
const sessions = ref<any[]>([]);
const preferences = ref<any>({
  version: 0,
  in_app_enabled: true,
  email_enabled: false,
  task_enabled: true,
  approval_enabled: true,
  competitor_enabled: true,
});
const assets = ref<any>({ followed_trends: [], decisions: [], tasks: [] });
const sectionsLoading = ref(false);
let loadSequence = 0;
const form = reactive({
  display_name: "",
  avatar_url: "",
  phone: "",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  reason: "更新个人资料",
});
const passwordForm = reactive({
  current_password: "",
  new_password: "",
  confirm_password: "",
});

async function call<T = any>(path: string, options?: ApiRequestOptions): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await request<T>(path, {
      ...options,
      signal: controller.signal,
    });
    requestId.value = response.request_id;
    return response.data ?? null;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      throw new Error(error.actionHint);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function load() {
  const sequence = ++loadSequence;
  state.value = "loading";
  notice.value = "";
  sectionsLoading.value = true;
  try {
    const loadedProfile = await call("/me/profile");
    if (sequence !== loadSequence) return;
    profile.value = loadedProfile;
    Object.assign(form, {
      display_name: profile.value.display_name,
      avatar_url: profile.value.avatar_url ?? "",
      phone: profile.value.phone ?? "",
      locale: profile.value.locale,
      timezone: profile.value.timezone,
      reason: "更新个人资料",
    });
    state.value = "ready";
    void loadSections(sequence);
  } catch (error) {
    if (sequence !== loadSequence) return;
    sectionsLoading.value = false;
    notice.value =
      error instanceof DOMException && error.name === "AbortError"
        ? "个人资料读取超时，请检查网络后重试。"
        : error instanceof Error
          ? error.message
          : "个人中心暂不可用";
    state.value = "error";
  }
}

async function loadSections(sequence: number) {
  try {
    const results = await Promise.allSettled([
      call("/me/authorization"),
      call("/me/sessions"),
      call("/me/notification-preferences"),
      call("/me/assets"),
    ]);
    if (sequence !== loadSequence) return;
    const [authorizationResult, sessionsResult, preferencesResult, assetsResult] = results;
    authorization.value =
      authorizationResult.status === "fulfilled"
        ? authorizationResult.value
        : { roles: [], capabilities: [], data_scopes: [] };
    sessions.value = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
    preferences.value =
      preferencesResult.status === "fulfilled"
        ? preferencesResult.value
        : {
            version: 0,
            in_app_enabled: true,
            email_enabled: false,
            task_enabled: true,
            approval_enabled: true,
            competitor_enabled: true,
          };
    assets.value =
      assetsResult.status === "fulfilled"
        ? assetsResult.value
        : { followed_trends: [], decisions: [], tasks: [] };
    const failed = results.filter((item) => item.status === "rejected").length;
    if (failed) notice.value = `个人资料已读取，另有 ${failed} 个分区暂不可用，可稍后刷新。`;
  } finally {
    if (sequence === loadSequence) sectionsLoading.value = false;
  }
}

async function saveProfile() {
  try {
    const result = await call("/me/profile", {
      method: "PATCH",
      body: {
        ...form,
        expected_version: profile.value.version,
      },
    });
    profile.value = { ...profile.value, ...result };
    notice.value = "个人资料已保存；手机号变化后保持未验证状态。";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "保存失败";
  }
}

async function savePreferences() {
  try {
    preferences.value = await call("/me/notification-preferences", {
      method: "PUT",
      body: {
        expected_version: preferences.value.version,
        in_app_enabled: preferences.value.in_app_enabled,
        email_enabled: preferences.value.email_enabled,
        task_enabled: preferences.value.task_enabled,
        approval_enabled: preferences.value.approval_enabled,
        competitor_enabled: preferences.value.competitor_enabled,
      },
    });
    notice.value = preferences.value.email_enabled
      ? "偏好已保存；邮件服务商未配置前只记录待投递状态。"
      : "通知偏好已保存。";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "保存失败";
  }
}

async function revokeSession(id: string) {
  try {
    await call(`/me/sessions/${id}`, { method: "DELETE" });
    sessions.value = sessions.value.filter((item) => item.id !== id);
    notice.value = "设备会话已撤销。";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "撤销失败";
  }
}
async function changePassword() {
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    notice.value = "两次输入的新密码不一致。";
    return;
  }
  try {
    await call("/me/password", {
      method: "POST",
      body: {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      },
    });
    window.location.assign("/login");
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "密码修改失败";
  }
}

const assetCount = computed(
  () =>
    assets.value.followed_trends.length + assets.value.decisions.length + assets.value.tasks.length,
);
const canManageOrganizationToken = computed(() =>
  authorization.value?.capabilities?.includes("organization_token:manage"),
);
const when = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("zh-CN", { hour12: false }) : "未设置";
const roleName = (value: string) =>
  (
    ({
      member: "成员",
      selection_manager: "选品负责人",
      procurement_member: "采购成员",
      organization_admin: "组织管理员",
    }) as Record<string, string>
  )[value] ?? "自定义角色";
const scopeName = (value: string) =>
  (
    ({
      organization: "整个组织",
      workspace: "当前工作区",
      team: "指定团队",
      self: "仅本人",
    }) as Record<string, string>
  )[value] ?? "指定范围";
const capabilityName = (value: string) =>
  (
    ({
      "task:read": "查看任务",
      "task:create": "创建任务",
      "task:update": "更新任务",
      "task:assign": "分配任务",
      "trend:read": "查看热点",
      "trend:follow": "关注热点",
      "opportunity:read": "查看机会",
      "opportunity:decide": "处理机会",
      "competitor:read": "查看竞品",
      "sourcing:read": "查看供应链",
      "report:read": "查看报表",
      "team:manage": "管理团队与规则",
    }) as Record<string, string>
  )[value] ?? "其他已授权操作";
const statusName = (value: string) =>
  (
    ({
      active: "使用中",
      revoked: "已撤销",
      expired: "已过期",
      todo: "待处理",
      in_progress: "进行中",
      completed: "已完成",
      cancelled: "已取消",
      low: "低",
      normal: "普通",
      high: "高",
      critical: "紧急",
    }) as Record<string, string>
  )[value] ?? value;
const decisionName = (value: string) =>
  (({ adopt: "采纳", observe: "继续观察", reject: "驳回" }) as Record<string, string>)[value] ??
  "已处理";
onMounted(() => void load());
watch(
  () => props.initialSection,
  (value) => {
    tab.value = normalizeSection(value);
  },
);
</script>

<template>
  <section class="personal-center" aria-live="polite">
    <header>
      <div>
        <p>个人中心</p>
        <h2>{{ profile?.display_name || "个人中心" }}</h2>
        <span>资料、权限、安全、通知和本人资产使用真实账号与当前组织数据。</span>
      </div>
      <button type="button" @click="load">刷新</button>
    </header>
    <p v-if="notice" class="personal-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <p v-else-if="state === 'ready' && sectionsLoading" class="personal-notice">
      基本资料已显示，正在后台读取权限、安全、通知和资产信息…
    </p>
    <section v-if="state !== 'ready'" class="personal-state">
      <h3>
        {{ state === "loading" ? "正在读取个人中心" : "个人中心暂不可用" }}
      </h3>
      <button v-if="state === 'error'" @click="load">重新加载</button>
    </section>
    <template v-else>
      <nav v-if="!accountShell" aria-label="个人中心分区">
        <button
          v-for="item in [
            { key: 'profile', name: '基本资料' },
            { key: 'permissions', name: '我的权限' },
            { key: 'security', name: '安全中心' },
            { key: 'notifications', name: '通知偏好' },
            { key: 'assets', name: `我的资产 ${assetCount}` },
          ]"
          :key="item.key"
          :class="{ on: tab === item.key }"
          @click="tab = item.key as any"
        >
          {{ item.name }}
        </button>
      </nav>
      <form
        v-if="tab === 'profile'"
        class="personal-card personal-form"
        @submit.prevent="saveProfile"
      >
        <h3>基本资料</h3>
        <label
          >邮箱<input :value="profile.email" disabled /><small>{{
            profile.email_verified_at ? "已验证" : "尚未验证"
          }}</small></label
        ><label>显示名称<input v-model="form.display_name" required maxlength="120" /></label
        ><label>头像 HTTPS 地址<input v-model="form.avatar_url" type="url" /></label
        ><label
          >手机号<input v-model="form.phone" inputmode="tel" /><small>{{
            profile.phone_verified_at ? "已验证" : "未验证；系统不会伪造短信验证结果"
          }}</small></label
        ><label
          >语言<select v-model="form.locale">
            <option value="zh-CN">简体中文</option>
          </select></label
        ><label>时区<input v-model="form.timezone" required /></label
        ><label>修改原因<textarea v-model="form.reason" required maxlength="300"></textarea></label
        ><button>保存资料</button>
      </form>
      <section v-else-if="tab === 'permissions'" class="personal-grid">
        <article class="personal-card">
          <h3>角色</h3>
          <span v-for="role in authorization.roles" :key="role">{{ roleName(role) }}</span>
        </article>
        <article class="personal-card">
          <h3>数据范围</h3>
          <span v-for="scope in authorization.data_scopes" :key="scope.scope + scope.scope_key"
            >{{ scopeName(scope.scope)
            }}<template v-if="scope.scope_key"> · 指定范围</template></span
          >
        </article>
        <article class="personal-card personal-wide">
          <h3>可执行动作</h3>
          <div class="personal-chips">
            <code v-for="capability in authorization.capabilities" :key="capability">{{
              capabilityName(capability)
            }}</code>
          </div>
          <a v-if="canManageOrganizationToken" href="/org-admin/tokens">管理组织令牌</a>
        </article>
      </section>
      <section v-else-if="tab === 'security'" class="personal-grid">
        <article class="personal-card">
          <h3>多因素认证</h3>
          <p>认证器绑定、恢复码和停用由独立安全页面处理。</p>
          <a href="/security/mfa">管理 MFA</a>
        </article>
        <form class="personal-card" @submit.prevent="changePassword">
          <h3>修改密码</h3>
          <label
            >当前密码<input
              v-model="passwordForm.current_password"
              type="password"
              autocomplete="current-password"
              required
              minlength="12" /></label
          ><label
            >新密码<input
              v-model="passwordForm.new_password"
              type="password"
              autocomplete="new-password"
              required
              minlength="12" /></label
          ><label
            >确认新密码<input
              v-model="passwordForm.confirm_password"
              type="password"
              autocomplete="new-password"
              required
              minlength="12" /></label
          ><button>修改并撤销全部会话</button>
        </form>
        <article class="personal-card personal-wide">
          <h3>设备会话</h3>
          <div v-for="session in sessions" :key="session.id" class="personal-line">
            <div>
              <b>{{ session.device_label }}</b
              ><small>{{ statusName(session.status) }} · {{ when(session.last_seen_at) }}</small>
            </div>
            <button @click="revokeSession(session.id)">撤销会话</button>
          </div>
          <p v-if="!sessions.length">暂无活动会话。</p>
        </article>
      </section>
      <form
        v-else-if="tab === 'notifications'"
        class="personal-card personal-form"
        @submit.prevent="savePreferences"
      >
        <h3>通知偏好</h3>
        <label><input v-model="preferences.in_app_enabled" type="checkbox" />站内通知</label
        ><label><input v-model="preferences.email_enabled" type="checkbox" />邮件通知</label
        ><label><input v-model="preferences.task_enabled" type="checkbox" />任务通知</label
        ><label><input v-model="preferences.approval_enabled" type="checkbox" />审批通知</label
        ><label><input v-model="preferences.competitor_enabled" type="checkbox" />竞品通知</label
        ><button>保存偏好</button>
      </form>
      <section v-else class="personal-grid">
        <article class="personal-card">
          <h3>关注热点</h3>
          <div v-for="item in assets.followed_trends" :key="item.id" class="personal-line">
            <a :href="`/trends?topic=${item.id}`">{{ item.title }}</a
            ><small>{{ item.market }} · {{ when(item.created_at) }}</small>
          </div>
          <p v-if="!assets.followed_trends.length">暂无关注热点。</p>
        </article>
        <article class="personal-card">
          <h3>我的决策</h3>
          <div v-for="item in assets.decisions" :key="item.id" class="personal-line">
            <a :href="`/opportunities/${item.opportunity_id}`">{{ item.opportunity_name }}</a
            ><small>{{ decisionName(item.action) }} · {{ when(item.created_at) }}</small>
          </div>
          <p v-if="!assets.decisions.length">暂无人工决策。</p>
        </article>
        <article class="personal-card personal-wide">
          <h3>我的任务</h3>
          <div v-for="item in assets.tasks" :key="item.id" class="personal-line">
            <a href="/tasks">{{ item.title }}</a
            ><small
              >{{ statusName(item.status) }} · {{ statusName(item.priority) }} ·
              {{ when(item.due_at) }}</small
            >
          </div>
          <p v-if="!assets.tasks.length">暂无本人任务。</p>
        </article>
      </section>
    </template>
  </section>
</template>

<style scoped>
.personal-center {
  display: grid;
  gap: 16px;
  color: var(--so-text);
}
.personal-center > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 20px;
  background:
    radial-gradient(circle at 82% 20%, var(--so-glow), transparent 36%),
    linear-gradient(135deg, var(--so-panel), var(--so-bg-elevated));
}
.personal-center header p {
  margin: 0;
  color: var(--so-primary);
  font: 800 11px monospace;
  letter-spacing: 0.15em;
}
.personal-center header h2 {
  margin: 6px 0;
  font-size: 30px;
}
.personal-center header span {
  color: var(--so-text-muted);
}
button,
.personal-center input,
.personal-center select,
.personal-center textarea {
  box-sizing: border-box;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  padding: 9px 12px;
  background: var(--so-panel-soft);
  color: var(--so-text);
  font: inherit;
}
.personal-center button {
  cursor: pointer;
}
.personal-center > nav {
  display: flex;
  gap: 8px;
  overflow: auto;
}
.personal-center > nav .on,
.personal-center form > button,
.personal-center > header button {
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 800;
}
.personal-card,
.personal-state,
.personal-notice {
  padding: 20px;
  border: 1px solid var(--so-border);
  border-radius: 15px;
  background: var(--so-panel);
}
.personal-notice {
  color: var(--so-success);
}
.personal-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}
.personal-form h3,
.personal-form > button,
.personal-form label:last-of-type {
  grid-column: 1/-1;
}
.personal-form label {
  display: grid;
  gap: 6px;
  color: var(--so-text-muted);
}
.personal-form label:has(input[type="checkbox"]) {
  display: flex;
  align-items: center;
}
.personal-form input[type="checkbox"] {
  width: auto;
}
.personal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.personal-wide {
  grid-column: 1/-1;
}
.personal-card > span {
  display: block;
  margin: 8px 0;
}
.personal-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.personal-chips code {
  padding: 6px 8px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--so-primary) 10%, var(--so-panel-soft));
  color: var(--so-primary);
}
.personal-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--so-border);
}
.personal-line small {
  display: block;
  color: var(--so-text-muted);
}
.personal-center a {
  color: var(--so-primary);
}
@media (max-width: 700px) {
  .personal-center > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .personal-form,
  .personal-grid {
    grid-template-columns: 1fr;
  }
  .personal-form h3,
  .personal-form > button,
  .personal-form label:last-of-type,
  .personal-wide {
    grid-column: auto;
  }
  .personal-line {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
