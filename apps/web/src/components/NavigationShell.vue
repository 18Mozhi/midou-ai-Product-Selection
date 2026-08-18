<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import DiscoveryOverlay from "./DiscoveryOverlay.vue";
import HomeDashboard from "./HomeDashboard.vue";
import ProviderRegistry from "./ProviderRegistry.vue";
import CredentialAssetCenter from "./CredentialAssetCenter.vue";
import ProviderAdapterCenter from "./ProviderAdapterCenter.vue";
import CollectionRuntimeCenter from "./CollectionRuntimeCenter.vue";
import CollectionTaskCenter from "./CollectionTaskCenter.vue";
import DataQualityCenter from "./DataQualityCenter.vue";
import ProviderSourceCenter from "./ProviderSourceCenter.vue";
import TrendDashboard from "./TrendDashboard.vue";
import OpportunityWorkspace from "./OpportunityWorkspace.vue";
import SelectionJourney from "./SelectionJourney.vue";
import ScoreRuleConsole from "./ScoreRuleConsole.vue";
import CostRuleConsole from "./CostRuleConsole.vue";
import CompetitorMonitor from "./CompetitorMonitor.vue";
import SourcingWorkspace from "./SourcingWorkspace.vue";
import TaskWorkspace from "./TaskWorkspace.vue";
import ApprovalWorkspace from "./ApprovalWorkspace.vue";
import NotificationCenter from "./NotificationCenter.vue";
import AutomationRuleCenter from "./AutomationRuleCenter.vue";
import ReportCenter from "./ReportCenter.vue";
import OrganizationAdminCenter from "./OrganizationAdminCenter.vue";
import PlatformDashboard from "./PlatformDashboard.vue";
import CollectionOperationsConsole from "./CollectionOperationsConsole.vue";
import SecurityOperationsCenter from "./SecurityOperationsCenter.vue";
import OpenPlatformCenter from "./OpenPlatformCenter.vue";
import CommercialOperationsCenter from "./CommercialOperationsCenter.vue";
import BackupRecoveryCenter from "./BackupRecoveryCenter.vue";
import ReleaseRolloutCenter from "./ReleaseRolloutCenter.vue";
import RuntimeTopologyCenter from "./RuntimeTopologyCenter.vue";
import RedisResilienceCenter from "./RedisResilienceCenter.vue";
import MySqlResilienceCenter from "./MySqlResilienceCenter.vue";
import FileResilienceCenter from "./FileResilienceCenter.vue";
import CrawlerSchedulerCenter from "./CrawlerSchedulerCenter.vue";
import CapacityBoundaryCenter from "./CapacityBoundaryCenter.vue";
import PlatformAccountCenter from "./PlatformAccountCenter.vue";

type Shell = "member" | "organization_admin" | "platform_admin";
type State =
  | "loading"
  | "ready"
  | "expired"
  | "forbidden"
  | "context_required"
  | "rate_limited"
  | "blocked";
interface GuardSummary {
  shell: Shell;
  organization_id: string | null;
  workspace_id: string | null;
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
const state = ref<State>("loading"),
  guard = ref<GuardSummary | null>(null),
  requestId = ref(""),
  actionHint = ref(""),
  menuOpen = ref(false),
  discoveryMode = ref<"search" | "create" | null>(null);
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
  { label: "自动化规则", path: "/automations", icon: "⚙", capabilities: ["team:manage"] },
  { label: "报表与导出", path: "/reports", icon: "▥", capabilities: ["report:read"] },
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
  { label: "组织与用户", path: "/platform-admin/accounts", icon: "♙", capabilities: ["platform:superadmin"] },
  {
    label: "热点来源",
    path: "/platform-admin/providers/sources",
    icon: "◎",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "采集任务",
    path: "/platform-admin/collection/overview",
    icon: "↻",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "数据质量",
    path: "/platform-admin/data",
    icon: "▦",
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
      !item.capabilities ||
      item.capabilities.some((cap) => allCapabilities.value.includes(cap)),
  );
});
const activeItem = computed(
  () =>
    items.value.find((item) => item.path === window.location.pathname) ||
    items.value.find(
      (item) =>
        item.path !== "/" &&
        window.location.pathname.startsWith(`${item.path}/`),
    ) ||
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
  routePath === "/" || routePath === "/home"
    ? "今日行动"
    : routePath === "/opportunities/start"
    ? "真实选品"
    : routePath === "/opportunities/scoring-rules"
    ? "评分规则"
    : routePath === "/sourcing/cost-rules"
      ? "费用与利润规则"
      : routePath === "/sourcing"
        ? "供应链与利润"
        : (activeItem.value?.label ?? shellTitle.value),
);
const routePath = window.location.pathname.replace(/\/$/, "") || "/",
  isHome = computed(() =>
    props.shell === "member" && (routePath === "/" || routePath === "/home"),
  ),
  isTasks = computed(
    () => props.shell === "member" && ["/work", "/tasks"].includes(routePath),
  ),
  isApprovals = computed(
    () => props.shell === "member" && routePath === "/tasks/approvals",
  ),
  isNotifications = computed(
    () => props.shell === "member" && routePath === "/notifications",
  ),
  isAutomations = computed(
    () => props.shell === "member" && routePath === "/automations",
  ),
  isReports = computed(
    () => props.shell === "member" && routePath === "/reports",
  ),
  isOrganizationAdmin = computed(() => props.shell === "organization_admin" && routePath.startsWith("/org-admin")),
  isPlatformDashboard = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin"),
  isPlatformAccounts = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/accounts"),
  isBackupRecovery = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/operations"),
  isReleaseRollout = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/releases"),
  isRuntimeTopology = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/topology"),
  isRedisResilience = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/redis"),
  isMySqlResilience = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/mysql"),
  isFileResilience = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/files"),
  isCrawlerScheduler = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/crawler-scheduler"),
  isCapacityBoundary = computed(() => props.shell === "platform_admin" && routePath === "/platform-admin/capacity"),
  isTrends = computed(
    () => props.shell === "member" && routePath === "/trends",
  ),
  isScoringRules = computed(
    () =>
      props.shell === "member" && routePath === "/opportunities/scoring-rules",
  ),
  isSelectionJourney=computed(()=>props.shell==="member"&&routePath==="/opportunities/start"),
  isOpportunities = computed(
    () =>
      props.shell === "member" &&
      (routePath === "/opportunities" ||
        routePath.startsWith("/opportunities/")),
  ),
  isCompetitors = computed(
    () => props.shell === "member" && routePath.startsWith("/competitors"),
  ),
  isSourcing = computed(
    () => props.shell === "member" && routePath === "/sourcing",
  ),
  isCostRules = computed(
    () =>
      props.shell === "member" && routePath.startsWith("/sourcing/cost-rules"),
  ),
  opportunityId = computed(() => {
    const match = routePath.match(/^\/opportunities\/([0-9a-f-]{36})$/i);
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
    ? "任务状态、负责人、期限、评论、转交和 SLA 均由当前工作区真实 API 驱动。"
    : isSourcing.value
      ? "供应链候选、版本化报价、最多五家对比和采购任务均保留来源与缺失项。"
      : isCompetitors.value
        ? "竞品身份、来源快照、变化记录和阈值告警由真实 API 与 Worker 驱动。"
        : isCostRules.value
          ? "版本化费用、双审批、汇率来源与利润计算由真实 API 和 Worker 驱动。"
          : isOpportunities.value
            ? "机会、证据覆盖和人工决策由当前组织与工作区的真实 API 驱动。"
            : isTrends.value
              ? "趋势主题、证据、关注和监控规则均由当前组织与工作区的真实 API 驱动。"
              : "当前功能由真实 API、最小权限和审计记录驱动。",
);
const short = (value: string | null) =>
  value ? `${value.slice(0, 8)}…` : "不适用";
const stateCopy = computed(
  () =>
    (
      ({
        expired: ["登录已失效", "重新登录后返回当前页面。"],
        forbidden: [
          "无权进入此工作台",
          "服务端已拒绝该壳层；返回有权访问的工作台。",
        ],
        context_required: [
          "尚未选择组织与工作区",
          "完成租户选择后才能进入成员或组织后台。",
        ],
        rate_limited: ["请求过于频繁", "稍后重试；不要连续刷新。"],
        blocked: [
          "导航服务暂不可用",
          "检查网络后重试；运维可在宝塔查看 Node API。",
        ],
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
    const response = await fetch(
      `${props.apiBaseUrl}/me/navigation?shell=${props.shell}`,
      { credentials: "include", headers: { accept: "application/json" } },
    );
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
  if (props.shell === "member" && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    discoveryMode.value = "search";
  }
}
onMounted(() => {
  void load();
  window.addEventListener("keydown", shortcut);
});
onUnmounted(() => window.removeEventListener("keydown", shortcut));
</script>

<template>
  <main class="role-shell" :data-shell="shell" :data-state="state">
    <header class="role-topbar">
      <a
        class="role-brand"
        :href="
          shell === 'member'
            ? '/home'
            : shell === 'organization_admin'
              ? '/org-admin'
              : '/platform-admin'
        "
        ><span>S</span><b>ai选品</b><em>{{shell==='platform_admin'?'管理员':shell==='organization_admin'?'组织后台':'选品工作台'}}</em></a
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
          ><small>组织</small>{{ short(guard?.organization_id ?? null) }}</span
        ><span v-if="shell !== 'platform_admin'"
          ><small>工作区</small>{{ short(guard?.workspace_id ?? null) }}</span
        ><span v-else><small>范围</small>平台全局</span>
      </div>
      <div class="role-top-actions">
        <button v-if="shell === 'member'" type="button" @click="discoveryMode = 'search'">
          ⌕ <span>搜索</span><kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          class="role-create"
          @click="discoveryMode = 'create'"
        >
          ＋ <span>创建</span>
        </button>
        <a v-if="shell === 'member'" href="/notifications" aria-label="通知中心">○</a
        ><a href="/me" aria-label="个人中心">◉</a>
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
      <nav v-if="state === 'ready'">
        <a
          v-for="item in items"
          :key="item.path"
          :href="item.path"
          :aria-current="activeItem?.path === item.path ? 'page' : undefined"
          @click="menuOpen = false"
          ><i>{{ item.icon }}</i
          ><span>{{ item.label }}</span></a
        >
      </nav>
      <div class="role-sidebar-foot">
        <span aria-hidden="true">●</span>
        <p>
          <strong>权限由服务端裁决</strong><small>前端菜单不是安全边界</small>
        </p>
      </div>
    </aside>
    <section class="role-content">
      <section
        v-if="state !== 'ready'"
        class="role-gate-state"
        aria-live="polite"
      >
        <span class="role-state-mark" aria-hidden="true">{{
          state === "loading" ? "···" : state === "forbidden" ? "×" : "!"
        }}</span>
        <p>ROUTE GUARD</p>
        <h1>{{ stateCopy[0] }}</h1>
        <p>{{ stateCopy[1] }}</p>
        <small v-if="actionHint">{{ actionHint }}</small
        ><code v-if="requestId">request_id: {{ requestId }}</code>
        <a v-if="state === 'expired'" href="/login">重新登录</a
        ><a v-else-if="state === 'context_required'" href="/select-context"
          >选择组织与工作区</a
        ><a v-else-if="state === 'forbidden'" href="/home">返回成员工作台</a
        ><button v-else-if="state !== 'loading'" type="button" @click="load">
          重新检查
        </button>
      </section>
      <template v-else>
        <header class="role-page-head">
          <div>
            <p>{{ shellTitle }}</p>
            <h1>{{ pageTitle }}</h1>
            <span>{{ pageSummary }}</span>
          </div>
          <b>{{ guard?.guard_reason }}</b>
        </header>
        <HomeDashboard v-if="isHome" :api-base-url="apiBaseUrl" />
        <TaskWorkspace
          v-else-if="isTasks"
          :api-base-url="apiBaseUrl"
          :mode="routePath === '/work' ? 'today' : 'all'"
        />
        <ApprovalWorkspace v-else-if="isApprovals" :api-base-url="apiBaseUrl" />
        <NotificationCenter
          v-else-if="isNotifications"
          :api-base-url="apiBaseUrl"
        />
        <AutomationRuleCenter
          v-else-if="isAutomations"
          :api-base-url="apiBaseUrl"
        />
        <ReportCenter v-else-if="isReports" :api-base-url="apiBaseUrl" />
        <OrganizationAdminCenter
          v-else-if="isOrganizationAdmin"
          :api-base-url="apiBaseUrl"
          :route-path="routePath"
          :organization-id="guard?.organization_id || ''"
        />
        <PlatformDashboard v-else-if="isPlatformDashboard" :api-base-url="apiBaseUrl" />
        <PlatformAccountCenter v-else-if="isPlatformAccounts" :api-base-url="apiBaseUrl" />
        <BackupRecoveryCenter v-else-if="isBackupRecovery" :api-base-url="apiBaseUrl" />
        <ReleaseRolloutCenter v-else-if="isReleaseRollout" :api-base-url="apiBaseUrl" />
        <RuntimeTopologyCenter v-else-if="isRuntimeTopology" :api-base-url="apiBaseUrl" />
        <RedisResilienceCenter v-else-if="isRedisResilience" :api-base-url="apiBaseUrl" />
        <MySqlResilienceCenter v-else-if="isMySqlResilience" :api-base-url="apiBaseUrl" />
        <FileResilienceCenter v-else-if="isFileResilience" :api-base-url="apiBaseUrl" />
        <CrawlerSchedulerCenter v-else-if="isCrawlerScheduler" :api-base-url="apiBaseUrl" />
        <CapacityBoundaryCenter v-else-if="isCapacityBoundary" :api-base-url="apiBaseUrl" />
        <TrendDashboard v-else-if="isTrends" :api-base-url="apiBaseUrl" :organization-id="guard?.organization_id||''" :workspace-id="guard?.workspace_id||''" />
        <ScoreRuleConsole
          v-else-if="isScoringRules"
          :api-base-url="apiBaseUrl"
        />
        <SelectionJourney v-else-if="isSelectionJourney" :api-base-url="apiBaseUrl" />
        <OpportunityWorkspace
          v-else-if="isOpportunities"
          :api-base-url="apiBaseUrl"
          :opportunity-id="opportunityId || undefined"
        />
        <CompetitorMonitor
          v-else-if="isCompetitors"
          :api-base-url="apiBaseUrl"
        />
        <SourcingWorkspace v-else-if="isSourcing" :api-base-url="apiBaseUrl" />
        <CostRuleConsole
          v-else-if="isCostRules"
          :api-base-url="apiBaseUrl"
          :roles="guard?.roles ?? []"
        />
        <section
          v-else-if="
            shell === 'platform_admin' &&
            routePath.startsWith('/platform-admin/providers')
          "
          class="provider-runtime-surface"
        >
          <nav class="provider-runtime-tabs" aria-label="来源管理视图">
            <a
              href="/platform-admin/providers"
              :aria-current="
                routePath === '/platform-admin/providers' ? 'page' : undefined
              "
              >来源定义</a
            ><a
              href="/platform-admin/providers/adapters"
              :aria-current="
                routePath === '/platform-admin/providers/adapters'
                  ? 'page'
                  : undefined
              "
              >适配器运行时</a
            ><a
              href="/platform-admin/providers/sources"
              :aria-current="
                routePath === '/platform-admin/providers/sources'
                  ? 'page'
                  : undefined
              "
              >首批来源</a
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
          v-else-if="
            shell === 'platform_admin' &&
            routePath === '/platform-admin/credentials'
          "
          :api-base-url="apiBaseUrl"
        />
        <section
          v-else-if="
            shell === 'platform_admin' &&
            routePath.startsWith('/platform-admin/collection')
          "
          class="provider-runtime-surface"
        >
          <nav class="provider-runtime-tabs" aria-label="采集控制台视图">
            <a
              href="/platform-admin/collection/overview"
              :aria-current="routePath === '/platform-admin/collection/overview' ? 'page' : undefined"
              >运营总览</a
            ><a
              href="/platform-admin/collection"
              :aria-current="
                routePath === '/platform-admin/collection' ? 'page' : undefined
              "
              >任务状态机</a
            ><a
              href="/platform-admin/collection/browser-runtime"
              :aria-current="
                routePath === '/platform-admin/collection/browser-runtime'
                  ? 'page'
                  : undefined
              "
              >浏览器运行时</a
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
        <DataQualityCenter
          v-else-if="
            shell === 'platform_admin' && routePath === '/platform-admin/data'
          "
          :api-base-url="apiBaseUrl"
        />
        <SecurityOperationsCenter v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/security'" :api-base-url="apiBaseUrl" />
        <OpenPlatformCenter v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/open-platform'" :api-base-url="apiBaseUrl" />
        <CommercialOperationsCenter v-else-if="shell === 'platform_admin' && routePath === '/platform-admin/commercial'" :api-base-url="apiBaseUrl" />
        <section v-else class="role-gate-state" aria-live="polite">
          <span class="role-state-mark" aria-hidden="true">?</span>
          <p>PAGE NOT FOUND</p>
          <h2>页面不存在</h2>
          <p>该地址没有可用功能，请从左侧真实功能菜单重新进入。</p>
          <a :href="items[0]?.path || '/'">返回工作台</a>
        </section>
      </template>
    </section>
    <nav
      v-if="state === 'ready'"
      class="role-mobile-nav"
      aria-label="移动快捷导航"
    >
      <a
        v-for="item in items.slice(0, 3)"
        :key="item.path"
        :href="item.path"
        :aria-current="activeItem?.path === item.path ? 'page' : undefined"
        ><i>{{ item.icon }}</i
        ><span>{{ item.label }}</span></a
      ><button v-if="shell === 'member'" type="button" @click="discoveryMode = 'search'">
        <i>⌕</i><span>搜索</span></button
      ><button type="button" @click="discoveryMode = 'create'">
        <i>＋</i><span>创建</span>
      </button>
    </nav>
    <DiscoveryOverlay
      :open="Boolean(discoveryMode)"
      :mode="discoveryMode || 'search'"
      :shell="shell"
      :api-base-url="apiBaseUrl"
      @close="discoveryMode = null"
    />
  </main>
</template>
