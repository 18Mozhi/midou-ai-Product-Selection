<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import PersonalCenter from "./PersonalCenter.vue";
import SessionLogout from "./SessionLogout.vue";

defineProps<{ apiBaseUrl: string }>();

const route = useRoute();
const sections = [
  { key: "profile", label: "基本资料", description: "账号信息" },
  { key: "permissions", label: "我的权限", description: "角色与范围" },
  { key: "security", label: "安全与设备", description: "密码与会话" },
  { key: "notifications", label: "通知偏好", description: "五项通知设置" },
  { key: "assets", label: "我的资产", description: "关注、决策与任务" },
];

const activeSection = computed(() => {
  const requested = typeof route.query.section === "string" ? route.query.section : "profile";
  return sections.some((item) => item.key === requested) ? requested : "profile";
});
</script>

<template>
  <main class="account-shell p11-account-review">
    <header class="account-topbar p11-top">
      <RouterLink to="/" class="account-brand p11-brand" aria-label="ScoutOps 应用入口">
        ScoutOps
      </RouterLink>
      <span class="p11-current-page">个人中心</span>
      <RouterLink class="p11-scope-link" to="/select-context">组织与工作区</RouterLink>
      <SessionLogout :api-base-url="apiBaseUrl" />
    </header>

    <section class="p11-page-heading" aria-labelledby="p11-title">
      <h1 id="p11-title">个人中心</h1>
    </section>

    <nav class="account-sidebar p11-directory" aria-label="个人中心分区">
      <RouterLink
        v-for="item in sections"
        :key="item.key"
        :to="{ path: '/me', query: { section: item.key } }"
        :aria-current="activeSection === item.key ? 'page' : undefined"
        :aria-label="`${item.label}：${item.description}`"
      >
        <b>{{ item.label }}</b>
        <small>{{ activeSection === item.key ? "当前分区" : item.description }}</small>
      </RouterLink>
      <RouterLink class="p11-theme-link" to="/settings/theme" aria-label="外观偏好：主题与密度">
        <b>外观偏好</b>
        <small>主题与密度</small>
      </RouterLink>
    </nav>

    <section class="account-content p11-content">
      <nav class="account-breadcrumb p11-crumb" aria-label="面包屑">
        <RouterLink to="/">应用入口</RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">个人中心</span>
      </nav>
      <PersonalCenter :api-base-url="apiBaseUrl" :initial-section="activeSection" account-shell />
    </section>
  </main>
</template>

<style scoped>
.account-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  align-content: start;
  background: var(--so-bg);
  color: var(--so-text);
  font-size: 13px;
  line-height: 1.6;
}
.p11-top,
.p11-page-heading,
.p11-directory,
.p11-content {
  box-sizing: border-box;
  width: min(1440px, calc(100% - 48px));
  margin-inline: auto;
  min-width: 0;
}
.p11-top {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding-block: 6px;
  border-bottom: 1px solid var(--so-border);
}
.p11-brand {
  color: var(--so-primary);
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}
.p11-current-page {
  color: var(--so-text-muted);
}
.p11-scope-link {
  margin-left: auto;
  min-height: 44px;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  color: var(--so-primary);
  font-weight: 500;
  text-decoration: none;
}
.p11-page-heading {
  padding-block: 20px 12px;
}
.p11-page-heading h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.5;
  font-weight: 600;
}
.p11-directory {
  display: flex;
  flex-wrap: wrap;
  gap: 0 20px;
  border-bottom: 1px solid var(--so-border);
}
.p11-directory a {
  min-height: 48px;
  padding: 10px 2px;
  display: inline-flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  color: var(--so-text-muted);
  text-decoration: none;
}
.p11-directory b {
  font-size: 13px;
  font-weight: 500;
}
.p11-directory small {
  display: none;
}
.p11-directory a:hover,
.p11-directory a[aria-current="page"] {
  color: var(--so-primary);
}
.p11-directory a[aria-current="page"] {
  border-bottom-color: var(--so-primary);
}
.p11-content {
  padding-block: 16px 40px;
}
.p11-crumb {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--so-text-muted);
  font-size: 12px;
}
.p11-crumb a {
  color: var(--so-primary);
}
.p11-crumb [aria-current="page"] {
  color: var(--so-text);
}
.account-shell a:focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 3px;
}
@media (max-width: 760px) {
  .p11-top,
  .p11-page-heading,
  .p11-directory,
  .p11-content {
    width: calc(100% - 32px);
  }
  .p11-top {
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .p11-current-page {
    display: none;
  }
  .p11-scope-link {
    padding-inline: 4px;
  }
  .p11-directory {
    gap: 0 16px;
  }
  .p11-page-heading {
    padding-top: 16px;
  }
  .p11-content {
    padding-top: 12px;
  }
}
</style>
