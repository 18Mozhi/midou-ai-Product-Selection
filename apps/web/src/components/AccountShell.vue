<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import PersonalCenter from "./PersonalCenter.vue";

defineProps<{ apiBaseUrl: string }>();
const route = useRoute();
const sections = [
  { key: "profile", label: "基本资料", icon: "person" },
  { key: "permissions", label: "我的权限", icon: "shield" },
  { key: "security", label: "安全与设备", icon: "key" },
  { key: "notifications", label: "通知偏好", icon: "bell" },
  { key: "assets", label: "我的资产", icon: "diamond" },
];
const activeSection = computed(() => {
  const requested = typeof route.query.section === "string" ? route.query.section : "profile";
  return sections.some((item) => item.key === requested) ? requested : "profile";
});
</script>

<template>
  <main class="account-shell">
    <header class="account-topbar">
      <RouterLink to="/home" class="account-brand"><span>选</span><b>智能选品</b></RouterLink>
      <div>
        <small>账号级设置</small>
        <h1>个人中心</h1>
      </div>
      <RouterLink to="/home">返回工作台</RouterLink>
    </header>
    <aside class="account-sidebar" aria-label="个人中心分区">
      <p>账号设置</p>
      <RouterLink
        v-for="item in sections"
        :key="item.key"
        :to="{ path: '/me', query: { section: item.key } }"
        :aria-current="activeSection === item.key ? 'page' : undefined"
      >
        <AppIcon :name="item.icon" /><span>{{ item.label }}</span>
      </RouterLink>
      <RouterLink to="/settings/theme"><AppIcon name="theme" /><span>外观偏好</span></RouterLink>
    </aside>
    <section class="account-content">
      <nav class="account-breadcrumb" aria-label="面包屑">
        <RouterLink to="/home">工作台</RouterLink><b>/</b><span aria-current="page">个人中心</span>
      </nav>
      <PersonalCenter :api-base-url="apiBaseUrl" :initial-section="activeSection" account-shell />
    </section>
  </main>
</template>

<style scoped>
.account-shell {
  min-height: 100vh;
  display: grid;
  grid-template: 68px 1fr / 232px minmax(0, 1fr);
  background: var(--so-bg);
  color: var(--so-text);
}
.account-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 232px 1fr auto;
  align-items: center;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-bg-elevated);
}
.account-topbar > div {
  display: grid;
  gap: 2px;
  padding-inline: 22px;
}
.account-topbar h1 {
  margin: 0;
  font-size: 18px;
}
.account-topbar small {
  color: var(--so-text-muted);
}
.account-topbar > a:last-child {
  margin-right: 22px;
  color: var(--so-primary);
  text-decoration: none;
}
.account-brand {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: var(--so-text);
  text-decoration: none;
  border-right: 1px solid var(--so-border);
}
.account-brand span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 900;
}
.account-sidebar {
  padding: 20px 14px;
  border-right: 1px solid var(--so-border);
  background: var(--so-bg-elevated);
}
.account-sidebar p {
  margin: 0 10px 12px;
  color: var(--so-text-muted);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.account-sidebar a {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--so-text-muted);
  text-decoration: none;
}
.account-sidebar a:hover,
.account-sidebar a[aria-current="page"] {
  color: var(--so-text);
  background: var(--so-panel-soft);
}
.account-sidebar a[aria-current="page"] {
  box-shadow: inset 3px 0 var(--so-primary);
}
.account-content {
  min-width: 0;
  width: min(1180px, 100%);
  padding: 22px clamp(18px, 3vw, 40px) 60px;
}
.account-breadcrumb {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--so-text-muted);
  font-size: 13px;
}
.account-breadcrumb b {
  color: var(--so-border);
}
.account-breadcrumb a {
  color: var(--so-primary);
  text-decoration: none;
}
@media (max-width: 760px) {
  .account-shell {
    display: block;
    padding-bottom: calc(78px + env(safe-area-inset-bottom));
  }
  .account-topbar {
    grid-template-columns: 1fr auto;
    height: 64px;
  }
  .account-topbar > div {
    display: none;
  }
  .account-brand {
    border: 0;
  }
  .account-sidebar {
    position: fixed;
    z-index: 12;
    inset: auto 0 0;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    border: 0;
    border-top: 1px solid var(--so-border);
  }
  .account-sidebar p {
    display: none;
  }
  .account-sidebar a {
    justify-content: center;
    padding: 0;
  }
  .account-sidebar a span {
    display: none;
  }
  .account-content {
    padding: 18px 14px 30px;
  }
}
</style>
