import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const beforeEmptyMobileSha =
  "2f71a84bc29b416ce9de84732993fa488ae856ac508d22297bdab8f7278b6e5f";
export const emptyMobileChanges = [
  ["", 'import "../provider-adapters-empty-mobile.css";\n'],
  [
    '<section v-if="state === \'empty\'" class="adapter-empty">',
    '<section v-if="state === \'empty\'" class="adapter-empty adapter-empty--approved-mobile">',
  ],
  [
    '<section v-else-if="!filtered.length" class="adapter-empty">',
    '<section v-else-if="!filtered.length" class="adapter-empty adapter-empty--approved-mobile">',
  ],
  [
    "<h3>还没有来源可绑定适配器</h3>",
    '<h3>\n          <span class="adapter-empty-copy-wide">还没有来源可绑定适配器</span\n          ><span class="adapter-empty-copy-mobile">还没有可查看的来源</span>\n        </h3>',
  ],
  [
    "<p>先在来源注册中心登记技术合同；不会创建模拟来源。</p>",
    '<p>\n          <span class="adapter-empty-copy-wide"\n            >先在来源注册中心登记技术合同；不会创建模拟来源。</span\n          ><span class="adapter-empty-copy-mobile"\n            >登记来源技术合同后，可在这里查看适配器的运行状态。</span\n          >\n        </p>',
  ],
  [
    "<h3>没有符合筛选条件的适配器</h3>",
    '<h3>\n          <span class="adapter-empty-copy-wide">没有符合筛选条件的适配器</span\n          ><span class="adapter-empty-copy-mobile">当前筛选下没有匹配来源</span>\n        </h3>',
  ],
  [
    "<p>调整搜索或筛选条件，清除后显示当前来源目录。</p>",
    '<p>\n          <span class="adapter-empty-copy-wide">调整搜索或筛选条件，清除后显示当前来源目录。</span\n          ><span class="adapter-empty-copy-mobile"\n            >试试调整搜索或筛选条件，也可以清除筛选，查看当前来源目录。</span\n          >\n        </p>',
  ],
];
const hash = (source) => createHash("sha256").update(source).digest("hex");

// Restore the exact pre-mobile implementation for comparisons only, not the running app.
export function beforeAdapterEmptyMobile(source) {
  source = source.replaceAll("\r\n", "\n");
  if (hash(source) === beforeEmptyMobileSha) return source;
  for (const [before, after] of emptyMobileChanges) {
    assert.equal(source.split(after).length, 2, "Unique approved mobile inverse anchor");
    source = source.replace(after, before);
  }
  assert.equal(
    hash(source),
    beforeEmptyMobileSha,
    "Unknown production change outside approved mobile empty regions",
  );
  return source;
}
