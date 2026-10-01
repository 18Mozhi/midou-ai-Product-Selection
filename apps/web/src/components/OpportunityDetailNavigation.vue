<script setup lang="ts">
import { computed } from "vue";
import type { OpportunityTab } from "./opportunity-workspace-types";

const props = defineProps<{
  activeTab: OpportunityTab;
  items: ReadonlyArray<readonly [OpportunityTab, string]>;
}>();

const emit = defineEmits<{
  select: [tab: OpportunityTab];
}>();

const activeLabel = computed(
  () => props.items.find(([tab]) => tab === props.activeTab)?.[1] ?? "结论",
);
</script>

<template>
  <aside class="opportunity-detail-directory" aria-label="机会详情目录">
    <p class="opportunity-detail-directory__eyebrow">核对机会</p>
    <h2>先看依据，<br />再作判断</h2>
    <p class="opportunity-detail-directory__note">
      系统建议不代替人工决定；未取得的数据不会以零值补齐。
    </p>
    <nav aria-label="机会详情分区">
      <button
        v-for="([tab, label], index) in items"
        :key="tab"
        type="button"
        :aria-current="activeTab === tab ? 'page' : undefined"
        @click="emit('select', tab)"
      >
        <span aria-hidden="true">{{ String(index + 1).padStart(2, "0") }}</span>
        {{ label }}
      </button>
    </nav>
  </aside>

  <details class="opportunity-detail-directory-mobile">
    <summary>
      <span>机会详情分区</span>
      <strong>{{ activeLabel }}</strong>
    </summary>
    <nav aria-label="机会详情分区">
      <button
        v-for="([tab, label], index) in items"
        :key="tab"
        type="button"
        :aria-current="activeTab === tab ? 'page' : undefined"
        @click="emit('select', tab)"
      >
        <span aria-hidden="true">{{ String(index + 1).padStart(2, "0") }}</span>
        {{ label }}
      </button>
    </nav>
  </details>
</template>

<style scoped>
.opportunity-detail-directory {
  position: sticky;
  top: 16px;
  min-width: 0;
  padding: 24px 18px;
  color: var(--so-opportunity-review-surface);
  background: var(--so-opportunity-review-blue);
}

.opportunity-detail-directory__eyebrow {
  color: var(--so-opportunity-review-directory-label);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.opportunity-detail-directory h2 {
  margin: 10px 0 12px;
  font-size: 24px;
  line-height: 1.45;
}

.opportunity-detail-directory__note {
  color: var(--so-opportunity-review-directory-note);
  font-size: 14px;
  line-height: 1.7;
}

.opportunity-detail-directory nav,
.opportunity-detail-directory-mobile nav {
  display: grid;
  gap: 4px;
  margin-top: 20px;
}

.opportunity-detail-directory button,
.opportunity-detail-directory-mobile button {
  min-width: 0;
  min-height: 46px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  color: inherit;
  background: transparent;
  font: inherit;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.opportunity-detail-directory button > span,
.opportunity-detail-directory-mobile button > span {
  flex: 0 0 24px;
  color: var(--so-opportunity-review-directory-label);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.opportunity-detail-directory button:hover,
.opportunity-detail-directory-mobile button:hover {
  border-color: var(--so-opportunity-review-directory-label);
}

.opportunity-detail-directory button[aria-current="page"],
.opportunity-detail-directory-mobile button[aria-current="page"] {
  border-color: var(--so-opportunity-review-surface);
  color: var(--so-opportunity-review-blue);
  background: var(--so-opportunity-review-surface);
}

.opportunity-detail-directory button[aria-current="page"] > span,
.opportunity-detail-directory-mobile button[aria-current="page"] > span {
  color: var(--so-opportunity-review-blue);
}

.opportunity-detail-directory-mobile {
  display: none;
}

@media (max-width: 900px) {
  .opportunity-detail-directory {
    display: none;
  }

  .opportunity-detail-directory-mobile {
    display: block;
    color: var(--so-opportunity-review-surface);
    background: var(--so-opportunity-review-blue);
  }

  .opportunity-detail-directory-mobile > summary {
    min-height: 52px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
  }

  .opportunity-detail-directory-mobile > summary strong {
    font-size: 16px;
  }

  .opportunity-detail-directory-mobile nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
    padding: 0 10px 10px;
  }

  .opportunity-detail-directory-mobile button {
    min-height: 44px;
    font-size: 14px;
  }
}
</style>
