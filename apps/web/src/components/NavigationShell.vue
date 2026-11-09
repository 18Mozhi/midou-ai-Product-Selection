<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { applyCachedTheme, applyShellDensity, themes, type ThemeId } from "../design/theme";
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
  platformOperationsNavigation,
  routeEntityIds,
  surfaceProps,
  type NavigationShellKind,
} from "../navigation-shell-route-state";
import { navigationItemsFor, type ShellNavigationItem } from "../route-catalog";
import { useNavigationDiscovery } from "../use-navigation-discovery";
import { useNavigationShellTheme } from "../use-navigation-shell-theme";
import { useNavigationShellDrawer } from "../use-navigation-shell-drawer";
import "../styles/platform-operations.css";
import AppIcon from "./AppIcon.vue";
import SessionLogout from "./SessionLogout.vue";
import NavigationAccessPanel from "./NavigationAccessPanel.vue";
import NavigationMobileBar from "./NavigationMobileBar.vue";
import NavigationShellGate from "./NavigationShellGate.vue";
import NavigationWorkspaceSidebar from "./NavigationWorkspaceSidebar.vue";
import { DiscoveryOverlay, surfaceComponents } from "./navigation-surface-registry";
import "../member-workspace-polish.css";

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
const props = defineProps<{ shell: Shell; apiBaseUrl: string; account?: boolean }>();
const request = createApiClient(props.apiBaseUrl);
const route = useRoute();
const accountMenu = ref<HTMLDetailsElement | null>(null);
const topHelp = ref<HTMLDetailsElement | null>(null);
const nativeScrollbar = ref(false);
function hasClassicScrollbar() {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;inline-size:64px;block-size:64px;overflow:scroll;visibility:hidden";
  document.body.append(probe);
  try {
    return probe.offsetWidth > probe.clientWidth;
  } finally {
    probe.remove();
  }
}
function closeAccountMenu(restoreFocus = false) {
  if (!accountMenu.value) return;
  accountMenu.value.open = false;
  if (restoreFocus) accountMenu.value.querySelector("summary")?.focus();
}
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
const themeTrigger = ref<HTMLButtonElement | null>(null);
const themePanel = ref<HTMLElement | null>(null);
function closeThemePanel() {
  themeOpen.value = false;
  themeTrigger.value?.focus();
}
async function toggleThemePanel() {
  if (themeOpen.value) {
    closeThemePanel();
    return;
  }
  themeOpen.value = true;
  await nextTick();
  themePanel.value?.querySelector("button")?.focus();
}
function selectTheme(theme: ThemeId) {
  themeTrigger.value?.focus();
  return chooseTheme(theme, props.shell !== "platform_admin");
}
const discovery = useNavigationDiscovery(
  () => props.shell,
  () => state.value === "ready",
);
const { discoveryMode, openDiscovery, closeDiscovery, handleDiscoveryShortcut } = discovery;
const {
  navigationDialog,
  compact: compactNavigation,
  containTab,
} = useNavigationShellDrawer(menuOpen);
const allCapabilities = computed(() => shellCapabilities(props.shell, guard.value));
const items = computed(() =>
  // Personal routes remain session-only. These links do not grant access: each destination
  // still performs its normal server navigation guard.
  props.account && !guard.value
    ? navigationItemsFor("member")
    : authorizedNavigation(props.shell, allCapabilities.value, guard.value?.roles ?? []),
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
const routeAllowed = computed(
  () =>
    props.account ||
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
const quickActionLabel = computed(() =>
  props.shell === "organization_admin" ? "邀请成员" : "新建组织",
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
const contextName = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;
let navigationSequence = 0;
let navigationRead: AbortController | null = null;
async function load() {
  const current = ++navigationSequence,
    shell = props.shell,
    account = Boolean(props.account);
  navigationRead?.abort();
  const controller = new AbortController();
  navigationRead = controller;
  // Personal content is session-only and never waits for organization approval.
  // The optional read only restores the same authorized links/context on reload.
  state.value = account ? "ready" : "loading";
  if (!account || guard.value?.shell !== shell) guard.value = null;
  requestId.value = "";
  traceId.value = "";
  actionHint.value = "";
  try {
    const response = await request<GuardSummary>(`/me/navigation?shell=${shell}`, {
      signal: controller.signal,
    });
    if (current !== navigationSequence || controller.signal.aborted || shell !== props.shell)
      return;
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    guard.value = response.data;
    state.value = "ready";
  } catch (error) {
    if (current !== navigationSequence || controller.signal.aborted || shell !== props.shell)
      return;
    if (account) return;
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
  } finally {
    if (navigationRead === controller) navigationRead = null;
  }
}
onMounted(() => {
  nativeScrollbar.value = hasClassicScrollbar();
  void load();
  applyShellDensity(props.shell !== "member");
  applyCachedTheme();
  if (props.shell !== "platform_admin") void loadThemePreference(false);
  window.addEventListener("keydown", handleDiscoveryShortcut);
});
watch(
  () => route.fullPath,
  (fullPath) => {
    closeAccountMenu();
    themeOpen.value = false;
    if (topHelp.value) topHelp.value.open = false;
    closeDiscovery();
    menuOpen.value = false;
    if (props.shell === "member" && !props.account) rememberMemberRoute(fullPath);
  },
  { immediate: true },
);
watch(
  () => props.account,
  () => {
    closeDiscovery();
    menuOpen.value = false;
    void load();
  },
);
watch(
  () => props.shell,
  (shell) => {
    closeDiscovery();
    themeOpen.value = false;
    menuOpen.value = false;
    menuQuery.value = "";
    void load();
    applyShellDensity(shell !== "member");
    applyCachedTheme();
    if (shell !== "platform_admin") void loadThemePreference(false);
  },
);
onUnmounted(() => {
  ++navigationSequence;
  navigationRead?.abort();
  window.removeEventListener("keydown", handleDiscoveryShortcut);
  if (props.shell !== "member") {
    applyShellDensity(false);
  }
});
</script>

<template>
  <main
    class="role-shell role-shell--c"
    :data-shell="shell"
    :data-state="state"
    :data-native-scrollbar="nativeScrollbar || undefined"
  >
    <header class="role-topbar">
      <RouterLink
        class="role-brand"
        aria-label="米兜智能选品"
        :to="
          shell === 'member'
            ? '/home'
            : shell === 'organization_admin'
              ? '/org-admin'
              : '/platform-admin'
        "
        ><img class="midou-brand-mark" src="/midou-logo.jpg" alt="" /><b>米兜智能选品</b
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
      <div class="role-workspace-identity">
        <nav class="role-page-breadcrumb role-top-breadcrumb" aria-label="面包屑">
          <template v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">
            <RouterLink v-if="item.path" :to="item.path">{{ item.label }}</RouterLink
            ><span v-else :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined">{{
              item.label
            }}</span
            ><b v-if="index < breadcrumbs.length - 1">/</b>
          </template>
        </nav>
        <RouterLink
          v-if="shell !== 'platform_admin' || state === 'ready'"
          :to="shell === 'platform_admin' ? contextSwitchTarget : '/select-context'"
          class="midou-top-context"
          aria-label="切换组织与工作区"
        >
          <span
            v-if="
              shell === 'platform_admin' && (!guard?.organization_name || !guard?.workspace_name)
            "
          >
            选择组织与工作区
          </span>
          <span v-else
            >{{ contextName(guard?.organization_name, "当前组织") }} /
            {{ contextName(guard?.workspace_name, "当前工作区") }}</span
          >
          <AppIcon name="chevron" :size="14" />
        </RouterLink>
        <span v-else>平台工作区</span>
      </div>
      <div class="role-top-actions">
        <RouterLink
          v-if="
            shell === 'platform_admin' &&
            routePath !== '/platform-admin' &&
            allCapabilities.includes('platform:superadmin')
          "
          class="role-quick-action"
          to="/platform-admin/organizations/new"
          :aria-label="quickActionLabel"
          ><AppIcon name="plus" /> <span>新建组织</span></RouterLink
        >
        <RouterLink
          v-else-if="shell === 'organization_admin' && routePath !== '/org-admin'"
          class="role-quick-action"
          v-show="guard?.roles?.includes('organization_admin')"
          to="/org-admin/members"
          :aria-label="quickActionLabel"
          ><AppIcon name="plus" /> <span>邀请成员</span></RouterLink
        >
        <button
          v-if="shell === 'member' || state === 'ready'"
          type="button"
          :aria-label="shell === 'member' ? '全局搜索' : '搜索后台功能'"
          data-navigation-search
          class="role-quick-action"
          @click="openDiscovery('search')"
        >
          <AppIcon name="search" />
          <span>{{ shell === "member" ? "搜索功能、商品、ASIN等" : "搜索后台功能" }}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span
          v-else-if="state === 'loading'"
          class="midou-pending-search"
          aria-hidden="true"
        ></span>
        <details
          ref="topHelp"
          class="midou-top-help"
          @keydown.esc.stop="($event.currentTarget as HTMLDetailsElement).open = false"
        >
          <summary aria-label="导航帮助"><AppIcon name="help" :size="22" /></summary>
          <div class="midou-account-menu-panel">
            <strong>导航帮助</strong>
            <p>
              {{
                shell === "member"
                  ? "按 Ctrl 或 ⌘ + K 搜索功能、商品和 ASIN。"
                  : "按 Ctrl 或 ⌘ + K 搜索当前后台功能。"
              }}
            </p>
            <p>使用侧栏切换工作台，在个人中心调整外观。</p>
          </div>
        </details>
        <div v-if="shell !== 'member'" class="role-theme-switcher">
          <button
            ref="themeTrigger"
            type="button"
            aria-label="切换界面主题"
            :aria-expanded="themeOpen"
            :aria-controls="themeOpen ? 'role-theme-panel' : undefined"
            @click="toggleThemePanel"
          >
            <AppIcon name="theme" /> <span>主题</span>
          </button>
        </div>
        <RouterLink v-if="shell === 'member'" to="/notifications" aria-label="通知中心"
          ><AppIcon name="bell"
        /></RouterLink>
        <details
          ref="accountMenu"
          class="midou-account-menu"
          @keydown.esc.stop.prevent="closeAccountMenu(true)"
        >
          <summary aria-label="账号菜单">
            <span class="midou-top-avatar"><AppIcon name="person" :size="18" /></span>
            <AppIcon name="chevron" :size="14" />
          </summary>
          <div class="midou-account-menu-panel">
            <RouterLink to="/me" @click="closeAccountMenu()">个人中心</RouterLink>
            <RouterLink to="/me?section=appearance" @click="closeAccountMenu()"
              >外观偏好</RouterLink
            >
            <SessionLogout :api-base-url="apiBaseUrl" />
          </div>
        </details>
      </div>
      <div
        v-if="themeOpen"
        id="role-theme-panel"
        ref="themePanel"
        class="role-theme-menu"
        role="group"
        aria-label="界面主题"
        @keydown.esc.stop.prevent="closeThemePanel"
      >
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          :aria-pressed="activeTheme === theme.id"
          @click="selectTheme(theme.id)"
        >
          <i :data-theme-dot="theme.id"></i
          ><span
            ><b>{{ theme.name }}</b
            ><small
              >{{ activeTheme === theme.id ? "当前主题 · " : "" }}{{ theme.caption }}</small
            ></span
          >
        </button>
        <RouterLink to="/me?section=appearance" @click="themeOpen = false">更多外观设置</RouterLink>
      </div>
    </header>
    <NavigationWorkspaceSidebar
      v-if="state === 'ready'"
      :shell="shell"
      :guard="guard"
      :menu-groups="menuGroups"
      :active-path="activeItem?.path"
      :route-path="routePath"
      :account="account"
      :context-switch-target="contextSwitchTarget"
      :member-return-path="memberReturnPath"
    />
    <div
      v-else-if="state === 'loading'"
      class="commerce-sidebar midou-pending-rail"
      aria-hidden="true"
    ></div>
    <dialog
      ref="navigationDialog"
      class="role-navigation-frame"
      aria-label="工作台导航"
      @cancel.prevent="menuOpen = false"
      @close="menuOpen = false"
      @keydown="containTab"
      @click.self="menuOpen = false"
    >
      <button
        v-if="compactNavigation"
        type="button"
        class="role-navigation-close"
        aria-label="关闭导航菜单"
        @click="menuOpen = false"
      >
        关闭菜单
      </button>
      <nav id="role-navigation" class="role-sidebar" :aria-label="`${shellTitle}导航`">
        <div class="role-sidebar-head">
          <strong>{{ shellTitle }}</strong>
          <small>{{ roleSummary }}</small>
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
        <div v-if="state === 'ready'" class="role-nav-groups">
          <details
            v-for="group in menuGroups"
            :key="group.label"
            :open="
              Boolean(menuQuery.trim()) ||
              group.items.some((item) => activeItem?.path === item.path)
            "
          >
            <summary>
              <span>{{ group.label }}</span
              ><AppIcon name="chevron" :size="14" />
            </summary>
            <div class="role-nav-menu">
              <RouterLink
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                :aria-current="activeItem?.path === item.path ? 'page' : undefined"
                @click="((menuOpen = false), (menuQuery = ''))"
                ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
              >
            </div>
          </details>
          <p v-if="!menuGroups.length" class="role-menu-empty">没有匹配的菜单或分组。</p>
        </div>
        <div v-if="state === 'ready'" class="role-sidebar-utility">
          <RouterLink v-if="compactNavigation" to="/me" aria-label="个人中心"
            ><AppIcon name="person" />个人中心</RouterLink
          >
          <div v-if="shell === 'member' && compactNavigation" class="role-discovery-actions">
            <button type="button" @click="openDiscovery('search')">
              <AppIcon name="search" /><span>全局搜索</span>
            </button>
          </div>
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
      </nav>
    </dialog>
    <section class="role-content">
      <NavigationShellGate
        v-if="state !== 'ready'"
        :state="state"
        :action-hint="actionHint"
        :request-id="requestId"
        :trace-id="traceId"
        @retry="load"
      />
      <template v-else-if="routeAllowed">
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
        <slot
          v-if="account"
          :organization-name="guard?.organization_name"
          :workspace-name="guard?.workspace_name"
        />
        <KeepAlive :max="12">
          <component
            :is="selectedSurfaceComponent"
            v-if="!account && selectedSurfaceComponent"
            :key="surfaceCacheKey"
            v-bind="selectedSurfaceProps"
          />
          <NavigationAccessPanel
            v-else-if="!account"
            state="missing"
            :home-path="items[0]?.path || '/'"
          />
        </KeepAlive>
      </template>
      <NavigationAccessPanel v-else state="forbidden" :home-path="items[0]?.path || '/home'" />
    </section>
    <NavigationMobileBar
      v-if="state === 'ready'"
      :primary-items="primaryItems"
      :active-path="activeItem?.path"
      :more-active="moreActive"
      :menu-open="menuOpen"
      @open-menu="menuOpen = true"
    />
    <p v-if="themeNotice" class="role-theme-notice" role="status">
      {{ themeNotice }}
    </p>
    <DiscoveryOverlay
      v-if="discovery.discoveryActivated.value"
      :open="Boolean(discoveryMode)"
      :shell="shell"
      :api-base-url="apiBaseUrl"
      :organization-name="guard?.organization_name ?? null"
      :workspace-name="guard?.workspace_name ?? null"
      :navigation-items="state === 'ready' ? items : []"
      @close="closeDiscovery"
    />
  </main>
</template>

<style src="../signal-ledger-workflows.css"></style>
<style src="../navigation-shell-c.css"></style>
<style src="../midou-workspace.css"></style>
