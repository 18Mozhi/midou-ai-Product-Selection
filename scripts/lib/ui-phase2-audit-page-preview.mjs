import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

export function auditPagePreview(source) {
  const ast = baseParse(parse(source).descriptor.template.content);
  const find = (className) => {
    const matches = [];
    const walk = (node) => {
      if (
        node.type === 1 &&
        node.props.some((prop) => prop.name === "class" && prop.value?.content === className)
      )
        matches.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(ast);
    assert.equal(matches.length, 1, className);
    return matches[0];
  };
  const panel = find("org-audit-panel"),
    overview = find("org-audit-overview"),
    metrics = find("org-audit-metrics"),
    form = find("org-audit-filters"),
    grid = find("org-audit-filter-grid"),
    ledger = find("org-audit-ledger"),
    correlation = find("org-audit-correlation");
  const labels = grid.children.filter((node) => node.type === 1);
  assert.deepEqual(
    labels.map((node) => node.tag),
    ["label", "label", "label", "label"],
  );
  const updatedForm = form.loc.source.replace(
    grid.loc.source,
    `<div class="p37-local-search">${labels[0].loc.source}<p>输入时仅检索已加载记录；读取新结果请应用筛选。</p></div><div class="org-audit-filter-grid">${labels
      .slice(1)
      .map((node) => node.loc.source)
      .join("\n")}</div>`,
  );
  let updatedCorrelation = correlation.loc.source;
  for (const [field, label] of [
    ["request", "复制请求 ID"],
    ["trace", "复制追踪 ID"],
  ]) {
    const button = [];
    const walk = (node) => {
      if (node.type === 1 && node.tag === "button" && node.loc.source.includes(`'${field}'`))
        button.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(correlation);
    assert.equal(button.length, 1);
    updatedCorrelation = updatedCorrelation.replace(
      button[0].loc.source,
      button[0].loc.source.replace(': "复制"', `: "${label}"`),
    );
  }
  const updatedLedger = ledger.loc.source.replace(correlation.loc.source, updatedCorrelation);
  const open = panel.loc.source.slice(0, panel.loc.source.indexOf(">") + 1);
  const result = source.replace(
    panel.loc.source,
    `${open}${overview.loc.source.replace("AUDIT LEDGER · 当前组织", "审计记录 / 当前组织").replace("组织审计账本", "组织审计记录")}<div class="p37-audit-workspace">${updatedForm}<div class="p37-audit-results">${metrics.loc.source}${updatedLedger}</div></div></section>`,
  );
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  return result;
}
