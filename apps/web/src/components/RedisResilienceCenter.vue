<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { RedisResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import TechnicalDetails from "./TechnicalDetails.vue";
import RedisResilienceSummary from "./redis-resilience/RedisResilienceSummary.vue";
import RedisResourceEvidence from "./redis-resilience/RedisResourceEvidence.vue";
import RedisKeyspaceSample from "./redis-resilience/RedisKeyspaceSample.vue";
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
type EvictionRisk = {
  level: "unknown" | "blocked" | "warning" | "ready";
  text: string;
};
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
const evictionRisk = computed<EvictionRisk>(() => {
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
  <section class="redis-resilience redis-resilience--c" :data-state="state">
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
    <aside class="p67-boundary-strip" aria-label="运行边界">
      <b>惠州单主机 / 宝塔管理</b
      ><span>Redis 仅协调缓存、队列、限流与实时消息；MySQL 仍是业务事实源。</span>
    </aside>
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
      <div class="p67-workspace">
        <RedisResilienceSummary
          :data="data"
          :state="data.state"
          :verdict="verdict"
          :format-observed-at="time"
        />
        <RedisResourceEvidence
          :data="data"
          :eviction-risk="evictionRisk"
          :format-bytes="compactBytes"
          :percent="percent"
        />
        <RedisKeyspaceSample
          :sample="data.keyspace_sample"
          :format-bytes="compactBytes"
          :percent="percent"
          :purpose-label="purposeLabel"
          :resource-label="resourceLabel"
          :status-label="sampleStatusLabel"
        />
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
