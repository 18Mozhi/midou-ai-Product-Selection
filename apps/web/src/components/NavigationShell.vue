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
import {
  applyCachedTheme,
  applyShellDensity,
  applyTheme,
  isThemeId,
  themes,
  type ThemeId,
} from "../design/theme";
import { getLastMemberRoute, rememberMemberRoute } from "../navigation-memory";
import { navigationItemsFor, type ShellNavigationItem } from "../route-catalog";
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

type Shell = "member" | "organization_admin" | "platform_admin";
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
interface ThemePreference {
  theme: ThemeId;
  version: number;
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
  themeOpen = ref(false),
  activeTheme = ref<ThemeId>(
    isThemeId(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme
      : "deep-ocean",
  ),
  themeVersion = ref<number | null>(null),
  themeNotice = ref(""),
  discoveryMode = ref<"search" | "create" | null>(null);
let themePreferenceSequence = 0;
const platformOperationsNavigation = [
  { label: "系统状态", path: "/platform-admin/status" },
  { label: "链路日志", path: "/platform-admin/logs" },
  { label: "服务拓扑", path: "/platform-admin/topology" },
  { label: "采集调度", path: "/platform-admin/crawler-scheduler" },
  { label: "Redis", path: "/platform-admin/redis" },
  { label: "MySQL", path: "/platform-admin/mysql" },
  { label: "文件存储", path: "/platform-admin/files" },
  { label: "备份恢复", path: "/platform-admin/operations" },
  { label: "发布管理", path: "/platform-admin/releases" },
  { label: "容量边界", path: "/platform-admin/capacity" },
];
const allCapabilities = computed(() =>
  props.shell === "platform_admin"
    ? (guard.value?.platform_capabilities ?? [])
    : (guard.value?.capabilities ?? []),
);
const items = computed(() => {
  const source = navigationItemsFor(props.shell);
  return source.filter(
    (item) =>
      item.capabilities.length === 0 ||
      item.capabilities.some((cap) => allCapabilities.value.includes(cap)),
  );
});
const navigationParentPath = computed(() => {
  if (["/platform-admin/accounts", "/platform-admin/organizations"].includes(routePath.value))
    return "/platform-admin/organizations";
  if (routePath.value === "/platform-admin/users") return "/platform-admin/users";
  if (["/platform-admin/permissions", "/platform-admin/admins"].includes(routePath.value))
    return "/platform-admin/admins";
  if (
    routePath.value.startsWith("/platform-admin/providers") ||
    routePath.value === "/platform-admin/credentials"
  )
    return "/platform-admin/providers/sources";
  if (routePath.value.startsWith("/platform-admin/collection"))
    return "/platform-admin/collection/overview";
  if (platformOperationsNavigation.some((item) => item.path === routePath.value))
    return "/platform-admin/status";
  return routePath.value;
});
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
const menuGroups = computed(() => {
  const groups = new Map<string, ShellNavigationItem[]>();
  for (const item of items.value) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
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
  Array.isArray(route.meta.breadcrumb)
    ? route.meta.breadcrumb.filter((item): item is string => typeof item === "string")
    : [pageTitle.value],
);
const requiredCapabilities = computed(() =>
  Array.isArray(route.meta.capabilities)
    ? route.meta.capabilities.filter((item): item is string => typeof item === "string")
    : [],
);
const routeAllowed = computed(
  () =>
    requiredCapabilities.value.length === 0 ||
    requiredCapabilities.value.some((capability) => allCapabilities.value.includes(capability)),
);
const roleSummary = computed(() => {
  const roles = props.shell === "platform_admin" ? guard.value?.platform_roles : guard.value?.roles;
  return roles?.length ? roles.join(" · ") : "当前角色";
});
const memberReturnPath = () => {
  return getLastMemberRoute();
};
const contextSwitchTarget = computed(
  () =>
    `/select-context?return_to=${encodeURIComponent(memberReturnPath())}&from=${encodeURIComponent(route.fullPath)}`,
);
const isHome = computed(
    () => props.shell === "member" && (routePath.value === "/" || routePath.value === "/home"),
  ),
  isTasks = computed(
    () =>
      props.shell === "member" &&
      (["/work", "/tasks"].includes(routePath.value) ||
        /^\/tasks\/[0-9a-f-]{36}$/i.test(routePath.value)),
  ),
  isApprovals = computed(() => props.shell === "member" && routePath.value === "/tasks/approvals"),
  isNotifications = computed(
    () => props.shell === "member" && routePath.value === "/notifications",
  ),
  isAutomations = computed(() => props.shell === "member" && routePath.value === "/automations"),
  isReports = computed(() => props.shell === "member" && routePath.value === "/reports"),
  isPersonal = computed(() => props.shell === "member" && routePath.value === "/me"),
  isOrganizationAdmin = computed(
    () => props.shell === "organization_admin" && routePath.value.startsWith("/org-admin"),
  ),
  isPlatformDashboard = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin",
  ),
  isPlatformAccounts = computed(
    () =>
      props.shell === "platform_admin" &&
      [
        "/platform-admin/accounts",
        "/platform-admin/permissions",
        "/platform-admin/organizations",
        "/platform-admin/users",
        "/platform-admin/admins",
      ].includes(routePath.value),
  ),
  isPlatformManagement = computed(
    () =>
      props.shell === "platform_admin" &&
      [
        "/platform-admin/content",
        "/platform-admin/notifications",
        "/platform-admin/status",
      ].includes(routePath.value),
  ),
  isPlatformLogs = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/logs",
  ),
  isPlatformGovernance = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/governance",
  ),
  isBackupRecovery = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/operations",
  ),
  isReleaseRollout = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/releases",
  ),
  isRuntimeTopology = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/topology",
  ),
  isRedisResilience = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/redis",
  ),
  isMySqlResilience = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/mysql",
  ),
  isFileResilience = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/files",
  ),
  isCrawlerScheduler = computed(
    () =>
      props.shell === "platform_admin" && routePath.value === "/platform-admin/crawler-scheduler",
  ),
  isCapacityBoundary = computed(
    () => props.shell === "platform_admin" && routePath.value === "/platform-admin/capacity",
  ),
  isPlatformOperationsRoute = computed(
    () =>
      props.shell === "platform_admin" &&
      platformOperationsNavigation.some((item) => item.path === routePath.value),
  ),
  isTrends = computed(() => props.shell === "member" && routePath.value === "/trends"),
  isScoringRules = computed(
    () => props.shell === "member" && routePath.value === "/opportunities/scoring-rules",
  ),
  isSelectionJourney = computed(
    () => props.shell === "member" && routePath.value === "/opportunities/start",
  ),
  isOpportunities = computed(
    () =>
      props.shell === "member" &&
      (routePath.value === "/opportunities" || routePath.value.startsWith("/opportunities/")),
  ),
  isCompetitors = computed(
    () => props.shell === "member" && routePath.value.startsWith("/competitors"),
  ),
  isSourcing = computed(() => props.shell === "member" && routePath.value === "/sourcing"),
  isCostRules = computed(
    () => props.shell === "member" && routePath.value.startsWith("/sourcing/cost-rules"),
  ),
  opportunityId = computed(() => {
    const match = routePath.value.match(/^\/opportunities\/([0-9a-f-]{36})$/i);
    return match?.[1] ?? "";
  }),
  taskId = computed(() => {
    const match = routePath.value.match(/^\/tasks\/([0-9a-f-]{36})$/i);
    return match?.[1] ?? "";
  });
const activeSurface = computed(() => String(route.meta.surface ?? ""));
const activeCachePolicy = computed(() => String(route.meta.cachePolicy ?? "none"));
const selectedSurfaceComponent = computed(() => surfaceComponents[activeSurface.value] ?? null);
const surfaceCacheKey = computed(() => {
  const routeIdentity = String(route.name ?? routePath.value);
  if (activeCachePolicy.value !== "reset_on_scope") return routeIdentity;
  return `${routeIdentity}:${guard.value?.organization_id ?? "none"}:${guard.value?.workspace_id ?? "none"}`;
});
const selectedSurfaceProps = computed<Record<string, unknown>>(() => {
  const common = { apiBaseUrl: props.apiBaseUrl };
  switch (activeSurface.value) {
    case "task-workspace":
      return {
        ...common,
        mode: routePath.value === "/work" ? "today" : "all",
        taskId: taskId.value || undefined,
      };
    case "organization-admin-center":
      return {
        ...common,
        routePath: routePath.value,
        organizationId: guard.value?.organization_id || "",
      };
    case "platform-account-center":
      return {
        ...common,
        initialTab:
          routePath.value === "/platform-admin/admins" ||
          routePath.value === "/platform-admin/permissions"
            ? "admins"
            : routePath.value === "/platform-admin/users"
              ? "users"
              : "organizations",
      };
    case "platform-dashboard":
      return { ...common, capabilities: allCapabilities.value };
    case "platform-management-center":
      return { ...common, domain: routePath.value.split("/").pop() || "status" };
    case "trend-dashboard":
      return {
        ...common,
        organizationId: guard.value?.organization_id || "",
        workspaceId: guard.value?.workspace_id || "",
      };
    case "opportunity-workspace":
      return { ...common, opportunityId: opportunityId.value || undefined };
    case "cost-rule-console":
      return { ...common, roles: guard.value?.roles ?? [] };
    case "provider-runtime-surface":
      return { ...common, routePath: routePath.value, capabilities: allCapabilities.value };
    case "collection-runtime-surface":
      return { ...common, routePath: routePath.value };
    default:
      return common;
  }
});
const pageSummary = computed(() =>
  isOrganizationAdmin.value
    ? "组织资料、成员、角色、工作区、团队、审批、Token 与审计均受当前组织权限和审计边界保护。"
    : isPlatformDashboard.value
      ? "先看今天有没有新热点、采集是否正常，再处理需要人工确认的事项。"
      : isPlatformAccounts.value
        ? "管理组织、普通用户和平台管理员；不用理解内部权限代码。"
        : isBackupRecovery.value
          ? "备份副本、RPO/RTO 与隔离恢复结论均来自可审计记录；未验证条件明确阻断。"
          : isReleaseRollout.value
            ? "版本、迁移、渐进观察门、自动停止与回滚均来自宝塔发布任务的审计事实。"
            : isRuntimeTopology.value
              ? "当前惠州单机的 API 心跳、宝塔 Nginx 单上游和私有服务只按可审计事实判定；不启用负载均衡或多节点。"
              : isRedisResilience.value
                ? "当前宝塔单 Redis 的持久化、内存与连接上限、告警和恢复状态只按可审计事实判定；不启用 Sentinel、集群或副本。"
                : isMySqlResilience.value
                  ? "当前宝塔 MySQL 5.7 单主的持久化、I/O、慢查询、容量与隔离恢复只按可审计事实判定；不启用读副本、负载均衡或备用服务器。"
                  : isFileResilience.value
                    ? "当前宝塔本机证据与导出目录的组织隔离、容量、校验和与同机恢复只按可审计事实判定；不启用共享存储或备用服务器。"
                    : isTasks.value || isApprovals.value || isNotifications.value
                      ? "把选品工作拆成具体任务，查看负责人、期限、运行进度和处理记录。"
                      : isSourcing.value
                        ? "供应链候选、版本化报价、最多五家对比和采购任务均保留来源与缺失项。"
                        : isCompetitors.value
                          ? "持续记录竞品价格、评分、页面变化和告警，点击记录可查看详情。"
                          : isCostRules.value
                            ? "维护费用和汇率规则，计算商品利润并明确展示缺失成本。"
                            : isOpportunities.value
                              ? "汇总商品图片、趋势、竞争、利润、风险和原始证据，辅助判断是否值得做。"
                              : isTrends.value
                                ? "用热度、增速、来源和证据判断市场变化，并可转为选品机会。"
                                : "",
);
const contextName = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;
async function loadThemePreference(showFailure = false) {
  const sequence = ++themePreferenceSequence;
  try {
    const response = await request<ThemePreference>("/me/ui-preferences");
    if (!isThemeId(response.data?.theme)) throw new Error("主题偏好读取失败");
    if (sequence !== themePreferenceSequence) return false;
    activeTheme.value = response.data.theme;
    themeVersion.value = Number(response.data.version ?? 0);
    applyTheme(activeTheme.value);
    return true;
  } catch {
    if (showFailure) themeNotice.value = "主题偏好暂时无法同步，已保留当前界面主题。";
    return false;
  }
}
async function chooseTheme(theme: ThemeId) {
  if (themeVersion.value === null) await loadThemePreference(false);
  ++themePreferenceSequence;
  const previousTheme = activeTheme.value;
  applyTheme(theme);
  activeTheme.value = theme;
  themeOpen.value = false;
  themeNotice.value = "正在保存主题…";
  try {
    const response = await request<ThemePreference>("/me/ui-preferences", {
      method: "PUT",
      body: { theme, expected_version: themeVersion.value ?? 0 },
    });
    if (!isThemeId(response.data?.theme)) throw new Error("主题保存失败");
    activeTheme.value = response.data.theme;
    themeVersion.value = Number(response.data.version);
    applyTheme(activeTheme.value);
    themeNotice.value = "主题已应用到全部模块。";
  } catch {
    activeTheme.value = previousTheme;
    applyTheme(previousTheme);
    themeNotice.value = "主题保存失败，已恢复原主题，请稍后重试。";
  }
}
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
function shortcut(event: KeyboardEvent) {
  if (
    props.shell === "member" &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    discoveryMode.value = "search";
  }
}
onMounted(() => {
  void load();
  applyShellDensity(props.shell !== "member");
  if (props.shell === "member") void loadThemePreference(false);
  else applyTheme("cloud-white");
  window.addEventListener("keydown", shortcut);
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
    if (shell === "member") void loadThemePreference(false);
    else applyTheme("cloud-white");
  },
);
onUnmounted(() => {
  window.removeEventListener("keydown", shortcut);
  if (props.shell !== "member") {
    applyCachedTheme();
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
        <div v-if="shell === 'member'" class="role-theme-switcher">
          <button type="button" aria-label="切换界面主题" @click="themeOpen = !themeOpen">
            <AppIcon name="theme" /> <span>主题</span>
          </button>
        </div>
        <button v-if="shell === 'member'" type="button" @click="discoveryMode = 'search'">
          <AppIcon name="search" /> <span>搜索</span><kbd>快捷键</kbd>
        </button>
        <RouterLink
          v-if="shell === 'platform_admin' && allCapabilities.includes('platform:superadmin')"
          class="role-create"
          to="/platform-admin/organizations?create=1"
          ><AppIcon name="plus" /> <span>新建组织</span></RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin'"
          class="role-create"
          to="/org-admin/members"
          ><AppIcon name="plus" /> <span>邀请成员</span></RouterLink
        >
        <button
          v-else-if="shell === 'member'"
          type="button"
          class="role-create"
          @click="discoveryMode = 'create'"
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
          v-else-if="guard?.platform_roles?.length"
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
      <div v-if="shell === 'member'" class="role-sidebar-actions">
        <button type="button" @click="((discoveryMode = 'search'), (menuOpen = false))">
          <AppIcon name="search" /> 搜索
        </button>
        <button type="button" @click="((discoveryMode = 'create'), (menuOpen = false))">
          <AppIcon name="plus" /> 创建选品
        </button>
      </div>
      <nav v-if="state === 'ready'" class="role-nav-groups">
        <details
          v-for="group in menuGroups"
          :key="group.label"
          :open="group.items.some((item) => activeItem?.path === item.path)"
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
            @click="menuOpen = false"
            ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
          >
        </details>
      </nav>
    </aside>
    <section class="role-content">
      <section v-if="state !== 'ready'" class="role-gate-state" aria-live="polite">
        <span class="role-state-mark" aria-hidden="true">{{
          state === "loading" ? "···" : state === "forbidden" ? "×" : "!"
        }}</span>
        <p>访问保护</p>
        <h1>{{ stateCopy[0] }}</h1>
        <p>{{ stateCopy[1] }}</p>
        <small v-if="actionHint">{{ actionHint }}</small
        ><code v-if="requestId">关联编号：{{ requestId }}</code
        ><code v-if="traceId && traceId !== requestId">链路编号：{{ traceId }}</code>
        <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
        ><RouterLink v-else-if="state === 'context_required'" to="/select-context"
          >选择组织与工作区</RouterLink
        ><RouterLink v-else-if="state === 'forbidden'" to="/home">返回成员工作台</RouterLink
        ><button v-else-if="state !== 'loading'" type="button" @click="load">重新检查</button>
      </section>
      <template v-else-if="routeAllowed">
        <nav v-if="!opportunityId" class="role-page-breadcrumb" aria-label="面包屑">
          <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
            <span>{{ item }}</span
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
        <RouterLink :to="items[0]?.path || '/home'">返回工作台</RouterLink>
      </section>
    </section>
    <nav v-if="state === 'ready'" class="role-mobile-nav" aria-label="移动快捷导航">
      <RouterLink
        v-for="item in items.slice(0, 4)"
        :key="item.path"
        :to="item.path"
        :aria-current="activeItem?.path === item.path ? 'page' : undefined"
        ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
      ><button
        type="button"
        aria-controls="role-navigation"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <i><AppIcon name="menu" /></i><span>更多</span>
      </button>
    </nav>
    <div v-if="shell === 'member' && themeOpen" class="role-theme-menu">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        :aria-pressed="activeTheme === theme.id"
        @click="chooseTheme(theme.id)"
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
    <p v-if="shell === 'member' && themeNotice" class="role-theme-notice" role="status">
      {{ themeNotice }}
    </p>
    <DiscoveryOverlay
      :open="Boolean(discoveryMode)"
      :mode="discoveryMode || 'search'"
      :shell="shell"
      :api-base-url="apiBaseUrl"
      @close="discoveryMode = null"
    />
  </main>
</template>

<style scoped>
.platform-secondary-nav {
  position: sticky;
  top: 68px;
  z-index: 8;
  display: flex;
  gap: 4px;
  margin: -4px 0 18px;
  padding: 6px;
  overflow-x: auto;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--so-bg-elevated) 94%, transparent);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--so-shadow-color) 24%, transparent);
}

.platform-secondary-nav a {
  flex: 0 0 auto;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  padding: 0 13px;
  border-radius: 7px;
  color: var(--so-text-muted);
  text-decoration: none;
  font-weight: 750;
  white-space: nowrap;
}

.platform-secondary-nav a:hover,
.platform-secondary-nav a[aria-current="page"] {
  color: var(--so-text);
  background: var(--so-panel-soft);
}

.platform-secondary-nav a[aria-current="page"] {
  box-shadow: inset 0 -2px var(--so-primary);
}

.role-sidebar-actions {
  display: none;
}

@media (max-width: 840px) {
  .platform-secondary-nav {
    top: 64px;
    margin-inline: -4px;
  }

  .platform-secondary-nav a {
    min-height: 44px;
  }

  .role-sidebar-actions {
    margin-bottom: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .role-sidebar-actions button {
    min-height: 44px;
    border: 1px solid var(--so-border);
    border-radius: 10px;
    color: var(--so-text);
    background: var(--so-panel-soft);
    font-weight: 750;
  }

  .role-theme-switcher span {
    display: none;
  }
}
</style>
