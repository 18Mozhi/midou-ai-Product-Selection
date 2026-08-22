<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref, useId, watch } from "vue";

interface TableColumn {
  index: number;
  label: string;
}

const root = ref<HTMLElement | null>(null),
  columns = ref<TableColumn[]>([]),
  hiddenColumns = ref<number[]>([]),
  freezeFirst = ref(true),
  density = ref<"standard" | "compact">("standard"),
  visibleColumnCount = computed(() => columns.value.length - hiddenColumns.value.length);
const controlId = useId();

function table() {
  return root.value?.querySelector<HTMLTableElement>("table") ?? null;
}

function applySettings() {
  const element = table();
  if (!element) return;
  element.dataset.tableDensity = density.value;
  for (const row of Array.from(element.rows)) {
    for (const cell of Array.from(row.cells)) {
      cell.hidden = hiddenColumns.value.includes(cell.cellIndex);
      cell.classList.remove("table-view-controls__frozen");
    }
  }
  if (!freezeFirst.value) return;
  const firstVisible = columns.value.find(
    (column) => !hiddenColumns.value.includes(column.index),
  )?.index;
  if (firstVisible === undefined) return;
  for (const row of Array.from(element.rows)) {
    const cell = Array.from(row.cells).find((candidate) => candidate.cellIndex === firstVisible);
    cell?.classList.add("table-view-controls__frozen");
  }
}

function refreshColumns() {
  const element = table();
  if (!element) {
    columns.value = [];
    return;
  }
  const headerRows = Array.from(element.tHead?.rows ?? []),
    header = headerRows.at(-1) ?? element.rows.item(0),
    nextColumns = Array.from(header?.cells ?? []).map((cell, index) => ({
      index,
      label: cell.textContent?.trim() || `第 ${index + 1} 列`,
    }));
  if (JSON.stringify(nextColumns) !== JSON.stringify(columns.value)) columns.value = nextColumns;
  const validHidden = hiddenColumns.value.filter((index) => index < nextColumns.length);
  if (validHidden.length !== hiddenColumns.value.length) hiddenColumns.value = validHidden;
  applySettings();
}

function toggleColumn(index: number) {
  if (hiddenColumns.value.includes(index)) {
    hiddenColumns.value = hiddenColumns.value.filter((item) => item !== index);
    return;
  }
  if (visibleColumnCount.value <= 1) return;
  hiddenColumns.value = [...hiddenColumns.value, index];
}

onMounted(() => void nextTick(refreshColumns));
onUpdated(() => void nextTick(refreshColumns));
watch([hiddenColumns, freezeFirst, density], () => void nextTick(applySettings), { deep: true });
</script>

<template>
  <section ref="root" class="table-view-controls">
    <header v-if="columns.length > 1" class="table-view-controls__toolbar">
      <details>
        <summary>列设置</summary>
        <fieldset>
          <legend>选择显示列</legend>
          <div v-for="column in columns" :key="column.index">
            <input
              :id="`${controlId}-column-${column.index}`"
              type="checkbox"
              :aria-label="`切换第 ${column.index + 1} 列`"
              :aria-describedby="`${controlId}-column-${column.index}-description`"
              :checked="!hiddenColumns.includes(column.index)"
              :disabled="!hiddenColumns.includes(column.index) && visibleColumnCount <= 1"
              @change="toggleColumn(column.index)"
            />
            <span :id="`${controlId}-column-${column.index}-description`">{{ column.label }}</span>
          </div>
        </fieldset>
      </details>
      <button type="button" :aria-pressed="freezeFirst" @click="freezeFirst = !freezeFirst">
        {{ freezeFirst ? "首列已冻结" : "首列未冻结" }}
      </button>
      <label>
        表格密度
        <select v-model="density">
          <option value="standard">标准</option>
          <option value="compact">紧凑</option>
        </select>
      </label>
    </header>
    <div class="table-view-controls__content"><slot /></div>
  </section>
</template>

<style scoped>
.table-view-controls {
  min-width: 0;
}

.table-view-controls__toolbar {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.table-view-controls__toolbar button,
.table-view-controls__toolbar summary,
.table-view-controls__toolbar select {
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel-soft);
  font: inherit;
}

.table-view-controls__toolbar details {
  position: relative;
}

.table-view-controls__toolbar summary {
  display: flex;
  align-items: center;
  cursor: pointer;
  list-style: none;
}

.table-view-controls__toolbar fieldset {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  width: min(280px, 80vw);
  max-height: 320px;
  margin: 0;
  padding: 12px;
  display: grid;
  gap: 8px;
  overflow-y: auto;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
}

.table-view-controls__toolbar fieldset div {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-view-controls__toolbar > label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--so-text-muted);
}

.table-view-controls__content {
  min-width: 0;
  overflow-x: auto;
}

.table-view-controls__content :deep(.table-view-controls__frozen) {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--so-bg-elevated);
  box-shadow: 1px 0 0 var(--so-border);
}

.table-view-controls__content :deep(th.table-view-controls__frozen) {
  z-index: 3;
}

.table-view-controls__content :deep(table[data-table-density="compact"] th),
.table-view-controls__content :deep(table[data-table-density="compact"] td) {
  padding-top: 6px;
  padding-bottom: 6px;
}

@media (max-width: 760px), (pointer: coarse) {
  .table-view-controls__toolbar button,
  .table-view-controls__toolbar summary,
  .table-view-controls__toolbar select,
  .table-view-controls__toolbar fieldset div {
    min-height: var(--so-touch-target);
  }
}
</style>
