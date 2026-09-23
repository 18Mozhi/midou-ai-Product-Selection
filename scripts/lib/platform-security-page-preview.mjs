import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const securityPageCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-security-page-preview.css";
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Unique P59 preview anchor: ${before}`);
  return source.replace(before, after);
};
export function previewSecurityPage(source) {
  let result = source.replaceAll("\r\n", "\n");
  if (result.includes('class="security-ops security-ops--c"'))
    return once(
      result,
      'class="security-ops security-ops--c"',
      'class="security-ops security-ops--c security-ops--review"',
    );
  result = once(result, 'class="security-ops"', 'class="security-ops security-ops--review"');
  result = once(
    result,
    '<h2 id="security-operations-title">安全与密钥运营</h2>',
    '<h1 id="security-operations-title">安全中心</h1>',
  );
  result = once(result, "<p>平台安全运营中心</p>", "<p>P59 / 调查工作区</p>");
  result = once(
    result,
    '<h3 id="security-read-state-title">{{ stateTitle }}</h3>',
    '<h2 id="security-read-state-title">{{ stateTitle }}</h2>',
  );
  const summary = result.match(/      <section class="security-kpis"[\s\S]*?      <\/section>/);
  const nav = result.match(/      <nav class="security-view-nav"[\s\S]*?      <\/nav>/);
  assert.ok(summary && nav);
  // Keep the original ready-only boundary and every RouterLink; source order matches visual/keyboard order.
  result = once(
    result,
    summary[0] + "\n\n" + nav[0],
    `${nav[0]}
      <section class="p59-background" aria-label="全平台背景摘要">
        <header><h2>全平台背景摘要</h2><p>独立于当前搜索和状态筛选</p></header>
${summary[0]}
        <p>事件与风险按事件时间窗统计；生命周期数量按已读取时点。零摘要不代表没有历史记录。</p>
      </section>`,
  );
  result = once(
    result,
    '      <form class="security-filter-bar"',
    '      <section class="p59-investigation" aria-label="调查结果">\n      <header class="p59-investigation-heading"><h2>调查结果</h2><p>筛选当前分类，查看匹配记录及原始证据字段。</p></header>\n      <form class="security-filter-bar"',
  );
  result = once(
    result,
    '      <footer class="security-footer">',
    '      </section>\n      <footer class="security-footer">',
  );
  result = once(
    result,
    "    <section\n      v-if=\"state !== 'ready'\"",
    '    <p class="p59-fixture-note">本地实际 Vue 审核预览 · 原 E2E 合成样例 · 摘要与记录数量不代表生产统计 · 尚未部署</p>\n    <section\n      v-if="state !== \'ready\'"',
  );
  return result;
}
export function previewSecurityShell(source) {
  const result = previewShellVue(source);
  if (result.includes("routePath !== '/platform-admin/security'")) return result;
  return once(
    result,
    '<header v-if="!opportunityId" class="role-page-title">',
    '<header v-if="!opportunityId && routePath !== \'/platform-admin/security\'" class="role-page-title">',
  );
}
export const securityPageSources = [
  securityPageCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/platform-security-page-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
];
export function securityPagePlugin() {
  return {
    name: "security-page-review-only",
    enforce: "pre",
    transform(source, id) {
      for (const [name, transform] of [
        ["NavigationShell", previewSecurityShell],
        ["SecurityOperationsCenter", previewSecurityPage],
      ])
        if (
          id.replaceAll("\\", "/") ===
          path.resolve(`apps/web/src/components/${name}.vue`).replaceAll("\\", "/")
        )
          return { code: transform(source), map: null };
      return null;
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, securityPageCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
