<script setup lang="ts">
import { computed, ref } from "vue";

type DetailItem = { label: string; value?: string | number | null };

const props = withDefaults(
  defineProps<{
    requestId?: string;
    traceId?: string;
    items?: DetailItem[];
    summary?: string;
  }>(),
  { requestId: "", traceId: "", items: () => [], summary: "技术详情" },
);

const copied = ref("");
const rows = computed(() => [
  ...(props.requestId ? [{ label: "请求编号", value: props.requestId }] : []),
  ...(props.traceId ? [{ label: "链路编号", value: props.traceId }] : []),
  ...props.items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== "",
  ),
]);

async function copy(label: string, value: string | number) {
  await navigator.clipboard.writeText(String(value));
  copied.value = label;
  window.setTimeout(() => {
    if (copied.value === label) copied.value = "";
  }, 1_500);
}
</script>

<template>
  <details v-if="rows.length" class="technical-details">
    <summary>{{ summary }}</summary>
    <dl>
      <div v-for="item in rows" :key="`${item.label}-${item.value}`">
        <dt>{{ item.label }}</dt>
        <dd>
          <code>{{ item.value }}</code>
        </dd>
        <button
          type="button"
          :aria-label="`复制${item.label}`"
          @click="copy(item.label, item.value!)"
        >
          {{ copied === item.label ? "已复制" : "复制" }}
        </button>
      </div>
    </dl>
  </details>
</template>

<style scoped>
.technical-details {
  color: var(--so-text-muted);
  font-size: var(--so-font-meta);
}
.technical-details summary {
  cursor: pointer;
  font-weight: 650;
  width: fit-content;
}
.technical-details dl {
  display: grid;
  gap: 0.45rem;
  margin: 0.65rem 0 0;
}
.technical-details dl > div {
  align-items: center;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(5rem, auto) minmax(0, 1fr) auto;
}
.technical-details dt,
.technical-details dd {
  margin: 0;
}
.technical-details code {
  overflow-wrap: anywhere;
}
.technical-details button {
  min-height: 1.8rem;
  padding: 0.2rem 0.55rem;
}
</style>
