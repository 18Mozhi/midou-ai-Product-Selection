<script setup lang="ts">
import type { RoleCapabilitySummary } from "@scoutops/contracts";
import type { AccountData, AccountTab } from "../platform-account-types";
import PlatformAdminRecords from "./PlatformAdminRecords.vue";
import PlatformAccountGlobalRail from "./PlatformAccountGlobalRail.vue";
import PlatformOrganizationRecords from "./PlatformOrganizationRecords.vue";
import PlatformRoleComparison from "./PlatformRoleComparison.vue";
import PlatformUserRecords from "./PlatformUserRecords.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";

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
    }"
  >
    <PlatformAccountGlobalRail
      v-if="props.adminListRoute || props.organizationListRoute"
      :data="props.data"
      :tab="props.tab"
      :organization-list-route="props.organizationListRoute"
    />
    <div class="account-page-main">
      <template v-if="!props.adminListRoute && !props.organizationListRoute">
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
            :class="{ on: props.tab === 'users' }"
            :aria-current="props.tab === 'users' ? 'page' : undefined"
            >用户管理</RouterLink
          ><RouterLink
            to="/platform-admin/admins"
            :class="{ on: props.tab === 'admins' }"
            :aria-current="props.tab === 'admins' ? 'page' : undefined"
            >管理员管理</RouterLink
          >
        </nav>
      </template>
      <header v-if="props.adminListRoute" class="admin-directory-heading">
        <h3>可授权账号</h3>
        <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>
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
      <ResponsiveFilterDrawer :label="props.filterLabel" :active-count="props.activeFilterCount">
        <form
          class="account-filter"
          :class="{ 'account-filter--admins-c': props.adminListRoute }"
          @submit.prevent="emit('apply-filters')"
        >
          <label v-if="props.adminListRoute" class="admin-filter-field">
            <span>账号邮箱</span>
            <input
              v-model="query"
              :placeholder="props.searchPlaceholder"
              aria-describedby="admin-query-help"
            />
            <small id="admin-query-help">输入邮箱关键词，搜索后更新列表。</small>
          </label>
          <label v-else-if="props.organizationListRoute" class="organization-filter-field">
            <span>组织名称或标识</span>
            <input
              v-model="query"
              :placeholder="props.searchPlaceholder"
              aria-describedby="organization-query-help"
            />
            <small id="organization-query-help">按组织名称或标识查询，不按成员邮箱查询。</small>
          </label>
          <label v-else class="account-query-field">
            <span>{{ props.searchPlaceholder }}</span>
            <input v-model="query" :placeholder="props.searchPlaceholder" />
          </label>
          <label v-if="props.adminListRoute" class="admin-filter-field">
            <span>账号状态</span>
            <select v-model="status" :aria-label="props.statusLabel">
              <option value="">全部状态</option>
              <option value="active">正常使用</option>
              <option value="disabled">已停用</option>
            </select>
            <small>仅筛选账号状态，不代表角色权限范围。</small>
          </label>
          <label v-else-if="props.organizationListRoute" class="organization-filter-field">
            <span>组织状态</span>
            <select
              v-model="status"
              :aria-label="props.statusLabel"
              aria-describedby="organization-status-help"
            >
              <option value="">全部状态</option>
              <option value="active">正常使用</option>
              <option value="archived">已停用组织</option>
            </select>
            <small id="organization-status-help">仅筛选组织状态，不代表成员账号状态。</small>
          </label>
          <select v-else v-model="status" :aria-label="props.statusLabel">
            <option value="">全部状态</option>
            <option value="active">正常使用</option>
            <option v-if="!props.organizationListRoute" value="disabled">已停用</option>
            <option v-if="props.tab === 'organizations'" value="archived">已停用组织</option>
          </select>
          <div :class="{ 'admin-filter-actions': props.adminListRoute }">
            <button :disabled="props.refreshing">搜索</button>
            <button
              type="button"
              class="secondary"
              :disabled="!props.activeFilterCount || props.refreshing"
              @click="emit('reset-filters')"
            >
              重置
            </button>
          </div>
        </form>
      </ResponsiveFilterDrawer>
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
    </div>
  </div>
</template>
