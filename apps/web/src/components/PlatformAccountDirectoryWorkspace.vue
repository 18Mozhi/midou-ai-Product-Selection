<script setup lang="ts">
import type { RoleCapabilitySummary } from "@scoutops/contracts";
import type { AccountData, AccountTab } from "../platform-account-types";
import PlatformAdminRecords from "./PlatformAdminRecords.vue";
import PlatformAccountGlobalRail from "./PlatformAccountGlobalRail.vue";
import PlatformOrganizationRecords from "./PlatformOrganizationRecords.vue";
import PlatformRoleComparison from "./PlatformRoleComparison.vue";
import PlatformUserRecords from "./PlatformUserRecords.vue";
import PlatformAccountDirectoryFilters from "./PlatformAccountDirectoryFilters.vue";

const props = defineProps<{
  data: AccountData | null;
  rows: any[];
  busy: boolean;
  state: "loading" | "ready" | "empty" | "error";
  tab: AccountTab;
  organizationListRoute: boolean;
  organizationEmptyState: boolean;
  adminListRoute: boolean;
  adminEmptyState: boolean;
  platformRoles: RoleCapabilitySummary[];
  filterLabel: string;
  activeFilterCount: number;
  searchPlaceholder: string;
  statusLabel: string;
  refreshing: boolean;
  updatedText: string;
  message: string;
  statusText: (value: string) => string;
  roleText: (value: string) => string;
}>();

const query = defineModel<string>("query", { required: true });
const status = defineModel<string>("status", { required: true });
const isCurrentTab = (target: AccountTab) => props.tab === target;
const emit = defineEmits<{
  (event: "apply-filters"): void;
  (event: "reset-filters"): void;
  (event: "load"): void;
  (event: "create-organization"): void;
  (event: "create-admin"): void;
  (event: "open-organization", row: any): void;
  (event: "open-user", row: any): void;
}>();
</script>

<template>
  <div
    class="account-page-layout"
    :class="{
      'account-page-layout--admins': props.adminListRoute,
      'account-page-layout--organizations': props.organizationListRoute,
      'account-page-layout--users': props.tab === 'users',
    }"
  >
    <PlatformAccountGlobalRail
      v-if="props.adminListRoute || props.organizationListRoute || props.tab === 'users'"
      :data="props.data"
      :tab="props.tab"
      :organization-list-route="props.organizationListRoute"
    />
    <div
      class="account-page-main"
      :class="{
        'p39-page-grid':
          !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations',
      }"
    >
      <component
        v-if="!props.adminListRoute && !props.organizationListRoute && props.tab !== 'users'"
        :is="props.tab === 'organizations' ? 'aside' : 'div'"
        :class="{
          'p39-directory':
            !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations',
        }"
      >
        <header
          v-if="
            !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations'
          "
        >
          <h3>平台全局</h3>
          <p>汇总不随组织列表筛选变化</p>
        </header>
        <div v-if="props.data" class="account-metrics">
          <article>
            <small>组织</small
            ><strong
              >{{ props.data.summary.active_organizations }} /
              {{ props.data.summary.organizations }}</strong
            ><span>正常 / 全部</span>
          </article>
          <article>
            <small>用户</small
            ><strong>{{ props.data.summary.active_users }} / {{ props.data.summary.users }}</strong
            ><span>可登录 / 全部</span>
          </article>
          <article>
            <small>平台管理员</small><strong>{{ props.data.summary.platform_admins }}</strong
            ><span>拥有平台后台权限</span>
          </article>
        </div>
        <nav class="account-tabs" aria-label="账号与组织二级导航">
          <RouterLink
            to="/platform-admin/organizations"
            :class="{ on: props.tab === 'organizations' }"
            :aria-current="props.tab === 'organizations' ? 'page' : undefined"
            >组织管理</RouterLink
          ><RouterLink
            to="/platform-admin/users"
            :class="{ on: isCurrentTab('users') }"
            :aria-current="isCurrentTab('users') ? 'page' : undefined"
            >用户管理</RouterLink
          ><RouterLink
            to="/platform-admin/admins"
            :class="{ on: props.tab === 'admins' }"
            :aria-current="props.tab === 'admins' ? 'page' : undefined"
            >管理员管理</RouterLink
          >
        </nav>
      </component>
      <component
        :is="
          !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations'
            ? 'section'
            : 'div'
        "
        :class="{
          'p39-results':
            !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations',
        }"
      >
        <header
          v-if="
            !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations'
          "
          class="p39-results-head"
        >
          <div>
            <h3>组织记录</h3>
            <p>组织名称、成员、工作区与状态</p>
          </div>
          <button type="button" :disabled="props.refreshing || props.busy" @click="emit('load')">
            {{ props.refreshing ? "正在刷新…" : "刷新数据" }}
          </button>
        </header>
        <header v-if="props.adminListRoute" class="admin-directory-heading">
          <h3>可授权账号</h3>
          <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>
        </header>
        <header v-if="props.tab === 'users'" class="user-directory-heading">
          <h3>用户目录</h3>
          <p>按邮箱、组织关系、平台角色和账号状态核对用户；全平台总量与当前筛选相互独立。</p>
        </header>
        <header v-if="props.organizationListRoute" class="organization-directory-heading">
          <div>
            <h3>组织记录</h3>
            <p>名称与标识、关系数量和当前状态</p>
          </div>
          <button
            type="button"
            class="secondary"
            :disabled="props.refreshing || props.busy"
            @click="emit('load')"
          >
            {{ props.refreshing ? "正在刷新…" : "刷新数据" }}
          </button>
        </header>
        <PlatformAccountDirectoryFilters
          v-model:query="query"
          v-model:status="status"
          :tab="props.tab"
          :organization-list-route="props.organizationListRoute"
          :admin-list-route="props.adminListRoute"
          :filter-label="props.filterLabel"
          :active-filter-count="props.activeFilterCount"
          :search-placeholder="props.searchPlaceholder"
          :status-label="props.statusLabel"
          :refreshing="props.refreshing"
          @apply-filters="emit('apply-filters')"
          @reset-filters="emit('reset-filters')"
        />
        <p class="account-updated" aria-live="polite">{{ props.updatedText }}</p>
        <p v-if="props.message" class="account-message">{{ props.message }}</p>
        <section v-if="props.state === 'loading'" class="account-state">
          {{ props.adminListRoute ? "正在读取可授权账号…" : "正在读取真实组织与用户…" }}
        </section>
        <section v-else-if="props.state === 'error'" class="account-state">
          {{ props.adminListRoute ? "暂时无法读取可授权账号。" : "暂时无法读取。" }}
          <button @click="emit('load')">重新加载</button>
        </section>
        <template v-else>
          <section v-if="props.organizationEmptyState" class="account-empty" aria-live="polite">
            <strong>{{ props.activeFilterCount ? "没有符合当前条件的组织" : "还没有组织" }}</strong>
            <span>{{
              props.activeFilterCount
                ? "调整组织名称、标识或状态筛选后重试。"
                : "创建首个组织后，系统会同时建立默认工作区和组织级数据范围。"
            }}</span>
            <button v-if="props.activeFilterCount" type="button" @click="emit('reset-filters')">
              清除筛选
            </button>
            <button
              v-else-if="props.organizationListRoute"
              type="button"
              @click="emit('create-organization')"
            >
              新建组织
            </button>
          </section>
          <PlatformOrganizationRecords
            v-else-if="props.tab === 'organizations'"
            :rows="props.rows"
            :busy="props.busy"
            :status-text="props.statusText"
            @open-organization="emit('open-organization', $event)"
          />
          <PlatformUserRecords
            v-else-if="props.tab === 'users'"
            :rows="props.rows"
            :status-text="props.statusText"
            :role-text="props.roleText"
            @open-user="emit('open-user', $event)"
          />
          <section v-else-if="props.adminEmptyState" class="account-empty" aria-live="polite">
            <strong>{{
              props.activeFilterCount ? "没有符合当前条件的管理员" : "还没有可授权账号"
            }}</strong>
            <span>{{
              props.activeFilterCount
                ? "调整管理员邮箱或状态筛选后重试。"
                : "创建首位平台管理员，或从用户管理选择现有账号授予平台角色。"
            }}</span>
            <button v-if="props.activeFilterCount" type="button" @click="emit('reset-filters')">
              清除筛选
            </button>
            <button v-else type="button" @click="emit('create-admin')">新建管理员</button>
          </section>
          <PlatformAdminRecords v-else :rows="props.rows" @open-user="emit('open-user', $event)" />
          <div
            v-if="props.adminListRoute && props.platformRoles.length"
            class="admin-comparison-workspace"
          >
            <PlatformRoleComparison
              class="platform-admin-role-comparison"
              :roles="props.platformRoles"
            />
          </div>
        </template>
      </component>
    </div>
  </div>
</template>
