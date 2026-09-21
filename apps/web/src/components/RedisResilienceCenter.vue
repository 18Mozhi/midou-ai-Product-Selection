<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { RedisResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import TechnicalDetails from "./TechnicalDetails.vue";
import "../redis-resilience.css";

type ViewState =
  | "loading"
  | "ready"
  | "warning"
  | "blocked"
  | "empty"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "recovering";
type RefreshFailure = "rate_limited" | "timeout" | "unavailable";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading"),
  data = ref<RedisResilienceDto | null>(null),
  requestId = ref(""),
  readFailureId = ref(""),
  actionHint = ref(""),
  refreshing = ref(false),
  refreshFailure = ref<RefreshFailure | null>(null);
let controller: AbortController | null = null;
let sequence = 0;
const refreshButton = ref<HTMLButtonElement | null>(null),
  retryButton = ref<HTMLButtonElement | null>(null),
  noticeRetryButton = ref<HTMLButtonElement | null>(null);
function handoffReadFocus() {
  const from = [retryButton.value, noticeRetryButton.value].find(
      (button) => button && button.ownerDocument.activeElement === button,
    ),
    to = refreshButton.value;
  if (
    !from?.isConnected ||
    !to?.isConnected ||
    from.closest("[inert]") ||
    to.closest("[inert]") ||
    !from.checkVisibility() ||
    !to.checkVisibility()
  )
    return;
  to.focus({ preventScroll: true });
  if (to.ownerDocument.activeElement !== to) return;
  const rect = to.getBoundingClientRect();
  if (
    rect.top < 0 ||
    rect.bottom > window.innerHeight ||
    !to.contains(
      to.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    )
  )
    to.scrollIntoView({ block: "center", inline: "nearest" });
}
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在读取单 Redis 运行事实", "核对持久化、内存上限、连接上限与最近错误。"],
        ready: ["单 Redis 韧性门已满足", "AOF/RDB、资源上限和失败关闭规则均通过。"],
        warning: ["Redis 资源接近预警线", "当前仍可用，但需检查增长、积压和连接使用。"],
        blocked: ["Redis 韧性门已阻断", "停止依赖 Redis 的新操作，并通过宝塔按阻断项恢复。"],
        empty: ["尚无 Redis 观测", "确认宝塔 Redis 与 Node API 已运行后重新核验。"],
        forbidden: ["没有平台运维权限", actionHint.value || "需要 platform:operate 能力。"],
        expired: ["登录已失效", "重新登录后再核验 Redis 韧性。"],
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        timeout: ["读取 Redis 运行事实超时", "本次请求已在 15 秒后停止，请检查服务状态再重试。"],
        unavailable: [
          "Redis 运行事实暂不可用",
          actionHint.value || "在宝塔检查 API、MySQL 与 Redis 日志。",
        ],
        recovering: ["正在执行恢复核验", "宝塔重启后先验证 PING、持久化、隔离读写与清理。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const refreshNotice = computed(() => {
  if (refreshFailure.value === "timeout")
    return "读取超过 15 秒，已停止本次请求并保留上次成功的 Redis 运行事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的 Redis 运行事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${actionHint.value || "Redis 运行事实暂不可用，请在宝塔核对 Node API、MySQL 与 Redis。"} 已保留上次成功的 Redis 运行事实。`;
  return "";
});
const percent = (basis?: number) => (basis === undefined ? "—" : `${(basis / 100).toFixed(1)}%`);
const bytes = (value?: number) =>
  value === undefined
    ? "—"
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
const compactBytes = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MiB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${value} B`;
const purposeLabel = {
  cache: "缓存",
  queue: "队列与租约",
  rate: "限流",
  sse: "实时消息",
} as const;
const resourceLabel = {
  collection_ready: "采集就绪队列",
  collection_task: "采集任务租约",
  other: "其他受限键",
} as const;
const sampleStatusLabel = {
  sampled: "采样完成",
  partial: "部分采样",
  empty: "暂无受限键",
  unavailable: "采样不可用",
} as const;
const time = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无记录";
const evictionRisk = computed(() => {
  if (!data.value) return { level: "unknown", text: "尚无观测" };
  if (data.value.evicted_keys > 0)
    return {
      level: "blocked",
      text: `实例启动后已累计淘汰 ${data.value.evicted_keys} 个键，需先核对受影响队列与实时协调。`,
    };
  if (data.value.max_memory_policy !== "noeviction")
    return { level: "blocked", text: `当前策略 ${data.value.max_memory_policy} 允许静默淘汰。` };
  if (data.value.memory.usage_basis_points >= 8000)
    return {
      level: "warning",
      text: "noeviction 不会静默淘汰，但接近内存上限时新写入会失败。",
    };
  return { level: "ready", text: "noeviction 已启用，当前未记录键淘汰。" };
});

async function load() {
  if (controller) return;
  handoffReadFocus();
  const currentSequence = ++sequence;
  const requestController = new AbortController();
  const hasSnapshot = Boolean(data.value);
  const correlationId = crypto.randomUUID();
  controller = requestController;
  refreshing.value = true;
  refreshFailure.value = null;
  readFailureId.value = "";
  if (!hasSnapshot) {
    state.value = "loading";
    requestId.value = "";
  }
  actionHint.value = "";
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 15_000);
  try {
    const response = await request<RedisResilienceDto | null>("/platform/operations/redis", {
      signal: requestController.signal,
      requestId: correlationId,
      traceId: correlationId,
    });
    if (currentSequence !== sequence) return;
    requestId.value = response.request_id;
    if (!response.data) {
      data.value = null;
      state.value = "empty";
      return;
    }
    data.value = response.data;
    state.value = response.data.state;
  } catch (error) {
    if (
      currentSequence !== sequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    if (timedOut) {
      readFailureId.value = correlationId;
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    const failure = error instanceof ApiClientError ? error : null;
    readFailureId.value = failure?.requestId ?? "";
    actionHint.value = failure?.actionHint ?? "";
    const failureState =
      failure?.kind === "expired" ||
      failure?.kind === "forbidden" ||
      failure?.kind === "rate_limited"
        ? failure.kind
        : "unavailable";
    if (hasSnapshot && !["expired", "forbidden"].includes(failureState))
      refreshFailure.value = failureState as RefreshFailure;
    else {
      data.value = null;
      requestId.value = "";
      state.value = failureState;
    }
  } finally {
    window.clearTimeout(timeout);
    if (currentSequence === sequence) {
      controller = null;
      refreshing.value = false;
    }
  }
}
onMounted(load);
onBeforeUnmount(() => {
  sequence += 1;
  controller?.abort();
  controller = null;
});
</script>

<template>
  <section class="redis-resilience redis-resilience--review" :data-state="state">
    <header class="redis-resilience__hero">
      <div>
        <p>P67 / 运行证据</p>
        <h1>Redis 运行核验</h1>
        <span>当前惠州单机只运行一个宝塔 Redis；不启用 Sentinel、集群、副本或备用服务器。</span>
      </div>
      <button
        ref="refreshButton"
        class="redis-read-action"
        type="button"
        :aria-disabled="refreshing"
        :aria-busy="refreshing"
        @click="load"
      >
        {{ refreshing ? "正在刷新…" : "刷新运行事实" }}
      </button>
    </header>
    <p class="p67-review-note">实际 Vue C 审核版 · 本地样例 · 未连接 Redis 或执行恢复 · 尚未部署</p>
    <aside class="p67-boundary-strip" aria-label="运行边界"><b>惠州单主机 / 宝塔管理</b><span>Redis 仅协调缓存、队列、限流与实时消息；MySQL 仍是业务事实源。</span></aside>
    <section
      v-if="data && refreshFailure"
      class="redis-resilience__refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
      aria-labelledby="redis-refresh-title"
      :aria-busy="refreshing"
    >
      <div>
        <h3 id="redis-refresh-title">
          {{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}
        </h3>
        <p>{{ refreshNotice }}</p>
        <TechnicalDetails :request-id="readFailureId" summary="本次失败读取追踪" />
      </div>
      <button ref="noticeRetryButton" type="button" :disabled="refreshing" @click="load">
        重新核验
      </button>
    </section>
    <section
      v-if="state === 'loading' || state === 'recovering'"
      class="redis-resilience__state"
      aria-live="polite"
      aria-labelledby="redis-read-title"
      :aria-busy="refreshing"
    >
      <div>
        <h3 id="redis-read-title">{{ verdict[0] }}</h3>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="
        ['forbidden', 'expired', 'rate_limited', 'timeout', 'unavailable', 'empty'].includes(state)
      "
      class="redis-resilience__state redis-resilience__state--danger"
      aria-live="polite"
      aria-labelledby="redis-read-title"
      :aria-busy="refreshing"
    >
      <div>
        <h3 id="redis-read-title">{{ verdict[0] }}</h3>
        <p>{{ verdict[1] }}</p>
        <TechnicalDetails v-if="state === 'empty'" :request-id="requestId" summary="本次读取追踪" />
        <TechnicalDetails v-else :request-id="readFailureId" summary="本次失败读取追踪" />
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
      ><button v-else ref="retryButton" type="button" :disabled="refreshing" @click="load">
        重新核验
      </button>
    </section>
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
          <div v-if="data.findings.some(item => item.code === 'redis_unavailable')" class="p67-unmeasured"><h3>未取得资源观测</h3><p>本次探针失败。返回的零计数与 100% 比例是占位值，不代表实测用量、满额或运行时长。</p></div>
          <template v-else><div class="p67-resource-grid">
            <article class="p67-resource" data-resource="memory"
      :data-severity="data.findings.some(item => item.code === 'redis_memory_stop') ? 'blocked' : data.findings.some(item => item.code === 'redis_memory_warning') ? 'warning' : 'ready'">
      <h3>内存使用</h3><strong>{{ data.memory.max_bytes > 0 ? percent(data.memory.usage_basis_points) : '未设置上限' }}</strong>
      <p>{{ compactBytes(data.memory.used_bytes) }} / {{ compactBytes(data.memory.max_bytes) }}</p>
      <div v-if="data.memory.max_bytes > 0" class="p67-bar" aria-hidden="true"><span :style="{ width: percent(data.memory.usage_basis_points) }"></span></div>
      <small v-if="data.memory.max_bytes <= 0">比例是服务占位值，不作为实际使用率。</small>
      <small v-else-if="data.memory.used_bytes > data.memory.max_bytes">用量超过上限；服务比例已封顶为 100%。</small>
      <small v-else>比例来自服务计算，不是容量承诺。</small>
    </article>
            <article class="p67-resource" data-resource="connections"
      :data-severity="data.findings.some(item => item.code === 'redis_connections_stop') ? 'blocked' : data.findings.some(item => item.code === 'redis_connections_warning') ? 'warning' : 'ready'">
      <h3>连接使用</h3><strong>{{ data.connections.maximum > 0 ? percent(data.connections.usage_basis_points) : '未设置上限' }}</strong>
      <p>{{ data.connections.connected }} / {{ data.connections.maximum }}</p>
      <div v-if="data.connections.maximum > 0" class="p67-bar" aria-hidden="true"><span :style="{ width: percent(data.connections.usage_basis_points) }"></span></div>
      <small v-if="data.connections.maximum <= 0">比例是服务占位值，不作为实际使用率。</small>
      <small v-else-if="data.connections.connected > data.connections.maximum">用量超过上限；服务比例已封顶为 100%。</small>
      <small v-else>比例来自服务计算，不是容量承诺。</small>
    </article>
          </div>
          <dl class="p67-counts"><div><dt>累计拒绝连接</dt><dd>{{ data.connections.rejected }}</dd></div><div><dt>累计淘汰键</dt><dd>{{ data.evicted_keys }}</dd></div><div><dt>实例运行秒数</dt><dd>{{ data.uptime_seconds }}</dd></div></dl>
          <p>实例运行 {{ data.uptime_seconds }} 秒；按天向下取整为 {{ Math.floor(data.uptime_seconds / 86400) }} 天。拒绝与淘汰不是本次新增量。</p>
          <aside class="p67-note" :data-severity="evictionRisk.level"><b>界面键淘汰风险提示</b><p>{{ evictionRisk.text }}</p><small>此提示的内存阈值为 80%；总体判门使用运行 policy，实际阈值未随本次返回，不能混用。</small></aside>
          </template>
        </section>
        <section class="p67-persistence p67-section" aria-labelledby="p67-persistence-title">
          <h2 id="p67-persistence-title">持久化观测</h2><p>是否启用与最近写入／保存结果分别核对。</p>
          <p v-if="data.findings.some(item => item.code === 'redis_unavailable')" class="p67-unmeasured">本次未取得持久化观测；不能把失败占位解释为已关闭 AOF 或 RDB。</p>
          <dl v-else class="p67-persistence-rows"><div><dt>AOF</dt><dd>{{ data.persistence.aof_enabled ? '已启用' : '未启用' }}<small>CONFIG GET 观测</small></dd><dd>{{ data.persistence.aof_last_write_status }}<small>写入状态，可能回退为最近重写结果</small></dd></div>
          <div><dt>RDB</dt><dd>{{ data.persistence.rdb_enabled ? '已启用' : '未启用' }}<small>CONFIG GET 观测</small></dd><dd>{{ data.persistence.rdb_last_save_status }}<small>最近保存状态</small></dd></div></dl>
          <p class="p67-note">AOF everysec 是既有部署目标；当前探针没有读取 appendfsync，不能标记为本次实测通过。此接口也不提供恢复演练证据。</p>
        </section>
        <aside class="p67-policy p67-section" aria-labelledby="p67-policy-title"><h2 id="p67-policy-title">边界与未覆盖项</h2><p>这些是部署合同与接口边界，不是一轮新的在线验证。</p>
          <dl><div><dt>淘汰策略 / 实际返回</dt><dd>{{ data.findings.some(item => item.code === 'redis_unavailable') ? '未取得观测' : data.max_memory_policy }}</dd></div>
          <div><dt>持久化目标</dt><dd>AOF everysec + RDB 规则</dd></div>
          <div><dt>固定拓扑边界</dt><dd>single_instance<br>Sentinel={{ data.sentinel_enabled }}<br>Cluster={{ data.cluster_enabled }}</dd></div>
          <div><dt>能力声明</dt><dd>不宣称副本、备用服务器或容量承诺</dd></div>
          <div><dt>当前 GET 未覆盖</dt><dd>appendfsync、bind、protected-mode、真实恢复演练</dd></div></dl>
          <p>重启、配置、恢复只能由宝塔管理。本页没有运维执行入口。</p>
        </aside>
        <section class="p67-sampling p67-section" aria-labelledby="p67-sampling-title"><header><div><h2 id="p67-sampling-title">有界键空间采样</h2><p>只比较成功测得的字节，不是总 Redis 内存占比或访问频率。</p></div><b>{{ sampleStatusLabel[data.keyspace_sample.status] }}</b></header>
          <dl class="p67-counts"><div><dt>已扫描去重键</dt><dd>{{ data.keyspace_sample.scanned_keys }}</dd></div><div><dt>成功测量</dt><dd>{{ data.keyspace_sample.measured_keys }}</dd></div><div><dt>忽略 / 测量失败</dt><dd>{{ data.keyspace_sample.ignored_keys }} / {{ data.keyspace_sample.failed_measurements }}</dd></div><div><dt>成功测得字节</dt><dd>{{ compactBytes(data.keyspace_sample.total_sampled_bytes) }}</dd></div></dl>
          <p>采样上限 {{ data.keyspace_sample.sample_limit }} 个键；{{ data.keyspace_sample.truncated ? '已达到有界采样范围' : '本次未标记截断' }}。SCAN COUNT 32 为提示，最多 32 轮；测量每批最多 16。</p>
          <div v-if="data.keyspace_sample.hotspots.length" class="p67-sample-list"><article v-for="item in data.keyspace_sample.hotspots" :key="item.purpose + ':' + item.resource">
            <div><h3>{{ purposeLabel[item.purpose] }} / {{ resourceLabel[item.resource] }}</h3><small>{{ item.sampled_keys }} 个成功测量键</small></div>
            <div><b>{{ compactBytes(item.sampled_bytes) }}</b><small>采样字节</small></div>
            <div><b>{{ data.keyspace_sample.total_sampled_bytes > 0 ? percent(item.sampled_share_basis_points) : '无比例分母' }}</b><small>成功测得字节的占比</small></div>
            <div v-if="data.keyspace_sample.total_sampled_bytes > 0" class="p67-bar" aria-hidden="true"><span :style="{ width: percent(item.sampled_share_basis_points) }"></span></div>
          </article></div>
          <div v-else class="p67-sample-empty"><h3>{{ sampleStatusLabel[data.keyspace_sample.status] }}</h3>
            <p v-if="data.keyspace_sample.status === 'partial'">已扫描到受限键，但本次未完成有效内存测量；不能据此判断没有业务键。</p>
            <p v-else-if="data.keyspace_sample.unavailable_reason === 'command_unsupported'">当前客户端不支持受限 SCAN 与 MEMORY USAGE。</p>
            <p v-else-if="data.keyspace_sample.unavailable_reason === 'scan_failed'">本次采样失败；总体韧性结论仍由独立运行事实决定。</p>
            <p v-else>本次有界采样没有可归类的结果，不代表整个 Redis 没有业务键。</p>
          </div>
          <p class="p67-note">只显示用途与资源类别，不返回键名、组织、工作区、载荷或连接信息。采样是否成功，不直接改变总体韧性判门。</p>
        </section>
      </div>
      <footer class="redis-resilience__footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><TechnicalDetails :request-id="requestId" summary="快照读取追踪" /><strong
          >重启、配置与恢复只允许通过宝塔</strong
        >
      </footer>
    </template>
  </section>
</template>
