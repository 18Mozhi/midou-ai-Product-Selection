import assert from "node:assert/strict";

export const pageTurnHandler = `async function turnPage(direction: -1 | 1, event: MouseEvent) {
  const trigger = event.currentTarget as HTMLButtonElement;
  page.value += direction;
  await nextTick();
  if (trigger.disabled) {
    trigger.closest(".adapter-pagination")
      ?.querySelector<HTMLElement>(".adapter-page-status")
      ?.focus({ preventScroll: true });
  }
}
`;

export function previewAdapterFilterPagination(source) {
  const changes = [
    [
      'import { computed, onMounted, ref, watch } from "vue";',
      'import { computed, nextTick, onMounted, ref, watch } from "vue";',
    ],
    ["onMounted(load);", pageTurnHandler + "onMounted(load);"],
    [
      "        <span>{{ filtered.length }} 个结果</span>",
      '        <span class="adapter-result-count" role="status" aria-live="polite" aria-atomic="true">{{ filtered.length }} 个结果</span>',
    ],
    [
      '<nav v-if="filtered.length" class="adapter-pagination" aria-label="来源适配器分页">',
      '<nav v-if="filtered.length && totalPages > 1" class="adapter-pagination" aria-label="来源适配器分页">',
    ],
    [
      '<button type="button" :disabled="page === 1" @click="page--">上一页</button>',
      '<button type="button" :disabled="page === 1" @click="turnPage(-1, $event)">上一页</button>',
    ],
    [
      "<span>第 {{ page }} / {{ totalPages }} 页 · 每页 {{ pageSize }} 条</span>",
      '<span class="adapter-page-status" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">第 {{ page }} / {{ totalPages }} 页 · 每页 {{ pageSize }} 条</span>',
    ],
    [
      '<button type="button" :disabled="page === totalPages" @click="page++">下一页</button>',
      '<button type="button" :disabled="page === totalPages" @click="turnPage(1, $event)">下一页</button>',
    ],
  ];
  for (const [before, after] of changes) {
    assert.equal(source.split(before).length, 2, `Unique filter/page preview anchor: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
