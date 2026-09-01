<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { statusLabel } from "../ui/status-labels";
import ConfirmDialog from "./ConfirmDialog.vue";
import "../crawler-scheduler.css";

type State =
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
interface Dto {
  state: "ready" | "warning" | "blocked";
  topology: {
    mode: "single_host";
    worker_instances: number;
    crawler_instances: number;
    maximum_workers: 1;
    maximum_crawlers: 1;
  };
  leases: {
    active_worker: number;
    active_crawler: number;
    duplicate_count: number;
  };
  expired_leases: {
    total: number;
    task_count: number;
    worker: number;
    crawler: number;
    provider: number;
    oldest_expired_at: string | null;
  };
  active_leases: Array<{
    slot_type: "worker" | "crawler" | "provider";
    provider_name: string | null;
    task_id: string | null;
    task_status: string | null;
    run_id: string | null;
    process_role: "node_worker" | "python_crawler";
    process_ref: string;
    heartbeat_at: string;
    expires_at: string;
  }>;
  providers: Array<{
    id: string;
    code: string;
    configured_concurrency: number;
    effective_concurrency: number;
    active_leases: number;
    queued_tasks: number;
    longest_queue_wait_seconds: number;
    queue_wait_p50_seconds: number;
    queue_wait_p95_seconds: number;
    sample_count_24h: number;
    success_rate_basis_points_24h: number | null;
    duration_p95_ms_24h: number | null;
    circuit_state: "closed" | "open";
    circuit_failure_threshold: number;
    consecutive_failures: number;
    last_error_code: string | null;
  }>;
  profiles: Array<{ id: string; active_leases: number }>;
  trend: Array<{
    bucket_at: string;
    total: number;
    succeeded: number;
    failed: number;
    failure_rate_basis_points: number;
  }>;
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
  receipt_spool: null | {
    pending_count: number;
    pending_bytes: number;
    quarantined_count: number;
    quarantined_bytes: number;
    oldest_pending_at: string | null;
    retention_days: number;
    max_bytes: number;
    minimum_free_disk_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
  findings: Array<{
    code: string;
    severity: "warning" | "blocked";
    action_hint: string;
  }>;
  observed_at: string;
  capacity_claim: "unverified";
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<State>(
  new URLSearchParams(location.search).get("state") === "recovering" ? "recovering" : "loading",
);
const data = ref<Dto | null>(null),
  requestId = ref(""),
  message = ref(""),
  confirming = ref(false),
  circuitConfirm = ref<Dto["providers"][number] | null>(null),
  providerRecovering = ref(""),
  saving = ref(false),
  refreshing = ref(false),
  refreshFailure = ref<"rate_limited" | "timeout" | "unavailable" | null>(null),
  actionHint = ref("");
let loadController: AbortController | null = null,
  loadSequence = 0,
  recoverExpiredKey: string | null = null,
  recoverProviderKey: { providerId: string; key: string } | null = null;
const queueSummary = computed(() => {
  const providers = data.value?.providers ?? [];
  return {
    queued: providers.reduce((sum, item) => sum + item.queued_tasks, 0),
    oldest: providers.reduce(
      (oldest, item) => Math.max(oldest, item.longest_queue_wait_seconds),
      0,
    ),
    starvationRisks: providers.filter(
      (item) =>
        item.queued_tasks > 0 &&
        item.sample_count_24h > 0 &&
        item.queue_wait_p95_seconds > 0 &&
        item.longest_queue_wait_seconds > item.queue_wait_p95_seconds,
    ).length,
  };
});
const expiredLeaseImpact = computed(() => {
  const impact = data.value?.expired_leases;
  if (!impact || impact.total === 0) return "当前没有过期租约；确认后不会修改任何活动槽位。";
  const types = [
    impact.worker ? `Worker ${impact.worker}` : "",
    impact.crawler ? `Crawler ${impact.crawler}` : "",
    impact.provider ? `来源 ${impact.provider}` : "",
  ].filter(Boolean);
  return `将回收 ${impact.total} 个过期槽位（${types.join("、")}），关联 ${impact.task_count} 个采集任务；最早于 ${impact.oldest_expired_at ? time(impact.oldest_expired_at) : "时间未知"} 到期。活动租约不会被修改。`;
});
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在核验单机调度", "读取进程、租约和来源并发。"],
        recovering: ["正在回收过期租约", "只处理服务端确认已过期的调度槽位。"],
        ready: ["采集调度已就绪", "Node Worker 与 Python Crawler 均为一个实例，来源并发 1。"],
        warning: ["采集调度需要关注", "继续保持来源并发 1，并按告警项处理。"],
        blocked: ["采集调度已阻断", "保持任务排队，按告警动作通过宝塔恢复。"],
        empty: ["尚无调度观测", "确认宝塔 ai选品 统一后端已运行。"],
        forbidden: ["没有平台运维权限", "联系平台管理员授予 platform:operate。"],
        expired: ["登录已失效", "重新登录后核验调度状态。"],
        rate_limited: ["刷新过于频繁", "稍后再试，当前租约不受影响。"],
        timeout: ["采集调度事实读取超时", "本次请求已在 15 秒后停止，请检查服务状态再重试。"],
        unavailable: ["采集调度事实暂不可用", "检查 MySQL、统一后端和受控目录后重试。"],
      }) as const
    )[state.value],
);
const refreshNotice = computed(() => {
  if (refreshFailure.value === "timeout")
    return "读取超过 15 秒，已停止本次请求并保留上次成功的采集调度事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的采集调度事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${actionHint.value || "采集调度事实暂不可用，请在宝塔核对 Node API 与 MySQL。"} 已保留上次成功的采集调度事实。`;
  return "";
});
const time = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
const processLabel = (value: "node_worker" | "python_crawler") =>
  value === "node_worker" ? "Node Worker" : "Python Crawler";
const duration = (seconds: number) => {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
};
const rate = (basisPoints: number | null) =>
  basisPoints == null ? "样本不足" : `${(basisPoints / 100).toFixed(1)}%`;
const milliseconds = (value: number | null) =>
  value == null
    ? "样本不足"
    : value < 1000
      ? `${Math.round(value)} ms`
      : `${(value / 1000).toFixed(1)} 秒`;
const bytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};
const queueRiskText = (item: Dto["providers"][number]) => {
  if (item.queued_tasks === 0) return "无排队，无饥饿风险";
  if (item.sample_count_24h === 0 || item.queue_wait_p95_seconds <= 0)
    return "缺少近 24 小时等待基线，需持续观察";
  if (item.longest_queue_wait_seconds > item.queue_wait_p95_seconds)
    return "最长等待已高于近 24 小时 P95，存在饥饿风险";
  return "最长等待仍在近 24 小时 P95 范围内";
};
const status = (kind: ApiFailureKind): State =>
  kind === "expired" || kind === "forbidden" || kind === "rate_limited" ? kind : "unavailable";

async function load(options: { preserveMessage?: boolean } = {}) {
  if (loadController) return;
  const currentSequence = ++loadSequence,
    controller = new AbortController(),
    hasSnapshot = Boolean(data.value),
    correlationId = crypto.randomUUID();
  loadController = controller;
  refreshing.value = true;
  refreshFailure.value = null;
  actionHint.value = "";
  if (!options.preserveMessage) message.value = "";
  if (!hasSnapshot) state.value = "loading";
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort("crawler_scheduler_read_timeout");
  }, 15_000);
  try {
    const response = await request<Dto>("/platform/operations/crawler-scheduler", {
      signal: controller.signal,
      requestId: correlationId,
      traceId: correlationId,
    });
    if (currentSequence !== loadSequence) return;
    requestId.value = response.request_id;
    data.value = response.data ?? null;
    state.value = data.value ? data.value.state : "empty";
  } catch (error) {
    if (
      currentSequence !== loadSequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    if (timedOut) {
      requestId.value = correlationId;
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    const failure = error instanceof ApiClientError ? error : null,
      failureState = failure ? status(failure.kind) : "unavailable";
    requestId.value = failure?.requestId ?? "";
    actionHint.value = failure?.actionHint ?? "";
    if (hasSnapshot && !["expired", "forbidden"].includes(failureState))
      refreshFailure.value = failureState as "rate_limited" | "unavailable";
    else {
      data.value = null;
      state.value = failureState;
    }
  } finally {
    window.clearTimeout(timeout);
    if (currentSequence === loadSequence) {
      loadController = null;
      refreshing.value = false;
    }
  }
}

async function recover() {
  if (saving.value || refreshing.value) return;
  saving.value = true;
  confirming.value = false;
  refreshFailure.value = null;
  actionHint.value = "";
  if (!data.value) state.value = "recovering";
  recoverExpiredKey ??= crypto.randomUUID();
  try {
    const response = await request<{ recovered: number }>(
      "/platform/operations/crawler-scheduler/recover-expired",
      { method: "POST", body: {}, idempotencyKey: recoverExpiredKey },
    );
    recoverExpiredKey = null;
    requestId.value = response.request_id;
    message.value = `已回收 ${response.data.recovered} 个过期调度槽位`;
    await load({ preserveMessage: true });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status > 0 && error.status < 500) recoverExpiredKey = null;
      requestId.value = error.requestId;
      actionHint.value = error.actionHint;
      message.value = error.actionHint;
      if (!data.value) state.value = status(error.kind);
    } else {
      actionHint.value = "租约回收结果暂时无法确认，请使用相同操作重试。";
      message.value = actionHint.value;
      if (!data.value) state.value = "unavailable";
    }
  } finally {
    saving.value = false;
  }
}

async function recoverProvider() {
  const provider = circuitConfirm.value;
  if (!provider || providerRecovering.value || refreshing.value) return;
  providerRecovering.value = provider.id;
  message.value = "";
  actionHint.value = "";
  circuitConfirm.value = null;
  if (recoverProviderKey?.providerId !== provider.id)
    recoverProviderKey = { providerId: provider.id, key: crypto.randomUUID() };
  try {
    const response = await request<{ provider_id: string; recovered: boolean }>(
      `/platform/operations/crawler-scheduler/providers/${provider.id}/recover`,
      { method: "POST", body: {}, idempotencyKey: recoverProviderKey.key },
    );
    recoverProviderKey = null;
    requestId.value = response.request_id;
    const resultMessage = response.data.recovered
      ? `已解除 ${provider.code} 的来源级熔断`
      : `${provider.code} 当前无需恢复`;
    message.value = resultMessage;
    await load({ preserveMessage: true });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status > 0 && error.status < 500) recoverProviderKey = null;
      requestId.value = error.requestId;
      actionHint.value = error.actionHint;
      message.value = error.actionHint;
    } else message.value = "来源恢复失败，请核对来源健康检查后重试。";
  } finally {
    providerRecovering.value = "";
  }
}

onMounted(() => {
  if (state.value !== "recovering") void load();
});
onBeforeUnmount(() => {
  loadSequence += 1;
  loadController?.abort();
  loadController = null;
});
</script>

<template>
  <section class="crawler-scheduler" :data-state="state">
    <header class="crawler-scheduler__hero">
      <div>
        <p>单机采集调度</p>
        <h2>运行与配额</h2>
        <span
          >惠州单机由 ai选品 Worker 领取采集任务，宝塔 Python 3.12 项目提供采集心跳与 Playwright
          桥接；来源并发上限 1。</span
        >
      </div>
      <div>
        <button type="button" :disabled="refreshing" :aria-busy="refreshing" @click="() => load()">
          {{ refreshing ? "正在刷新…" : "刷新运行事实" }}</button
        ><button
          class="danger"
          type="button"
          :disabled="saving || refreshing"
          @click="confirming = true"
        >
          回收过期租约
        </button>
      </div>
    </header>
    <section
      v-if="data && refreshFailure"
      class="crawler-scheduler__refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
    >
      <div>
        <b>{{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}</b>
        <p>{{ refreshNotice }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <button type="button" :disabled="refreshing" @click="() => load()">重新核验</button>
    </section>
    <section
      v-if="!['ready', 'warning', 'blocked'].includes(state)"
      class="crawler-scheduler__state"
      :data-kind="state"
      aria-live="polite"
    >
      <i></i>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ message ? `${message}；${actionHint || verdict[1]}` : actionHint || verdict[1] }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <button v-if="!['loading', 'recovering'].includes(state)" type="button" @click="() => load()">
        重新核验
      </button>
    </section>
    <template v-else-if="data">
      <section class="crawler-scheduler__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>统一后端 · 运行就绪</em>
      </section>
      <section class="crawler-scheduler__metrics">
        <article>
          <span>任务处理器</span
          ><strong
            >{{ data.topology.worker_instances }} / {{ data.topology.maximum_workers }}</strong
          ><small>全局任务槽位 {{ data.leases.active_worker }}</small>
        </article>
        <article>
          <span>Python 采集运行时</span
          ><strong
            >{{ data.topology.crawler_instances }} / {{ data.topology.maximum_crawlers }}</strong
          ><small>活动浏览器槽位 {{ data.leases.active_crawler }}</small>
        </article>
        <article>
          <span>重复租约</span><strong>{{ data.leases.duplicate_count }}</strong
          ><small>必须保持为 0</small>
        </article>
        <article>
          <span>已启用来源</span><strong>{{ data.providers.length }}</strong
          ><small>来源并发由调度器统一管理</small>
        </article>
      </section>
      <div class="crawler-scheduler__layout">
        <section class="crawler-scheduler__panel">
          <header>
            <div>
              <p>来源配额</p>
              <h3>来源并发与排队</h3>
            </div>
            <span>配置值会被单机上限收紧到 1</span>
          </header>
          <section class="crawler-scheduler__queue-summary" aria-label="采集排队摘要">
            <article>
              <small>待领取任务</small><strong>{{ queueSummary.queued }}</strong>
            </article>
            <article>
              <small>最老等待</small><strong>{{ duration(queueSummary.oldest) }}</strong>
            </article>
            <article>
              <small>饥饿风险来源</small><strong>{{ queueSummary.starvationRisks }}</strong>
            </article>
          </section>
          <div class="crawler-scheduler__sources">
            <p v-if="message" class="crawler-scheduler__operation-message" aria-live="polite">
              {{ message }}
            </p>
            <article
              v-for="item in data.providers"
              :key="item.id"
              :data-circuit="item.circuit_state"
            >
              <div>
                <b>{{ item.code }}</b
                ><span>{{
                  item.circuit_state === "open"
                    ? "来源已熔断"
                    : `${item.active_leases} / ${item.effective_concurrency}`
                }}</span>
              </div>
              <progress
                :value="item.active_leases"
                :max="item.effective_concurrency || 1"
              ></progress
              ><small
                >来源配置 {{ item.configured_concurrency }} · 当前有效
                {{ item.effective_concurrency }}</small
              >
              <small
                >等待 {{ item.queued_tasks }} 个任务 · 最长
                {{ duration(item.longest_queue_wait_seconds) }}</small
              >
              <small
                >等待分位 P50 {{ duration(item.queue_wait_p50_seconds) }} · P95
                {{ duration(item.queue_wait_p95_seconds) }}</small
              >
              <small class="crawler-scheduler__queue-risk">{{ queueRiskText(item) }}</small>
              <small
                >24 小时成功率 {{ rate(item.success_rate_basis_points_24h) }} · 耗时 P95
                {{ milliseconds(item.duration_p95_ms_24h) }} · 样本
                {{ item.sample_count_24h }}</small
              >
              <small v-if="item.circuit_state === 'open'" class="crawler-scheduler__circuit">
                连续失败 {{ item.consecutive_failures }} /
                {{ item.circuit_failure_threshold }}，仅该来源暂停；健康检查恢复后再解除。
                <RouterLink :to="`/platform-admin/provider-adapters?provider_id=${item.id}`"
                  >前往来源健康</RouterLink
                >
                <button
                  type="button"
                  :disabled="providerRecovering === item.id || refreshing"
                  @click="circuitConfirm = item"
                >
                  解除熔断
                </button>
              </small>
              <details v-if="item.last_error_code">
                <summary>最近失败</summary>
                <code>{{ item.last_error_code }}</code>
              </details>
            </article>
            <p v-if="!data.providers.length">当前没有启用来源。</p>
          </div>
        </section>
        <aside class="crawler-scheduler__panel">
          <header>
            <div>
              <p>独占登录档案</p>
              <h3>浏览器档案独占</h3>
            </div>
            <span>{{ data.profiles.length }} 个活动档案</span>
          </header>
          <dl>
            <div>
              <dt>重复租约</dt>
              <dd>{{ data.leases.duplicate_count }}</dd>
            </div>
            <div>
              <dt>独占上限</dt>
              <dd>每档案 1</dd>
            </div>
            <div>
              <dt>全局采集执行器</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>租约真相</dt>
              <dd>数据库 5.7</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section class="crawler-scheduler__panel crawler-scheduler__receipts">
        <header>
          <div>
            <p>完成回执</p>
            <h3>容量、保留期与磁盘水位</h3>
          </div>
          <span v-if="data.receipt_spool">观测于 {{ time(data.receipt_spool.observed_at) }}</span>
          <span v-else>等待 Python Crawler 上报</span>
        </header>
        <div v-if="data.receipt_spool" class="crawler-scheduler__receipt-grid">
          <article>
            <small>待回写</small><strong>{{ data.receipt_spool.pending_count }}</strong>
            <span>{{ bytes(data.receipt_spool.pending_bytes) }}</span>
          </article>
          <article>
            <small>隔离待审阅</small><strong>{{ data.receipt_spool.quarantined_count }}</strong>
            <span>{{ bytes(data.receipt_spool.quarantined_bytes) }}</span>
          </article>
          <article>
            <small>最老待回写</small>
            <strong>{{
              data.receipt_spool.oldest_pending_at
                ? time(data.receipt_spool.oldest_pending_at)
                : "无积压"
            }}</strong>
            <span>保留期 {{ data.receipt_spool.retention_days }} 天；到期只告警，不自动删除</span>
          </article>
          <article>
            <small>目录容量</small>
            <strong>{{
              bytes(data.receipt_spool.pending_bytes + data.receipt_spool.quarantined_bytes)
            }}</strong>
            <span>告警上限 {{ bytes(data.receipt_spool.max_bytes) }}</span>
          </article>
          <article>
            <small>所在磁盘可用</small><strong>{{ data.receipt_spool.free_disk_mb }} MB</strong>
            <span>停止线 {{ data.receipt_spool.minimum_free_disk_mb }} MB</span>
          </article>
        </div>
        <p v-else class="crawler-scheduler__empty">
          尚无受限回执目录观测；调度保持阻断，重启 Python Crawler 后重新核验。
        </p>
      </section>
      <section class="crawler-scheduler__panel crawler-scheduler__trend">
        <header>
          <div>
            <p>最近 24 小时</p>
            <h3>吞吐与失败率趋势</h3>
          </div>
          <span>{{ data.trend.reduce((sum, item) => sum + item.total, 0) }} 次浏览器运行</span>
        </header>
        <div v-if="data.trend.length">
          <article v-for="item in data.trend" :key="item.bucket_at">
            <time :datetime="item.bucket_at">{{ time(item.bucket_at) }}</time>
            <span>吞吐 {{ item.total }}</span
            ><span>成功 {{ item.succeeded }}</span
            ><span>失败 {{ item.failed }}</span>
            <strong>{{ rate(item.failure_rate_basis_points) }}</strong>
          </article>
        </div>
        <p v-else class="crawler-scheduler__empty">最近 24 小时暂无浏览器运行样本。</p>
      </section>
      <section
        v-if="data.active_leases.length"
        class="crawler-scheduler__panel crawler-scheduler__associations"
      >
        <header>
          <div>
            <p>实时关联</p>
            <h3>租约、进程与采集任务</h3>
          </div>
          <span>{{ data.active_leases.length }} 个活动槽位</span>
        </header>
        <div>
          <article
            v-for="(item, index) in data.active_leases"
            :key="`${item.slot_type}:${item.task_id}:${item.run_id}:${index}`"
          >
            <div>
              <b>{{ processLabel(item.process_role) }}</b>
              <span>{{ item.provider_name || "全局调度槽位" }}</span>
            </div>
            <p>
              采集任务：{{ statusLabel(item.task_status) }} · 最近心跳
              {{ time(item.heartbeat_at) }} · 租约到期 {{ time(item.expires_at) }}
            </p>
            <details>
              <summary>查看技术详情</summary>
              <code>任务 UUID {{ item.task_id || "未关联" }}</code>
              <code>进程标识 {{ item.process_ref }}</code>
              <code>槽位类型 {{ item.slot_type }}</code>
              <code v-if="item.run_id">运行 UUID {{ item.run_id }}</code>
            </details>
          </article>
        </div>
      </section>
      <section class="crawler-scheduler__panel crawler-scheduler__findings">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>调度告警</h3>
          </div>
          <span>{{ data.findings.length }} 项</span>
        </header>
        <div v-if="data.findings.length">
          <article
            v-for="(item, index) in data.findings"
            :key="item.code"
            :data-severity="item.severity"
          >
            <span>{{ String(index + 1).padStart(2, "0") }}</span
            ><code>{{ item.code }}</code>
            <p>{{ item.action_hint }}</p>
          </article>
        </div>
        <div v-else class="crawler-scheduler__clear">
          <b>当前无采集调度阻断</b><span>Node Worker 与 Python Crawler 均可正常接收任务。</span>
        </div>
      </section>
      <footer>
        <span>运行观测 {{ time(data.observed_at) }}</span
        ><span>request_id {{ requestId || "—" }}</span
        ><strong>服务、重启与有限任务只允许通过宝塔</strong>
      </footer>
    </template>
    <ConfirmDialog
      :open="confirming"
      title="回收过期调度租约？"
      description="仅删除服务端确认已经过期的 Worker、Crawler 与来源调度槽位。"
      :impact="expiredLeaseImpact"
      confirm-label="确认回收"
      confirmation-text="确认回收"
      @cancel="confirming = false"
      @confirm="recover"
    />
    <ConfirmDialog
      :open="Boolean(circuitConfirm)"
      title="解除该来源的运行熔断？"
      description="仅当来源启用，且熔断后已完成一次结果正常的来源健康检查时才会恢复。"
      impact="只恢复当前来源；其他来源、任务结果和历史证据不会被修改。"
      confirm-label="确认解除"
      confirmation-text="确认解除"
      @cancel="circuitConfirm = null"
      @confirm="recoverProvider"
    />
  </section>
</template>
