import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const releaseReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/release-page-preview.css";
export const releasePageSources = [
  releaseReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/release-page-preview.mjs",
];
const once = (source, target, replacement) => {
  assert.equal(source.split(target).length, 2, "P65 unique anchor: " + target.slice(0, 80));
  return source.replace(target, replacement);
};
export function releaseNodes(source) {
  const template = source.slice(
    source.indexOf("<template>") + 10,
    source.lastIndexOf("</template>"),
  );
  const nodes = [];
  const walk = (n) => {
    nodes.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(baseParse(template));
  const byClass = (name) => {
    const found = nodes.filter(
      (n) => n.type === 1 && n.props.some((p) => p.name === "class" && p.value?.content === name),
    );
    assert.equal(found.length, 1, "P65 unique class " + name);
    return found[0];
  };
  return { nodes, byClass };
}
export function previewReleasePage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    { nodes, byClass } = releaseNodes(source);
  const root = byClass("release-center"),
    hero = byClass("hero"),
    identity = byClass("identity-grid"),
    grid = byClass("detail-grid"),
    rings = byClass("gate-grid");
  const ringPanel = nodes.find((n) => n.type === 1 && n.children?.includes(rings));
  assert.ok(ringPanel);
  const panels = grid.children.filter((n) => n.type === 1 && n.tag === "section");
  assert.equal(panels.length, 2);
  let metrics = once(
    panels[0].loc.source,
    'class="panel"',
    'class="panel p65-metrics" id="p65-metrics" tabindex="-1" aria-labelledby="p65-metrics-title"',
  );
  metrics = once(metrics, "<h3>门禁指标</h3>", '<h2 id="p65-metrics-title">历史观察门指标</h2>');
  metrics = once(metrics, "超过任一阈值自动停止", "只读历史记录，不是当前分流或发布操作");
  let thresholds = once(panels[1].loc.source, "<h3>停止阈值</h3>", "<h2>历史观察策略</h2>");
  thresholds = once(thresholds, "固定失败关闭", "记录对应的阈值要求");
  thresholds = once(
    thresholds,
    "</header>",
    `</header><p>每阶段至少 {{ data.policy.minimum_observation_seconds }} 秒；
    证据有效期 {{ data.policy.maximum_evidence_age_minutes }} 分钟。比例要求 {{ data.policy.percentages.join(' / ') }}%。</p>`,
  );
  const field = (title, expression, code = false) =>
    `<div><dt>${title}</dt><dd>${code ? "<code>" : ""}{{ ${expression} }}${code ? "</code>" : ""}</dd></div>`;
  const version = (
    key,
    title,
  ) => `<section class="p65-version p65-version-${key}" aria-label="${title}"><h3>${title}</h3><dl>
    ${field("完整构建 SHA", `data.versions?.${key}?.build_sha || '未记录'`, true)}
    ${
      key === "production"
        ? field("应用版本", "data.versions?.production?.app_version || '未记录'") +
          field("迁移版本", "data.versions?.production?.migration_version || '未记录'", true)
        : ""
    }
    ${
      key === "remote"
        ? field("仓库", "data.versions?.remote?.repository || '未记录仓库'", true) +
          field("分支", "data.versions?.remote?.branch || '未记录'", true)
        : ""
    }
    </dl>${
      key === "production"
        ? `<details><summary>配置技术详情</summary><dl>
      ${field("配置指纹", "data.versions?.production?.config_fingerprint || '未记录'", true)}</dl></details>`
        : ""
    }</section>`;
  const identities = `<section class="p65-identities" id="p65-identities" tabindex="-1" aria-labelledby="p65-identities-title">
    <h2 id="p65-identities-title">运行身份与部署捕获</h2>
    <p class="p65-source-note">来源字段可能由服务回退填充；返回文本一致不代表独立核验。部署捕获值不是刷新时实时查询 Git。</p>
    ${version("production", "生产运行身份")}
    <div class="p65-sources">${version("local", "本地构建输入")}${version("remote", "远端部署捕获")}</div>
    <section class="p65-match"><h3>当前构建匹配记录</h3><p v-if="!data.latest_release">当前构建尚无匹配发布记录。</p>
      <dl v-else>${field("构建 SHA", "data.latest_release.build_sha || '未记录'", true)}
      ${field("记录状态", "statusText(data.latest_release.status)")}${field("完成时间", "time(data.latest_release.finished_at)")}</dl>
    </section></section>`;
  const actions = `<section class="p65-actions" id="p65-actions" tabindex="-1" aria-labelledby="p65-actions-title">
    <h2 id="p65-actions-title">动作计时与最近历史</h2><div class="p65-sources">
      <section><h3>迁移记录</h3><dl>${field("耗时", "duration(gate('migration')?.duration_ms)")}
      ${field("门状态", "gate('migration') ? statusText(gate('migration')?.status) : '尚无记录'")}</dl></section>
      <section><h3>回滚记录</h3><dl>${field("耗时", "duration(gate('rollback')?.duration_ms)")}
      ${field("门状态", "gate('rollback') ? statusText(gate('rollback')?.status) : '尚无记录'")}</dl></section></div>
    <dl>${field("自动停止证据", "data.automatic_stop_verified ? '已记录' : '未核验'")}
    ${field("回滚证据", "data.rollback_verified ? '已记录' : '未核验'")}</dl>
    <section class="p65-history"><h3>最近一条历史记录</h3><p>该记录不一定属于当前构建，不能据此推导其观察门。</p>
      <p v-if="!data.latest_historical_release">尚无历史发布记录。</p><dl v-else>
      ${field("构建 SHA", "data.latest_historical_release.build_sha || '未记录'", true)}
      ${field("记录状态", "statusText(data.latest_historical_release.status)")}
      ${field("完成时间", "time(data.latest_historical_release.finished_at)")}</dl></section></section>`;
  let content = root.loc.source.slice(
    root.loc.source.indexOf(">") + 1,
    root.loc.source.lastIndexOf("</section>"),
  );
  content = once(content, hero.loc.source, "");
  content = once(content, identity.loc.source, identities);
  content = once(content, ringPanel.loc.source, "");
  content = once(content, grid.loc.source, `${thresholds}\n${metrics}\n${actions}`);
  content = once(content, "<h3>阻断项</h3>", "<h2>阻断项</h2>");
  content = once(content, "发布已自动停止", "服务返回停止结论");
  content = once(content, "已回滚到稳定版本", "服务返回回滚结论");
  content = once(
    content,
    "回滚事实已审计，需重新完成发布门才可签发新版本。",
    "请结合下方回滚记录与证据标记核对；该结论不表示本页执行或独立核验了回滚。",
  );
  content = content.replace(
    /<h3 id="(release-(?:read|refresh)-title)">([\s\S]*?)<\/h3>/g,
    '<h2 id="$1">$2</h2>',
  );
  content = once(
    content,
    "读取构建身份、迁移、备份前置和 5% / 25% / 100% 观察门。",
    "读取运行身份、部署捕获与历史观察证据。",
  );
  content = once(
    content,
    "失败关闭：任何门缺失、超阈值或版本不一致都不会显示为健康。",
    "结论由服务返回；请结合当前构建匹配记录、历史门指标和阻断说明核对。",
  );
  content = once(
    content,
    "当前版本完成全部观察门；后续指标退化仍应停止新发布。",
    "服务返回观察门通过结论；不代表独立来源核验或本页执行了发布。",
  );
  content = once(
    content,
    "发布和回滚只能由宝塔任务执行",
    "本页只读；当前固定目录部署由宝塔管理，历史分流流程不作为操作指令",
  );
  let header = once(hero.loc.source, "<h2>发布与回滚控制台</h2>", "<h1>发布证据</h1>");
  header = once(header, "<p>发布控制</p>", "<p>P65 / 只读核验</p>");
  header = once(
    header,
    "只展示宝塔发布任务写入的版本、观察门、自动停止与回滚事实。",
    "区分运行身份、部署捕获与历史观察记录。",
  );
  return once(
    source,
    root.loc.source,
    `<section class="release-center release-center--review">${header}
    <p class="p65-review-note">实际 Vue 审核版 · 本地测试样例 · 未执行发布或回滚 · 尚未部署</p>
    <div class="p65-layout"><aside class="p65-directory"><h2>阅读发布证据</h2><p>当前为单后端固定目录部署。5% / 25% / 100% 仅用于阅读历史观察记录。</p>
    <nav v-if="data" aria-label="发布证据页内导航"><a href="#p65-identities">运行身份</a><a href="#p65-metrics">历史观察</a><a href="#p65-actions">动作与历史</a></nav>
    <p>此页没有发布、停止、回滚或迁移执行入口。</p></aside><div class="p65-content">${content}</div></div></section>`,
  );
}
export function previewReleaseTableControls(source) {
  return once(
    once(
      source,
      "<legend>选择显示列</legend>",
      '<legend>选择显示列</legend><p class="p65-column-help">至少保留一列</p>',
    ),
    '<span :id="`${controlId}-column-${column.index}-description`">{{ column.label }}</span>',
    '<label :for="`${controlId}-column-${column.index}`" :id="`${controlId}-column-${column.index}-description`">{{ column.label }}</label>',
  );
}
export function releasePagePlugin() {
  return {
    name: "p65-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (p) => path.resolve(p).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/TableViewControls.vue"))
        return { code: previewReleaseTableControls(source), map: null };
      if (file === absolute("apps/web/src/components/ReleaseRolloutCenter.vue"))
        return { code: previewReleasePage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            `<header v-if="!opportunityId && routePath !== '/platform-admin/releases'" class="role-page-title">`,
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, releaseReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
