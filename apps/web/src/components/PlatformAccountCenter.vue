<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RoleCapabilitySummary } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import AppIcon from "./AppIcon.vue";
import OrganizationCreationWizard from "./OrganizationCreationWizard.vue";
import PlatformAccountDialogs from "./PlatformAccountDialogs.vue";
import PlatformAdminRecords from "./PlatformAdminRecords.vue";
import PlatformOrganizationRecords from "./PlatformOrganizationRecords.vue";
import PlatformOrganizationDetailDialog from "./PlatformOrganizationDetailDialog.vue";
import PlatformRoleComparison from "./PlatformRoleComparison.vue";
import PlatformUserDetailDialog from "./PlatformUserDetailDialog.vue";
import PlatformUserRecords from "./PlatformUserRecords.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
type Tab = "organizations" | "users" | "admins";
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
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<"loading" | "ready" | "empty" | "error">("loading"),
  tab = ref<Tab>(props.initialTab),
  data = ref<Data | null>(null),
  platformRoles = ref<RoleCapabilitySummary[]>([]),
  query = ref(typeof route.query.query === "string" ? route.query.query.slice(0, 120) : ""),
  status = ref(typeof route.query.status === "string" ? route.query.status.slice(0, 30) : ""),
  message = ref(""),
  rolesError = ref(""),
  refreshing = ref(false),
  rolesLoading = ref(false),
  lastUpdatedAt = ref<Date | null>(null),
  busy = ref(""),
  createError = ref(""),
  createUserError = ref(""),
  createUserOpen = ref(false),
  createOrganizationButton = ref<HTMLButtonElement | null>(null),
  organizationDetailOpen = ref(false),
  organizationMissing = ref(false),
  organizationError = ref(""),
  organizationSuccess = ref(""),
  detailOpen = ref(false),
  detailError = ref(""),
  detailSuccess = ref(""),
  passwordOpen = ref(false),
  passwordError = ref(""),
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
watch(
  () => [route.query.query, route.query.status],
  ([routeQuery, routeStatus]) => {
    const nextQuery = typeof routeQuery === "string" ? routeQuery.slice(0, 120) : "";
    const nextStatus = typeof routeStatus === "string" ? routeStatus.slice(0, 30) : "";
    if (nextQuery !== query.value) query.value = nextQuery;
    if (nextStatus !== status.value) status.value = nextStatus;
    void load();
  },
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
  accountOverviewRoute = computed(() => props.routePath === "/platform-admin/accounts"),
  permissionsRoute = computed(() => props.routePath === "/platform-admin/permissions"),
  adminListRoute = computed(
    () => props.routePath === "/platform-admin/admins" && tab.value === "admins",
  ),
  organizationEmptyState = computed(
    () =>
      !rows.value.length &&
      tab.value === "organizations" &&
      (props.routePath === "/platform-admin/accounts" || organizationListRoute.value),
  ),
  adminEmptyState = computed(() => adminListRoute.value && !rows.value.length),
  filterLabel = computed(() =>
    organizationListRoute.value ? "组织筛选" : adminListRoute.value ? "管理员筛选" : "账号筛选",
  ),
  searchPlaceholder = computed(() =>
    organizationListRoute.value
      ? "搜索组织名称或标识"
      : adminListRoute.value
        ? "搜索管理员邮箱"
        : accountOverviewRoute.value
          ? "搜索组织名称或用户邮箱"
          : "搜索用户邮箱",
  ),
  statusLabel = computed(() =>
    organizationListRoute.value ? "组织状态" : adminListRoute.value ? "管理员状态" : "账号状态",
  ),
  activeFilterCount = computed(
    () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
  ),
  updatedText = computed(() =>
    lastUpdatedAt.value
      ? `最近更新 ${lastUpdatedAt.value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "尚未完成读取",
  ),
  permissionCapabilityCount = computed(
    () => new Set(platformRoles.value.flatMap((role) => role.capabilities)).size,
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
  if (rolesLoading.value) return false;
  const hadRoles = platformRoles.value.length > 0;
  rolesLoading.value = true;
  rolesError.value = "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await request<RoleCapabilitySummary[]>("/platform/roles", {
      signal: controller.signal,
    });
    platformRoles.value = response.data;
    if (permissionsRoute.value) lastUpdatedAt.value = new Date();
    return true;
  } catch (e) {
    const action =
      e instanceof DOMException && e.name === "AbortError"
        ? "角色目录读取超过 12 秒，请稍后重试。"
        : e instanceof ApiClientError
          ? e.actionHint
          : "角色目录读取失败";
    rolesError.value = hadRoles ? `${action} 已保留上次成功读取的权限矩阵。` : action;
    if (!permissionsRoute.value) message.value = `${action} 账号记录仍可继续使用。`;
    return false;
  } finally {
    window.clearTimeout(timeout);
    rolesLoading.value = false;
  }
}
async function load() {
  if (permissionsRoute.value) {
    if (rolesLoading.value) return;
    if (!platformRoles.value.length) state.value = "loading";
    const loaded = await loadPlatformRoles();
    state.value = loaded
      ? platformRoles.value.length
        ? "ready"
        : "empty"
      : platformRoles.value.length
        ? "ready"
        : "error";
    return;
  }
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
async function applyFilters() {
  const nextQuery = { ...route.query } as Record<string, string | string[] | null | undefined>;
  if (query.value.trim()) nextQuery.query = query.value.trim();
  else delete nextQuery.query;
  if (status.value) nextQuery.status = status.value;
  else delete nextQuery.status;
  const currentQuery = typeof route.query.query === "string" ? route.query.query : "";
  const currentStatus = typeof route.query.status === "string" ? route.query.status : "";
  if (currentQuery === (nextQuery.query ?? "") && currentStatus === (nextQuery.status ?? "")) {
    await load();
    return;
  }
  await router.replace({ query: nextQuery });
}
async function resetFilters() {
  query.value = "";
  status.value = "";
  await applyFilters();
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
  clearOrganizationFeedback();
  askReason(item.status === "active" ? "停用组织" : "恢复组织", async (why) => {
    if (
      await write(
        `/platform/accounts/organizations/${item.id}/status`,
        {
          status: item.status === "active" ? "archived" : "active",
          reason: why,
        },
        "POST",
        (value) => (organizationError.value = value),
      )
    ) {
      const updated = data.value?.organizations.find((row) => row.id === item.id);
      if (updated) showOrganization(updated);
      organizationSuccess.value = item.status === "active" ? "组织已停用。" : "组织已恢复。";
    }
  });
}
async function toggleUser(item: any) {
  clearDetailFeedback();
  askReason(item.status === "active" ? "停用用户并撤销会话" : "恢复用户", async (why) => {
    if (
      await write(
        `/platform/accounts/users/${item.id}/status`,
        {
          status: item.status === "active" ? "disabled" : "active",
          reason: why,
        },
        "POST",
        (value) => (detailError.value = value),
      )
    ) {
      const updated = [...(data.value?.users ?? []), ...(data.value?.admins ?? [])].find(
        (row) => row.id === item.id,
      );
      detailSuccess.value =
        item.status === "active" ? "账号已停用，活动会话已撤销。" : "账号已恢复登录。";
      if (updated && detailOpen.value) await openUserDetail(updated, true);
    }
  });
}
async function role(userId: string, roleCode: string, enabled: boolean) {
  clearDetailFeedback();
  askReason(`${enabled ? "授予" : "撤销"}${roleText(roleCode)}`, async (why) => {
    if (
      await write(
        `/platform/accounts/users/${userId}/platform-role`,
        {
          role_code: roleCode,
          enabled,
          reason: why,
        },
        "POST",
        (value) => (detailError.value = value),
      )
    ) {
      const updated = [...(data.value?.users ?? []), ...(data.value?.admins ?? [])].find(
        (row) => row.id === userId,
      );
      detailSuccess.value = `${roleText(roleCode)}已${enabled ? "授予" : "撤销"}。`;
      if (updated && detailOpen.value) await openUserDetail(updated, true);
    }
  });
}
function showOrganization(item: any) {
  selected.value = item;
  organizationMissing.value = false;
  organizationForm.name = item.name;
  organizationForm.timezone = item.timezone || "Asia/Shanghai";
  organizationForm.data_retention_days = Number(item.data_retention_days || 365);
  organizationDetailOpen.value = true;
}
async function openOrganization(item: any) {
  clearOrganizationFeedback();
  showOrganization(item);
  await router.push(`/platform-admin/organizations/${item.id}`);
}
async function closeOrganizationDetail() {
  organizationDetailOpen.value = false;
  organizationMissing.value = false;
  clearOrganizationFeedback();
  await router.replace("/platform-admin/organizations");
}
function clearOrganizationFeedback() {
  organizationError.value = "";
  organizationSuccess.value = "";
}
function syncOrganizationRoute() {
  if (props.routePath.endsWith("/new")) {
    createOpen.value = true;
    organizationDetailOpen.value = false;
    organizationMissing.value = false;
    return;
  }
  createOpen.value = false;
  if (props.organizationId && data.value) {
    const organization = data.value.organizations.find((item) => item.id === props.organizationId);
    if (organization) showOrganization(organization);
    else if (selected.value?.id === props.organizationId) showOrganization(selected.value);
    else {
      selected.value = null;
      organizationMissing.value = true;
      organizationDetailOpen.value = true;
    }
    return;
  }
  organizationDetailOpen.value = false;
  organizationMissing.value = false;
}
async function updateOrganization() {
  if (!selected.value) return;
  clearOrganizationFeedback();
  askReason("保存组织资料", async (why) => {
    if (
      await write(
        `/platform/accounts/organizations/${selected.value.id}`,
        { ...organizationForm, reason: why },
        "PATCH",
        (value) => (organizationError.value = value),
      )
    ) {
      const updated = data.value?.organizations.find((item) => item.id === selected.value.id);
      if (updated) showOrganization(updated);
      organizationSuccess.value = "组织资料已更新。";
    }
  });
}
function openCreateUser(asAdmin = false) {
  createUserError.value = "";
  userForm.email = "";
  userForm.temporary_password = "";
  userForm.platform_role_code = asAdmin ? "platform_operations_admin" : "";
  userForm.organization_id = "";
  userForm.organization_role_code = "member";
  createUserOpen.value = true;
}
function closeCreateUser() {
  createUserOpen.value = false;
  createUserError.value = "";
}
async function createUser() {
  createUserError.value = "";
  if (
    await write(
      "/platform/accounts/users",
      {
        ...userForm,
        organization_id: userForm.organization_id || null,
        platform_role_code: userForm.platform_role_code || null,
      },
      "POST",
      (value) => (createUserError.value = value),
    )
  ) {
    createUserOpen.value = false;
    message.value = "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
  }
}
function clearDetailFeedback() {
  detailError.value = "";
  detailSuccess.value = "";
}
function closeUserDetail() {
  detailOpen.value = false;
  clearDetailFeedback();
}
async function openUserDetail(item: any, preserveFeedback = false) {
  if (!preserveFeedback) clearDetailFeedback();
  selected.value = item;
  detail.value = null;
  detailOpen.value = true;
  try {
    const response = await request<any>(`/platform/accounts/users/${item.id}`);
    detail.value = response.data;
  } catch (e) {
    detailError.value = e instanceof ApiClientError ? e.actionHint : "读取详情失败";
  }
}
function openPassword(item: any) {
  selected.value = item;
  passwordForm.temporary_password = "";
  passwordError.value = "";
  passwordOpen.value = true;
}
async function resetPassword() {
  if (!selected.value) return;
  passwordError.value = "";
  askReason("强制重置密码并撤销全部会话", async (why) => {
    if (
      await write(
        `/platform/accounts/users/${selected.value.id}/password`,
        {
          temporary_password: passwordForm.temporary_password,
          reason: why,
        },
        "POST",
        (value) => (passwordError.value = value),
      )
    ) {
      passwordOpen.value = false;
      detailOpen.value = false;
      message.value = "临时密码已更新，全部活动会话已撤销。";
    }
  });
}
function revokeSessions(item: any, sessionId: string | null = null) {
  clearDetailFeedback();
  askReason(sessionId ? "撤销该会话" : "撤销全部活动会话", async (why) => {
    if (
      await write(
        `/platform/accounts/users/${item.id}/sessions/revoke`,
        {
          session_id: sessionId,
          reason: why,
        },
        "POST",
        (value) => (detailError.value = value),
      )
    ) {
      detailSuccess.value = sessionId ? "该会话已撤销。" : "全部活动会话已撤销。";
      if (detailOpen.value) await openUserDetail(item, true);
    }
  });
}
onMounted(load);
</script>
<template>
  <section class="account-center">
    <header class="account-hero">
      <div>
        <p>
          {{
            accountOverviewRoute
              ? "组织与用户"
              : permissionsRoute
                ? "平台权限"
                : organizationListRoute
                  ? "平台组织"
                  : adminListRoute
                    ? "平台管理员"
                    : "平台用户"
          }}
        </p>
        <h2>
          {{
            accountOverviewRoute
              ? "查看平台账号使用概况"
              : permissionsRoute
                ? "核对角色与能力边界"
                : organizationListRoute
                  ? "管理组织状态与隔离边界"
                  : adminListRoute
                    ? "授权、会话与登录状态，一处管理"
                    : "查看用户归属与登录状态"
          }}
        </h2>
        <span>{{
          accountOverviewRoute
            ? "创建组织、启停账号、分配平台管理员。所有操作都会留审计记录。"
            : permissionsRoute
              ? "直接读取后端角色目录，比较每个固定平台角色实际拥有与缺少的能力。"
              : organizationListRoute
                ? "核对成员与工作区数量，进入详情维护资料、停用或恢复。所有操作都会留审计记录。"
                : adminListRoute
                  ? "创建运营、安全或超级管理员，维护角色、会话与登录状态。所有操作都会留审计记录。"
                  : "创建用户、核对组织归属并维护登录状态。所有操作都会留审计记录。"
        }}</span>
      </div>
      <div class="hero-actions">
        <template v-if="permissionsRoute">
          <RouterLink class="secondary" to="/platform-admin/admins">管理管理员</RouterLink>
          <button class="secondary" :disabled="rolesLoading" @click="load">
            {{ rolesLoading ? "正在刷新…" : "刷新角色目录" }}
          </button>
        </template>
        <template v-else>
          <button ref="createOrganizationButton" @click="openOrganizationWizard">
            <AppIcon name="plus" /> 新建组织</button
          ><button @click="openCreateUser(tab === 'admins')">
            <AppIcon name="plus" /> {{ tab === "admins" ? "新建管理员" : "新建用户" }}</button
          ><button class="secondary" :disabled="refreshing || Boolean(busy)" @click="load">
            {{ refreshing ? "正在刷新…" : "刷新数据" }}
          </button>
        </template>
      </div>
    </header>
    <template v-if="permissionsRoute">
      <div v-if="platformRoles.length" class="account-metrics permission-metrics">
        <article>
          <small>固定平台角色</small><strong>{{ platformRoles.length }}</strong
          ><span>来自当前启用角色目录</span>
        </article>
        <article>
          <small>平台能力</small><strong>{{ permissionCapabilityCount }}</strong
          ><span>按能力编码去重</span>
        </article>
        <article>
          <small>事实来源</small><strong>MySQL</strong><span>roles + role_capabilities</span>
        </article>
      </div>
      <p class="account-updated" aria-live="polite">{{ updatedText }}</p>
      <p v-if="rolesError" class="account-message" role="alert">{{ rolesError }}</p>
      <section v-if="state === 'loading'" class="account-state" aria-live="polite">
        正在读取真实平台角色目录…
      </section>
      <section v-else-if="state === 'error'" class="account-state">
        <strong>暂时无法读取角色目录</strong>
        <span>管理员账号和权限定义均未被修改。</span>
        <button type="button" :disabled="rolesLoading" @click="load">重新加载</button>
      </section>
      <section v-else-if="state === 'empty'" class="account-empty" aria-live="polite">
        <strong>角色目录为空</strong>
        <span>当前没有启用的平台角色；请检查角色初始化与数据库状态。</span>
        <button type="button" :disabled="rolesLoading" @click="load">重新检查</button>
      </section>
      <PlatformRoleComparison v-else :roles="platformRoles" :persist-selection="true" />
    </template>
    <template v-else>
      <div v-if="data" class="account-metrics">
        <article>
          <small>组织</small
          ><strong
            >{{ data.summary.active_organizations }} / {{ data.summary.organizations }}</strong
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
        <form class="account-filter" @submit.prevent="applyFilters">
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
        <section v-else-if="adminEmptyState" class="account-empty" aria-live="polite">
          <strong>{{ activeFilterCount ? "没有符合当前条件的管理员" : "还没有可授权账号" }}</strong>
          <span>{{
            activeFilterCount
              ? "调整管理员邮箱或状态筛选后重试。"
              : "创建首位平台管理员，或从用户管理选择现有账号授予平台角色。"
          }}</span>
          <button v-if="activeFilterCount" type="button" @click="resetFilters">清除筛选</button>
          <button v-else type="button" @click="openCreateUser(true)">新建管理员</button>
        </section>
        <PlatformAdminRecords v-else :rows="rows" @open-user="openUserDetail" />
        <PlatformRoleComparison
          v-if="tab === 'admins' && platformRoles.length"
          :roles="platformRoles"
        />
      </template>
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
    <PlatformAccountDialogs
      :create-user-open="createUserOpen"
      :create-user-error="createUserError"
      :account-overview-route="accountOverviewRoute"
      :tab="tab"
      :user-form="userForm"
      :organizations="data?.organizations || []"
      :password-open="passwordOpen"
      :password-error="passwordError"
      :password-form="passwordForm"
      :reason-open="reasonOpen"
      :reason-title="reasonTitle"
      :reason-text="reasonText"
      :busy="Boolean(busy)"
      @close-create-user="closeCreateUser"
      @create-user="createUser"
      @close-password="passwordOpen = false"
      @reset-password="resetPassword"
      @close-reason="cancelReason"
      @submit-reason="submitReason"
      @update:reason-text="reasonText = $event"
    />
    <PlatformOrganizationDetailDialog
      :open="organizationDetailOpen"
      :organization="selected"
      :form="organizationForm"
      :busy="Boolean(busy)"
      :missing="organizationMissing"
      :error-message="organizationError"
      :success-message="organizationSuccess"
      :status-text="statusText"
      @close="closeOrganizationDetail"
      @retry="load"
      @clear-feedback="clearOrganizationFeedback"
      @save="updateOrganization"
      @toggle-status="toggleOrganization"
    />
    <PlatformUserDetailDialog
      :open="detailOpen"
      :detail="detail"
      :selected="selected"
      :busy="Boolean(busy)"
      :error-message="detailError"
      :success-message="detailSuccess"
      :status-text="statusText"
      :role-text="roleText"
      @close="closeUserDetail"
      @retry="selected && openUserDetail(selected)"
      @toggle-status="toggleUser"
      @role="role"
      @reset-password="openPassword"
      @revoke-sessions="revokeSessions"
    />
  </section>
</template>
<style scoped src="./PlatformAccountCenter.css"></style>
