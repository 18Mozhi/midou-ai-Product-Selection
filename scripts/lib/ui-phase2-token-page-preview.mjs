import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { tokenCreatePreview } from "./ui-phase2-token-create-preview.mjs";
import { tokenSecretPreview } from "./ui-phase2-token-secret-preview.mjs";
import { tokenListPreview } from "./ui-phase2-token-list-preview.mjs";

// Compose existing review regions; production source and every handler stay intact.
export function tokenPagePreview(source) {
  let result = tokenListPreview(tokenSecretPreview(tokenCreatePreview(source)));
  const matches = [],
    overviews = [],
    truths = [];
  const walk = (node) => {
    if (
      node.type === 1 &&
      node.props.some(
        (prop) => prop.name === "class" && prop.value?.content === "org-token-workbench",
      )
    )
      matches.push(node);
    if (
      node.type === 1 &&
      node.props.some(
        (prop) => prop.name === "class" && prop.value?.content === "org-token-overview",
      )
    )
      overviews.push(node);
    if (
      node.type === 1 &&
      node.props.some((prop) => prop.name === "class" && prop.value?.content === "org-token-truth")
    )
      truths.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(parse(result).descriptor.template.content));
  assert.equal(matches.length, 1);
  assert.equal(overviews.length, 1);
  assert.equal(truths.length, 1);
  const aside = overviews[0].children.filter((node) => node.type === 1 && node.tag === "aside");
  assert.equal(aside.length, 1);
  result = result.replace(
    overviews[0].loc.source,
    overviews[0].loc.source.replace(aside[0].loc.source, ""),
  );
  result = result.replace(truths[0].loc.source, "");
  const workbench = matches[0],
    parts = workbench.children.filter((node) => node.type === 1);
  assert.deepEqual(
    parts.map((node) => node.tag),
    ["form", "section"],
  );
  result = result.replace(
    workbench.loc.source,
    `<div class="org-token-workbench">${parts[1].loc.source}<div class="p36-safety-c">${aside[0].loc.source}${truths[0].loc.source}</div>${parts[0].loc.source}</div>`,
  );
  assert.equal(result.split("ACCESS LEDGER · 当前组织").length, 2);
  result = result.replace("ACCESS LEDGER · 当前组织", "只读访问 / 当前组织");
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  return result;
}
