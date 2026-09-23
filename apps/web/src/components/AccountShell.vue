<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import PersonalCenter from "./PersonalCenter.vue";

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
    </header>

    <section class="p11-hero" aria-labelledby="p11-title">
      <p>PERSONAL CENTER</p>
      <h1 id="p11-title">账号事实与个人操作</h1>
      <span>资料、权限、安全、通知和本人资产按各自读取状态呈现。</span>
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
  --p11-blue: var(--so-primary);
  --p11-ink: var(--so-text);
  --p11-muted: var(--so-text-muted);
  --p11-line: var(--so-border);
  min-height: 100vh;
  display: grid;
  grid-template-rows: 64px auto auto minmax(0, 1fr);
  justify-items: center;
  background: var(--so-bg);
  color: var(--p11-ink);
  font-size: 17px;
}

.p11-top,
.p11-hero,
.p11-directory,
.p11-content {
  width: min(1120px, calc(100% - 48px));
  margin-inline: auto;
}

.p11-top {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
}

.p11-brand {
  padding: 6px 12px;
  background: var(--p11-blue);
  color: var(--so-on-primary);
  font-weight: 800;
  text-decoration: none;
}

.p11-current-page {
  font-weight: 800;
}

.p11-scope-link {
  margin-left: auto;
  min-height: 44px;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--p11-blue);
  color: var(--p11-blue);
  font-weight: 700;
  text-decoration: none;
}

.p11-hero {
  display: grid;
  align-content: center;
  gap: 8px;
  min-height: 190px;
  padding: 30px 38px;
  background: var(--p11-blue);
  color: var(--so-on-primary);
}

.p11-hero p,
.p11-hero h1 {
  margin: 0;
}

.p11-hero p {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.p11-hero h1 {
  font-size: clamp(28px, 3vw, 36px);
  line-height: 1.2;
}

.p11-directory {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border: 1px solid var(--p11-line);
  background: var(--so-panel);
}

.p11-directory a {
  min-height: 76px;
  padding: 12px 14px;
  display: grid;
  align-content: center;
  gap: 3px;
  border-right: 1px solid var(--p11-line);
  color: var(--p11-ink);
  text-decoration: none;
}

.p11-directory a:last-child {
  border-right: 0;
}

.p11-directory a:hover,
.p11-directory a[aria-current="page"] {
  background: var(--so-signal-soft);
  color: var(--p11-blue);
}

.p11-directory a[aria-current="page"] {
  box-shadow: inset 0 -3px var(--p11-blue);
}

.p11-directory b {
  font-size: 17px;
}

.p11-directory small {
  color: var(--p11-muted);
  font-size: 17px;
}

.p11-content {
  min-width: 0;
  padding: 24px 0 60px;
}

.p11-crumb {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--p11-muted);
  font-size: 17px;
}

.p11-crumb a {
  color: var(--p11-blue);
}

.p11-crumb [aria-current="page"] {
  color: var(--p11-ink);
}

@media (max-width: 760px) {
  .p11-top,
  .p11-hero,
  .p11-directory,
  .p11-content {
    width: min(100% - 32px, 520px);
  }

  .p11-top {
    flex-wrap: wrap;
    padding: 12px 0;
  }

  .p11-scope-link {
    margin-left: 0;
  }

  .p11-hero {
    min-height: 168px;
    padding: 24px 20px;
  }

  .p11-hero h1 {
    font-size: 28px;
  }

  .p11-directory {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .p11-directory a {
    min-height: 70px;
  }

  .p11-content {
    padding-top: 18px;
  }
}
</style>
