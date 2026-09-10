import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { undoTokenQuerySync } from "./ui-phase2-token-query-delta.mjs";

export const tokenFilterBaseline = "c380b995b3a6d55d7f1742dc42baf9479be0e8e7";
export const tokenComponent = "apps/web/src/components/OrganizationTokenPanel.vue";
const help = {
  query: "搜索名称、前缀、中文状态或读取范围，不搜索记录 ID。",
  status: "生命周期来自已返回的记录，筛选不会撤销或轮换令牌。",
  scope: "仅筛选已有读取范围，不更改令牌授权。",
  sort: "只调整已加载记录的排列顺序。",
};
const canonical = (node) => {
  if (node.type === 2) return node.content.trim().replace(/\s+/g, " ") || null;
  if (node.type === 5) return { expression: node.content.content };
  if (node.type === 3) return { comment: node.content };
  if (![0, 1].includes(node.type)) throw Error(`Unhandled template node ${node.type}`);
  return {
    tag: node.tag ?? "root",
    props: (node.props ?? []).map((p) =>
      p.type === 6
        ? { name: p.name, value: p.value?.content }
        : {
            directive: p.name,
            arg: p.arg?.content,
            exp: p.exp?.content,
            modifiers: p.modifiers.map((m) => m.content ?? m),
          },
    ),
    children: (node.children ?? []).map(canonical).filter((v) => v !== null),
  };
};
export function assertTokenFilterDelta(current, baseline) {
  const c = parse(current).descriptor,
    b = parse(baseline).descriptor;
  assert.equal(
    undoTokenQuerySync(c.scriptSetup.content),
    b.scriptSetup.content.replaceAll("\r\n", "\n"),
    "Only separately verified query synchronization may change the business script",
  );
  assert.equal(b.styles.length, 0);
  assert.equal(c.styles.length, 2);
  assert.equal(c.styles[0].src, "../design/token-filter-tokens.css");
  assert.equal(c.styles[1].scoped, true);
  assert.match(
    c.styles[1].content,
    /^\s*\.org-token-filter-help\s*\{\s*display: none;\s*\}\s*@media \(max-width: 760px\) \{/,
  );
  let template = c.template.content;
  const replaceOne = (from, to) => {
    assert.equal(template.split(from).length, 2, `Exactly one ${from}`);
    template = template.replace(from, to);
  };
  replaceOne('class="org-token-toolbar org-token-filters-c"', 'class="org-token-toolbar"');
  for (const [key, text] of Object.entries(help)) {
    const pattern = new RegExp(
      `<small id="org-token-${key}-help" class="org-token-filter-help">([\\s\\S]*?)<\\/small>`,
      "g",
    );
    const matches = [...template.matchAll(pattern)];
    assert.equal(matches.length, 1);
    assert.equal(matches[0][1].trim(), text);
    template = template.replace(pattern, "");
    replaceOne(` id="org-token-${key}-label"`, "");
    replaceOne(`aria-labelledby="org-token-${key}-label"`, "");
    replaceOne(`aria-describedby="org-token-${key}-help"`, "");
  }
  const reset = /<small class="org-token-filter-help org-token-reset-help">([\s\S]*?)<\/small>/g;
  const matches = [...template.matchAll(reset)];
  assert.equal(matches.length, 1);
  assert.equal(matches[0][1].trim(), "仅重置筛选和排序，不更改令牌。");
  template = template.replace(reset, "");
  assert.deepEqual(
    canonical(baseParse(template)),
    canonical(baseParse(b.template.content)),
    "Only exact approved-region presentation delta",
  );
  return true;
}
