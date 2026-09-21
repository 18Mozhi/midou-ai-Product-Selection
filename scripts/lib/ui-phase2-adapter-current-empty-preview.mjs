import assert from "node:assert/strict";
import { beforeAdapterRefreshFocus } from "./ui-phase2-adapter-refresh-focus-baseline.mjs";
import { emptyCopy } from "./ui-phase2-adapter-empty-preview.mjs";

// Only the previously reviewed empty-region presentation changes. Keep both live focus handlers.
export function previewCurrentAdapterEmpty(source) {
  source = source.replaceAll("\r\n", "\n");
  assert.notEqual(beforeAdapterRefreshFocus(source), source, "Verified refresh focus fix required");
  const changes = [
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
  ];
  for (const [before, after] of changes) {
    assert.equal(source.split(before).length, 2, before);
    source = source.replace(before, after);
  }
  return source;
}
