<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
} from "vue";
import { useRoute } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { applyCachedTheme, applyShellDensity, themes } from "../design/theme";
import { getLastMemberRoute, rememberMemberRoute } from "../navigation-memory";
import {
  authorizedNavigation,
  canOpenRoute,
  shellCapabilities,
  shellRoleSummary,
} from "../navigation-shell-permissions";
import {
  breadcrumbTrail,
  navigationParentPath as resolveNavigationParentPath,
  pageSummary as resolvePageSummary,
  platformOperationsNavigation,
  routeEntityIds,
  surfaceProps,
  type NavigationShellKind,
} from "../navigation-shell-route-state";
import type { ShellNavigationItem } from "../route-catalog";
import { useNavigationDiscovery } from "../use-navigation-discovery";
import { useNavigationShellTheme } from "../use-navigation-shell-theme";
import AppIcon from "./AppIcon.vue";
import "../member-workspace-polish.css";

const componentModules = import.meta.glob<{ default: object }>("./*.vue");
const lazy = (name: string) => {
  const loader = componentModules[`./${name}.vue`];
  if (!loader) throw new Error(`missing lazy component: ${name}`);
  return defineAsyncComponent(loader);
};
const DiscoveryOverlay = lazy("DiscoveryOverlay"),
  HomeDashboard = lazy("HomeDashboard"),
  ProviderRuntimeSurface = lazy("ProviderRuntimeSurface"),
  CollectionRuntimeSurface = lazy("CollectionRuntimeSurface"),
  PlatformDataCenter = lazy("PlatformDataCenter"),
  PlatformGovernanceCenter = lazy("PlatformGovernanceCenter"),
  TrendDashboard = lazy("TrendDashboard"),
  OpportunityWorkspace = lazy("OpportunityWorkspace"),
  SelectionJourney = lazy("SelectionJourney"),
  ScoreRuleConsole = lazy("ScoreRuleConsole"),
  CostRuleConsole = lazy("CostRuleConsole"),
  CompetitorMonitor = lazy("CompetitorMonitor"),
  SourcingWorkspace = lazy("SourcingWorkspace"),
  TaskWorkspace = lazy("TaskWorkspace"),
  ApprovalWorkspace = lazy("ApprovalWorkspace"),
  NotificationCenter = lazy("NotificationCenter"),
  AutomationRuleCenter = lazy("AutomationRuleCenter"),
  ReportCenter = lazy("ReportCenter"),
  OrganizationAdminCenter = lazy("OrganizationAdminCenter"),
  PlatformDashboard = lazy("PlatformDashboard"),
  SecurityOperationsCenter = lazy("SecurityOperationsCenter"),
  OpenPlatformCenter = lazy("OpenPlatformCenter"),
  CommercialOperationsCenter = lazy("CommercialOperationsCenter"),
  BackupRecoveryCenter = lazy("BackupRecoveryCenter"),
  ReleaseRolloutCenter = lazy("ReleaseRolloutCenter"),
  RuntimeTopologyCenter = lazy("RuntimeTopologyCenter"),
  RedisResilienceCenter = lazy("RedisResilienceCenter"),
  MySqlResilienceCenter = lazy("MySqlResilienceCenter"),
  FileResilienceCenter = lazy("FileResilienceCenter"),
  CrawlerSchedulerCenter = lazy("CrawlerSchedulerCenter"),
  CapacityBoundaryCenter = lazy("CapacityBoundaryCenter"),
  PlatformAccountCenter = lazy("PlatformAccountCenter"),
  PlatformManagementCenter = lazy("PlatformManagementCenter"),
  PlatformLogCenter = lazy("PlatformLogCenter"),
  PersonalCenter = lazy("PersonalCenter");

const surfaceComponents: Record<string, Component> = {
  "home-dashboard": HomeDashboard,
  "task-workspace": TaskWorkspace,
  "approval-workspace": ApprovalWorkspace,
  "notification-center": NotificationCenter,
  "automation-rule-center": AutomationRuleCenter,
  "report-center": ReportCenter,
  "personal-center": PersonalCenter,
  "organization-admin-center": OrganizationAdminCenter,
  "platform-dashboard": PlatformDashboard,
  "platform-account-center": PlatformAccountCenter,
  "platform-management-center": PlatformManagementCenter,
  "platform-log-center": PlatformLogCenter,
  "platform-governance-center": PlatformGovernanceCenter,
  "backup-recovery-center": BackupRecoveryCenter,
  "release-rollout-center": ReleaseRolloutCenter,
  "runtime-topology-center": RuntimeTopologyCenter,
  "redis-resilience-center": RedisResilienceCenter,
  "mysql-resilience-center": MySqlResilienceCenter,
  "file-resilience-center": FileResilienceCenter,
  "crawler-scheduler-center": CrawlerSchedulerCenter,
  "capacity-boundary-center": CapacityBoundaryCenter,
  "trend-dashboard": TrendDashboard,
  "score-rule-console": ScoreRuleConsole,
  "selection-journey": SelectionJourney,
  "opportunity-workspace": OpportunityWorkspace,
  "competitor-monitor": CompetitorMonitor,
  "sourcing-workspace": SourcingWorkspace,
  "cost-rule-console": CostRuleConsole,
  "provider-runtime-surface": ProviderRuntimeSurface,
  "collection-runtime-surface": CollectionRuntimeSurface,
  "platform-data-center": PlatformDataCenter,
  "security-operations-center": SecurityOperationsCenter,
  "open-platform-center": OpenPlatformCenter,
  "commercial-operations-center": CommercialOperationsCenter,
};

type Shell = NavigationShellKind;
type State =
  "loading" | "ready" | "expired" | "forbidden" | "context_required" | "rate_limited" | "blocked";
interface GuardSummary {
  shell: Shell;
  organization_id: string | null;
  workspace_id: string | null;
  organization_name: string | null;
  workspace_name: string | null;
  roles: string[];
  capabilities: string[];
  platform_roles: string[];
  platform_capabilities: string[];
  guard_reason: string;
}
const props = defineProps<{ shell: Shell; apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const route = useRoute();
const routePath = computed(() => route.path.replace(/\/$/, "") || "/");
const state = ref<State>("loading"),
  guard = ref<GuardSummary | null>(null),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref(""),
  menuOpen = ref(false),
  menuQuery = ref("");
const { themeOpen, activeTheme, themeNotice, loadThemePreference, chooseTheme } =
  useNavigationShellTheme(request);
const { discoveryMode, openDiscovery, closeDiscovery, handleDiscoveryShortcut } =
  useNavigationDiscovery(() => props.shell);
const allCapabilities = computed(() => shellCapabilities(props.shell, guard.value));
const items = computed(() =>
  authorizedNavigation(props.shell, allCapabilities.value, guard.value?.roles ?? []),
);
const navigationParentPath = computed(() => resolveNavigationParentPath(routePath.value));
const activeItem = computed(
  () =>
    items.value.find((item) => item.path === navigationParentPath.value) ||
    [...items.value]
      .filter(
        (item) =>
          !["/platform-admin", "/org-admin", "/home"].includes(item.path) &&
          routePath.value.startsWith(`${item.path}/`),
      )
      .sort((left, right) => right.path.length - left.path.length)[0] ||
    null,
);
const visibleMenuItems = computed(() => {
  const needle = menuQuery.value.trim().toLocaleLowerCase();
  if (!needle) return items.value;
  return items.value.filter((item) =>
    `${item.label} ${item.group}`.toLocaleLowerCase().includes(needle),
  );
});
const menuGroups = computed(() => {
  const groups = new Map<string, ShellNavigationItem[]>();
  for (const item of visibleMenuItems.value)
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups].map(([label, groupItems]) => ({ label, items: groupItems }));
});
const shellTitle = computed(() =>
  props.shell === "member"
    ? "成员工作台"
    : props.shell === "organization_admin"
      ? "组织管理后台"
      : "平台管理后台",
);
const pageTitle = computed(() =>
  typeof route.meta.title === "string"
    ? route.meta.title
    : (activeItem.value?.label ?? shellTitle.value),
);
const breadcrumbs = computed(() =>
  breadcrumbTrail(
    Array.isArray(route.meta.breadcrumb)
      ? route.meta.breadcrumb.filter((item): item is string => typeof item === "string")
      : [pageTitle.value],
    routePath.value,
  ),
);
const requiredCapabilities = computed(() =>
  Array.isArray(route.meta.capabilities)
    ? route.meta.capabilities.filter((item): item is string => typeof item === "string")
    : [],
);
const routeAllowed = computed(() =>
  canOpenRoute(
    requiredCapabilities.value,
    allCapabilities.value,
    props.shell,
    guard.value?.roles ?? [],
  ),
);
const roleSummary = computed(() => shellRoleSummary(props.shell, guard.value));
const primaryItems = computed(() => items.value.slice(0, 4));
const moreActive = computed(
  () =>
    routePath.value !== activeItem.value?.path ||
    !primaryItems.value.some((item) => item.path === activeItem.value?.path),
);
const primaryActionLabel = computed(() =>
  props.shell === "member"
    ? "创建选品"
    : props.shell === "organization_admin"
      ? "邀请成员"
      : "新建组织",
);
const memberReturnPath = () => {
  return getLastMemberRoute();
};
const contextSwitchTarget = computed(
  () =>
    `/select-context?return_to=${encodeURIComponent(memberReturnPath())}&from=${encodeURIComponent(route.fullPath)}`,
);
const opportunityId = computed(() => routeEntityIds(routePath.value).opportunityId),
  isPlatformOperationsRoute = computed(
    () =>
      props.shell === "platform_admin" &&
      platformOperationsNavigation.some((item) => item.path === routePath.value),
  );
const activeSurface = computed(() => String(route.meta.surface ?? ""));
const activeCachePolicy = computed(() => String(route.meta.cachePolicy ?? "none"));
const selectedSurfaceComponent = computed(() => surfaceComponents[activeSurface.value] ?? null);
const surfaceCacheKey = computed(() => {
  const routeIdentity =
    activeSurface.value === "platform-account-center"
      ? activeSurface.value
      : String(route.name ?? routePath.value);
  if (activeCachePolicy.value !== "reset_on_scope") return routeIdentity;
  return `${routeIdentity}:${guard.value?.organization_id ?? "none"}:${guard.value?.workspace_id ?? "none"}`;
});
const selectedSurfaceProps = computed<Record<string, unknown>>(() =>
  surfaceProps({
    surface: activeSurface.value,
    path: routePath.value,
    apiBaseUrl: props.apiBaseUrl,
    organizationId: guard.value?.organization_id,
    workspaceId: guard.value?.workspace_id,
    capabilities: allCapabilities.value,
    roles: guard.value?.roles ?? [],
  }),
);
const pageSummary = computed(() => resolvePageSummary(props.shell, routePath.value));
const contextName = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;
const stateCopy = computed(
  () =>
    (
      ({
        expired: ["登录已失效", "重新登录后返回当前页面。"],
        forbidden: ["无权进入此工作台", "服务端已拒绝该壳层；返回有权访问的工作台。"],
        context_required: ["尚未选择组织与工作区", "完成租户选择后才能进入成员或组织后台。"],
        rate_limited: ["请求过于频繁", "稍后重试；不要连续刷新。"],
        blocked: ["导航服务暂不可用", "检查网络后重试；运维可在宝塔查看 Node API。"],
        loading: ["正在核验工作台权限", "菜单只会在服务端确认后显示。"],
        ready: ["", ""],
      }) as Record<State, [string, string]>
    )[state.value],
);
async function load() {
  state.value = "loading";
  guard.value = null;
  requestId.value = "";
  traceId.value = "";
  actionHint.value = "";
  try {
    const response = await request<GuardSummary>(`/me/navigation?shell=${props.shell}`);
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    guard.value = response.data;
    state.value = "ready";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      state.value =
        error.kind === "expired"
          ? "expired"
          : error.kind === "forbidden"
            ? "forbidden"
            : error.kind === "conflict"
              ? "context_required"
              : error.kind === "rate_limited"
                ? "rate_limited"
                : "blocked";
      return;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    state.value = "blocked";
  }
}
onMounted(() => {
  void load();
  applyShellDensity(props.shell !== "member");
  applyCachedTheme();
  if (props.shell !== "platform_admin") void loadThemePreference(false);
  window.addEventListener("keydown", handleDiscoveryShortcut);
});
watch(
  () => route.fullPath,
  (fullPath) => {
    if (props.shell === "member") rememberMemberRoute(fullPath);
  },
  { immediate: true },
);
watch(
  () => props.shell,
  (shell) => {
    applyShellDensity(shell !== "member");
    applyCachedTheme();
    if (shell !== "platform_admin") void loadThemePreference(false);
  },
);
onUnmounted(() => {
  window.removeEventListener("keydown", handleDiscoveryShortcut);
  if (props.shell !== "member") {
    applyShellDensity(false);
  }
});
</script>

<template>
  <main class="role-shell" :data-shell="shell" :data-state="state">
    <header class="role-topbar">
      <RouterLink
        class="role-brand"
        :to="
          shell === 'member'
            ? '/home'
            : shell === 'organization_admin'
              ? '/org-admin'
              : '/platform-admin'
        "
        ><span>选</span><b>智能选品</b
        ><em>{{
          shell === "platform_admin"
            ? "管理员"
            : shell === "organization_admin"
              ? "组织后台"
              : "选品工作台"
        }}</em></RouterLink
      >
      <button
        class="role-menu-toggle"
        type="button"
        aria-label="打开导航菜单"
        :aria-expanded="menuOpen"
        aria-controls="role-navigation"
        @click="menuOpen = !menuOpen"
      >
        <AppIcon name="menu" /> <span>菜单</span>
      </button>
      <div class="role-context" v-if="state === 'ready'">
        <span v-if="shell !== 'platform_admin'"
          ><small>组织</small>{{ contextName(guard?.organization_name, "未命名组织") }}</span
        ><span v-if="shell !== 'platform_admin'"
          ><small>工作区</small>{{ contextName(guard?.workspace_name, "默认工作区") }}</span
        ><span v-else><small>范围</small>平台全局</span>
      </div>
      <div class="role-top-actions">
        <div v-if="state === 'ready'" class="role-identity" aria-label="当前身份">
          <small>当前身份</small><strong>{{ roleSummary }}</strong>
        </div>
        <div class="role-theme-switcher">
          <button type="button" aria-label="切换界面主题" @click="themeOpen = !themeOpen">
            <AppIcon name="theme" /> <span>主题</span>
          </button>
        </div>
        <button v-if="shell === 'member'" type="button" @click="openDiscovery('search')">
          <AppIcon name="search" /> <span>搜索</span><kbd>快捷键</kbd>
        </button>
        <RouterLink
          v-if="shell === 'platform_admin' && allCapabilities.includes('platform:superadmin')"
          class="role-create"
          to="/platform-admin/organizations/new"
          :aria-label="primaryActionLabel"
          ><AppIcon name="plus" /> <span>新建组织</span></RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin'"
          class="role-create"
          v-show="guard?.roles?.includes('organization_admin')"
          to="/org-admin/members"
          :aria-label="primaryActionLabel"
          ><AppIcon name="plus" /> <span>邀请成员</span></RouterLink
        >
        <button
          v-else-if="shell === 'member'"
          type="button"
          class="role-create"
          :aria-label="primaryActionLabel"
          @click="openDiscovery('create')"
        >
          <AppIcon name="plus" /> <span>创建选品</span>
        </button>
        <RouterLink
          v-if="shell === 'platform_admin'"
          class="role-switch"
          :to="contextSwitchTarget"
          aria-label="选择组织与工作区后进入用户工作台"
          ><AppIcon name="switch" /><span class="role-switch-desktop">选择范围并返回工作台</span
          ><span class="role-switch-mobile">用户面板</span></RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin'"
          class="role-switch"
          :to="memberReturnPath()"
          aria-label="返回成员工作台"
          ><AppIcon name="switch" /><span class="role-switch-desktop">返回成员工作台</span
          ><span class="role-switch-mobile">工作台</span></RouterLink
        >
        <RouterLink
          v-else-if="guard?.roles?.includes('organization_admin')"
          class="role-switch"
          to="/org-admin"
          aria-label="进入组织管理后台"
          ><AppIcon name="switch" /><span class="role-switch-desktop">进入组织后台</span
          ><span class="role-switch-mobile">组织后台</span></RouterLink
        >
        <RouterLink
          v-if="shell === 'member' && guard?.platform_roles?.length"
          class="role-switch"
          to="/platform-admin"
          aria-label="进入管理后台"
          ><AppIcon name="switch" /><span class="role-switch-desktop">进入管理后台</span
          ><span class="role-switch-mobile">管理后台</span></RouterLink
        >
        <RouterLink v-if="shell === 'member'" to="/notifications" aria-label="通知中心"
          ><AppIcon name="bell" /></RouterLink
        ><RouterLink to="/me" aria-label="个人中心"><AppIcon name="person" /></RouterLink>
      </div>
    </header>
    <aside
      id="role-navigation"
      class="role-sidebar"
      :class="{ 'is-open': menuOpen }"
      :aria-label="`${shellTitle}导航`"
    >
      <div class="role-sidebar-head">
        <strong>{{ shellTitle }}</strong
        ><small
          >{{
            shell === "member"
              ? "当前组织业务范围"
              : shell === "organization_admin"
                ? "仅当前组织"
                : "平台角色授权范围"
          }}
          · {{ roleSummary }}</small
        >
      </div>
      <label v-if="items.length >= 8" class="role-menu-search">
        <span class="so-visually-hidden">搜索导航菜单</span>
        <AppIcon name="search" :size="15" />
        <input
          v-model="menuQuery"
          type="search"
          placeholder="搜索菜单或分组"
          aria-label="搜索导航菜单"
        />
      </label>
      <nav v-if="state === 'ready'" class="role-nav-groups">
        <details
          v-for="group in menuGroups"
          :key="group.label"
          :open="
            Boolean(menuQuery.trim()) || group.items.some((item) => activeItem?.path === item.path)
          "
        >
          <summary>
            <span>{{ group.label }}</span
            ><AppIcon name="chevron" :size="14" />
          </summary>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            :aria-current="activeItem?.path === item.path ? 'page' : undefined"
            @click="((menuOpen = false), (menuQuery = ''))"
            ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
          >
        </details>
        <p v-if="!menuGroups.length" class="role-menu-empty">没有匹配的菜单或分组。</p>
      </nav>
      <div v-if="state === 'ready'" class="role-sidebar-utility">
        <RouterLink
          v-if="shell === 'platform_admin'"
          :to="contextSwitchTarget"
          aria-label="选择组织与工作区后进入用户工作台"
          ><AppIcon name="switch" />返回用户工作台</RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin'"
          :to="memberReturnPath()"
          aria-label="返回成员工作台"
          ><AppIcon name="switch" />返回成员工作台</RouterLink
        >
        <RouterLink
          v-else-if="guard?.roles?.includes('organization_admin')"
          to="/org-admin"
          aria-label="进入组织管理后台"
          ><AppIcon name="switch" />进入组织后台</RouterLink
        >
        <RouterLink
          v-if="shell === 'member' && guard?.platform_roles?.length"
          to="/platform-admin"
          aria-label="进入管理后台"
          ><AppIcon name="switch" />进入管理后台</RouterLink
        >
      </div>
    </aside>
    <section class="role-content">
      <section v-if="state !== 'ready'" class="role-gate-state" aria-live="polite">
        <span class="role-state-mark" aria-hidden="true">{{
          state === "loading" ? "···" : state === "forbidden" ? "×" : "!"
        }}</span>
        <p>访问保护</p>
        <h1>{{ stateCopy[0] }}</h1>
        <p>{{ stateCopy[1] }}</p>
        <small v-if="actionHint">{{ actionHint }}</small>
        <details v-if="requestId || traceId" class="role-gate-technical">
          <summary>故障详情</summary>
          <code v-if="requestId">关联编号：{{ requestId }}</code
          ><code v-if="traceId && traceId !== requestId">链路编号：{{ traceId }}</code>
        </details>
        <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
        ><RouterLink v-else-if="state === 'context_required'" to="/select-context"
          >选择组织与工作区</RouterLink
        ><RouterLink v-else-if="state === 'forbidden'" to="/home">返回成员工作台</RouterLink
        ><button v-else-if="state !== 'loading'" type="button" @click="load">重新检查</button>
      </section>
      <template v-else-if="routeAllowed">
        <nav v-if="!opportunityId" class="role-page-breadcrumb" aria-label="面包屑">
          <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
            <RouterLink v-if="item.path" :to="item.path">{{ item.label }}</RouterLink
            ><span v-else :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined">{{
              item.label
            }}</span
            ><b v-if="index < breadcrumbs.length - 1">/</b>
          </template>
        </nav>
        <h1 v-if="!opportunityId" class="so-visually-hidden">{{ pageTitle }}</h1>
        <nav
          v-if="isPlatformOperationsRoute"
          class="platform-secondary-nav"
          aria-label="系统运维二级导航"
        >
          <RouterLink
            v-for="item in platformOperationsNavigation"
            :key="item.path"
            :to="item.path"
            :aria-current="routePath === item.path ? 'page' : undefined"
            >{{ item.label }}</RouterLink
          >
        </nav>
        <KeepAlive :max="12">
          <component
            :is="selectedSurfaceComponent"
            v-if="selectedSurfaceComponent"
            :key="surfaceCacheKey"
            v-bind="selectedSurfaceProps"
          />
          <section v-else class="role-gate-state" aria-live="polite">
            <span class="role-state-mark" aria-hidden="true">?</span>
            <p>页面不存在</p>
            <h2>页面不存在</h2>
            <p>该地址没有可用功能，请从左侧真实功能菜单重新进入。</p>
            <RouterLink :to="items[0]?.path || '/'">返回工作台</RouterLink>
          </section>
        </KeepAlive>
      </template>
      <section v-else class="role-gate-state" aria-live="polite">
        <span class="role-state-mark" aria-hidden="true">×</span>
        <p>路由权限</p>
        <h1>无权打开此页面</h1>
        <p>当前角色不包含该页面要求的能力，请返回有权访问的模块。</p>
        <div class="role-gate-actions">
          <RouterLink :to="items[0]?.path || '/home'">返回工作台</RouterLink>
          <RouterLink to="/me?section=permissions">申请权限或联系管理员</RouterLink>
        </div>
      </section>
    </section>
    <nav v-if="state === 'ready'" class="role-mobile-nav" aria-label="移动快捷导航">
      <RouterLink
        v-for="item in primaryItems"
        :key="item.path"
        :to="item.path"
        :aria-current="activeItem?.path === item.path ? 'page' : undefined"
        ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
      ><button
        type="button"
        :aria-current="moreActive ? 'page' : undefined"
        aria-controls="role-navigation"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <i><AppIcon name="menu" /></i><span>更多</span>
      </button>
    </nav>
    <div v-if="themeOpen" class="role-theme-menu">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        :aria-pressed="activeTheme === theme.id"
        @click="chooseTheme(theme.id, shell !== 'platform_admin')"
      >
        <i :data-theme-dot="theme.id"></i
        ><span
          ><b>{{ theme.name }}</b
          ><small
            >{{ activeTheme === theme.id ? "当前主题 · " : "" }}{{ theme.caption }}</small
          ></span
        >
      </button>
      <RouterLink to="/settings/theme">更多外观设置</RouterLink>
    </div>
    <p v-if="themeNotice" class="role-theme-notice" role="status">
      {{ themeNotice }}
    </p>
    <DiscoveryOverlay
      :open="Boolean(discoveryMode)"
      :mode="discoveryMode || 'search'"
      :shell="shell"
      :api-base-url="apiBaseUrl"
      @close="closeDiscovery"
    />
  </main>
</template>

<style scoped src="../navigation-shell-scoped.css"></style>
