<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { OpportunityTab } from "./opportunity-workspace-types";

const props = defineProps<{
  activeTab: OpportunityTab;
  items: ReadonlyArray<readonly [OpportunityTab, string]>;
}>();
const emit = defineEmits<{ select: [tab: OpportunityTab] }>();
const primaryOrder: OpportunityTab[] = [
  "overview",
  "competition",
  "profit",
  "evidence",
  "risk",
  "decisions",
];
const primary = computed(() =>
  primaryOrder.flatMap((key) => props.items.filter(([tab]) => tab === key)),
);
const secondary = computed(() => props.items.filter(([tab]) => !primaryOrder.includes(tab)));
const more = ref<HTMLDetailsElement | null>(null);
const secondaryLabel = computed(
  () => secondary.value.find(([tab]) => tab === props.activeTab)?.[1],
);
function closeMore(restoreFocus = false) {
  if (!more.value?.open) return;
  more.value.open = false;
  if (restoreFocus) more.value.querySelector("summary")?.focus();
}
function select(tab: OpportunityTab) {
  closeMore(!primaryOrder.includes(tab));
  emit("select", tab);
}
watch(
  () => props.activeTab,
  () => closeMore(),
);
</script>

<template>
  <nav class="selection-detail-navigation" aria-label="机会详情分区">
    <button
      v-for="[tab, label] in primary"
      :key="tab"
      type="button"
      :aria-current="activeTab === tab ? 'page' : undefined"
      @click="select(tab)"
    >
      {{ label }}
    </button>
    <details
      v-if="secondary.length"
      ref="more"
      class="selection-detail-more"
      @keydown.esc.prevent="closeMore(true)"
    >
      <summary :data-active="Boolean(secondaryLabel)">
        {{ secondaryLabel ?? "更多记录" }} <span aria-hidden="true">⌄</span>
      </summary>
      <div>
        <button
          v-for="[tab, label] in secondary"
          :key="tab"
          type="button"
          :aria-current="activeTab === tab ? 'page' : undefined"
          @click="select(tab)"
        >
          {{ label }}
        </button>
      </div>
    </details>
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
.selection-detail-navigation button,
.selection-detail-more summary {
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
.selection-detail-navigation button:hover,
.selection-detail-more summary:hover {
  color: var(--so-primary);
}
.selection-detail-navigation button[aria-current="page"],
.selection-detail-more summary[data-active="true"] {
  color: var(--so-primary);
  border-bottom-color: var(--so-primary);
}
.selection-detail-navigation :is(button, summary):focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
.selection-detail-more {
  position: relative;
  margin-left: auto;
}
.selection-detail-more summary {
  display: flex;
  align-items: center;
  gap: 10px;
  list-style: none;
}
.selection-detail-more summary::-webkit-details-marker {
  display: none;
}
.selection-detail-more > div {
  position: absolute;
  z-index: 5;
  top: 100%;
  right: 0;
  display: grid;
  min-width: 148px;
  padding: 6px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
}
.selection-detail-more > div button {
  padding: 8px 14px;
  text-align: left;
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
  .selection-detail-more {
    grid-column: 1/-1;
    margin-left: 0;
    border-top: 1px solid var(--so-border);
  }
  .selection-detail-more summary {
    justify-content: space-between;
    min-height: 44px;
  }
  .selection-detail-more > div {
    right: 0;
    left: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
