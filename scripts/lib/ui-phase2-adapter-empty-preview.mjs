import assert from "node:assert/strict";

export const emptyCopy = {
  catalog: ["还没有可查看的来源", "登记来源技术合同后，可在这里查看适配器的运行状态。"],
  filtered: [
    "当前筛选下没有匹配来源",
    "试试调整搜索或筛选条件，也可以清除筛选，查看当前来源目录。",
  ],
};
export const focusWrapper = `async function resetEmptyFilters(event: MouseEvent) {
  const input = (event.currentTarget as HTMLElement)
    .closest(".adapter-center")?.querySelector<HTMLInputElement>(".adapter-search input");
  resetFilters();
  await nextTick();
  if (input?.isConnected && !input.disabled && !input.closest("[inert]") && document.activeElement === document.body) {
    input.focus();
  }
}

`;
export function previewAdapterEmpty(source) {
  const changes = [
    [
      'import { computed, onMounted, ref, watch } from "vue";',
      'import { computed, nextTick, onMounted, ref, watch } from "vue";',
    ],
    ["onMounted(load);", focusWrapper + "onMounted(load);"],
    [
      'v-if="state === \'empty\'" class="adapter-empty"',
      'v-if="state === \'empty\'" class="adapter-empty p47-empty-catalog"',
    ],
    [
      'v-else-if="!filtered.length" class="adapter-empty"',
      'v-else-if="!filtered.length" class="adapter-empty p47-empty-filtered"',
    ],
    ["还没有来源可绑定适配器", emptyCopy.catalog[0]],
    ["先在来源注册中心登记技术合同；不会创建模拟来源。", emptyCopy.catalog[1]],
    ["没有符合筛选条件的适配器", emptyCopy.filtered[0]],
    ["调整搜索或筛选条件，清除后显示当前来源目录。", emptyCopy.filtered[1]],
    ['@click="resetFilters">清除筛选', '@click="resetEmptyFilters">清除筛选'],
  ];
  for (const [before, after] of changes) {
    assert.equal(source.split(before).length, 2, `Unique preview anchor: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
