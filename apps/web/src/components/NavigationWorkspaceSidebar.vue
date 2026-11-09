<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import type { NavigationShellKind } from "../navigation-shell-route-state";
import type { ShellNavigationItem } from "../route-catalog";

const props = defineProps<{
  shell: NavigationShellKind;
  guard: {
    roles: string[];
    platform_roles: string[];
    workspace_name: string | null;
    organization_name: string | null;
  } | null;
  menuGroups: { label: string; items: ShellNavigationItem[] }[];
  activePath?: string;
  routePath: string;
  account?: boolean;
  contextSwitchTarget: string;
  memberReturnPath: () => string;
}>();
const sidebarWorkspaceName = computed(() => props.guard?.workspace_name?.trim() || "");
const sidebarOrganizationName = computed(() => props.guard?.organization_name?.trim() || "");
const sidebarContextTitle = computed(
  () =>
    [sidebarWorkspaceName.value, sidebarOrganizationName.value].filter(Boolean).join(" · ") ||
    undefined,
);
</script>

<template>
  <aside class="commerce-sidebar" aria-label="工作区导航">
    <nav class="midou-area-tabs" aria-label="工作台类型">
      <RouterLink v-if="shell === 'member'" to="/home" aria-current="page">选品</RouterLink>
      <RouterLink v-else :to="memberReturnPath()">选品</RouterLink>
      <RouterLink
        v-if="shell === 'organization_admin' || guard?.roles?.includes('organization_admin')"
        to="/org-admin"
        :aria-current="shell === 'organization_admin' ? 'page' : undefined"
        >组织</RouterLink
      >
      <span v-else aria-disabled="true">组织</span>
      <RouterLink
        v-if="shell === 'platform_admin' || guard?.platform_roles?.length"
        to="/platform-admin"
        :aria-current="shell === 'platform_admin' ? 'page' : undefined"
        >平台</RouterLink
      >
      <span v-else aria-disabled="true">平台</span>
    </nav>
    <div class="commerce-sidebar-menu">
      <section v-for="group in menuGroups" :key="group.label">
        <h2>{{ group.label }}</h2>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          :aria-current="activePath === item.path ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" :size="18" /><span>{{ item.label }}</span>
        </RouterLink>
      </section>
      <section v-if="shell === 'member'" class="midou-member-utility">
        <RouterLink
          to="/notifications"
          :aria-current="routePath === '/notifications' ? 'page' : undefined"
          ><AppIcon name="bell" :size="18" />通知中心</RouterLink
        >
        <RouterLink to="/me" :aria-current="account ? 'page' : undefined"
          ><AppIcon name="person" :size="18" />个人中心</RouterLink
        >
      </section>
    </div>
    <footer>
      <RouterLink
        v-if="shell === 'member' || shell === 'organization_admin'"
        to="/select-context"
        class="commerce-workspace-switch"
        aria-label="侧栏切换工作区"
        :title="sidebarContextTitle"
        ><AppIcon name="layers" :size="18" />
        <span>
          {{ sidebarWorkspaceName || sidebarOrganizationName || "切换工作区" }}
          <small v-if="sidebarWorkspaceName && sidebarOrganizationName">
            {{ sidebarOrganizationName }}
          </small>
        </span>
        <AppIcon class="midou-workspace-chevron" name="chevron" :size="14" />
      </RouterLink>
      <RouterLink
        v-if="shell === 'member' && guard?.roles?.includes('organization_admin')"
        to="/org-admin"
        aria-label="进入组织管理后台"
        >组织后台</RouterLink
      >
      <RouterLink
        v-if="shell === 'member' && guard?.platform_roles?.length"
        to="/platform-admin"
        aria-label="进入管理后台"
        >平台后台</RouterLink
      >
      <RouterLink
        v-if="shell === 'platform_admin'"
        class="midou-platform-return"
        :to="contextSwitchTarget"
        aria-label="选择组织与工作区后进入用户工作台"
        :title="sidebarContextTitle"
        ><AppIcon name="layers" :size="18" />
        <span>{{
          guard?.workspace_name && guard?.organization_name
            ? `${guard.workspace_name} · ${guard.organization_name}`
            : "选择工作区"
        }}</span>
        <AppIcon name="chevron" :size="14"
      /></RouterLink>
      <RouterLink v-slot="{ href, navigate }" to="/me?section=appearance" custom>
        <a :href="href" class="midou-sidebar-settings" @click="navigate">
          <AppIcon name="settings" :size="18" />设置
        </a>
      </RouterLink>
      <details
        class="midou-organization-help"
        @keydown.esc.stop="($event.currentTarget as HTMLDetailsElement).open = false"
      >
        <summary><AppIcon name="help" :size="18" />帮助</summary>
        <p v-if="shell === 'member'">
          按 Ctrl 或 ⌘ + K 搜索功能、商品和 ASIN。使用侧栏切换工作台，在个人中心调整外观。
        </p>
        <p v-else-if="shell === 'organization_admin'">
          从侧栏进入成员、权限和审计。使用「返回选品工作台」返回成员工作区。
        </p>
        <p v-else>从侧栏进入组织、采集和审计管理。返回选品工作台前需选择组织与工作区。</p>
      </details>
      <RouterLink
        v-if="shell === 'organization_admin'"
        :to="memberReturnPath()"
        aria-label="返回成员工作台"
        class="midou-organization-return"
        ><AppIcon name="arrow-right" :size="18" />返回选品工作台</RouterLink
      >
    </footer>
  </aside>
</template>
