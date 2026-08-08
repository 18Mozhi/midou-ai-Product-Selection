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
import ScoreRuleConsole from "./ScoreRuleConsole.vue";
import CostRuleConsole from "./CostRuleConsole.vue";
import CompetitorMonitor from "./CompetitorMonitor.vue";
import SourcingWorkspace from "./SourcingWorkspace.vue";
import TaskWorkspace from "./TaskWorkspace.vue";

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
    label: "通知中心",
    path: "/notifications",
    icon: "○",
    capabilities: ["notification:read"],
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
  { label: "平台驾驶舱", path: "/platform-admin", icon: "⌂" },
  {
    label: "组织与账号",
    path: "/platform-admin/organizations",
    icon: "♙",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "平台管理员",
    path: "/platform-admin/admins",
    icon: "♜",
    capabilities: ["platform:superadmin"],
  },
  {
    label: "来源注册中心",
    path: "/platform-admin/providers",
    icon: "◎",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "凭证与档案",
    path: "/platform-admin/credentials",
    icon: "⌘",
    capabilities: ["platform:secure", "platform:superadmin"],
  },
  {
    label: "采集控制台",
    path: "/platform-admin/collection",
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
    icon: "◇",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "通知运营",
    path: "/platform-admin/notifications",
    icon: "○",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "Token 与开放 API",
    path: "/platform-admin/open-platform",
    icon: "⌁",
    capabilities: [
      "platform:operate",
      "platform:secure",
      "platform:superadmin",
    ],
  },
  {
    label: "安全与审计",
    path: "/platform-admin/security",
    icon: "⊙",
    capabilities: ["platform:secure", "platform:superadmin"],
  },
  {
    label: "监控与运维",
    path: "/platform-admin/operations",
    icon: "⌬",
    capabilities: ["platform:operate", "platform:superadmin"],
  },
  {
    label: "商业运营",
    path: "/platform-admin/commercial",
    icon: "▰",
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
  routePath === "/opportunities/scoring-rules"
    ? "评分规则"
    : routePath === "/sourcing/cost-rules"
      ? "费用与利润规则"
      : routePath === "/sourcing"
        ? "供应链与利润"
        : (activeItem.value?.label ?? shellTitle.value),
);
const routePath = window.location.pathname.replace(/\/$/, "") || "/",
  isHome = computed(() => props.shell === "member" && routePath === "/home"),
  isTasks = computed(
    () => props.shell === "member" && ["/work", "/tasks"].includes(routePath),
  ),
  isTrends = computed(
    () => props.shell === "member" && routePath === "/trends",
  ),
  isScoringRules = computed(
    () =>
      props.shell === "member" && routePath === "/opportunities/scoring-rules",
  ),
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
const phaseLabel = computed(() =>
  isTasks.value
    ? "P05"
    : isTrends.value ||
  isOpportunities.value ||
  isCompetitors.value ||
  isSourcing.value ||
  isCostRules.value
    ? "P04"
    : props.shell === "platform_admin" &&
        [
          "/platform-admin/providers",
          "/platform-admin/credentials",
          "/platform-admin/collection",
          "/platform-admin/data",
        ].some((path) => routePath.startsWith(path))
      ? "P03"
      : "P02",
);
const pageSummary = computed(() =>
  isTasks.value
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
            : phaseLabel.value === "P03"
              ? "来源、采集运行与证据数据均由对应模块的真实 API 和权限边界驱动。"
              : "导航与权限壳层已就绪；业务数据由对应阶段的真实 API 接入。",
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
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
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
        ><span>S</span><b>ScoutOps</b></a
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
        <button type="button" @click="discoveryMode = 'search'">
          ⌕ <span>搜索</span><kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          class="role-create"
          @click="discoveryMode = 'create'"
        >
          ＋ <span>创建</span>
        </button>
        <a href="/notifications" aria-label="通知中心">○</a
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
        <a v-if="state === 'expired'" href="/?view=local-identity">重新登录</a
        ><a v-else-if="state === 'context_required'" href="/?view=tenancy"
          >选择组织与工作区</a
        ><a v-else-if="state === 'forbidden'" href="/home">返回成员工作台</a
        ><button v-else-if="state !== 'loading'" type="button" @click="load">
          重新检查
        </button>
      </section>
      <template v-else>
        <header class="role-page-head">
          <div>
            <p>{{ shellTitle }} / {{ phaseLabel }}</p>
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
        <TrendDashboard v-else-if="isTrends" :api-base-url="apiBaseUrl" />
        <ScoreRuleConsole
          v-else-if="isScoringRules"
          :api-base-url="apiBaseUrl"
        />
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
          <CollectionRuntimeCenter
            v-if="routePath === '/platform-admin/collection/browser-runtime'"
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
        <section v-else class="role-ready-panel">
          <div class="role-ready-hero">
            <span>S</span>
            <div>
              <p>VERIFIED NAVIGATION</p>
              <h2>服务端已确认此工作台</h2>
              <p>
                当前只交付导航、响应式布局与路由状态，不展示示例指标或其他组织数据。
              </p>
            </div>
          </div>
          <dl>
            <div>
              <dt>壳层</dt>
              <dd>{{ shellTitle }}</dd>
            </div>
            <div>
              <dt>组织范围</dt>
              <dd>{{ short(guard?.organization_id ?? null) }}</dd>
            </div>
            <div>
              <dt>工作区范围</dt>
              <dd>{{ short(guard?.workspace_id ?? null) }}</dd>
            </div>
            <div>
              <dt>可见入口</dt>
              <dd>{{ items.length }} 项</dd>
            </div>
          </dl>
          <div class="role-scope-note">
            <strong>权限说明</strong>
            <p>
              {{
                shell === "platform_admin"
                  ? "平台角色与组织角色严格分离；平台壳层不依赖组织上下文。"
                  : shell === "organization_admin"
                    ? "仅 organization_admin 可进入；所有后续组织 API 仍需服务端能力与范围 Guard。"
                    : "活动成员可进入；菜单按服务端 capabilities 过滤，资源 API 仍执行数据范围 Guard。"
              }}
            </p>
          </div>
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
      ><button type="button" @click="discoveryMode = 'search'">
        <i>⌕</i><span>搜索</span></button
      ><button type="button" @click="discoveryMode = 'create'">
        <i>＋</i><span>创建</span>
      </button>
    </nav>
    <DiscoveryOverlay
      :open="Boolean(discoveryMode)"
      :mode="discoveryMode || 'search'"
      :api-base-url="apiBaseUrl"
      @close="discoveryMode = null"
    />
  </main>
</template>
