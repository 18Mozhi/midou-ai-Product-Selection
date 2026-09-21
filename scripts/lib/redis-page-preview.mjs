import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const redisReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/redis-page-preview.css";
export const redisPageSources = [
  redisReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/redis-page-preview.mjs",
];
const once = (s, before, after) => {
  assert.equal(s.split(before).length, 2, "P67 unique anchor: " + before.slice(0, 80));
  return s.replace(before, after);
};
// Review-only transformation. All original script, requests and lifecycle remain unchanged.
export function previewRedisPage(input) {
  const source = input.replaceAll("\r\n", "\n");
  // Once the approved C direction is in the production SFC, keep the review
  // harness idempotent so its Vite path validates the real template instead
  // of trying to re-transform already migrated markup.
  if (source.includes('class="redis-resilience redis-resilience--review"') && source.includes('class="p67-workspace"'))
    return source;
  const template = source.slice(
    source.indexOf("<template>") + 10,
    source.lastIndexOf("</template>"),
  );
  const nodes = [];
  const walk = (n) => {
    nodes.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(baseParse(template));
  const get = (name) => {
    const found = nodes.filter(
      (n) => n.type === 1 && n.props.some((p) => p.name === "class" && p.value?.content === name),
    );
    assert.equal(found.length, 1, name);
    return found[0].loc.source;
  };
  const root = get("redis-resilience");
  let hero = once(
    get("redis-resilience__hero"),
    "<h2>缓存服务单实例韧性</h2>",
    "<h1>Redis 运行核验</h1>",
  );
  hero = once(hero, "<p>单实例缓存服务</p>", "<p>P67 / 运行证据</p>");
  let pending = get("redis-resilience__state");
  pending = once(pending, '<i aria-hidden="true"></i>', "");
  let failure = get("redis-resilience__state redis-resilience__state--danger");
  failure = once(failure, '<strong aria-hidden="true">!</strong>', "");
  const unavailable = "data.findings.some(item => item.code === 'redis_unavailable')";
  const sampled = "data.keyspace_sample";
  const resource = (
    type,
    title,
    actual,
    maximum,
    ratio,
    prefix,
  ) => `<article class="p67-resource" data-resource="${type}"
      :data-severity="data.findings.some(item => item.code === '${prefix}_stop') ? 'blocked' : data.findings.some(item => item.code === '${prefix}_warning') ? 'warning' : 'ready'">
      <h3>${title}</h3><strong>{{ ${maximum} > 0 ? percent(${ratio}) : '未设置上限' }}</strong>
      <p>${actual} / ${type === "memory" ? "{{ compactBytes(data.memory.max_bytes) }}" : "{{ data.connections.maximum }}"}</p>
      <div v-if="${maximum} > 0" class="p67-bar" aria-hidden="true"><span :style="{ width: percent(${ratio}) }"></span></div>
      <small v-if="${maximum} <= 0">比例是服务占位值，不作为实际使用率。</small>
      <small v-else-if="${type === "memory" ? "data.memory.used_bytes > data.memory.max_bytes" : "data.connections.connected > data.connections.maximum"}">用量超过上限；服务比例已封顶为 100%。</small>
      <small v-else>比例来自服务计算，不是容量承诺。</small>
    </article>`;
  const next = `<section class="redis-resilience redis-resilience--review" :data-state="state">
    ${hero}
    <p class="p67-review-note">实际 Vue C 审核版 · 本地样例 · 未连接 Redis 或执行恢复 · 尚未部署</p>
    <aside class="p67-boundary-strip" aria-label="运行边界"><b>惠州单主机 / 宝塔管理</b><span>Redis 仅协调缓存、队列、限流与实时消息；MySQL 仍是业务事实源。</span></aside>
    ${get("redis-resilience__refresh-notice")}
    ${pending}
    ${failure}
    <template v-else-if="data">
      <section class="p67-conclusion" :data-verdict="state" aria-labelledby="p67-conclusion-title">
        <div><small>S0 / {{ state }}</small><h2 id="p67-conclusion-title">{{ state === 'ready' ? '当前韧性门满足' : state === 'warning' ? '运行观测存在预警' : '当前韧性门阻断' }}</h2>
        <p>服务返回 {{ data.findings.length }} 项发现；不等于恢复演练、所有任务或高可用已验证。</p></div>
        <div><b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time><small>单实例 · 容量能力未验证</small></div>
      </section>
      <div class="p67-workspace">
        <section class="p67-findings p67-section" aria-labelledby="p67-findings-title">
          <h2 id="p67-findings-title">告警与阻断项 <small>{{ data.findings.length }} 项</small></h2>
          <div v-if="data.findings.length" class="p67-finding-list"><article v-for="item in data.findings" :key="item.code" :data-severity="item.severity">
            <b>{{ item.severity === 'blocked' ? '阻断' : '预警' }}</b><code>{{ item.code }}</code><p>{{ item.action_hint }}</p>
          </article></div>
          <p v-else>当前返回未列出告警或阻断。不据此推定所有缓存、队列或实时消息功能均已实测可用。</p>
        </section>
        <section class="p67-resources p67-section" aria-labelledby="p67-resources-title">
          <h2 id="p67-resources-title">资源与累计计数</h2><p>用量、上限、累计错误分别阅读。</p>
          <div v-if="${unavailable}" class="p67-unmeasured"><h3>未取得资源观测</h3><p>本次探针失败。返回的零计数与 100% 比例是占位值，不代表实测用量、满额或运行时长。</p></div>
          <template v-else><div class="p67-resource-grid">
            ${resource("memory", "内存使用", "{{ compactBytes(data.memory.used_bytes) }}", "data.memory.max_bytes", "data.memory.usage_basis_points", "redis_memory")}
            ${resource("connections", "连接使用", "{{ data.connections.connected }}", "data.connections.maximum", "data.connections.usage_basis_points", "redis_connections")}
          </div>
          <dl class="p67-counts"><div><dt>累计拒绝连接</dt><dd>{{ data.connections.rejected }}</dd></div><div><dt>累计淘汰键</dt><dd>{{ data.evicted_keys }}</dd></div><div><dt>实例运行秒数</dt><dd>{{ data.uptime_seconds }}</dd></div></dl>
          <p>实例运行 {{ data.uptime_seconds }} 秒；按天向下取整为 {{ Math.floor(data.uptime_seconds / 86400) }} 天。拒绝与淘汰不是本次新增量。</p>
          <aside class="p67-note" :data-severity="evictionRisk.level"><b>界面键淘汰风险提示</b><p>{{ evictionRisk.text }}</p><small>此提示的内存阈值为 80%；总体判门使用运行 policy，实际阈值未随本次返回，不能混用。</small></aside>
          </template>
        </section>
        <section class="p67-persistence p67-section" aria-labelledby="p67-persistence-title">
          <h2 id="p67-persistence-title">持久化观测</h2><p>是否启用与最近写入／保存结果分别核对。</p>
          <p v-if="${unavailable}" class="p67-unmeasured">本次未取得持久化观测；不能把失败占位解释为已关闭 AOF 或 RDB。</p>
          <dl v-else class="p67-persistence-rows"><div><dt>AOF</dt><dd>{{ data.persistence.aof_enabled ? '已启用' : '未启用' }}<small>CONFIG GET 观测</small></dd><dd>{{ data.persistence.aof_last_write_status }}<small>写入状态，可能回退为最近重写结果</small></dd></div>
          <div><dt>RDB</dt><dd>{{ data.persistence.rdb_enabled ? '已启用' : '未启用' }}<small>CONFIG GET 观测</small></dd><dd>{{ data.persistence.rdb_last_save_status }}<small>最近保存状态</small></dd></div></dl>
          <p class="p67-note">AOF everysec 是既有部署目标；当前探针没有读取 appendfsync，不能标记为本次实测通过。此接口也不提供恢复演练证据。</p>
        </section>
        <aside class="p67-policy p67-section" aria-labelledby="p67-policy-title"><h2 id="p67-policy-title">边界与未覆盖项</h2><p>这些是部署合同与接口边界，不是一轮新的在线验证。</p>
          <dl><div><dt>淘汰策略 / 实际返回</dt><dd>{{ ${unavailable} ? '未取得观测' : data.max_memory_policy }}</dd></div>
          <div><dt>持久化目标</dt><dd>AOF everysec + RDB 规则</dd></div>
          <div><dt>固定拓扑边界</dt><dd>single_instance<br>Sentinel={{ data.sentinel_enabled }}<br>Cluster={{ data.cluster_enabled }}</dd></div>
          <div><dt>能力声明</dt><dd>不宣称副本、备用服务器或容量承诺</dd></div>
          <div><dt>当前 GET 未覆盖</dt><dd>appendfsync、bind、protected-mode、真实恢复演练</dd></div></dl>
          <p>重启、配置、恢复只能由宝塔管理。本页没有运维执行入口。</p>
        </aside>
        <section class="p67-sampling p67-section" aria-labelledby="p67-sampling-title"><header><div><h2 id="p67-sampling-title">有界键空间采样</h2><p>只比较成功测得的字节，不是总 Redis 内存占比或访问频率。</p></div><b>{{ sampleStatusLabel[${sampled}.status] }}</b></header>
          <dl class="p67-counts"><div><dt>已扫描去重键</dt><dd>{{ ${sampled}.scanned_keys }}</dd></div><div><dt>成功测量</dt><dd>{{ ${sampled}.measured_keys }}</dd></div><div><dt>忽略 / 测量失败</dt><dd>{{ ${sampled}.ignored_keys }} / {{ ${sampled}.failed_measurements }}</dd></div><div><dt>成功测得字节</dt><dd>{{ compactBytes(${sampled}.total_sampled_bytes) }}</dd></div></dl>
          <p>采样上限 {{ ${sampled}.sample_limit }} 个键；{{ ${sampled}.truncated ? '已达到有界采样范围' : '本次未标记截断' }}。SCAN COUNT 32 为提示，最多 32 轮；测量每批最多 16。</p>
          <div v-if="${sampled}.hotspots.length" class="p67-sample-list"><article v-for="item in ${sampled}.hotspots" :key="item.purpose + ':' + item.resource">
            <div><h3>{{ purposeLabel[item.purpose] }} / {{ resourceLabel[item.resource] }}</h3><small>{{ item.sampled_keys }} 个成功测量键</small></div>
            <div><b>{{ compactBytes(item.sampled_bytes) }}</b><small>采样字节</small></div>
            <div><b>{{ ${sampled}.total_sampled_bytes > 0 ? percent(item.sampled_share_basis_points) : '无比例分母' }}</b><small>成功测得字节的占比</small></div>
            <div v-if="${sampled}.total_sampled_bytes > 0" class="p67-bar" aria-hidden="true"><span :style="{ width: percent(item.sampled_share_basis_points) }"></span></div>
          </article></div>
          <div v-else class="p67-sample-empty"><h3>{{ sampleStatusLabel[${sampled}.status] }}</h3>
            <p v-if="${sampled}.status === 'partial'">已扫描到受限键，但本次未完成有效内存测量；不能据此判断没有业务键。</p>
            <p v-else-if="${sampled}.unavailable_reason === 'command_unsupported'">当前客户端不支持受限 SCAN 与 MEMORY USAGE。</p>
            <p v-else-if="${sampled}.unavailable_reason === 'scan_failed'">本次采样失败；总体韧性结论仍由独立运行事实决定。</p>
            <p v-else>本次有界采样没有可归类的结果，不代表整个 Redis 没有业务键。</p>
          </div>
          <p class="p67-note">只显示用途与资源类别，不返回键名、组织、工作区、载荷或连接信息。采样是否成功，不直接改变总体韧性判门。</p>
        </section>
      </div>
      ${get("redis-resilience__footer")}
    </template>
  </section>`;
  return once(source, root, next);
}
export function redisPagePlugin() {
  return {
    name: "p67-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (p) => path.resolve(p).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/RedisResilienceCenter.vue"))
        return { code: previewRedisPage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            '<header v-if="!opportunityId && routePath !== \'/platform-admin/redis\'" class="role-page-title">',
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, redisReviewCss]
          .map(
            (f) => `<link rel="stylesheet" href="/@fs/${path.resolve(f).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
