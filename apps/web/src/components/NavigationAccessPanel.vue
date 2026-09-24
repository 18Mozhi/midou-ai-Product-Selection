<script setup lang="ts">
defineProps<{
  state: "missing" | "forbidden";
  homePath: string;
}>();
</script>

<template>
  <section class="role-gate-state" :data-state="state" aria-live="polite">
    <span class="role-state-mark" aria-hidden="true">{{ state === "missing" ? "?" : "×" }}</span>
    <template v-if="state === 'missing'">
      <p>页面不存在</p>
      <h2>页面不存在</h2>
      <p>该地址没有可用功能，请从顶部模块索引重新进入。</p>
      <RouterLink :to="homePath">返回工作台</RouterLink>
    </template>
    <template v-else>
      <p>路由权限</p>
      <h1>无权打开此页面</h1>
      <p>当前角色不包含该页面要求的能力，请返回有权访问的模块。</p>
      <div class="role-gate-actions">
        <RouterLink :to="homePath">返回工作台</RouterLink>
        <RouterLink to="/me?section=permissions">申请权限或联系管理员</RouterLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.role-gate-state {
  min-height: calc(100vh - 210px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.role-state-mark {
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  border: 2px solid var(--so-text);
  color: var(--so-primary);
  font: 700 32px var(--so-font-display);
}

.role-gate-state > p:first-of-type {
  margin: 20px 0 6px;
  color: var(--so-primary);
  font: 700 13px var(--so-font-mono);
  letter-spacing: 0.12em;
}

.role-gate-state h1,
.role-gate-state h2 {
  margin: 0;
  font-family: var(--so-font-display);
  font-size: clamp(30px, 4vw, 50px);
}

.role-gate-state > p:last-of-type,
.role-gate-state > small {
  max-width: 560px;
  color: var(--so-text-muted);
}

.role-gate-state > a,
.role-gate-state > button,
.role-gate-actions a {
  min-height: 44px;
  margin-top: 18px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--so-text);
  color: var(--so-on-primary);
  background: var(--so-primary);
  text-decoration: none;
  font-weight: 800;
}

.role-gate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
