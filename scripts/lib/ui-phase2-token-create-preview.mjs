import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

// Review-only structure. Original script, directives, constraints and field expressions survive.
export function tokenCreatePreview(source) {
  const template = parse(source).descriptor.template.content;
  const ast = baseParse(template);
  const found = [];
  const walk = (node) => {
    if (
      node.type === 1 &&
      node.tag === "form" &&
      node.props.some((p) => p.name === "class" && p.value?.content === "org-token-create")
    )
      found.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(ast);
  assert.equal(found.length, 1);
  const form = found[0],
    elements = form.children.filter((node) => node.type === 1);
  assert.deepEqual(
    elements.map((node) => node.tag),
    ["header", "label", "fieldset", "div", "label", "aside", "button"],
  );
  const [header, name, scopes, duration, reason, preview, submit] = elements.map(
    (node) => node.loc.source,
  );
  const updated = `<form class="org-token-create p36-create-c" @submit.prevent="submitCreate">
${header.replace("CREATE · 最小权限", "只读访问 / 新建")}
<div class="p36-form-layout"><div class="p36-form-fields">
${name}
${duration}
${scopes}
${reason}
${submit}
</div>${preview}</div></form>`;
  const result = source.replace(form.loc.source, updated);
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  return result;
}
