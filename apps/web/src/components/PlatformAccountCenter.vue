<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type { RoleCapabilitySummary } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import AppIcon from "./AppIcon.vue";
import OrganizationCreationWizard from "./OrganizationCreationWizard.vue";
import PlatformAdminRecords from "./PlatformAdminRecords.vue";
import PlatformOrganizationRecords from "./PlatformOrganizationRecords.vue";
import PlatformOrganizationDetailDialog from "./PlatformOrganizationDetailDialog.vue";
import PlatformRoleComparison from "./PlatformRoleComparison.vue";
import PlatformUserDetailDialog from "./PlatformUserDetailDialog.vue";
import PlatformUserRecords from "./PlatformUserRecords.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
type Tab = "organizations" | "users" | "admins";
type State = "loading" | "ready" | "empty" | "error";
interface Data {
  summary: {
    organizations: number;
    active_organizations: number;
    users: number;
    active_users: number;
    platform_admins: number;
  };
  organizations: any[];
  users: any[];
  admins: any[];
}
const props = withDefaults(
    defineProps<{
      apiBaseUrl: string;
      initialTab?: Tab;
      routePath?: string;
      organizationId?: string;
    }>(),
    {
      initialTab: "organizations",
      routePath: "/platform-admin/organizations",
      organizationId: "",
    },
  ),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  tab = ref<Tab>(props.initialTab),
  data = ref<Data | null>(null),
  platformRoles = ref<RoleCapabilitySummary[]>([]),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  refreshing = ref(false),
  rolesLoading = ref(false),
  lastUpdatedAt = ref<Date | null>(null),
  busy = ref(""),
  createError = ref(""),
  createUserOpen = ref(false),
  createOrganizationButton = ref<HTMLButtonElement | null>(null),
  organizationDetailOpen = ref(false),
  detailOpen = ref(false),
  passwordOpen = ref(false),
  reasonOpen = ref(false),
  reasonTitle = ref("确认操作"),
  reasonText = ref("平台管理员人工操作"),
  pendingReasonAction = ref<null | ((value: string) => Promise<void>)>(null),
  selected = ref<any>(null),
  detail = ref<any>(null),
  createOpen = ref(props.routePath.endsWith("/new")),
  form = reactive({ name: "", slug: "", initial_admin_user_id: "" }),
  organizationForm = reactive({
    name: "",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
  }),
  userForm = reactive({
    email: "",
    temporary_password: "",
    platform_role_code: "",
    organization_id: "",
    organization_role_code: "member",
  }),
  passwordForm = reactive({ temporary_password: "" });
const { dialogElement: createUserDialogElement, handleCancel: handleCreateUserCancel } =
    useModalDialog(
      () => createUserOpen.value,
      () => (createUserOpen.value = false),
    ),
  { dialogElement: passwordDialogElement, handleCancel: handlePasswordCancel } = useModalDialog(
    () => passwordOpen.value,
    () => (passwordOpen.value = false),
  ),
  { dialogElement: reasonDialogElement, handleCancel: handleReasonCancel } = useModalDialog(
    () => reasonOpen.value,
    () => cancelReason(),
  );
watch(
  () => props.initialTab,
  (value) => {
    tab.value = value;
    if (value === "admins" && !platformRoles.value.length) void loadPlatformRoles();
  },
);
watch(
  () => [props.routePath, props.organizationId],
  () => syncOrganizationRoute(),
);
const rows = computed(() =>
    tab.value === "organizations"
      ? (data.value?.organizations ?? [])
      : tab.value === "users"
        ? (data.value?.users ?? [])
        : (data.value?.admins ?? []),
  ),
  organizationListRoute = computed(
    () => props.routePath === "/platform-admin/organizations" && tab.value === "organizations",
  ),
  organizationEmptyState = computed(
    () =>
      !rows.value.length &&
      tab.value === "organizations" &&
      (props.routePath === "/platform-admin/accounts" || organizationListRoute.value),
  ),
  filterLabel = computed(() => (organizationListRoute.value ? "组织筛选" : "账号筛选")),
  searchPlaceholder = computed(() =>
    organizationListRoute.value ? "搜索组织名称或标识" : "搜索组织名称或用户邮箱",
  ),
  statusLabel = computed(() => (organizationListRoute.value ? "组织状态" : "账号状态")),
  activeFilterCount = computed(
    () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
  ),
  updatedText = computed(() =>
    lastUpdatedAt.value
      ? `最近更新 ${lastUpdatedAt.value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "尚未完成读取",
  ),
  statusText = (v: string) =>
    (
      ({
        active: "正常使用",
        archived: "已停用",
        disabled: "已停用",
        locked: "已锁定",
        pending_verification: "待验证",
        revoked: "已撤销",
        expired: "已过期",
      }) as Record<string, string>
    )[v] ?? v,
  roleText = (v: string) =>
    (
      ({
        platform_super_admin: "超级管理员",
        platform_operations_admin: "运营管理员",
        platform_security_admin: "安全管理员",
        organization_admin: "组织管理员",
        member: "普通成员",
        selection_manager: "选品经理",
        procurement_member: "采购成员",
        auditor: "审计员",
      }) as Record<string, string>
    )[v] ?? v;
async function loadPlatformRoles() {
  if (rolesLoading.value) return;
  rolesLoading.value = true;
  try {
    const response = await request<RoleCapabilitySummary[]>("/platform/roles");
    platformRoles.value = response.data;
  } catch (e) {
    message.value = `${e instanceof ApiClientError ? e.actionHint : "角色目录读取失败"} 账号记录仍可继续使用。`;
  } finally {
    rolesLoading.value = false;
  }
}
async function load() {
  if (refreshing.value) return;
  const hadData = Boolean(data.value);
  if (!hadData) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const p = new URLSearchParams();
    if (query.value.trim()) p.set("query", query.value.trim());
    if (status.value) p.set("status", status.value);
    const accountResponse = await request<Data>(`/platform/accounts?${p}`, {
      signal: controller.signal,
    });
    data.value = accountResponse.data;
    state.value = "ready";
    lastUpdatedAt.value = new Date();
    syncOrganizationRoute();
    if (tab.value === "admins") await loadPlatformRoles();
  } catch (e) {
    const action =
      e instanceof DOMException && e.name === "AbortError"
        ? "读取超过 12 秒，请稍后重试。"
        : e instanceof ApiClientError
          ? e.actionHint
          : "读取失败";
    message.value = hadData ? `${action} 已保留上次成功读取的数据。` : action;
    state.value = hadData ? "ready" : "error";
  } finally {
    window.clearTimeout(timeout);
    refreshing.value = false;
  }
}
async function resetFilters() {
  query.value = "";
  status.value = "";
  await load();
}
async function write<T = unknown>(
  path: string,
  body: unknown,
  method = "POST",
  onError?: (value: string) => void,
) {
  busy.value = path;
  message.value = "";
  try {
    const response = await request<T>(path, { method, body });
    await load();
    return response.data;
  } catch (e) {
    const action = e instanceof ApiClientError ? e.actionHint : "操作失败";
    if (onError) onError(action);
    else message.value = action;
    return null;
  } finally {
    busy.value = "";
  }
}
async function createOrganization() {
  if (busy.value) return;
  createError.value = "";
  const body = {
    name: form.name,
    slug: form.slug,
    ...(form.initial_admin_user_id ? { initial_admin_user_id: form.initial_admin_user_id } : {}),
  };
  const created = await write<any>(
    "/platform/accounts/organizations",
    body,
    "POST",
    (value) => (createError.value = value),
  );
  if (created) {
    form.name = "";
    form.slug = "";
    form.initial_admin_user_id = "";
    createOpen.value = false;
    const organization =
      data.value?.organizations.find((item) => item.id === created.id) ?? created;
    showOrganization(organization);
    await router.replace(`/platform-admin/organizations/${created.id}`);
    message.value = "组织和默认工作区已创建，已进入组织详情。";
  }
}
async function openOrganizationWizard() {
  createError.value = "";
  createOpen.value = true;
  await router.push("/platform-admin/organizations/new");
}
async function closeOrganizationWizard() {
  createError.value = "";
  createOpen.value = false;
  await router.replace("/platform-admin/organizations");
  await nextTick();
  createOrganizationButton.value?.focus();
}
function askReason(title: string, action: (value: string) => Promise<void>) {
  reasonTitle.value = title;
  reasonText.value = "平台管理员人工操作";
  pendingReasonAction.value = action;
  reasonOpen.value = true;
}
async function submitReason() {
  const value = reasonText.value.trim();
  if (value.length < 2 || !pendingReasonAction.value) return;
  const action = pendingReasonAction.value;
  reasonOpen.value = false;
  pendingReasonAction.value = null;
  await action(value);
}
function cancelReason() {
  reasonOpen.value = false;
  pendingReasonAction.value = null;
}
async function toggleOrganization(item: any) {
  askReason(item.status === "active" ? "停用组织" : "恢复组织", async (why) => {
    if (
      await write(`/platform/accounts/organizations/${item.id}/status`, {
        status: item.status === "active" ? "archived" : "active",
        reason: why,
      })
    ) {
      const updated = data.value?.organizations.find((row) => row.id === item.id);
      if (updated) showOrganization(updated);
    }
  });
}
async function toggleUser(item: any) {
  askReason(item.status === "active" ? "停用用户并撤销会话" : "恢复用户", async (why) => {
    if (
      await write(`/platform/accounts/users/${item.id}/status`, {
        status: item.status === "active" ? "disabled" : "active",
        reason: why,
      })
    ) {
      const updated = [...(data.value?.users ?? []), ...(data.value?.admins ?? [])].find(
        (row) => row.id === item.id,
      );
      if (updated && detailOpen.value) await openUserDetail(updated);
    }
  });
}
async function role(userId: string, roleCode: string, enabled: boolean) {
  askReason(`${enabled ? "授予" : "撤销"}${roleText(roleCode)}`, async (why) => {
    if (
      await write(`/platform/accounts/users/${userId}/platform-role`, {
        role_code: roleCode,
        enabled,
        reason: why,
      })
    ) {
      const updated = [...(data.value?.users ?? []), ...(data.value?.admins ?? [])].find(
        (row) => row.id === userId,
      );
      if (updated && detailOpen.value) await openUserDetail(updated);
    }
  });
}
function showOrganization(item: any) {
  selected.value = item;
  organizationForm.name = item.name;
  organizationForm.timezone = item.timezone || "Asia/Shanghai";
  organizationForm.data_retention_days = Number(item.data_retention_days || 365);
  organizationDetailOpen.value = true;
}
async function openOrganization(item: any) {
  showOrganization(item);
  await router.push(`/platform-admin/organizations/${item.id}`);
}
async function closeOrganizationDetail() {
  organizationDetailOpen.value = false;
  await router.replace("/platform-admin/organizations");
}
function syncOrganizationRoute() {
  if (props.routePath.endsWith("/new")) {
    createOpen.value = true;
    organizationDetailOpen.value = false;
    return;
  }
  createOpen.value = false;
  if (props.organizationId && data.value) {
    const organization = data.value.organizations.find((item) => item.id === props.organizationId);
    if (organization) showOrganization(organization);
    return;
  }
  organizationDetailOpen.value = false;
}
async function updateOrganization() {
  if (!selected.value) return;
  askReason("保存组织资料", async (why) => {
    if (
      await write(
        `/platform/accounts/organizations/${selected.value.id}`,
        { ...organizationForm, reason: why },
        "PATCH",
      )
    ) {
      const updated = data.value?.organizations.find((item) => item.id === selected.value.id);
      if (updated) showOrganization(updated);
      message.value = "组织资料已更新。";
    }
  });
}
function openCreateUser(asAdmin = false) {
  userForm.email = "";
  userForm.temporary_password = "";
  userForm.platform_role_code = asAdmin ? "platform_operations_admin" : "";
  userForm.organization_id = "";
  userForm.organization_role_code = "member";
  createUserOpen.value = true;
}
async function createUser() {
  if (
    await write("/platform/accounts/users", {
      ...userForm,
      organization_id: userForm.organization_id || null,
      platform_role_code: userForm.platform_role_code || null,
    })
  ) {
    createUserOpen.value = false;
    message.value = "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
  }
}
async function openUserDetail(item: any) {
  selected.value = item;
  detail.value = null;
  detailOpen.value = true;
  try {
    const response = await request<any>(`/platform/accounts/users/${item.id}`);
    detail.value = response.data;
  } catch (e) {
    message.value = e instanceof ApiClientError ? e.actionHint : "读取详情失败";
    detailOpen.value = false;
  }
}
function openPassword(item: any) {
  selected.value = item;
  passwordForm.temporary_password = "";
  passwordOpen.value = true;
}
async function resetPassword() {
  if (!selected.value) return;
  askReason("强制重置密码并撤销全部会话", async (why) => {
    if (
      await write(`/platform/accounts/users/${selected.value.id}/password`, {
        temporary_password: passwordForm.temporary_password,
        reason: why,
      })
    ) {
      passwordOpen.value = false;
      detailOpen.value = false;
      message.value = "临时密码已更新，全部活动会话已撤销。";
    }
  });
}
function revokeSessions(item: any, sessionId: string | null = null) {
  askReason(sessionId ? "撤销该会话" : "撤销全部活动会话", async (why) => {
    if (
      await write(`/platform/accounts/users/${item.id}/sessions/revoke`, {
        session_id: sessionId,
        reason: why,
      })
    ) {
      message.value = "会话已撤销。";
      if (detailOpen.value) await openUserDetail(item);
    }
  });
}
onMounted(load);
</script>
<template>
  <section class="account-center">
    <header class="account-hero">
      <div>
        <p>{{ organizationListRoute ? "平台组织" : "组织与用户" }}</p>
        <h2>
          {{
            organizationListRoute ? "组织、状态与隔离边界，一眼看懂" : "谁在使用智能选品，一眼看懂"
          }}
        </h2>
        <span>{{
          organizationListRoute
            ? "核对成员与工作区数量，进入详情维护资料、停用或恢复。所有操作都会留审计记录。"
            : "创建组织、启停账号、分配平台管理员。所有操作都会留审计记录。"
        }}</span>
      </div>
      <div class="hero-actions">
        <button ref="createOrganizationButton" @click="openOrganizationWizard">
          <AppIcon name="plus" /> 新建组织</button
        ><button @click="openCreateUser(tab === 'admins')">
          <AppIcon name="plus" /> {{ tab === "admins" ? "新建管理员" : "新建用户" }}</button
        ><button class="secondary" :disabled="refreshing || Boolean(busy)" @click="load">
          {{ refreshing ? "正在刷新…" : "刷新数据" }}
        </button>
      </div>
    </header>
    <div v-if="data" class="account-metrics">
      <article>
        <small>组织</small
        ><strong>{{ data.summary.active_organizations }} / {{ data.summary.organizations }}</strong
        ><span>正常 / 全部</span>
      </article>
      <article>
        <small>用户</small
        ><strong>{{ data.summary.active_users }} / {{ data.summary.users }}</strong
        ><span>可登录 / 全部</span>
      </article>
      <article>
        <small>平台管理员</small><strong>{{ data.summary.platform_admins }}</strong
        ><span>拥有平台后台权限</span>
      </article>
    </div>
    <nav class="account-tabs" aria-label="账号与组织二级导航">
      <RouterLink
        to="/platform-admin/organizations"
        :class="{ on: tab === 'organizations' }"
        :aria-current="tab === 'organizations' ? 'page' : undefined"
        >组织管理</RouterLink
      ><RouterLink
        to="/platform-admin/users"
        :class="{ on: tab === 'users' }"
        :aria-current="tab === 'users' ? 'page' : undefined"
        >用户管理</RouterLink
      ><RouterLink
        to="/platform-admin/admins"
        :class="{ on: tab === 'admins' }"
        :aria-current="tab === 'admins' ? 'page' : undefined"
        >管理员管理</RouterLink
      >
    </nav>
    <ResponsiveFilterDrawer :label="filterLabel" :active-count="activeFilterCount">
      <form class="account-filter" @submit.prevent="load">
        <input v-model="query" :placeholder="searchPlaceholder" /><select
          v-model="status"
          :aria-label="statusLabel"
        >
          <option value="">全部状态</option>
          <option value="active">正常使用</option>
          <option v-if="!organizationListRoute" value="disabled">已停用</option>
          <option v-if="tab === 'organizations'" value="archived">已停用组织</option></select
        ><button :disabled="refreshing">搜索</button
        ><button
          type="button"
          class="secondary"
          :disabled="!activeFilterCount || refreshing"
          @click="resetFilters"
        >
          重置
        </button>
      </form>
    </ResponsiveFilterDrawer>
    <p class="account-updated" aria-live="polite">{{ updatedText }}</p>
    <p v-if="message" class="account-message">{{ message }}</p>
    <section v-if="state === 'loading'" class="account-state">正在读取真实组织与用户…</section>
    <section v-else-if="state === 'error'" class="account-state">
      暂时无法读取。<button @click="load">重新加载</button>
    </section>
    <template v-else>
      <PlatformRoleComparison
        v-if="tab === 'admins' && platformRoles.length"
        :roles="platformRoles"
      />
      <section v-if="organizationEmptyState" class="account-empty" aria-live="polite">
        <strong>{{ activeFilterCount ? "没有符合当前条件的组织" : "还没有组织" }}</strong>
        <span>{{
          activeFilterCount
            ? "调整组织名称、标识或状态筛选后重试。"
            : "创建首个组织后，系统会同时建立默认工作区和组织级数据范围。"
        }}</span>
        <button v-if="activeFilterCount" type="button" @click="resetFilters">清除筛选</button>
        <button v-else-if="organizationListRoute" type="button" @click="openOrganizationWizard">
          新建组织
        </button>
      </section>
      <PlatformOrganizationRecords
        v-else-if="tab === 'organizations'"
        :rows="rows"
        :busy="Boolean(busy)"
        :status-text="statusText"
        @open-organization="openOrganization"
      />
      <PlatformUserRecords
        v-else-if="tab === 'users'"
        :rows="rows"
        :status-text="statusText"
        :role-text="roleText"
        @open-user="openUserDetail"
      />
      <PlatformAdminRecords v-else :rows="rows" @open-user="openUserDetail" />
    </template>
    <OrganizationCreationWizard
      :open="createOpen"
      :busy="Boolean(busy)"
      :error-message="createError"
      :users="data?.users || []"
      :form="form"
      @clear-error="createError = ''"
      @close="closeOrganizationWizard"
      @submit="createOrganization"
    />
    <dialog
      ref="createUserDialogElement"
      aria-label="新建用户或平台管理员"
      @cancel="handleCreateUserCancel"
    >
      <form @submit.prevent="createUser">
        <h3>新建用户或平台管理员</h3>
        <p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p>
        <label>邮箱<input v-model="userForm.email" type="email" required maxlength="254" /></label>
        <label
          >临时密码<input
            v-model="userForm.temporary_password"
            type="password"
            required
            minlength="12"
            autocomplete="new-password"
        /></label>
        <label
          >平台角色<select v-model="userForm.platform_role_code">
            <option value="">普通用户</option>
            <option value="platform_operations_admin">运营管理员</option>
            <option value="platform_security_admin">安全管理员</option>
            <option value="platform_super_admin">超级管理员</option>
          </select></label
        >
        <label
          >加入组织<select v-model="userForm.organization_id">
            <option value="">暂不加入组织</option>
            <option
              v-for="item in data?.organizations || []"
              :key="item.id"
              :value="item.id"
              :disabled="item.status !== 'active'"
            >
              {{ item.name }}
            </option>
          </select></label
        >
        <label v-if="userForm.organization_id"
          >组织角色<select v-model="userForm.organization_role_code">
            <option value="member">普通成员</option>
            <option value="organization_admin">组织管理员</option>
          </select></label
        >
        <footer>
          <button type="button" @click="createUserOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认创建</button>
        </footer>
      </form>
    </dialog>
    <PlatformOrganizationDetailDialog
      :open="organizationDetailOpen"
      :organization="selected"
      :form="organizationForm"
      :busy="Boolean(busy)"
      :status-text="statusText"
      @close="closeOrganizationDetail"
      @save="updateOrganization"
      @toggle-status="toggleOrganization"
    />
    <PlatformUserDetailDialog
      :open="detailOpen"
      :detail="detail"
      :selected="selected"
      :status-text="statusText"
      :role-text="roleText"
      @close="detailOpen = false"
      @toggle-status="toggleUser"
      @role="role"
      @reset-password="openPassword"
      @revoke-sessions="revokeSessions"
    />
    <dialog ref="passwordDialogElement" aria-label="强制重置密码" @cancel="handlePasswordCancel">
      <form @submit.prevent="resetPassword">
        <h3>强制重置密码</h3>
        <p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p>
        <label
          >新临时密码<input
            v-model="passwordForm.temporary_password"
            type="password"
            required
            minlength="12"
            autocomplete="new-password"
        /></label>
        <footer>
          <button type="button" @click="passwordOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认重置</button>
        </footer>
      </form>
    </dialog>
    <dialog ref="reasonDialogElement" :aria-label="reasonTitle" @cancel="handleReasonCancel">
      <form @submit.prevent="submitReason">
        <h3>{{ reasonTitle }}</h3>
        <p>原因会写入平台审计记录。</p>
        <label
          >操作原因<textarea v-model="reasonText" required minlength="2" maxlength="300"></textarea>
        </label>
        <footer>
          <button type="button" @click="reasonOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认执行</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
<style scoped>
.account-center {
  display: grid;
  gap: 18px;
  color: var(--so-text);
}
.account-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
  color: var(--so-text);
}
.account-hero p {
  margin: 0;
  color: var(--so-primary);
  font-weight: 800;
}
.account-hero h2 {
  margin: 6px 0;
  font-size: 28px;
}
.account-hero span {
  color: var(--so-text-muted);
}
.account-hero button,
.account-filter button {
  border: 0;
  border-radius: 10px;
  padding: 11px 16px;
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 800;
}
.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.hero-actions button:last-child {
  background: var(--so-panel-soft);
  color: var(--so-text);
  border: 1px solid var(--so-border-strong);
}
.hero-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.hero-actions button:disabled,
.account-filter button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
.account-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.account-metrics article {
  padding: 18px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
  color: var(--so-text);
}
.account-metrics small,
.account-metrics span {
  display: block;
  color: var(--so-text-muted);
}
.account-metrics strong {
  display: block;
  font-size: 28px;
  margin: 5px 0;
  color: var(--so-text);
}
.account-tabs {
  display: flex;
  gap: 8px;
}
.account-tabs a {
  text-decoration: none;
  border: 1px solid var(--so-border-strong);
  border-radius: 999px;
  padding: 9px 15px;
  background: var(--so-panel);
  color: var(--so-text);
}
.account-tabs a.on {
  border-color: var(--so-primary);
  background: var(--so-primary);
  color: var(--so-on-primary);
}
.account-filter {
  display: flex;
  gap: 10px;
}
.account-filter input,
.account-filter select {
  min-width: 180px;
  padding: 10px;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
}
.account-filter button.secondary {
  color: var(--so-text);
  background: var(--so-panel);
  border: 1px solid var(--so-border-strong);
}
.account-updated {
  margin: -8px 0 0;
  color: var(--so-text-muted);
  font-size: 13px;
  text-align: right;
}
.account-empty {
  padding: 28px;
  display: grid;
  justify-items: start;
  gap: 8px;
  border: 1px dashed var(--so-border-strong);
  border-radius: 14px;
  color: var(--so-text);
  background: var(--so-panel);
}
.account-empty span {
  color: var(--so-text-muted);
}
.account-empty button {
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
}
.account-table-wrap {
  background: var(--so-panel);
  border: 1px solid var(--so-border);
  border-radius: 14px;
  color: var(--so-text);
}
table {
  width: 100%;
  border-collapse: collapse;
  color: var(--so-text);
}
th,
td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid var(--so-border);
}
th {
  color: var(--so-text-muted);
}
td strong,
td small {
  display: block;
}
td strong {
  color: var(--so-text);
}
td small {
  color: var(--so-text-muted);
  margin-top: 4px;
}
td button {
  margin: 2px;
  border: 1px solid var(--so-border-strong);
  background: var(--so-bg-elevated);
  color: var(--so-text);
  border-radius: 8px;
  padding: 7px 10px;
}
td b[data-status="active"] {
  color: var(--so-success);
}
td b[data-status="disabled"],
td b[data-status="archived"] {
  color: var(--so-danger);
}
.mobile-actions {
  display: grid;
  gap: 8px;
}
.account-state,
.account-message {
  padding: 18px;
  text-align: center;
}
.account-message {
  background: var(--so-warning-soft);
  color: var(--so-warning);
  border-radius: 10px;
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 0;
  border-radius: 16px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  border: 1px solid var(--so-border-strong);
  box-shadow: 0 24px 80px color-mix(in srgb, var(--so-shadow-color) 40%, transparent);
  z-index: 10;
}
dialog::backdrop {
  background: color-mix(in srgb, var(--so-bg) 70%, transparent);
  backdrop-filter: blur(4px);
}
dialog form {
  display: grid;
  gap: 14px;
  min-width: 340px;
  padding: 10px;
}
dialog label {
  display: grid;
  gap: 6px;
}
dialog input,
dialog select,
dialog textarea {
  padding: 10px;
  color: var(--so-text);
  background: var(--so-panel-soft);
  border: 1px solid var(--so-border-strong);
  border-radius: 8px;
}
dialog textarea {
  min-height: 90px;
  resize: vertical;
}
dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 700px) {
  .account-center {
    padding-bottom: 76px;
  }
  .account-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .account-metrics {
    grid-template-columns: 1fr;
  }
  .account-filter {
    flex-direction: column;
  }
  .account-tabs {
    overflow: auto;
  }
  .account-table-wrap {
    padding: 0;
    background: transparent;
    border: 0;
  }
  dialog {
    width: calc(100% - 28px);
  }
  dialog form {
    min-width: 0;
  }
}
</style>
