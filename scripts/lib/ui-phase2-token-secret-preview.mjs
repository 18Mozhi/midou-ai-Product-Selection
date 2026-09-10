import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

// Review-only composition. No original script, directive or business callback is changed.
export function tokenSecretPreview(source) {
  const template = parse(source).descriptor.template.content;
  const found = [];
  const walk = (node) => {
    if (
      node.type === 1 &&
      node.tag === "section" &&
      node.props.some((prop) => prop.name === "class" && prop.value?.content === "org-token-secret")
    )
      found.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(template));
  assert.equal(found.length, 1, "Exactly one secret region");
  const section = found[0],
    elements = section.children.filter((node) => node.type === 1);
  assert.deepEqual(
    elements.map((node) => node.tag),
    ["header", "code", "footer"],
  );
  const [header, code, footer] = elements.map((node) => node.loc.source);
  const updated = `<section v-if="secret" class="org-token-secret p36-secret-c" aria-labelledby="org-token-secret-title" :data-copy-state="copyState || 'idle'">
${header.replace("ONE-TIME SECRET", "仅本次响应可见").replace("仅本次响应可见的令牌明文", "请保存令牌明文")}
<div class="p36-secret-content"><p class="p36-secret-label">令牌明文</p>${code}
${footer}
<p class="p36-secret-footnote">确认已保存后，当前页面将清除明文。</p>
</div></section>`;
  const result = source.replace(section.loc.source, updated);
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  return result;
}
