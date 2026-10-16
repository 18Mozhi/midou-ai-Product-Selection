<script setup lang="ts">
import type { OpportunityTab } from "./opportunity-workspace-types";
defineProps<{
  activeTab: OpportunityTab;
  items: ReadonlyArray<readonly [OpportunityTab, string]>;
}>();
const emit = defineEmits<{ select: [tab: OpportunityTab] }>();
</script>
<template>
  <nav class="selection-detail-navigation" aria-label="选品详情分区">
    <button
      v-for="[tab, label] in items"
      :key="tab"
      type="button"
      :aria-current="activeTab === tab ? 'page' : undefined"
      @click="emit('select', tab)"
    >
      {{ label }}
    </button>
  </nav>
</template>

<style scoped>
.selection-detail-navigation {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0 20px;
  padding: 0 24px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel);
}
.selection-detail-navigation button {
  min-height: 48px;
  padding: 8px 4px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--so-text-muted);
  background: transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.selection-detail-navigation button:hover {
  color: var(--so-primary);
}
.selection-detail-navigation button[aria-current="page"] {
  color: var(--so-primary);
  border-bottom-color: var(--so-primary);
}
.selection-detail-navigation button:focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .selection-detail-navigation {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    padding: 0 12px;
  }
  .selection-detail-navigation > button {
    min-width: 0;
  }
}
</style>
