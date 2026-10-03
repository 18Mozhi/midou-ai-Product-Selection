<script setup lang="ts">
import type { AccountTab } from "../platform-account-types";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";

const props = defineProps<{
  tab: AccountTab;
  organizationListRoute: boolean;
  adminListRoute: boolean;
  filterLabel: string;
  activeFilterCount: number;
  searchPlaceholder: string;
  statusLabel: string;
  refreshing: boolean;
}>();

const query = defineModel<string>("query", { required: true });
const status = defineModel<string>("status", { required: true });
const emit = defineEmits<{
  (event: "apply-filters"): void;
  (event: "reset-filters"): void;
}>();
</script>

<template>
  <ResponsiveFilterDrawer :label="props.filterLabel" :active-count="props.activeFilterCount">
    <form
      class="account-filter"
      :class="{
        'account-filter--admins-c': props.adminListRoute,
        'account-filter--overview-c':
          !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations',
      }"
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
      <label
        v-else-if="!props.organizationListRoute && props.tab === 'organizations'"
        class="p39-filter-field"
      >
        <span id="p39-query-label">关键词</span>
        <input
          v-model="query"
          :placeholder="props.searchPlaceholder"
          aria-labelledby="p39-query-label"
          aria-describedby="p39-query-help"
        />
        <small id="p39-query-help"> 概览只展示组织记录。用户邮箱查询结果请到用户管理查看。 </small>
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
      <label
        v-else-if="!props.organizationListRoute && props.tab === 'organizations'"
        class="p39-filter-field"
      >
        <span>{{ props.statusLabel }}</span>
        <select v-model="status" :aria-label="props.statusLabel" aria-describedby="p39-status-help">
          <option value="">全部状态</option>
          <option value="active">正常使用</option>
          <option value="disabled">已停用</option>
          <option value="archived">已停用组织</option>
        </select>
        <small id="p39-status-help">“已停用”和“已停用组织”是不同的筛选值。</small>
      </label>
      <select v-else v-model="status" :aria-label="props.statusLabel">
        <option value="">全部状态</option>
        <option value="active">正常使用</option>
        <option v-if="!props.organizationListRoute" value="disabled">已停用</option>
        <option v-if="props.tab === 'organizations'" value="archived">已停用组织</option>
      </select>
      <div
        :class="{
          'admin-filter-actions': props.adminListRoute,
          'p39-filter-actions':
            !props.adminListRoute && !props.organizationListRoute && props.tab === 'organizations',
        }"
      >
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
</template>
