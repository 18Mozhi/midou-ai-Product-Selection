<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ThemeStudio from "./ThemeStudio.vue";
import PersonalCenter from "./PersonalCenter.vue";

defineProps<{ apiBaseUrl: string }>();

const route = useRoute();
const sections = [
  { key: "profile", label: "基本资料", description: "账号信息" },
  { key: "permissions", label: "我的权限", description: "角色与范围" },
  { key: "security", label: "安全与设备", description: "密码与会话" },
  { key: "notifications", label: "通知偏好", description: "五项通知设置" },
  { key: "assets", label: "我的资产", description: "关注、决策与任务" },
  { key: "appearance", label: "外观偏好", description: "主题与密度" },
];

const activeSection = computed(() => {
  const requested = typeof route.query.section === "string" ? route.query.section : "profile";
  return sections.some((item) => item.key === requested) ? requested : "profile";
});
</script>
<template>
  <div class="account-shell account-content-only">
    <section class="p11-page-heading" aria-labelledby="p11-title">
      <h1 id="p11-title">个人中心</h1>
      <p class="midou-account-description">管理你的账号信息、权限、安全与偏好设置。</p>
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
    </nav>

    <section class="account-content p11-content">
      <ThemeStudio v-if="activeSection === 'appearance'" :api-base-url="apiBaseUrl" embedded />
      <PersonalCenter
        v-else
        :api-base-url="apiBaseUrl"
        :initial-section="activeSection"
        account-shell
      />
    </section>
  </div>
</template>
<style scoped>
.account-content-only {
  min-width: 0;
}
.p11-page-heading h1 {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.35;
}
.midou-account-description {
  margin: 0;
  color: var(--so-text-muted);
  font-size: 13px;
}
.p11-directory {
  display: flex;
  flex-wrap: wrap;
  gap: 0 24px;
  margin: 16px 0;
  border-bottom: 1px solid var(--so-border);
}
.p11-directory a {
  padding: 10px 0;
  text-decoration: none;
  color: var(--so-text-muted);
  border-bottom: 2px solid transparent;
  font-size: 13px;
}
.p11-directory a[aria-current="page"] {
  color: var(--so-primary);
  border-bottom-color: var(--so-primary);
}
.p11-directory small {
  display: none;
}
</style>
