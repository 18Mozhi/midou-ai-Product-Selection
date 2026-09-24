<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { AccountData, AccountTab } from "../platform-account-types";

const props = defineProps<{
  data: AccountData | null;
  tab: AccountTab;
  organizationListRoute: boolean;
}>();
</script>

<template>
  <aside
    class="account-page-rail"
    :aria-label="props.organizationListRoute ? '平台汇总与账号管理入口' : '全平台汇总与管理入口'"
  >
    <header class="account-page-rail__intro">
      <small>平台全局</small>
      <h3>账号与组织</h3>
      <p>
        {{
          props.organizationListRoute
            ? "汇总不随组织列表筛选变化。"
            : "以下为全平台汇总，不是当前列表条数。"
        }}
      </p>
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
  </aside>
</template>
