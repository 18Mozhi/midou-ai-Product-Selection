<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { applyTheme, isThemeId, themes, type ThemeId } from "../design/theme";
import "../member-workspace-polish.css";

const componentModules = import.meta.glob<{ default: object }>("./*.vue");
const lazy = (name: string) => {
  const loader = componentModules[`./${name}.vue`];
  if (!loader) throw new Error(`missing lazy component: ${name}`);
  return defineAsyncComponent(loader);
};
const DiscoveryOverlay = lazy("DiscoveryOverlay"),
  HomeDashboard = lazy("HomeDashboard"),
  ProviderRegistry = lazy("ProviderRegistry"),
  CredentialAssetCenter = lazy("CredentialAssetCenter"),
  ProviderAdapterCenter = lazy("ProviderAdapterCenter"),
  CollectionRuntimeCenter = lazy("CollectionRuntimeCenter"),
  CollectionTaskCenter = lazy("CollectionTaskCenter"),
  PlatformDataCenter = lazy("PlatformDataCenter"),
  PlatformGovernanceCenter = lazy("PlatformGovernanceCenter"),
  ProviderSourceCenter = lazy("ProviderSourceCenter"),
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
  CollectionOperationsConsole = lazy("CollectionOperationsConsole"),
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
  PersonalCenter = lazy("PersonalCenter");

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
interface MenuItem {
  label: string;
  path: string;
  icon: string;
  capabilities?: string[];
}
const props = defineProps<{ shell: Shell; apiBaseUrl: string }>();
const route = useRoute();
const routePath = computed(() => route.path.replace(/\/$/, "") || "/");
const state = ref<State>("loading"),
  guard = ref<GuardSummary | null>(null),
  requestId = ref(""),
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
const memberMenu: MenuItem[] = [
  { label: "今日行动", path: "/home", icon: "⌂", capabilities: ["task:read"] },
  { label: "今日工作", path: "/work", icon: "✓", capabilities: ["task:read"] },
  {
    label: "热点趋势",
    path: "/trends",
    icon: "↗",
    capabilities: ["trend:read"],
  },
  {
    label: "选品机会",
    path: "/opportunities",
    icon: "◇",
    capabilities: ["opportunity:read"],
  },
  {
    label: "竞品监控",
    path: "/competitors",
    icon: "◎",
    capabilities: ["competitor:read"],
  },
  {
    label: "供应链与利润",
    path: "/sourcing",
    icon: "▣",
    capabilities: ["sourcing:read"],
  },
  {
    label: "任务中心",
    path: "/tasks",
    icon: "☷",
    capabilities: ["task:read"],
  },
  {
    label: "审批中心",
    path: "/tasks/approvals",
    icon: "✓",
    capabilities: ["task:read"],
  },
  {
    label: "通知中心",
    path: "/notifications",
    icon: "○",
    capabilities: ["notification:read"],
  },
  {
    label: "自动化规则",
    path: "/automations",
    icon: "⚙",
    capabilities: ["team:manage"],
  },
  {
    label: "报表与导出",
    path: "/reports",
    icon: "▥",
    capabilities: ["report:read"],
  },
  { label: "个人中心", path: "/me", icon: "◉" },
];
const orgMenu: MenuItem[] = [
  { label: "组织资料", path: "/org-admin", icon: "▰" },
  { label: "成员与邀请", path: "/org-admin/members", icon: "♙" },
  { label: "角色与权限", path: "/org-admin/roles", icon: "◇" },
  { label: "工作区与团队", path: "/org-admin/workspaces", icon: "▦" },
  { label: "任务与审批", path: "/org-admin/approvals", icon: "✓" },
  { label: "组织数据", path: "/org-admin/data", icon: "⌁" },
  { label: "组织 Token", path: "/org-admin/tokens", icon: "⌘" },
  { label: "组织审计", path: "/org-admin/audit", icon: "⊙" },
];
const platformMenu: MenuItem[] = [
  { label: "平台概览", path: "/platform-admin", icon: "⌂" },
  {
    label: "账号与组织",
    path: "/platform-admin/accounts",
    icon: "♙",
    capabilities: ["platform:superadmin"],
  },
  {
    label: "人员与权限",
    path: "/platform-admin/permissions",
    icon: "◇",
    capabilities: ["platform:superadmin"],
  },
  {
    label: "热点来源",
    path: "/platform-admin/providers/sources",
    icon: "◎",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "凭证与档案",
    path: "/platform-admin/credentials",
    icon: "⌘",
    capabilities: ["platform:superadmin"],
  },
  {
    label: "采集任务",
    path: "/platform-admin/collection/overview",
    icon: "↻",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "全量数据",
    path: "/platform-admin/data",
    icon: "▦",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "规则与自动化",
    path: "/platform-admin/governance",
    icon: "⚙",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "内容管理",
    path: "/platform-admin/content",
    icon: "▤",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "通知管理",
    path: "/platform-admin/notifications",
    icon: "○",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "开放平台",
    path: "/platform-admin/open-platform",
    icon: "⇄",
    capabilities: ["platform:superadmin"],
  },
  {
    label: "配额管理",
    path: "/platform-admin/commercial",
    icon: "¥",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "系统状态",
    path: "/platform-admin/status",
    icon: "●",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "安全与审计",
    path: "/platform-admin/security",
    icon: "⊙",
    capabilities: ["platform:secure", "platform:superadmin"],
  },
  {
    label: "高级设置",
    path: "/platform-admin/operations",
    icon: "⌬",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
];
const allCapabilities = computed(() =>
  props.shell === "platform_admin"
    ? (guard.value?.platform_capabilities ?? [])
    : (guard.value?.capabilities ?? []),
);
const items = computed(() => {
  const source =
    props.shell === "member"
      ? memberMenu
      : props.shell === "organization_admin"
        ? orgMenu
        : platformMenu;
  return source.filter(
    (item) =>
      !item.capabilities || item.capabilities.some((cap) => allCapabilities.value.includes(cap)),
  );
});
const activeItem = computed(
  () =>
    items.value.find((item) => item.path === routePath.value) ||
    items.value.find((item) => item.path !== "/" && routePath.value.startsWith(`${item.path}/`)) ||
    items.value[0],
);
const shellTitle = computed(() =>
  props.shell === "member"
    ? "成员工作台"
    : props.shell === "organization_admin"
      ? "组织管理后台"
      : "平台管理后台",
);
const pageTitle = computed(() =>
  routePath.value === "/" || routePath.value === "/home"
    ? "今日行动"
    : routePath.value === "/opportunities/start"
      ? "真实选品"
      : routePath.value === "/opportunities/scoring-rules"
        ? "评分规则"
        : routePath.value === "/sourcing/cost-rules"
          ? "费用与利润规则"
          : routePath.value === "/sourcing"
            ? "供应链与利润"
            : routePath.value === "/platform-admin/crawler-scheduler"
              ? "采集调度"
              : (activeItem.value?.label ?? shellTitle.value),
);
const isHome = computed(
    () => props.shell === "member" && (routePath.value === "/" || routePath.value === "/home"),
  ),
  isTasks = computed(
    () => props.shell === "member" && ["/work", "/tasks"].includes(routePath.value),
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
      ["/platform-admin/accounts", "/platform-admin/permissions"].includes(routePath.value),
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
    const response = await fetch(`${props.apiBaseUrl}/me/ui-preferences`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !isThemeId(body?.data?.theme))
      throw new Error(body?.error?.action_hint ?? "主题偏好读取失败");
    if (sequence !== themePreferenceSequence) return false;
    activeTheme.value = body.data.theme;
    themeVersion.value = Number(body.data.version ?? 0);
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
    const response = await fetch(`${props.apiBaseUrl}/me/ui-preferences`, {
      method: "PUT",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ theme, expected_version: themeVersion.value ?? 0 }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !isThemeId(body?.data?.theme))
      throw new Error(body?.error?.action_hint ?? "主题保存失败");
    activeTheme.value = body.data.theme;
    themeVersion.value = Number(body.data.version);
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
  actionHint.value = "";
  try {
    const response = await fetch(`${props.apiBaseUrl}/me/navigation?shell=${props.shell}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    actionHint.value = body?.error?.action_hint ?? "";
    if (!response.ok) {
      state.value =
        response.status === 401
          ? "expired"
          : response.status === 403
            ? "forbidden"
            : response.status === 409
              ? "context_required"
              : response.status === 429
                ? "rate_limited"
                : "blocked";
      return;
    }
    guard.value = body.data;
    state.value = "ready";
  } catch {
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
  void loadThemePreference(false);
  window.addEventListener("keydown", shortcut);
});
onUnmounted(() => window.removeEventListener("keydown", shortcut));
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
        ☰ <span>菜单</span>
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
            ◐ <span>主题</span>
          </button>
        </div>
        <button v-if="shell === 'member'" type="button" @click="discoveryMode = 'search'">
          ⌕ <span>搜索</span><kbd>快捷键</kbd>
        </button>
        <RouterLink
          v-if="shell === 'platform_admin'"
          class="role-create"
          to="/platform-admin/accounts?create=1"
          >＋ <span>新建组织</span></RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin'"
          class="role-create"
          to="/org-admin/members"
          >＋ <span>邀请成员</span></RouterLink
        >
        <button v-else type="button" class="role-create" @click="discoveryMode = 'create'">
          ＋ <span>创建选品</span>
        </button>
        <RouterLink
          v-if="shell === 'platform_admin'"
          class="role-switch"
          to="/home"
          aria-label="进入用户工作台"
          ><span class="role-switch-desktop">进入用户工作台</span
          ><span class="role-switch-mobile">用户面板</span></RouterLink
        >
        <RouterLink
          v-else-if="guard?.platform_roles?.length"
          class="role-switch"
          to="/platform-admin"
          aria-label="进入管理后台"
          ><span class="role-switch-desktop">进入管理后台</span
          ><span class="role-switch-mobile">管理后台</span></RouterLink
        >
        <RouterLink v-if="shell === 'member'" to="/notifications" aria-label="通知中心"
          >○</RouterLink
        ><RouterLink to="/me" aria-label="个人中心">◉</RouterLink>
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
        ><small>{{
          shell === "member"
            ? "当前组织业务范围"
            : shell === "organization_admin"
              ? "仅当前组织"
              : "平台角色授权范围"
        }}</small>
      </div>
      <div v-if="shell === 'member'" class="role-sidebar-actions">
        <button type="button" @click="((discoveryMode = 'search'), (menuOpen = false))">
          ⌕ 搜索
        </button>
        <button type="button" @click="((discoveryMode = 'create'), (menuOpen = false))">
          ＋ 创建选品
        </button>
      </div>
      <nav v-if="state === 'ready'">
        <RouterLink
          v-for="item in items"
          :key="item.path"
          :to="item.path"
          :aria-current="activeItem?.path === item.path ? 'page' : undefined"
          @click="menuOpen = false"
          ><i>{{ item.icon }}</i
          ><span>{{ item.label }}</span></RouterLink
        >
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
        ><code v-if="requestId">关联编号：{{ requestId }}</code>
        <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
        ><RouterLink v-else-if="state === 'context_required'" to="/select-context"
          >选择组织与工作区</RouterLink
        ><RouterLink v-else-if="state === 'forbidden'" to="/home">返回成员工作台</RouterLink
        ><button v-else-if="state !== 'loading'" type="button" @click="load">重新检查</button>
      </section>
      <template v-else>
        <header v-if="!opportunityId" class="role-page-head">
          <div>
            <p>{{ shellTitle }}</p>
            <h1>{{ pageTitle }}</h1>
            <span v-if="pageSummary">{{ pageSummary }}</span>
          </div>
        </header>
        <KeepAlive :max="12">
          <HomeDashboard v-if="isHome" :api-base-url="apiBaseUrl" />
          <TaskWorkspace
            v-else-if="isTasks"
            :api-base-url="apiBaseUrl"
            :mode="routePath === '/work' ? 'today' : 'all'"
          />
          <ApprovalWorkspace v-else-if="isApprovals" :api-base-url="apiBaseUrl" />
          <NotificationCenter v-else-if="isNotifications" :api-base-url="apiBaseUrl" />
          <AutomationRuleCenter v-else-if="isAutomations" :api-base-url="apiBaseUrl" />
          <ReportCenter v-else-if="isReports" :api-base-url="apiBaseUrl" />
          <PersonalCenter v-else-if="isPersonal" :api-base-url="apiBaseUrl" />
          <OrganizationAdminCenter
            v-else-if="isOrganizationAdmin"
            :api-base-url="apiBaseUrl"
            :route-path="routePath"
            :organization-id="guard?.organization_id || ''"
          />
          <PlatformDashboard v-else-if="isPlatformDashboard" :api-base-url="apiBaseUrl" />
          <PlatformAccountCenter
            v-else-if="isPlatformAccounts"
            :api-base-url="apiBaseUrl"
            :initial-tab="routePath === '/platform-admin/permissions' ? 'admins' : 'organizations'"
          />
          <PlatformManagementCenter
            v-else-if="isPlatformManagement"
            :api-base-url="apiBaseUrl"
            :domain="routePath.split('/').pop() || 'status'"
          />
          <PlatformGovernanceCenter v-else-if="isPlatformGovernance" :api-base-url="apiBaseUrl" />
          <BackupRecoveryCenter v-else-if="isBackupRecovery" :api-base-url="apiBaseUrl" />
          <ReleaseRolloutCenter v-else-if="isReleaseRollout" :api-base-url="apiBaseUrl" />
          <RuntimeTopologyCenter v-else-if="isRuntimeTopology" :api-base-url="apiBaseUrl" />
          <RedisResilienceCenter v-else-if="isRedisResilience" :api-base-url="apiBaseUrl" />
          <MySqlResilienceCenter v-else-if="isMySqlResilience" :api-base-url="apiBaseUrl" />
          <FileResilienceCenter v-else-if="isFileResilience" :api-base-url="apiBaseUrl" />
          <CrawlerSchedulerCenter v-else-if="isCrawlerScheduler" :api-base-url="apiBaseUrl" />
          <CapacityBoundaryCenter v-else-if="isCapacityBoundary" :api-base-url="apiBaseUrl" />
          <TrendDashboard
            v-else-if="isTrends"
            :api-base-url="apiBaseUrl"
            :organization-id="guard?.organization_id || ''"
            :workspace-id="guard?.workspace_id || ''"
          />
          <ScoreRuleConsole v-else-if="isScoringRules" :api-base-url="apiBaseUrl" />
          <SelectionJourney v-else-if="isSelectionJourney" :api-base-url="apiBaseUrl" />
          <OpportunityWorkspace
            v-else-if="isOpportunities"
            :api-base-url="apiBaseUrl"
            :opportunity-id="opportunityId || undefined"
          />
          <CompetitorMonitor v-else-if="isCompetitors" :api-base-url="apiBaseUrl" />
          <SourcingWorkspace v-else-if="isSourcing" :api-base-url="apiBaseUrl" />
          <CostRuleConsole
            v-else-if="isCostRules"
            :api-base-url="apiBaseUrl"
            :roles="guard?.roles ?? []"
          />
          <section
            v-else-if="
              shell === 'platform_admin' && routePath.startsWith('/platform-admin/providers')
            "
            class="provider-runtime-surface"
          >
            <nav class="provider-runtime-tabs" aria-label="来源管理视图">
              <a
                href="/platform-admin/providers"
                :aria-current="routePath === '/platform-admin/providers' ? 'page' : undefined"
                >来源设置（高级）</a
              ><a
                href="/platform-admin/providers/adapters"
                :aria-current="
                  routePath === '/platform-admin/providers/adapters' ? 'page' : undefined
                "
                >采集程序（高级）</a
              ><a
                href="/platform-admin/providers/sources"
                :aria-current="
                  routePath === '/platform-admin/providers/sources' ? 'page' : undefined
                "
                >来源频道</a
              >
            </nav>
            <ProviderSourceCenter
              v-if="routePath === '/platform-admin/providers/sources'"
              :api-base-url="apiBaseUrl"
            />
            <ProviderAdapterCenter
              v-else-if="routePath === '/platform-admin/providers/adapters'"
              :api-base-url="apiBaseUrl"
            />
            <ProviderRegistry v-else :api-base-url="apiBaseUrl" />
          </section>
          <CredentialAssetCenter
            v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/credentials'"
            :api-base-url="apiBaseUrl"
          />
          <section
            v-else-if="
              shell === 'platform_admin' && routePath.startsWith('/platform-admin/collection')
            "
            class="provider-runtime-surface"
          >
            <nav class="provider-runtime-tabs" aria-label="采集控制台视图">
              <a
                href="/platform-admin/collection/overview"
                :aria-current="
                  routePath === '/platform-admin/collection/overview' ? 'page' : undefined
                "
                >采集总览</a
              ><a
                href="/platform-admin/collection"
                :aria-current="routePath === '/platform-admin/collection' ? 'page' : undefined"
                >任务详情</a
              ><a
                href="/platform-admin/collection/browser-runtime"
                :aria-current="
                  routePath === '/platform-admin/collection/browser-runtime' ? 'page' : undefined
                "
                >网页登录采集（高级）</a
              >
            </nav>
            <CollectionOperationsConsole
              v-if="routePath === '/platform-admin/collection/overview'"
              :api-base-url="apiBaseUrl"
            />
            <CollectionRuntimeCenter
              v-else-if="routePath === '/platform-admin/collection/browser-runtime'"
              :api-base-url="apiBaseUrl"
            />
            <CollectionTaskCenter v-else :api-base-url="apiBaseUrl" />
          </section>
          <PlatformDataCenter
            v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/data'"
            :api-base-url="apiBaseUrl"
          />
          <SecurityOperationsCenter
            v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/security'"
            :api-base-url="apiBaseUrl"
          />
          <OpenPlatformCenter
            v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/open-platform'"
            :api-base-url="apiBaseUrl"
          />
          <CommercialOperationsCenter
            v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/commercial'"
            :api-base-url="apiBaseUrl"
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
    </section>
    <nav v-if="state === 'ready'" class="role-mobile-nav" aria-label="移动快捷导航">
      <RouterLink
        v-for="item in items.slice(0, 4)"
        :key="item.path"
        :to="item.path"
        :aria-current="activeItem?.path === item.path ? 'page' : undefined"
        ><i>{{ item.icon }}</i
        ><span>{{ item.label }}</span></RouterLink
      ><button
        type="button"
        aria-controls="role-navigation"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <i>☰</i><span>更多</span>
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
      <a href="/settings/theme">更多外观设置</a>
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
.role-sidebar-actions {
  display: none;
}

@media (max-width: 840px) {
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
