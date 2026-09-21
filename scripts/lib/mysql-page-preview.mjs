import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const mysqlReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/mysql-page-preview.css";
export const mysqlPageSources = [
  mysqlReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/mysql-page-preview.mjs",
];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P68 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Review-only transformation: the production script, request and lifecycle stay byte-for-byte intact.
export function previewMysqlPage(input) {
  const source = input.replaceAll("\r\n", "\n");
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
  const get = (name) => {
    const matches = nodes.filter(
      (node) =>
        node.type === 1 &&
        node.props.some((prop) => prop.name === "class" && prop.value?.content === name),
    );
    assert.equal(matches.length, 1, name);
    return matches[0].loc.source;
  };
  const root = get("mysql-resilience");
  let hero = once(
    get("mysql-resilience__hero"),
    "<h2>数据库 5.7 单主韧性</h2>",
    "<h1>MySQL 运行核验</h1>",
  );
  hero = once(hero, "<p>单主数据库</p>", "<p>ScoutOps / 数据库运行</p>");
  const pending = once(get("mysql-resilience__state"), "<i></i>", "");
  const failure = once(
    get("mysql-resilience__state mysql-resilience__state--danger"),
    "<strong>!</strong>",
    "",
  );
  const unavailable = "data.findings.some(item => item.code === 'mysql_unavailable')";
  const resource = (
    kind,
    title,
    used,
    maximum,
    ratio,
    prefix,
    unit,
  ) => `<article class="p68-resource" data-resource="${kind}" :data-severity="findingSeverity(['${prefix}_warning','${prefix}_stop'])">
    <h3>${title}</h3><strong>{{ ${unavailable} ? '未取得观测' : ${maximum} > 0 ? percent(${ratio}) : '上限 / 容量未知' }}</strong>
    <p>{{ ${used} }} / {{ ${kind === "storage" ? `bytes(${maximum})` : maximum} }}</p><div v-if="!${unavailable} && ${maximum} > 0" class="p68-meter" :data-level="findingSeverity(['${prefix}_warning','${prefix}_stop'])" aria-hidden="true"><span :style="{ width: percent(${ratio}) }"></span></div>
    <small v-if="${maximum} <= 0">接口比例为未知${unit}约定，不是实测满额。</small><small v-else>${kind === "storage" ? "数据目录所在文件系统，不等于数据库表体积。" : "已连接为瞬时计数，不是查询吞吐量。"}</small></article>`;
  const next = `<section class="mysql-resilience mysql-resilience--review" :data-state="state">
    ${hero}
    <p class="p68-review-note">实际 Vue C 审核版 · 本地样例 · 未连接 MySQL 或执行恢复 · 尚未部署</p>
    <aside class="p68-boundary" aria-label="运行边界"><b>惠州同机 / 宝塔受管</b><span>固定单主；不新增读副本、负载均衡或备用服务器。</span></aside>
    ${get("mysql-resilience__refresh-notice")}
    ${pending}
    ${failure}
    <template v-else-if="data">
      <section class="p68-paper"><section class="p68-conclusion" :data-verdict="state"><div><small>S0 / {{ state }}</small><h2>{{ state === 'ready' ? '当前单主韧性门满足' : state === 'warning' ? '当前观测存在预警' : '当前单主韧性门阻断' }}</h2><p>返回 {{ data.findings.length }} 项发现；ready 不替代真实恢复或生产验收。</p></div><div><b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time></div></section>
      <section v-if="data.findings.length" class="p68-findings"><h2>当前发现 <small>{{ data.findings.length }} 项</small></h2><article v-for="item in data.findings" :key="item.code" :data-severity="item.severity"><b>{{ item.severity === 'blocked' ? '阻断' : '预警' }}</b><code>{{ item.code }}</code><p>{{ item.action_hint }}</p></article><small>提示仅供人工核对，不会执行停任务、调优、迁移或恢复。</small></section>
      <div class="p68-evidence"><div class="p68-runtime"><section class="p68-section"><header><h2>资源观测</h2><p>连接和文件系统各自按对应 finding 显示。</p></header><div class="p68-resource-grid">${resource("connections", "连接使用", "data.connections.connected", "data.connections.maximum", "data.connections.usage_basis_points", "mysql_connections", "上限")}${resource("storage", "数据盘使用", "bytes(data.storage.used_bytes)", "data.storage.total_bytes", "data.storage.usage_basis_points", "mysql_data_capacity", "容量")}</div></section>
      <section class="p68-section"><header><h2>速率、累计与瞬时</h2><p>不同口径分开，不组合成“当前性能分数”。</p></header><dl class="p68-measurements"><div><dt>慢查询近似速率</dt><dd>{{ data.slow_queries.per_minute.toFixed(2) }} 次/分钟</dd><p>累计非负增量除以至少一分钟间隔；无上次观测时按运行分钟平均。</p></div><div><dt>累计缓冲池命中</dt><dd>{{ percent(data.io.buffer_pool_hit_rate_basis_points) }}</dd><p>来自启动以来 reads / requests；零 requests 的 100% 不能独立证明实际命中。</p></div><div><dt>行锁等待</dt><dd>{{ data.io.innodb_row_lock_waits }} 次累计</dd><p>{{ rowLockImpact }}</p></div><div><dt>日志等待</dt><dd>{{ data.io.innodb_log_waits }} 次累计</dd><p>累计等待不能直接表示当前磁盘延迟。</p></div><div><dt>运行线程</dt><dd>{{ data.connections.running }} 个</dd><p>当前状态计数，不是活跃用户数或容量。</p></div></dl></section></div>
      <aside class="p68-recovery"><header><h2>同机恢复证据</h2><p>与运行资源独立核对，不是高可用或异地容灾。</p></header><div class="p68-recovery-state"><b>{{ data.recovery.status }}</b><small>仍需与总体 findings 对照。</small></div><dl><div><dt>RPO / 最多可丢失时间</dt><dd>{{ data.recovery.actual_rpo_minutes ?? '未记录' }}<small>{{ data.recovery.actual_rpo_minutes == null ? '未知不填0' : '分钟' }}</small></dd></div><div><dt>RTO / 实际恢复耗时</dt><dd>{{ data.recovery.actual_rto_minutes ?? '未记录' }}<small>{{ data.recovery.actual_rto_minutes == null ? '未知不填0' : '分钟' }}</small></dd></div><div><dt>演练距今</dt><dd>{{ data.recovery.drill_age_days ?? '未记录' }}<small>{{ data.recovery.drill_age_days == null ? '未知不填0' : '天' }}</small></dd></div></dl><p class="p68-note">探针按15分钟 RPO、240分钟 RTO、90天演练检查；运行 policy 还会再次检查。页面不发起备份或恢复。</p></aside></div>
      <section class="p68-section p68-durability"><header><h2>持久化实际值与单主合同</h2><p>目标用于对照，不是可编辑配置表。</p></header><div class="p68-contract p68-contract--head"><span>核对项</span><span>当前返回</span><span>合同目标</span></div><div class="p68-contract"><code>二进制日志</code><span>{{ data.durability.log_bin_enabled ? '已启用' : '未启用' }}</span><span>启用</span></div><div class="p68-contract"><code>binlog_format</code><span>{{ data.durability.binlog_format }}</span><span>ROW</span></div><div class="p68-contract"><code>innodb_flush_log_at_trx_commit</code><span>{{ data.durability.innodb_flush_log_at_trx_commit }}</span><span>2</span></div><div class="p68-contract"><code>sync_binlog</code><span>{{ data.durability.sync_binlog }}</span><span>1</span></div><p class="p68-note">固定单主/无副本是边界，不覆盖只读主库或非预期副本 findings；接口不返回主机、账号、目录、binlog 文件或 SQL。</p></section></section>
      ${get("mysql-resilience__footer")}
    </template>
  </section>`;
  return once(source, root, next);
}
export function mysqlPagePlugin() {
  return {
    name: "p68-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/MySqlResilienceCenter.vue"))
        return { code: previewMysqlPage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            '<header v-if="!opportunityId && routePath !== \'/platform-admin/mysql\'" class="role-page-title">',
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, mysqlReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
