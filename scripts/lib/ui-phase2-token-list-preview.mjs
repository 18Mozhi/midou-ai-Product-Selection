import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

// Review-only result composition. Keep filters, native controls and complete script unchanged.
export function tokenListPreview(source) {
  const template = parse(source).descriptor.template.content;
  const matches = [];
  const walk = (node) => {
    if (
      node.type === 1 &&
      node.tag === "section" &&
      node.props.some((prop) => prop.name === "class" && prop.value?.content === "org-token-ledger")
    )
      matches.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(template));
  assert.equal(matches.length, 1);
  const section = matches[0],
    children = section.children.filter((node) => node.type === 1);
  assert.deepEqual(
    children.map((node) => node.tag),
    ["header", "div", "div", "div", "footer"],
  );
  const [heading, filters, list, empty, paging] = children;
  const articles = list.children.filter((node) => node.type === 1);
  assert.equal(articles.length, 1);
  const article = articles[0],
    parts = article.children.filter((node) => node.type === 1);
  assert.equal(article.tag, "article");
  assert.deepEqual(
    parts.map((node) => node.tag),
    ["header", "div", "dl", "footer"],
  );
  const [header, scopes, dates, footer] = parts;
  const identity = header.children.filter((node) => node.type === 1);
  assert.deepEqual(
    identity.map((node) => node.tag),
    ["div", "code"],
  );
  const labels = identity[0].children.filter((node) => node.type === 1);
  assert.deepEqual(
    labels.map((node) => node.tag),
    ["span", "small", "h5"],
  );
  const rearrangedHeader = header.loc.source.replace(
    identity[0].loc.source,
    `<div>${labels[2].loc.source}<div class="p36-token-state">${labels[0].loc.source}${labels[1].loc.source}</div></div>`,
  );
  const opening = article.loc.source.slice(0, article.loc.source.indexOf(">") + 1);
  const updatedArticle = `${opening}<div class="p36-token-record-main"><div class="p36-token-identity">${rearrangedHeader}${scopes.loc.source}</div>${dates.loc.source}</div>${footer.loc.source}</article>`;
  const updatedList = list.loc.source.replace(article.loc.source, updatedArticle);
  const result = source.replace(
    section.loc.source,
    `<section class="org-token-ledger p36-ledger-c" aria-labelledby="org-token-ledger-title">${filters.loc.source}<div class="p36-results-c">${heading.loc.source.replace("LIFECYCLE · 真实记录", "已读取的令牌")}${updatedList}${empty.loc.source}${paging.loc.source}</div></section>`,
  );
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  return result;
}
