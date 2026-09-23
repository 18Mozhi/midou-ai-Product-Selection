<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { FileResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import TechnicalDetails from "./TechnicalDetails.vue";
import FileResilienceSnapshot from "./file-resilience/FileResilienceSnapshot.vue";
import { formatFileObservedAt } from "./file-resilience/formatters";
import "../file-resilience.css";
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
  data = ref<FileResilienceDto | null>(null),
  requestId = ref(""),
  actionHint = ref(""),
  refreshing = ref(false),
  refreshFailure = ref<RefreshFailure | null>(null);
let controller: AbortController | null = null;
let sequence = 0;
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在核对本机受控目录", "读取容量、索引、校验和与同机恢复事实。"],
        ready: ["本机文件韧性门已满足", "证据、导出与临时目录符合当前 S0 单机边界。"],
        warning: ["本机文件接近预警线", "当前可用，但需要按告警项处理。"],
        blocked: ["本机文件韧性门已阻断", "停止新增大文件任务，并通过宝塔核验目录与恢复副本。"],
        empty: ["尚无本机文件观测", "确认宝塔 Node API 与受控目录后重新核验。"],
        forbidden: ["没有平台运维权限", actionHint.value || "需要 platform:operate 能力。"],
        expired: ["登录已失效", "重新登录后再核验。"],
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        timeout: ["读取本机文件事实超时", "本次请求已在 15 秒后停止，请检查服务状态再重试。"],
        unavailable: [
          "本机文件事实暂不可用",
          actionHint.value || "在宝塔检查 Node API、目录挂载与 MySQL。",
        ],
        recovering: ["正在核验同机文件恢复", "恢复和校验结论确认前保持阻断。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const refreshNotice = computed(() => {
  if (refreshFailure.value === "timeout")
    return "读取超过 15 秒，已停止本次请求并保留上次成功的本机文件事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的本机文件事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${actionHint.value || "本机文件事实暂不可用，请在宝塔核对 Node API、受控目录与 MySQL。"} 已保留上次成功的本机文件事实。`;
  return "";
});
async function load() {
  if (controller) return;
  const currentSequence = ++sequence;
  const requestController = new AbortController();
  const hasSnapshot = Boolean(data.value);
  const correlationId = crypto.randomUUID();
  controller = requestController;
  refreshing.value = true;
  refreshFailure.value = null;
  if (!hasSnapshot) state.value = "loading";
  actionHint.value = "";
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 15_000);
  try {
    const response = await request<FileResilienceDto | null>("/platform/operations/files", {
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
      requestId.value = correlationId;
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
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
  <section class="file-resilience file-resilience--c" :data-state="state">
    <header class="file-resilience__hero">
      <div>
        <p>ScoutOps / 文件运行</p>
        <h1>文件存储核验</h1>
        <span>证据、导出与临时目录，逐项观测、分别核对</span>
      </div>
      <button type="button" :disabled="refreshing" :aria-busy="refreshing" @click="load">
        {{ refreshing ? "正在刷新…" : "刷新文件事实" }}
      </button>
    </header>
    <aside class="p69-boundary" aria-label="运行边界">
      <b>惠州同机 · 宝塔受管</b>
      <span>证据、导出与临时文件均在当前主机；不使用共享存储或备用服务器。</span>
    </aside>
    <section
      v-if="data && refreshFailure"
      class="file-resilience__refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
    >
      <div>
        <b>{{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}</b>
        <p>{{ refreshNotice }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <button type="button" :disabled="refreshing" @click="load">重新核验</button>
    </section>
    <section
      v-if="state === 'loading' || state === 'recovering'"
      class="file-resilience__state"
      aria-live="polite"
    >
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="
        ['forbidden', 'expired', 'rate_limited', 'timeout', 'unavailable', 'empty'].includes(state)
      "
      class="file-resilience__state file-resilience__state--danger"
      aria-live="polite"
    >
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
      ><button v-else type="button" :disabled="refreshing" @click="load">重新核验</button>
    </section>
    <template v-else-if="data">
      <FileResilienceSnapshot :data="data" :state="data.state" :verdict="verdict" />
      <footer class="file-resilience__footer">
        <span>观测 {{ formatFileObservedAt(data.observed_at) }}</span>
        <TechnicalDetails :request-id="requestId" />
        <strong>目录、备份、恢复与清理只允许通过宝塔</strong>
      </footer>
    </template>
  </section>
</template>
