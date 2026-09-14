import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const commercialPageCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-commercial-page-preview.css";
export const commercialReviewSetup =
  'const reviewTask = ref(organizationId.value ? "organization" : "plans");\n';
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Unique P58 page anchor: ${before}`);
  return source.replace(before, after);
};
export function previewCommercialPage(source) {
  let text = source.replaceAll("\r\n", "\n");
  text = once(text, 'const notice = ref("");', commercialReviewSetup + 'const notice = ref("");');
  text = once(text, 'class="commercial"', 'class="commercial commercial--review"');
  text = once(text, "<h2>组织配额与用量</h2>", "<h1>组织配额与用量</h1>");
  const lookup = text.match(
    /      <form class="commercial-organization-lookup"[\s\S]*?      <\/form>\n/,
  );
  assert.ok(lookup);
  text = once(text, lookup[0], "");
  text = once(
    text,
    '    <p v-if="notice"',
    `
    <div class="p58-task-switch" role="group" aria-label="配额工作区切换">
      <button type="button" :aria-pressed="reviewTask === 'plans'" @click="reviewTask = 'plans'">方案目录<span>全局配置与额度</span></button>
      <button type="button" :aria-pressed="reviewTask === 'organization'" @click="reviewTask = 'organization'">组织配额<span>读取组织、分配与用量</span></button>
    </div>
    <section v-show="reviewTask === 'organization'" class="p58-organization-task" aria-label="组织配额工作区">
      <header class="p58-task-heading"><h3>读取组织配额</h3><p>使用组织内部编号读取分配和用量；不改变全局方案统计。</p></header>
${lookup[0]}      <p v-if="!organizationId" class="p58-unselected">尚未读取组织。填写组织内部编号后，点击“读取组织”。</p>
    </section>
    <p v-if="notice"`,
  );
  text = once(
    text,
    '<section class="commercial-summary"',
    '<section v-show="reviewTask === \'plans\'" class="commercial-summary"',
  );
  text = once(
    text,
    '      <section v-if="organizationId" class="membership">',
    `      <section v-if="organizationId" v-show="reviewTask === 'organization'" class="membership">`,
  );
  text = once(
    text,
    '<section class="commercial-catalog">',
    '<section v-show="reviewTask === \'plans\'" class="commercial-catalog">',
  );
  text = once(
    text,
    "当前列表没有启用方案。请在下方按名称或内部标识搜索",
    "当前列表没有启用方案。请在“方案目录”按名称或内部标识搜索",
  );
  return text;
}
export function previewCommercialShell(source) {
  return once(
    previewShellVue(source),
    '<header v-if="!opportunityId" class="role-page-title">',
    '<header v-if="!opportunityId && routePath !== \'/platform-admin/commercial\'" class="role-page-title">',
  );
}

export const commercialPageSources = [
  commercialPageCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/platform-commercial-page-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
];
export function commercialPagePlugin() {
  return {
    name: "commercial-page-review-only",
    enforce: "pre",
    transform(source, id) {
      for (const [name, transform] of [
        ["NavigationShell", previewCommercialShell],
        ["CommercialOperationsCenter", previewCommercialPage],
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
        [shellReviewCss, commercialPageCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
