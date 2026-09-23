import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";
export const topologyReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/topology-page-preview.css";
export const topologyPageSources = [
  "apps/web/src/runtime-topology-c.css",
  topologyReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/topology-page-preview.mjs",
];
const once = (s, before, after) => {
  assert.equal(s.split(before).length, 2, "P66 unique source anchor " + before.slice(0, 60));
  return s.replace(before, after);
};
export function topologyNodes(source) {
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
    const matches = nodes.filter(
      (n) => n.type === 1 && n.props.some((p) => p.name === "class" && p.value?.content === name),
    );
    assert.equal(matches.length, 1, name);
    return matches[0];
  };
  return { nodes, byClass };
}
export function previewTopologyPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    { byClass } = topologyNodes(source);
  if (source.includes('class="topology-center topology-center--c"')) {
    return once(
      once(
        source,
        'class="topology-center topology-center--c"',
        'class="topology-center topology-center--review"',
      ),
      '<div class="p66-layout">',
      '<p class="p66-review-note">实际 Vue C 审核版 · 本地样例 · 未执行探测、重启或调度 · 尚未部署</p><div class="p66-layout">',
    );
  }
  const get = (name) => byClass(name).loc.source;
  const root = get("topology-center"),
    hero = get("topology-hero"),
    layout = get("topology-layout");
  let map = get("topology-panel topology-map"),
    process = get("topology-processes"),
    health = get("topology-health-probes"),
    scheduler = get("topology-scheduler");
  const alerts = get("topology-panel topology-alerts"),
    blockers = get("topology-panel topology-blockers");
  const restart = get("topology-restart-trends");
  const restartRecords = `<div v-if="restartSeries.length" class="p66-restart-records">
    <p>最近24小时记录；五分钟桶由授权查看触发，不代表无人查看时持续采样。各次观测按实际时间阅读。</p>
    <details v-for="series in restartSeries" :key="series.name">
      <summary>{{ series.name === 'api' ? 'Node API' : 'Node Worker' }} · 新增重启 {{ series.restart_delta }} · {{ series.rows.length }} 次观测</summary>
      <p>计数重置 {{ series.counter_resets }} 次；首次记录与计数重置的新增值按服务返回保留。</p>
      <ol><li v-for="(row, index) in series.rows" :key="index">
        <time :datetime="row.observed_at">{{ time(row.observed_at) }}</time>
        <dl><div><dt>进程状态</dt><dd>{{ row.status }}</dd></div><div><dt>累计重启</dt><dd>{{ row.restart_count }}</dd></div>
        <div><dt>本次新增</dt><dd>{{ row.restart_delta }}</dd></div><div><dt>计数重置</dt><dd>{{ row.counter_reset ? '是' : '否' }}</dd></div></dl>
      </li></ol>
    </details></div>`;
  process = once(process, restart, restartRecords);
  map = once(map, get("topology-processes"), process);
  map = once(map, health, "");
  map = once(map, scheduler, "");
  map = once(
    map,
    'class="topology-panel topology-map"',
    'class="topology-panel topology-map" id="p66-nodes" tabindex="-1" aria-labelledby="p66-nodes-title"',
  );
  map = once(map, "<p>实时拓扑</p>", "<p>01 / 节点与进程</p>");
  map = once(map, "<h3>网站与本机后端</h3>", '<h2 id="p66-nodes-title">节点与进程记录</h2>');
  map = once(
    map,
    get("topology-entry"),
    '<p class="p66-relation-note">部署关系说明：宝塔网页服务 → 本机后端。此关系来自单上游合同，不是本次网络连通性实测。</p>',
  );
  map = once(map, get("topology-rail"), "");
  map = map.replaceAll("<h4>", "<h3>").replaceAll("</h4>", "</h3>");
  map = once(map, "{{ short(node.build_sha) }}", "{{ node.build_sha || '未记录' }}");
  health = once(
    health,
    "<span>可用率 {{ (endpoint.availability_basis_points / 100).toFixed(2) }}%</span>",
    `<span v-if="endpoint.sample_count > 0">可用率 {{ (endpoint.availability_basis_points / 100).toFixed(2) }}%</span><span v-else>无样本，暂不提供实测可用率</span>`,
  );
  health = once(
    health,
    byClass("topology-health-probes").children.find((n) => n.type === 1 && n.tag === "header").loc
      .source,
    byClass("topology-health-probes").children.find((n) => n.type === 1 && n.tag === "header").loc
      .source +
      '<p class="p66-section-note">各端点与各自窗口独立呈现；耗时分位数包括失败和超时样本。</p>',
  );
  scheduler = once(
    scheduler,
    "<small v-else>当前空闲，不累计老化</small>",
    '<small v-else>{{ queue.running ? "当前执行中，不处于等待队列" : "当前空闲，不累计老化" }}</small>',
  );
  scheduler = once(
    scheduler,
    "<summary>调度策略</summary>",
    '<summary>调度策略</summary><code class="p66-queue-code">{{ queue.name }}</code>',
  );
  const section = (id, title, body) =>
    `<section class="p66-section" id="${id}" tabindex="-1" aria-labelledby="${id}-title"><h2 id="${id}-title">${title}</h2>${body}</section>`;
  const sections =
    map +
    section(
      "p66-health",
      "02 / 健康探测",
      health + '<p v-if="!data.health_probes">尚未提供健康探测摘要；不据此判断端点可用性。</p>',
    ) +
    section(
      "p66-queues",
      "03 / 队列调度",
      scheduler + '<p v-if="!data.worker_scheduler">尚未提供 Worker 调度快照。</p>',
    ) +
    section("p66-alerts", "04 / 告警与阻断", alerts + blockers);
  const boundary = get("topology-panel topology-evidence");
  const boundaryContent = boundary.slice(
    boundary.indexOf(">") + 1,
    boundary.lastIndexOf("</aside>"),
  );
  const metrics = `<dl class="p66-summary"><div><dt>健康后端实例</dt><dd>{{ data.active_api_instances }}</dd></div>
    <div><dt>过期节点</dt><dd>{{ data.stale_node_count }}</dd></div><div><dt>运行告警</dt><dd>{{ data.alerts?.length || 0 }}</dd></div>
    <div><dt>阻断项</dt><dd>{{ data.blockers.length }}</dd></div></dl><p class="p66-section-note">节点结论、监督器阻断与运行告警分别核对；标题不代表所有服务均健康。</p>`;
  let content = root.slice(root.indexOf(">") + 1, root.lastIndexOf("</section>"));
  content = once(content, hero, "");
  for (const name of [
    "topology-state",
    "topology-state topology-state--danger",
    "topology-refresh-notice",
  ]) {
    const region = get(name);
    content = once(
      content,
      region,
      region.replace(
        /<h3 (id="topology-(?:read|refresh)-title")>([\s\S]*?)<\/h3>/,
        "<h2 $1>$2</h2>",
      ),
    );
  }
  content = once(content, '<strong aria-hidden="true">!</strong>', "");
  content = once(content, get("topology-metrics"), metrics);
  content = once(content, layout, sections);
  // Remove the original trailing sections after relocating them inside the fourth workspace.
  const end = content.lastIndexOf(alerts);
  content = content.slice(0, end) + content.slice(end + alerts.length);
  const endBlocker = content.lastIndexOf(blockers);
  content = content.slice(0, endBlocker) + content.slice(endBlocker + blockers.length);
  const header = once(
    once(hero, "<h2>单机运行控制台</h2>", "<h1>服务拓扑</h1>"),
    "<p>单服务器</p>",
    "<p>P66 / 运行证据</p>",
  );
  return once(
    source,
    root,
    `<section class="topology-center topology-center--review" :data-state="state">${header}
    <p class="p66-review-note">实际 Vue C 审核版 · 本地样例 · 未执行探测、重启或调度 · 尚未部署</p>
    <div class="p66-layout"><aside class="p66-directory"><h2>阅读运行证据</h2><p>惠州单主机 · 固定单后端</p>
      <nav v-if="data" aria-label="服务拓扑页内导航"><a href="#p66-nodes">节点与进程</a><a href="#p66-health">健康探测</a><a href="#p66-queues">队列调度</a><a href="#p66-alerts">告警与阻断</a></nav>
      <div v-if="data" class="p66-boundary">${boundaryContent}<p>容量尚未验证；无高可用或备用服务器承诺。</p></div>
    </aside><div class="p66-content">${content}</div></div></section>`,
  );
}
export function topologyPagePlugin() {
  return {
    name: "p66-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (p) => path.resolve(p).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/RuntimeTopologyCenter.vue"))
        return { code: previewTopologyPage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return { code: previewShellVue(source), map: null };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, topologyReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
