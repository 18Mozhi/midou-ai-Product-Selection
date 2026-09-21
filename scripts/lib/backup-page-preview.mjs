import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const backupReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/backup-page-preview.css";
export const backupPageSources = [
  backupReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/backup-page-preview.mjs",
];
const once = (source, target, replacement) => {
  assert.equal(source.split(target).length, 2, "P64 unique anchor: " + target.slice(0, 80));
  return source.replace(target, replacement);
};
export function backupNodes(source) {
  const template = source.slice(
    source.indexOf("<template>") + 10,
    source.lastIndexOf("</template>"),
  );
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(template));
  const byClass = (name) => {
    const found = nodes.filter(
      (node) =>
        node.type === 1 && node.props.some((p) => p.name === "class" && p.value?.content === name),
    );
    assert.equal(found.length, 1, "P64 unique class " + name);
    return found[0];
  };
  return { nodes, byClass };
}
export function previewBackupPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    { byClass } = backupNodes(source);
  const root = byClass("backup-center"),
    hero = byClass("backup-hero"),
    policy = byClass("policy-grid"),
    grid = byClass("backup-grid");
  const panels = grid.children.filter((n) => n.type === 1 && n.tag === "section");
  assert.equal(panels.length, 2);
  let assets = once(
    panels[0].loc.source,
    'class="panel"',
    'class="panel p64-assets" id="p64-assets" tabindex="-1" aria-labelledby="p64-assets-title"',
  );
  assets = once(assets, "<h3>备份资产</h3>", '<h2 id="p64-assets-title">备份资产</h2>');
  assets = once(assets, "高强度加密", "按实际记录核对");
  let evidence = once(
    panels[1].loc.source,
    'class="panel"',
    'class="panel p64-evidence" id="p64-evidence" tabindex="-1" aria-labelledby="p64-evidence-title"',
  );
  evidence = once(evidence, "<h3>恢复证据</h3>", '<h2 id="p64-evidence-title">恢复证据</h2>');
  const evidenceDl = panels[1].children.find((n) => n.type === 1 && n.tag === "dl");
  const actualFields = evidenceDl.children.filter(
    (n) => n.type === 1 && /<dt>实际(?:最多可丢失时间|恢复耗时)<\/dt>/.test(n.loc.source),
  );
  assert.equal(actualFields.length, 2);
  for (const field of actualFields) evidence = once(evidence, field.loc.source, "");
  const actual = actualFields.map(
    (n) => n.children.find((c) => c.type === 1 && c.tag === "dd").loc.source,
  );
  const targets = `<section class="p64-objectives" id="p64-objectives" tabindex="-1" aria-labelledby="p64-objectives-title">
    <h2 id="p64-objectives-title">恢复目标与实际</h2>
    <dl class="p64-regions"><div><dt>主站 · 单机运行</dt><dd>{{ data.policy.primary_region }}</dd></div><div><dt>恢复目标</dt><dd>{{ data.policy.recovery_region }} · {{ data.recovery_copy_verified ? "同机副本已核验" : "同机副本未核验" }}</dd></div></dl>
    <div class="p64-comparisons">
      <section aria-label="数据库最多可丢失时间"><h3>数据库最多可丢失时间</h3><dl><div><dt>目标上限</dt><dd>{{ data.policy.rpo_minutes }} min</dd></div><div><dt>实际记录</dt>${actual[0]}</div></dl></section>
      <section aria-label="数据库恢复耗时"><h3>数据库恢复耗时</h3><dl><div><dt>目标上限</dt><dd>{{ data.policy.rto_minutes }} min</dd></div><div><dt>实际记录</dt>${actual[1]}</div></dl></section>
    </div></section>`;
  let content = root.loc.source.slice(
    root.loc.source.indexOf(">") + 1,
    root.loc.source.lastIndexOf("</section>"),
  );
  content = once(content, hero.loc.source, "");
  content = once(content, policy.loc.source, targets);
  content = once(content, grid.loc.source, evidence + "\n" + assets);
  content = once(content, "<h3>阻断项</h3>", "<h2>阻断项</h2>");
  content = content.replace(
    /<h3 id="(backup-(?:read|refresh)-title)">([\s\S]*?)<\/h3>/g,
    '<h2 id="$1">$2</h2>',
  );
  let header = once(hero.loc.source, "<h2>备份与恢复控制台</h2>", "<h1>备份与恢复控制台</h1>");
  header = once(
    header,
    '<p class="eyebrow">备份恢复管理</p>',
    '<p class="eyebrow">P64 / 恢复证据</p>',
  );
  header = once(
    header,
    "惠州当前主机内的加密副本与隔离恢复；不代表整机或异地灾备。",
    "核对结论、目标和证据；此页只读取事实。",
  );
  return once(
    source,
    root.loc.source,
    `<section class="backup-center backup-center--review">
    ${header}
    <p class="p64-review-note">实际 Vue 审核版 · 本地测试样例 · 未执行备份或恢复 · 尚未部署</p>
    <div class="p64-layout"><aside class="p64-directory"><h2>仅限当前主机</h2><p>惠州当前主机内的加密副本与隔离恢复；不代表整机或异地灾备。</p><nav v-if="data" aria-label="备份恢复页内导航"><a href="#p64-objectives">01 / 目标与实际</a><a href="#p64-evidence">02 / 恢复证据</a><a href="#p64-assets">03 / 备份资产</a></nav><p>恢复动作仅由宝塔受控任务执行，本页没有执行入口。</p></aside><div class="p64-content">${content}</div></div>
  </section>`,
  );
}
export function previewBackupTableControls(source) {
  return once(
    source,
    '<span :id="`${controlId}-column-${column.index}-description`">{{ column.label }}</span>',
    '<label :for="`${controlId}-column-${column.index}`" :id="`${controlId}-column-${column.index}-description`">{{ column.label }}</label>',
  );
}
export function backupPagePlugin() {
  return {
    name: "p64-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (
        file === path.resolve("apps/web/src/components/TableViewControls.vue").replaceAll("\\", "/")
      )
        return { code: previewBackupTableControls(source), map: null };
      if (
        file ===
        path.resolve("apps/web/src/components/BackupRecoveryCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewBackupPage(source), map: null };
      if (
        file === path.resolve("apps/web/src/components/NavigationShell.vue").replaceAll("\\", "/")
      )
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            `<header v-if="!opportunityId && routePath !== '/platform-admin/operations'" class="role-page-title">`,
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, backupReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
