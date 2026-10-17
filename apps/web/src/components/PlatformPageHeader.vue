<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    headingLevel?: 1 | 2;
    titleId?: string;
  }>(),
  { description: "", headingLevel: 2, titleId: undefined },
);
</script>

<template>
  <header class="platform-page-header">
    <div class="platform-page-header__identity">
      <component
        :is="headingLevel === 1 ? 'h1' : 'h2'"
        :id="titleId"
        class="platform-page-header__title"
        >{{ title }}</component
      >
      <p v-if="description" class="platform-page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="platform-page-header__actions"><slot /></div>
  </header>
</template>

<style scoped>
.platform-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--so-border);
  border-radius: 8px;
  background: var(--so-panel);
  color: var(--so-text);
}
.platform-page-header__identity {
  min-width: 0;
}
.platform-page-header__title {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.platform-page-header__description {
  margin: 4px 0 0;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.5;
}
.platform-page-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.platform-page-header .platform-page-header__actions :deep(:is(form, nav, label)) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  margin: 0;
}
.platform-page-header .platform-page-header__actions :deep(label) {
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-page-header .platform-page-header__actions :deep(:is(button, a, input, select)) {
  box-sizing: border-box;
  min-height: 44px;
  max-width: 100%;
  margin: 0;
  padding: 7px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  box-shadow: none;
  text-decoration: none;
}
.platform-page-header .platform-page-header__actions :deep(:is(button, a)) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}
.platform-page-header
  .platform-page-header__actions
  :deep(:is(button, a):hover:not(:disabled):not([aria-disabled="true"]):not(.is-primary)) {
  border-color: var(--so-primary);
}
.platform-page-header .platform-page-header__actions :deep(:is(button, a).is-primary) {
  border-color: var(--so-primary-strong);
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.platform-page-header .platform-page-header__actions :deep(button[aria-current="page"]) {
  border-color: var(--so-primary);
  background: var(--so-panel-soft);
  color: var(--so-primary);
}
.platform-page-header .platform-page-header__actions :deep(:is(button, input, select):disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}
.platform-page-header .platform-page-header__actions :deep([aria-disabled="true"]) {
  cursor: not-allowed;
}
.platform-page-header
  .platform-page-header__actions
  :deep(:is(button, a, input, select):focus-visible) {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
@media (max-width: 640px) {
  .platform-page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
  }
  .platform-page-header__title {
    font-size: 20px;
  }
  .platform-page-header__actions {
    justify-content: flex-start;
  }
  .platform-page-header .platform-page-header__actions :deep(:is(button, a, input, select)) {
    min-height: 44px;
  }
  .platform-page-header .platform-page-header__actions :deep(input) {
    width: 100%;
  }
}
</style>
