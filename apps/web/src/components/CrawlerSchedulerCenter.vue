<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { statusLabel } from "../ui/status-labels";
import ConfirmDialog from "./ConfirmDialog.vue";
import CrawlerSchedulerEvidence from "./CrawlerSchedulerEvidence.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
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
const state = ref<State>("loading");
const data = ref<Dto | null>(null),
  requestId = ref(""),
  message = ref(""),
  confirming = ref(false),
  circuitConfirm = ref<Dto["providers"][number] | null>(null),
  providerRecovering = ref(""),
  saving = ref(false),
  refreshing = ref(false),
  refreshFailure = ref<"rate_limited" | "timeout" | "unavailable" | null>(null),
  actionHint = ref(""),
  providerQuery = ref(""),
  providerFilter = ref<"attention" | "all" | "open" | "queued">("attention"),
  providerPage = ref(1);
const providerPageSize = 12;
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
const filteredProviders = computed(() => {
  const query = providerQuery.value.trim().toLocaleLowerCase();
  return [...(data.value?.providers ?? [])]
    .filter((item) => !query || item.code.toLocaleLowerCase().includes(query))
    .filter((item) => {
      if (providerFilter.value === "all") return true;
      if (providerFilter.value === "open") return item.circuit_state === "open";
      if (providerFilter.value === "queued") return item.queued_tasks > 0;
      return (
        item.circuit_state === "open" || item.queued_tasks > 0 || item.consecutive_failures > 0
      );
    })
    .sort(
      (left, right) =>
        Number(right.circuit_state === "open") - Number(left.circuit_state === "open") ||
        right.queued_tasks - left.queued_tasks ||
        right.consecutive_failures - left.consecutive_failures ||
        left.code.localeCompare(right.code),
    );
});
const providerPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredProviders.value.length / providerPageSize)),
);
const pagedProviders = computed(() => {
  if (providerPage.value > providerPageCount.value) providerPage.value = providerPageCount.value;
  const offset = (providerPage.value - 1) * providerPageSize;
  return filteredProviders.value.slice(offset, offset + providerPageSize);
});
function resetProviderPage() {
  providerPage.value = 1;
}
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

onMounted(() => void load());
onBeforeUnmount(() => {
  loadSequence += 1;
  loadController?.abort();
  loadController = null;
});
</script>

<template>
  <section class="crawler-scheduler crawler-scheduler--c" :data-state="state">
    <header class="crawler-scheduler__hero">
      <div>
        <p>ScoutOps / 采集调度</p>
        <h1>采集调度核验</h1>
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
    <aside class="p70-boundary" aria-label="运行边界">
      <b>惠州单机 / 宝塔受管</b
      ><span>Worker 与 Python Crawler 各一个实例；来源有效并发固定为1。</span>
    </aside>
    <section
      v-if="data && refreshFailure"
      class="crawler-scheduler__refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
    >
      <div>
        <b>{{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}</b>
        <p>{{ refreshNotice }}</p>
        <TechnicalDetails :request-id="requestId" />
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
        <TechnicalDetails :request-id="requestId" />
      </div>
      <button v-if="!['loading', 'recovering'].includes(state)" type="button" @click="() => load()">
        重新核验
      </button>
    </section>
    <template v-else-if="data">
      <section class="p70-paper">
        <section class="p70-conclusion" :data-verdict="state">
          <div>
            <small>S0 / {{ state }}</small>
            <h2>
              {{
                state === "ready"
                  ? "当前采集调度门满足"
                  : state === "warning"
                    ? "当前调度需要关注"
                    : "当前采集调度门阻断"
              }}
            </h2>
            <p>返回 {{ data.findings.length }} 项发现；不以单张指标卡替代总体结论。</p>
          </div>
          <div>
            <b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time>
          </div>
        </section>
        <section v-if="data.findings.length" class="p70-findings">
          <h2>
            当前发现 <small>{{ data.findings.length }} 项</small>
          </h2>
          <article v-for="item in data.findings" :key="item.code" :data-severity="item.severity">
            <b>{{ item.severity === "blocked" ? "阻断" : "预警" }}</b
            ><code>{{ item.code }}</code>
            <p>{{ item.action_hint }}</p>
          </article>
        </section>
        <div class="p70-runtime">
          <section>
            <h2>单机运行与租约</h2>
            <dl>
              <div>
                <dt>Worker / 上限</dt>
                <dd>{{ data.topology.worker_instances }} / {{ data.topology.maximum_workers }}</dd>
              </div>
              <div>
                <dt>Python Crawler / 上限</dt>
                <dd>
                  {{ data.topology.crawler_instances }} / {{ data.topology.maximum_crawlers }}
                </dd>
              </div>
              <div>
                <dt>重复租约</dt>
                <dd>{{ data.leases.duplicate_count }}</dd>
              </div>
              <div>
                <dt>活动档案</dt>
                <dd>{{ data.profiles.length }}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2>主机资源观测</h2>
            <dl>
              <div>
                <dt>负载 / 核数</dt>
                <dd>{{ (data.resource.load_basis_points / 100).toFixed(1) }}%</dd>
              </div>
              <div>
                <dt>可用内存</dt>
                <dd>{{ data.resource.available_memory_mb }} MB</dd>
              </div>
              <div>
                <dt>可用磁盘</dt>
                <dd>{{ data.resource.free_disk_mb }} MB</dd>
              </div>
            </dl>
            <p>负载/核数不是CPU利用率；非Linux占位不当作实测进程数。</p>
          </section>
        </div>
        <section class="p70-providers">
          <header>
            <div>
              <h2>来源并发与排队</h2>
              <p>来源按熔断、排队、连续失败和代码排序；每页最多12条。</p>
            </div>
            <b>待领取 {{ queueSummary.queued }} · 最老 {{ duration(queueSummary.oldest) }}</b>
          </header>
          <p v-if="message" class="crawler-scheduler__operation-message" aria-live="polite">
            {{ message }}
          </p>
          <div class="crawler-scheduler__source-filters">
            <label>
              搜索来源
              <input
                v-model="providerQuery"
                type="search"
                placeholder="输入来源代码"
                @input="resetProviderPage"
              />
            </label>
            <label>
              运行范围
              <select v-model="providerFilter" @change="resetProviderPage">
                <option value="attention">需要关注</option>
                <option value="open">已熔断</option>
                <option value="queued">有排队任务</option>
                <option value="all">全部来源</option>
              </select>
            </label>
            <span>共 {{ filteredProviders.length }} 个来源</span>
          </div>
          <div class="p70-provider-list">
            <article
              v-for="item in pagedProviders"
              :key="item.id"
              :data-circuit="item.circuit_state"
            >
              <header>
                <b>{{ item.code }}</b
                ><span>{{
                  item.circuit_state === "open"
                    ? "来源已熔断"
                    : item.active_leases + " / " + item.effective_concurrency
                }}</span>
              </header>
              <progress
                :aria-label="item.code + '来源有效并发占用'"
                :aria-valuetext="item.active_leases + ' / ' + (item.effective_concurrency || 1)"
                :value="item.active_leases"
                :max="item.effective_concurrency || 1"
              ></progress>
              <p>
                排队 {{ item.queued_tasks }} · 最长
                {{ duration(item.longest_queue_wait_seconds) }} · P95
                {{ duration(item.queue_wait_p95_seconds) }}
              </p>
              <p>{{ queueRiskText(item) }}</p>
              <p>
                24小时成功率 {{ rate(item.success_rate_basis_points_24h) }} · 耗时P95
                {{ milliseconds(item.duration_p95_ms_24h) }} · 样本 {{ item.sample_count_24h }}
              </p>
              <details v-if="item.last_error_code">
                <summary>最近失败</summary>
                <code>{{ item.last_error_code }}</code>
              </details>
              <div v-if="item.circuit_state === 'open'" class="p70-provider-actions">
                <RouterLink :to="'/platform-admin/provider-adapters?provider_id=' + item.id"
                  >前往来源健康</RouterLink
                ><button
                  type="button"
                  :disabled="providerRecovering === item.id || refreshing"
                  @click="circuitConfirm = item"
                >
                  解除熔断
                </button>
              </div>
            </article>
            <p v-if="!data.providers.length">当前没有启用来源。</p>
            <p v-else-if="!filteredProviders.length">当前筛选范围没有需要处理的来源。</p>
          </div>
          <nav
            v-if="filteredProviders.length > providerPageSize"
            class="p70-pagination"
            aria-label="来源列表分页"
          >
            <button type="button" :disabled="providerPage <= 1" @click="providerPage -= 1">
              上一页</button
            ><span>第 {{ providerPage }} / {{ providerPageCount }} 页</span
            ><button
              type="button"
              :disabled="providerPage >= providerPageCount"
              @click="providerPage += 1"
            >
              下一页
            </button>
          </nav>
        </section>
        <CrawlerSchedulerEvidence
          :data="data"
          :time="time"
          :bytes="bytes"
          :rate="rate"
          :process-label="processLabel"
          :status-label="statusLabel"
        />
      </section>
      <footer>
        <span>运行观测 {{ time(data.observed_at) }}</span
        ><TechnicalDetails :request-id="requestId" /><strong
          >服务、重启与有限任务只允许通过宝塔</strong
        >
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

<style>
@import "../crawler-scheduler-c.css";
</style>
