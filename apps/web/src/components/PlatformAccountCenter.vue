<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RoleCapabilitySummary } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import { usePlatformUserDetail } from "../use-platform-user-detail";
import { usePlatformOrganizationActions } from "../use-platform-organization-actions";
import { usePlatformOrganizationDetailState } from "../use-platform-organization-detail-state";
import { useUserCreationOwner } from "../use-user-creation-owner";
import type { AccountData, AccountTab, MembershipInput } from "../platform-account-types";
import AppIcon from "./AppIcon.vue";
const OrganizationCreationWizard = defineAsyncComponent(
  () => import("./OrganizationCreationWizard.vue"),
);
const PlatformAccountDirectoryWorkspace = defineAsyncComponent(
  () => import("./PlatformAccountDirectoryWorkspace.vue"),
);
const PlatformAccountDialogs = defineAsyncComponent(() => import("./PlatformAccountDialogs.vue"));
const PlatformOrganizationDetailDialog = defineAsyncComponent(
  () => import("./PlatformOrganizationDetailDialog.vue"),
);
const PlatformRoleComparison = defineAsyncComponent(() => import("./PlatformRoleComparison.vue"));
const PlatformUserDetailDialog = defineAsyncComponent(
  () => import("./PlatformUserDetailDialog.vue"),
);
const props = withDefaults(
    defineProps<{
      apiBaseUrl: string;
      initialTab?: AccountTab;
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
  tab = ref<AccountTab>(props.initialTab),
  data = ref<AccountData | null>(null),
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
  organizationRefreshWarning = ref(""),
  passwordOpen = ref(false),
  passwordError = ref(""),
  reasonOpen = ref(false),
  reasonTitle = ref("确认操作"),
  reasonText = ref("平台管理员人工操作"),
  pendingReasonAction = ref<null | ((value: string) => Promise<void>)>(null),
  selected = ref<any>(null),
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
const createUserOwner = useUserCreationOwner(
  () => createUserOpen.value,
  () => props.routePath,
);
const createOrganizationOwner = useUserCreationOwner(
  () => createOpen.value,
  () => props.routePath,
);
const {
  detailOpen,
  detail,
  detailError,
  detailSuccess,
  captureDetailAction,
  closeUserDetail,
  openUserDetail,
} = usePlatformUserDetail(request, selected, () => props.routePath);
const { showOrganization, syncOrganizationRoute } = usePlatformOrganizationDetailState({
  selected,
  data,
  detailOpen: organizationDetailOpen,
  missing: organizationMissing,
  createOpen,
  form: organizationForm,
  routePath: () => props.routePath,
  organizationId: () => props.organizationId,
});
const { updateOrganization, toggleOrganization, invalidateOrganizationAction } =
  usePlatformOrganizationActions({
    selected,
    form: organizationForm,
    data,
    detailOpen: organizationDetailOpen,
    missing: organizationMissing,
    error: organizationError,
    success: organizationSuccess,
    refreshWarning: organizationRefreshWarning,
    message,
    pendingReasonAction,
    routePath: () => props.routePath,
    organizationId: () => props.organizationId,
    clearFeedback: clearOrganizationFeedback,
    showOrganization,
    askReason,
    cancelReason,
    write,
  });
watch(
  () => props.initialTab,
  (value) => {
    tab.value = value;
    if (value === "admins" && !platformRoles.value.length) void loadPlatformRoles();
  },
);
watch(
  () => [props.routePath, props.organizationId],
  () => {
    clearOrganizationFeedback();
    syncOrganizationRoute();
  },
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
  return loadAccounts();
}
let queuedAccountsRead = false;
let activeAccountsRead: { query: string; status: string } | null = null;
async function loadAccounts(ownsResult?: () => boolean): Promise<boolean> {
  if (permissionsRoute.value) {
    if (rolesLoading.value) return false;
    if (!platformRoles.value.length) state.value = "loading";
    const loaded = await loadPlatformRoles();
    state.value = loaded
      ? platformRoles.value.length
        ? "ready"
        : "empty"
      : platformRoles.value.length
        ? "ready"
        : "error";
    return loaded;
  }
  if (refreshing.value) {
    const routeQuery =
      typeof route.query.query === "string" ? route.query.query.slice(0, 120).trim() : "";
    const routeStatus =
      typeof route.query.status === "string" ? route.query.status.slice(0, 30) : "";
    if (
      activeAccountsRead &&
      (routeQuery !== activeAccountsRead.query || routeStatus !== activeAccountsRead.status)
    )
      queuedAccountsRead = true;
    return false;
  }
  const requestedQuery = query.value.trim();
  const requestedStatus = status.value;
  activeAccountsRead = { query: requestedQuery, status: requestedStatus };
  const routeFiltersChanged = () => {
    const routeQuery =
      typeof route.query.query === "string" ? route.query.query.slice(0, 120).trim() : "";
    const routeStatus =
      typeof route.query.status === "string" ? route.query.status.slice(0, 30) : "";
    return requestedQuery !== routeQuery || requestedStatus !== routeStatus;
  };
  const hadData = Boolean(data.value);
  if (!hadData) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const p = new URLSearchParams();
    if (requestedQuery) p.set("query", requestedQuery);
    if (requestedStatus) p.set("status", requestedStatus);
    const accountResponse = await request<AccountData>(`/platform/accounts?${p}`, {
      signal: controller.signal,
    });
    if ((ownsResult && !ownsResult()) || routeFiltersChanged()) return false;
    data.value = accountResponse.data;
    state.value = "ready";
    lastUpdatedAt.value = new Date();
    syncOrganizationRoute();
    if (tab.value === "admins") await loadPlatformRoles();
    return true;
  } catch (e) {
    if ((ownsResult && !ownsResult()) || routeFiltersChanged()) return false;
    const action =
      e instanceof DOMException && e.name === "AbortError"
        ? "读取超过 12 秒，请稍后重试。"
        : e instanceof ApiClientError
          ? e.actionHint
          : "读取失败";
    message.value = hadData ? `${action} 已保留上次成功读取的数据。` : action;
    state.value = hadData ? "ready" : "error";
    return false;
  } finally {
    window.clearTimeout(timeout);
    activeAccountsRead = null;
    refreshing.value = false;
    if (queuedAccountsRead) {
      queuedAccountsRead = false;
      void loadAccounts();
    }
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
  ownsResult?: () => boolean,
  onReload?: (loaded: boolean) => void,
) {
  busy.value = path;
  message.value = "";
  try {
    const response = await request<T>(path, { method, body });
    if (!ownsResult || ownsResult()) {
      const loaded = await loadAccounts(ownsResult);
      if (!ownsResult || ownsResult()) onReload?.(loaded);
    }
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
  const isCurrent = createOrganizationOwner.capture();
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
    (value) => isCurrent() && (createError.value = value),
    isCurrent,
  );
  if (created && isCurrent()) {
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
async function toggleUser(item: any) {
  const isCurrent = captureDetailAction();
  askReason(item.status === "active" ? "停用用户并撤销会话" : "恢复用户", async (why) => {
    if (!isCurrent()) return;
    if (
      await write(
        `/platform/accounts/users/${item.id}/status`,
        {
          status: item.status === "active" ? "disabled" : "active",
          reason: why,
        },
        "POST",
        (value) => isCurrent() && (detailError.value = value),
      )
    ) {
      if (!isCurrent()) return;
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
  const isCurrent = captureDetailAction();
  askReason(`${enabled ? "授予" : "撤销"}${roleText(roleCode)}`, async (why) => {
    if (!isCurrent()) return;
    if (
      await write(
        `/platform/accounts/users/${userId}/platform-role`,
        {
          role_code: roleCode,
          enabled,
          reason: why,
        },
        "POST",
        (value) => isCurrent() && (detailError.value = value),
      )
    ) {
      if (!isCurrent()) return;
      const updated = [...(data.value?.users ?? []), ...(data.value?.admins ?? [])].find(
        (row) => row.id === userId,
      );
      detailSuccess.value = `${roleText(roleCode)}已${enabled ? "授予" : "撤销"}。`;
      if (updated && detailOpen.value) await openUserDetail(updated, true);
    }
  });
}
async function addMembership(userId: string, value: MembershipInput) {
  const isCurrent = captureDetailAction();
  const path = `/platform/accounts/users/${userId}/memberships`;
  const created = await write(
    path,
    value,
    "POST",
    (error) => isCurrent() && (detailError.value = error),
  );
  if (!created || !isCurrent()) return;
  detailSuccess.value = `${roleText(value.role_code)}组织关系已创建。`;
  await openUserDetail(selected.value, true);
}
async function openOrganization(item: any) {
  clearOrganizationFeedback();
  showOrganization(item);
  await router.push(`/platform-admin/organizations/${item.id}`);
}
async function closeOrganizationDetail() {
  invalidateOrganizationAction();
  organizationDetailOpen.value = false;
  organizationMissing.value = false;
  clearOrganizationFeedback();
  await router.replace("/platform-admin/organizations");
}
function clearOrganizationFeedback() {
  organizationError.value = "";
  organizationSuccess.value = "";
  organizationRefreshWarning.value = "";
}
async function retryOrganizationRead() {
  organizationRefreshWarning.value = "";
  const loaded = await load();
  organizationRefreshWarning.value = loaded
    ? organizationMissing.value
      ? "本次组织列表仍未返回这个目标。"
      : ""
    : "重新加载未成功。";
}
function openCreateUser(asAdmin = false) {
  createUserOwner.invalidate();
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
  const isCurrent = createUserOwner.capture();
  let accountListReloaded = true;
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
      (value) => isCurrent() && (createUserError.value = value),
      undefined,
      (loaded) => {
        accountListReloaded = loaded;
      },
    )
  ) {
    if (isCurrent()) createUserOpen.value = false;
    message.value = accountListReloaded
      ? "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。"
      : "账号已创建，但列表刷新未成功，请手动刷新核对；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
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
  const isCurrent = captureDetailAction();
  passwordError.value = "";
  askReason("强制重置密码并撤销全部会话", async (why) => {
    if (!isCurrent()) return;
    if (
      await write(
        `/platform/accounts/users/${selected.value.id}/password`,
        {
          temporary_password: passwordForm.temporary_password,
          reason: why,
        },
        "POST",
        (value) => isCurrent() && (passwordError.value = value),
      )
    ) {
      if (isCurrent()) {
        passwordOpen.value = false;
        detailOpen.value = false;
      }
      message.value = "临时密码已更新，全部活动会话已撤销。";
    }
  });
}
function revokeSessions(item: any, sessionId: string | null = null) {
  const isCurrent = captureDetailAction();
  askReason(sessionId ? "撤销该会话" : "撤销全部活动会话", async (why) => {
    if (!isCurrent()) return;
    if (
      await write(
        `/platform/accounts/users/${item.id}/sessions/revoke`,
        {
          session_id: sessionId,
          reason: why,
        },
        "POST",
        (value) => isCurrent() && (detailError.value = value),
      )
    ) {
      if (!isCurrent()) return;
      detailSuccess.value = sessionId ? "该会话已撤销。" : "全部活动会话已撤销。";
      if (detailOpen.value) await openUserDetail(item, true);
    }
  });
}
onMounted(load);
</script>
<template>
  <section
    class="account-center account-center--review"
    :class="{
      'account-center--organization-review': organizationListRoute,
      'account-center--user-admin-c': tab === 'users' || tab === 'admins',
      'account-center--users-c': tab === 'users' && props.routePath === '/platform-admin/users',
      'account-center--admins-c': adminListRoute,
      'account-center--permissions-c': permissionsRoute,
    }"
  >
    <header class="account-hero">
      <div>
        <p>
          {{
            accountOverviewRoute
              ? "组织与用户"
              : permissionsRoute
                ? "平台权限"
                : organizationListRoute
                  ? "组织管理"
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
                  ? "组织管理"
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
                ? "查找组织，核对成员与工作区，进入详情维护资料和状态。"
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
          ><button
            v-if="!organizationListRoute"
            class="secondary"
            :disabled="refreshing || Boolean(busy)"
            @click="load"
          >
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
      <PlatformAccountDirectoryWorkspace
        v-model:query="query"
        v-model:status="status"
        :data="data"
        :rows="rows"
        :busy="Boolean(busy)"
        :state="state"
        :tab="tab"
        :organization-list-route="organizationListRoute"
        :organization-empty-state="organizationEmptyState"
        :admin-list-route="adminListRoute"
        :admin-empty-state="adminEmptyState"
        :platform-roles="platformRoles"
        :filter-label="filterLabel"
        :active-filter-count="activeFilterCount"
        :search-placeholder="searchPlaceholder"
        :status-label="statusLabel"
        :refreshing="refreshing"
        :updated-text="updatedText"
        :message="message"
        :status-text="statusText"
        :role-text="roleText"
        @apply-filters="applyFilters"
        @reset-filters="resetFilters"
        @load="load"
        @create-organization="openOrganizationWizard"
        @create-admin="openCreateUser(true)"
        @open-organization="openOrganization"
        @open-user="openUserDetail"
      />
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
      :refresh-warning="organizationRefreshWarning"
      :refreshing="refreshing"
      :status-text="statusText"
      @close="closeOrganizationDetail"
      @retry="retryOrganizationRead"
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
      :organizations="data?.organizations || []"
      :status-text="statusText"
      :role-text="roleText"
      @close="closeUserDetail"
      @retry="selected && openUserDetail(selected)"
      @toggle-status="toggleUser"
      @role="role"
      @add-membership="addMembership"
      @reset-password="openPassword"
      @revoke-sessions="revokeSessions"
    />
  </section>
</template>
<style src="./PlatformAccountCenter.css"></style>
<style scoped src="./PlatformAccountCenterPermissions.css"></style>
<style src="./PlatformAccountCenterAdmin.css"></style>
<style src="./PlatformAdminComparisonMobile.css"></style>
<style src="./PlatformAdminDirectoryMobile.css"></style>
<style src="./PlatformAccountUsersC.css"></style>
