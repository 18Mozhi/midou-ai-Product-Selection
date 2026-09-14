import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const openPageCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-open-page-preview.css";
export const openCreateComponent =
  "design-plans/ui-phase-2-2026-09-07/implementation/OpenCreateReview.vue";
export const openReviewImport = `import OpenCreateReview from "../../../../${openCreateComponent}";\n`;
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Unique P60 preview anchor: ${before}`);
  return source.replace(before, after);
};
export function previewOpenPage(source) {
  let result = source.replaceAll("\r\n", "\n");
  result = once(
    result,
    '<script setup lang="ts">\n',
    '<script setup lang="ts">\n' + openReviewImport,
  );
  result = once(result, 'class="open-platform"', 'class="open-platform open-platform--review"');
  result = once(result, "<p>平台开放能力</p>", "<p>P60 / 连接工作区</p>");
  result = once(result, "<h2>开放接口与事件回调</h2>", "<h1>开放平台</h1>");
  const org = result.match(/      <form class="open-org-filter"[\s\S]*?      <\/form>/)?.[0];
  assert.ok(org);
  result = once(result, org, "");
  result = once(
    result,
    '    <aside v-if="secret"',
    `    <p class="p60-fixture-note">本地实际 Vue 审核预览 · 合成测试样例 · 不生成真实密钥或发送外部回调 · 尚未部署</p>\n${org}\n    <aside v-if="secret"`,
  );
  for (const view of ["clients", "webhooks", "deliveries"])
    result = once(
      result,
      `data-view="${view}"`,
      `data-view="${view}" :aria-current="activeView === '${view}' ? 'page' : undefined"`,
    );
  const create = result.match(
    /      <section\n        v-if="activeView !== 'deliveries'"[\s\S]*?      <\/section>/,
  )?.[0];
  assert.ok(create, "Original create section remains uniquely identifiable");
  result = once(result, create + "\n", "");
  let fields = once(create, `        v-if="activeView !== 'deliveries'"\n`, "");
  fields = once(
    fields,
    '<div class="open-form-grid">',
    `<div class="open-form-grid">\n          <label class="wide">组织内部编号<input v-model.trim="organizationId" aria-label="组织内部编号" required autocomplete="off" :aria-invalid="Boolean(fieldErrors.organization_id)" aria-describedby="p60-org-help p60-org-error"/><small id="p60-org-help">填写目标组织的 UUID。该值与上方组织读取字段共用。</small><small v-if="fieldErrors.organization_id" id="p60-org-error" class="field-error">{{ fieldErrors.organization_id }}</small></label>`,
  );
  fields = once(
    fields,
    '<small v-if="fieldErrors.organization_id" class="field-error">{{\n              fieldErrors.organization_id\n            }}</small>',
    "",
  );
  // Form handlers and values are preserved. Only accessible field associations are added.
  for (const [model, key, label] of [
    ["form.name", "name", "名称"],
    ["form.quota_per_minute", "quota", "每分钟配额"],
    ["form.target_url", "target_url", "事件回调安全网址"],
    ["form.reason", "reason", "变更原因"],
  ]) {
    const binding =
      model === "form.quota_per_minute" ? `v-model.number="${model}"` : `v-model="${model}"`;
    fields = once(
      fields,
      binding,
      `${binding} aria-label="${label}" required :aria-invalid="Boolean(fieldErrors.${key})" aria-describedby="p60-${key}-error"`,
    );
    fields = once(
      fields,
      `v-if="fieldErrors.${key}"`,
      `v-if="fieldErrors.${key}" id="p60-${key}-error"`,
    );
  }
  fields = once(fields, 'class="open-form-grid"', 'class="open-form-grid" aria-live="polite"');
  fields = once(
    fields,
    "<fieldset v-if=\"activeView === 'webhooks'\"",
    '<fieldset v-if="activeView === \'webhooks\'" :aria-invalid="Boolean(fieldErrors.events)" aria-describedby="p60-events-error"',
  );
  fields = once(
    fields,
    'v-if="fieldErrors.events"',
    'v-if="fieldErrors.events" id="p60-events-error"',
  );
  result = once(result, "<h3>{{ currentTitle }}</h3>", "<h2>{{ currentTitle }}</h2>");
  result = once(
    result,
    '        <form class="open-toolbar"',
    `        <OpenCreateReview v-if="activeView !== 'deliveries'" :key="activeView" :confirming="Boolean(pending)" :busy="actionBusy" :title="activeView === 'clients' ? '创建接口访问账号' : '创建事件回调地址'">\n${fields}\n        </OpenCreateReview>\n        <form class="open-toolbar"`,
  );
  return result;
}
export function previewOpenShell(source) {
  return once(
    previewShellVue(source),
    '<header v-if="!opportunityId" class="role-page-title">',
    '<header v-if="!opportunityId && routePath !== \'/platform-admin/open-platform\'" class="role-page-title">',
  );
}
export const openPageSources = [
  openPageCss,
  openCreateComponent,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/platform-open-page-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
];
export function openPagePlugin() {
  return {
    name: "open-platform-c-review-only",
    enforce: "pre",
    transform(source, id) {
      for (const [name, transform] of [
        ["NavigationShell", previewOpenShell],
        ["OpenPlatformCenter", previewOpenPage],
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
        [shellReviewCss, openPageCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
