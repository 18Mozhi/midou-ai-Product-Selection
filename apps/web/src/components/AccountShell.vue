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
      <RouterLink to="/" class="account-brand"><span>S</span><b>SCOUTOPS</b></RouterLink>
      <div>
        <small>账号级设置</small>
        <h1>个人中心</h1>
      </div>
      <RouterLink to="/select-context">组织与工作区</RouterLink>
    </header>
    <nav class="account-sidebar" aria-label="个人中心分区">
      <p>ACCOUNT INDEX / 账号设置</p>
      <RouterLink
        v-for="item in sections"
        :key="item.key"
        :to="{ path: '/me', query: { section: item.key } }"
        :aria-current="activeSection === item.key ? 'page' : undefined"
      >
        <AppIcon :name="item.icon" /><span>{{ item.label }}</span>
      </RouterLink>
      <RouterLink to="/settings/theme"><AppIcon name="theme" /><span>外观偏好</span></RouterLink>
    </nav>
    <section class="account-content">
      <nav class="account-breadcrumb" aria-label="面包屑">
        <RouterLink to="/">应用入口</RouterLink><b>/</b><span aria-current="page">个人中心</span>
      </nav>
      <PersonalCenter :api-base-url="apiBaseUrl" :initial-section="activeSection" account-shell />
    </section>
  </main>
</template>

<style scoped>
.account-shell {
  min-height: 100vh;
  display: grid;
  grid-template: 58px 51px minmax(0, 1fr) / minmax(0, 1fr);
  background: var(--so-bg);
  color: var(--so-text);
}
.account-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  grid-row: 1;
  display: grid;
  grid-template-columns: minmax(190px, 1fr) auto auto;
  align-items: center;
  border-bottom: 2px solid var(--so-text);
  background: var(--so-bg-elevated);
}
.account-topbar > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-inline: 18px;
  border-left: 1px solid var(--so-border);
}
.account-topbar h1 {
  margin: 0;
  font: 800 18px var(--so-font-display);
}
.account-topbar small {
  color: var(--so-text-muted);
  font: 13px var(--so-font-mono);
}
.account-topbar > a:last-child {
  margin-right: 22px;
  min-height: 44px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-left: 1px solid var(--so-border);
  color: var(--so-text);
  text-decoration: none;
}
.account-brand {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  color: var(--so-text);
  text-decoration: none;
  font-family: var(--so-font-mono);
  letter-spacing: 0.1em;
}
.account-brand span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--so-text);
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 900;
}
.account-sidebar {
  grid-row: 2;
  padding: 0 clamp(16px, 2.4vw, 36px);
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  border-bottom: 1px solid var(--so-text);
  background: var(--so-panel);
}
.account-sidebar p {
  margin: 0;
  padding-right: 20px;
  display: flex;
  align-items: center;
  border-right: 1px solid var(--so-border);
  color: var(--so-text-muted);
  font: 13px var(--so-font-mono);
  font-weight: 800;
  letter-spacing: 0.08em;
}
.account-sidebar a {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
  border-right: 1px solid var(--so-border);
  color: var(--so-text-muted);
  text-decoration: none;
}
.account-sidebar a:hover,
.account-sidebar a[aria-current="page"] {
  color: var(--so-text);
  background: var(--so-signal-soft);
}
.account-sidebar a[aria-current="page"] {
  box-shadow: inset 0 -4px var(--so-primary);
}
.account-content {
  grid-row: 3;
  min-width: 0;
  width: min(1440px, 100%);
  margin-inline: auto;
  padding: 24px clamp(18px, 3.2vw, 48px) 60px;
}
.account-breadcrumb {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--so-text-muted);
  font: 13px var(--so-font-mono);
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
    padding-top: 58px;
    padding-bottom: calc(78px + env(safe-area-inset-bottom));
  }
  .account-topbar {
    position: fixed;
    inset: 0 0 auto;
    grid-template-columns: 1fr auto;
    height: 58px;
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
    border-top: 2px solid var(--so-text);
  }
  .account-sidebar p {
    display: none;
  }
  .account-sidebar a {
    justify-content: center;
    padding: 0;
    border-right: 1px solid var(--so-border);
  }
  .account-sidebar a span {
    display: none;
  }
  .account-content {
    padding: 18px 14px 30px;
  }
}
</style>
