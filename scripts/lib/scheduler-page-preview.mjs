import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const schedulerReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/scheduler-page-preview.css";
export const schedulerPageSources = [
  schedulerReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/scheduler-page-preview.mjs",
];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P70 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Review-only transformation: source request, filter, pagination and recovery handlers remain byte-for-byte intact.
export function previewSchedulerPage(input) {
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
  const root = get("crawler-scheduler"),
    footer = getTag("footer"),
    dialogs = [...template.matchAll(/<ConfirmDialog[\s\S]*?\/>/g)].map((match) => match[0]);
  assert.equal(dialogs.length, 2, "P70 two original confirmation dialogs");
  let hero = once(get("crawler-scheduler__hero"), "<h2>运行与配额</h2>", "<h1>采集调度核验</h1>");
  hero = once(hero, "<p>单机采集调度</p>", "<p>ScoutOps / 采集调度</p>");
  const next = `<section class="crawler-scheduler crawler-scheduler--review" :data-state="state">
    ${hero}
    <p class="p70-review-note">实际 Vue C 审核版 · 本地样例 · 不发送恢复或健康检查 · 尚未部署</p>
    <aside class="p70-boundary" aria-label="运行边界"><b>惠州单机 / 宝塔受管</b><span>Worker 与 Python Crawler 各一个实例；来源有效并发固定为1。</span></aside>
    ${get("crawler-scheduler__refresh-notice")}
    ${get("crawler-scheduler__state")}
    <template v-else-if="data">
      <section class="p70-paper"><section class="p70-conclusion" :data-verdict="state"><div><small>S0 / {{ state }}</small><h2>{{ state === 'ready' ? '当前采集调度门满足' : state === 'warning' ? '当前调度需要关注' : '当前采集调度门阻断' }}</h2><p>返回 {{ data.findings.length }} 项发现；不以单张指标卡替代总体结论。</p></div><div><b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time></div></section>
      <section v-if="data.findings.length" class="p70-findings"><h2>当前发现 <small>{{ data.findings.length }} 项</small></h2><article v-for="item in data.findings" :key="item.code" :data-severity="item.severity"><b>{{ item.severity === 'blocked' ? '阻断' : '预警' }}</b><code>{{ item.code }}</code><p>{{ item.action_hint }}</p></article></section>
      <div class="p70-runtime"><section><h2>单机运行与租约</h2><dl><div><dt>Worker / 上限</dt><dd>{{ data.topology.worker_instances }} / {{ data.topology.maximum_workers }}</dd></div><div><dt>Python Crawler / 上限</dt><dd>{{ data.topology.crawler_instances }} / {{ data.topology.maximum_crawlers }}</dd></div><div><dt>重复租约</dt><dd>{{ data.leases.duplicate_count }}</dd></div><div><dt>活动档案</dt><dd>{{ data.profiles.length }}</dd></div></dl></section><section><h2>主机资源观测</h2><dl><div><dt>负载 / 核数</dt><dd>{{ (data.resource.load_basis_points / 100).toFixed(1) }}%</dd></div><div><dt>可用内存</dt><dd>{{ data.resource.available_memory_mb }} MB</dd></div><div><dt>可用磁盘</dt><dd>{{ data.resource.free_disk_mb }} MB</dd></div></dl><p>负载/核数不是CPU利用率；非Linux占位不当作实测进程数。</p></section></div>
      <section class="p70-providers"><header><div><h2>来源并发与排队</h2><p>来源按熔断、排队、连续失败和代码排序；每页最多12条。</p></div><b>待领取 {{ queueSummary.queued }} · 最老 {{ duration(queueSummary.oldest) }}</b></header>${get("crawler-scheduler__source-filters")}<div class="p70-provider-list"><article v-for="item in pagedProviders" :key="item.id" :data-circuit="item.circuit_state"><header><b>{{ item.code }}</b><span>{{ item.circuit_state === 'open' ? '来源已熔断' : item.active_leases + ' / ' + item.effective_concurrency }}</span></header><progress :aria-label="item.code + '来源有效并发占用'" :aria-valuetext="item.active_leases + ' / ' + (item.effective_concurrency || 1)" :value="item.active_leases" :max="item.effective_concurrency || 1"></progress><p>排队 {{ item.queued_tasks }} · 最长 {{ duration(item.longest_queue_wait_seconds) }} · P95 {{ duration(item.queue_wait_p95_seconds) }}</p><p>{{ queueRiskText(item) }}</p><p>24小时成功率 {{ rate(item.success_rate_basis_points_24h) }} · 耗时P95 {{ milliseconds(item.duration_p95_ms_24h) }} · 样本 {{ item.sample_count_24h }}</p><details v-if="item.last_error_code"><summary>最近失败</summary><code>{{ item.last_error_code }}</code></details><div v-if="item.circuit_state === 'open'" class="p70-provider-actions"><RouterLink :to="'/platform-admin/provider-adapters?provider_id=' + item.id">前往来源健康</RouterLink><button type="button" :disabled="providerRecovering === item.id || refreshing" @click="circuitConfirm = item">解除熔断</button></div></article><p v-if="!data.providers.length">当前没有启用来源。</p><p v-else-if="!filteredProviders.length">当前筛选范围没有需要处理的来源。</p></div><nav v-if="filteredProviders.length > providerPageSize" class="p70-pagination" aria-label="来源列表分页"><button type="button" :disabled="providerPage <= 1" @click="providerPage -= 1">上一页</button><span>第 {{ providerPage }} / {{ providerPageCount }} 页</span><button type="button" :disabled="providerPage >= providerPageCount" @click="providerPage += 1">下一页</button></nav></section>
      <div class="p70-evidence"><section class="p70-receipts"><header><h2>完成回执水位</h2><p>{{ data.receipt_spool ? '观测于 ' + time(data.receipt_spool.observed_at) : '等待 Python Crawler 上报' }}</p></header><template v-if="data.receipt_spool"><dl><div><dt>待回写</dt><dd>{{ data.receipt_spool.pending_count }} / {{ bytes(data.receipt_spool.pending_bytes) }}</dd></div><div><dt>隔离待审阅</dt><dd>{{ data.receipt_spool.quarantined_count }} / {{ bytes(data.receipt_spool.quarantined_bytes) }}</dd></div><div><dt>最老待回写</dt><dd>{{ data.receipt_spool.oldest_pending_at ? time(data.receipt_spool.oldest_pending_at) : '时间未知' }}</dd></div><div><dt>目录可用</dt><dd>{{ data.receipt_spool.free_disk_mb }} MB</dd></div></dl><p class="p70-note">保留期 {{ data.receipt_spool.retention_days }} 天；到期只告警，不授权自动删除。</p></template><p v-else class="p70-note">尚无回执水位；调度保持阻断，重新核验不会读取回执内容或路径。</p></section><section class="p70-leases"><header><h2>活动租约与进程</h2><p>{{ data.active_leases.length }} 个活动槽位，技术详情不在默认面展开。</p></header><article v-for="(item,index) in data.active_leases" :key="index"><b>{{ processLabel(item.process_role) }}</b><span>{{ item.provider_name || '全局调度槽位' }}</span><p>最近心跳 {{ time(item.heartbeat_at) }} · 租约到期 {{ time(item.expires_at) }}</p><details><summary>查看技术详情</summary><code>任务 UUID {{ item.task_id || '未关联' }}</code><code>进程标识 {{ item.process_ref }}</code></details></article><p v-if="!data.active_leases.length" class="p70-note">当前没有活动租约。</p></section></div>
      <section class="p70-trend"><header><h2>最近24小时运行样本</h2><p>总量可含尚未终态运行，不称为完整等待基线。</p></header><article v-for="item in data.trend" :key="item.bucket_at"><time>{{ time(item.bucket_at) }}</time><span>吞吐 {{ item.total }}</span><span>成功 {{ item.succeeded }}</span><span>失败 {{ item.failed }}</span><b>{{ rate(item.failure_rate_basis_points) }}</b></article><p v-if="!data.trend.length" class="p70-note">最近24小时暂无浏览器运行样本。</p></section></section>
      ${footer}
    </template>
    ${dialogs.join("\n")}
  </section>`;
  return once(source, root, next);
}
export function schedulerPagePlugin() {
  return {
    name: "p70-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/CrawlerSchedulerCenter.vue"))
        return { code: previewSchedulerPage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            '<header v-if="!opportunityId && routePath !== \'/platform-admin/crawler-scheduler\'" class="role-page-title">',
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, schedulerReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
