import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const capacityReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/capacity-page-preview.css";
export const capacityPageSources = [
  capacityReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/capacity-page-preview.mjs",
];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P71 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Review-only transformation: production request, attestation and snapshot code remain byte-for-byte intact.
export function previewCapacityPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    template = source.slice(source.indexOf("<template>") + 10, source.lastIndexOf("</template>"));
  const nodes = [],
    walk = (node) => {
      nodes.push(node);
      for (const child of node.children ?? []) walk(child);
    };
  walk(baseParse(template));
  const get = (name) => {
    const matches = nodes.filter(
      (node) =>
        node.type === 1 &&
        node.props.some((prop) => prop.name === "class" && prop.value?.content === name),
    );
    assert.equal(matches.length, 1, name);
    return matches[0].loc.source;
  };
  const getTag = (tag) => {
    const matches = nodes.filter((node) => node.type === 1 && node.tag === tag);
    assert.equal(matches.length, 1, tag);
    return matches[0].loc.source;
  };
  const root = get("capacity-boundary"),
    footer = getTag("footer"),
    dialogs = [...template.matchAll(/<ConfirmDialog[\s\S]*?\/>/g)].map((match) => match[0]);
  assert.equal(dialogs.length, 1, "P71 original attestation dialog");
  let hero = once(get("capacity-boundary__hero"), "<h2>单机容量边界</h2>", "<h1>容量边界核验</h1>");
  hero = once(hero, "<p>单机实测容量边界</p>", "<p>ScoutOps / 容量边界</p>");
  const next = `<section class="capacity-boundary capacity-boundary--review" :data-state="state">
    ${hero}
    <p class="p71-review-note">实际 Vue C 审核版 · 本地样例 · 不签认演练或读取生产测量 · 尚未部署</p>
    <aside class="p71-boundary" aria-label="运行边界"><b>惠州单机 / 宝塔受管</b><span>不启用负载均衡、备用服务器或多节点；规划用户数不是并发承诺。</span></aside>
    ${get("capacity-boundary__notice")}
    ${get("capacity-boundary__operation-message")}
    ${get("capacity-boundary__state")}
    <template v-else-if="data"><section class="p71-paper"><section class="p71-conclusion" :data-verdict="state"><div><small>S0 / {{ state }}</small><h2>{{ state === 'ready' ? '当前单机容量门满足' : state === 'warning' ? '当前容量需人工关注' : '当前容量门阻断' }}</h2><p>声明仅限当前返回的单机事实；不构成压测授权或扩容承诺。</p></div><div><b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time></div></section>
      <section class="p71-stages"><header><div><h2>通过档位与停止事实</h2><p>最后通过与下一档停止必须成对阅读；缺失不补成承诺。</p></div><b>{{ data.boundary.capacity_claim === 'measured_single_host_limited' ? '单机有限实测' : '未验证' }}</b></header><dl><div><dt>最后通过并发档位</dt><dd>{{ data.boundary.measured_concurrency }}</dd></div><div><dt>下一档事实</dt><dd>{{ nextStageHint }}</dd></div><div><dt>停止原因</dt><dd>{{ data.boundary.stop_reason || '未返回' }}</dd></div><div><dt>失败代码</dt><dd>{{ data.boundary.failed_next_code || '未返回' }}</dd></div></dl><p class="p71-note">{{ boundaryHint }}</p></section>
      <section class="p71-performance"><header><h2>性能参考与停止线</h2><p>这是返回值及参考线，不在浏览器重新判定服务状态。</p></header><dl><div><dt>读取 P95</dt><dd>{{ data.performance.read_p95_ms }} ms<small>停止线 300 ms</small></dd></div><div><dt>写入 P95</dt><dd>{{ data.performance.write_p95_ms }} ms<small>停止线 600 ms</small></dd></div><div><dt>错误率</dt><dd>{{ pct(data.performance.error_rate_basis_points) }}<small>停止线 1%</small></dd></div><div><dt>异步滞后</dt><dd>{{ data.performance.async_lag_seconds }} 秒<small>停止线 60 秒</small></dd></div></dl></section>
      <div class="p71-evidence"><section class="p71-resilience"><header><h2>归档与恢复签认</h2><p>签认只记录已核验事实，不执行恢复。</p></header><dl><div><dt>归档</dt><dd>{{ data.resilience.archive_verified ? '已核验' : '未核验' }}</dd></div><div><dt>隔离恢复</dt><dd>{{ data.resilience.recovery_verified ? '已核验' : '未核验' }}</dd></div><div><dt>降载模式</dt><dd>{{ data.degradation.mode }}</dd></div></dl><p class="p71-note">操作不会启动新服务、删除数据或改变并发上限。</p></section><section class="p71-resources"><header><h2>资源绝对值</h2><p>绝对值不是容量比例，故不绘制误导性水位条。</p></header><dl><div><dt>归一化负载</dt><dd>{{ pct(data.resource.load_basis_points) }}</dd></div><div><dt>可用内存</dt><dd>{{ data.resource.available_memory_mb }} MB</dd></div><div><dt>可用磁盘</dt><dd>{{ data.resource.free_disk_mb }} MB</dd></div></dl><p class="p71-note">非正或异常值按原始返回显示，不能据此称为资源充足。</p></section></div>
      <section class="p71-findings"><header><h2>容量告警与处置</h2><p>{{ data.findings.length }} 项返回发现；责任角色与处理提示逐项保留。</p></header><article v-for="item in data.findings" :key="item.code" :data-severity="item.severity"><b>{{ item.severity === 'blocked' ? '阻断' : '预警' }}</b><strong>{{ item.reason }}</strong><small>责任人：{{ item.owner_label }}</small><p>{{ item.action_hint }}</p><details><summary>技术详情</summary><code>{{ item.code }} · {{ item.owner_role_code }}</code></details></article><p v-if="!data.findings.length" class="p71-note">当前返回没有发现；这不证明100人、多节点或高可用能力。</p></section>
      ${footer}</section></template>
    ${dialogs.join("\n")}
  </section>`;
  return once(source, root, next);
}
export function capacityPagePlugin() {
  return {
    name: "p71-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/CapacityBoundaryCenter.vue"))
        return { code: previewCapacityPage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            '<header v-if="!opportunityId && routePath !== \'/platform-admin/capacity\'" class="role-page-title">',
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, capacityReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
