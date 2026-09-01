<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ConfirmDialog from "./ConfirmDialog.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
import "../capacity-boundary.css";
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
  | "verifying";
interface Dto {
  state: "ready" | "warning" | "blocked";
  boundary: {
    measured_concurrency: number;
    planning_users: 100;
    planning_concurrency_min: 5;
    planning_concurrency_max: 20;
    capacity_claim: "unverified" | "measured_single_host_limited";
    stop_reason: "next_stage_gate_failed" | "planning_ceiling_reached" | null;
    failed_next_concurrency: number | null;
    failed_next_code: string | null;
  };
  performance: {
    read_p95_ms: number;
    write_p95_ms: number;
    error_rate_basis_points: number;
    async_lag_seconds: number;
  };
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
  };
  resilience: { archive_verified: boolean; recovery_verified: boolean };
  degradation: {
    mode: "normal" | "shed_background" | "stop_new_work";
    actions: string[];
  };
  findings: Array<{
    code: string;
    severity: "warning" | "blocked";
    reason: string;
    owner_role_code: "platform_operations_admin";
    owner_label: "平台运维管理员";
    action_hint: string;
  }>;
  single_host: true;
  load_balancing_enabled: false;
  backup_server_used: false;
  multi_node_claim: false;
  observed_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  data = ref<Dto | null>(null),
  requestId = ref(""),
  message = ref(""),
  operationMessage = ref(""),
  confirming = ref(false),
  saving = ref(false),
  refreshing = ref(false),
  refreshFailure = ref<"rate_limited" | "timeout" | "empty" | "unavailable" | null>(null);
let loadController: AbortController | null = null,
  loadSequence = 0,
  drillIdempotencyKey = crypto.randomUUID();
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在读取单机实测边界", "核对延迟、错误率、异步滞后、资源与恢复事实。"],
        verifying: ["正在核验归档与恢复演练", "只签认宝塔有限任务已经完成的事实。"],
        ready: ["S0 单机实测边界已满足", "当前实测档位低于全部停止线，归档和隔离恢复均已核验。"],
        warning: ["单机有限边界已签发", "下一档已触发固定停止线；保持最后通过档位并执行后台降载。"],
        blocked: ["单机容量门已阻断", "固定并发 5 尚未通过，停止新增后台工作并按 Runbook 恢复。"],
        empty: ["尚无同提交容量基线", "通过宝塔有限任务执行受控基线后再核验。"],
        forbidden: ["没有平台运维权限", "联系平台管理员授予 platform:operate。"],
        expired: ["登录已失效", "重新登录后核验容量边界。"],
        rate_limited: ["刷新过于频繁", "稍后重试，不扩大当前并发。"],
        timeout: ["容量边界事实读取超时", "本次请求已在 15 秒后停止，请检查服务状态再重试。"],
        unavailable: ["容量边界事实暂不可用", "检查 MySQL、生产证据与宝塔运行状态后重试。"],
      }) as const
    )[state.value],
);
const boundaryHint = computed(() => {
    if (!data.value) return "";
    if (data.value.boundary.stop_reason === "next_stage_gate_failed")
      return `并发 ${data.value.boundary.failed_next_concurrency} 已失败；声明只限并发 ${data.value.boundary.measured_concurrency}`;
    if (data.value.boundary.stop_reason === "planning_ceiling_reached")
      return "规划测量上限已完成；仍仅限当前单机实测";
    return data.value.boundary.measured_concurrency < 5
      ? "固定并发 5 未通过；容量保持未验证"
      : "停止事实缺失；容量保持未验证";
  }),
  nextStageHint = computed(() => {
    if (!data.value) return "—";
    if (data.value.boundary.failed_next_concurrency)
      return `${data.value.boundary.failed_next_concurrency} 已停止`;
    if (data.value.boundary.stop_reason === "planning_ceiling_reached") return "规划上限已完成";
    return data.value.boundary.measured_concurrency < 5 ? "固定并发 5 未通过" : "停止事实缺失";
  }),
  pct = (v: number) => `${(v / 100).toFixed(2)}%`,
  time = (v: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(v)),
  status = (error: ApiClientError): State =>
    error.kind === "expired" || error.kind === "forbidden" || error.kind === "rate_limited"
      ? error.kind
      : error.status === 404 || error.code === "capacity_evidence_unavailable"
        ? "empty"
        : "unavailable";
const refreshFailureMessage = computed(() => {
  if (refreshFailure.value === "timeout")
    return "本次请求已在 15 秒后停止，请检查服务状态再重试；当前快照保持不变。";
  if (refreshFailure.value === "rate_limited") return "刷新过于频繁，当前快照保持不变。";
  if (refreshFailure.value === "empty") return "未读取到新的同提交容量基线，当前快照保持不变。";
  return "新鲜容量事实暂不可用，当前快照保持不变。";
});
async function load(options: { preserveOperationMessage?: boolean } = {}) {
  if (refreshing.value) return;
  const hasSnapshot = Boolean(data.value),
    controller = new AbortController(),
    sequence = ++loadSequence;
  loadController?.abort();
  loadController = controller;
  refreshing.value = true;
  if (!hasSnapshot) state.value = "loading";
  message.value = "";
  refreshFailure.value = null;
  if (!options.preserveOperationMessage) operationMessage.value = "";
  const timeout = window.setTimeout(
    () => controller.abort("capacity_boundary_read_timeout"),
    15_000,
  );
  try {
    const response = await request<Dto>("/platform/operations/capacity", {
      signal: controller.signal,
    });
    if (sequence !== loadSequence) return;
    requestId.value = response.request_id;
    data.value = response.data ?? null;
    state.value = data.value ? data.value.state : "empty";
  } catch (error) {
    if (sequence !== loadSequence) return;
    const timedOut = controller.signal.aborted;
    if (timedOut) {
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      const next = status(error);
      if (["expired", "forbidden"].includes(next)) {
        data.value = null;
        state.value = next;
      } else if (hasSnapshot) {
        refreshFailure.value = next === "rate_limited" || next === "empty" ? next : "unavailable";
      } else state.value = next;
    } else if (hasSnapshot) refreshFailure.value = "unavailable";
    else state.value = "unavailable";
  } finally {
    window.clearTimeout(timeout);
    if (sequence === loadSequence) {
      refreshing.value = false;
      loadController = null;
    }
  }
}
async function attest() {
  if (saving.value || refreshing.value) return;
  saving.value = true;
  confirming.value = false;
  operationMessage.value = "";
  if (!data.value) state.value = "verifying";
  try {
    const response = await request("/platform/operations/capacity/drills", {
      method: "POST",
      body: {
        kind: "archive_recovery",
        reason: "平台运维确认本轮单机容量收尾演练",
      },
      idempotencyKey: drillIdempotencyKey,
    });
    requestId.value = response.request_id;
    operationMessage.value = "归档与隔离恢复演练已签认。";
    drillIdempotencyKey = crypto.randomUUID();
    await load({ preserveOperationMessage: true });
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      operationMessage.value = error.actionHint;
      const next = status(error);
      if (["expired", "forbidden"].includes(next)) {
        data.value = null;
        state.value = next;
      } else if (!data.value) state.value = next;
    } else {
      operationMessage.value = "签认请求未完成，请保留当前容量快照后重试。";
      if (!data.value) state.value = "unavailable";
    }
  } finally {
    saving.value = false;
  }
}
onMounted(() => void load());
</script>
<template>
  <section class="capacity-boundary" :data-state="state">
    <header class="capacity-boundary__hero">
      <div>
        <p>单机实测容量边界</p>
        <h2>单机容量边界</h2>
        <span
          >只展示惠州当前单机实测结论；规划 100
          用户不等于并发承诺，不启用负载均衡、备用服务器或多节点。</span
        >
      </div>
      <div>
        <button type="button" :disabled="refreshing" :aria-busy="refreshing" @click="() => load()">
          {{ refreshing ? "刷新中…" : "刷新实测事实" }}</button
        ><button
          class="danger"
          type="button"
          :disabled="saving || refreshing"
          :aria-busy="saving"
          @click="confirming = true"
        >
          {{ saving ? "签认中…" : "签认恢复演练" }}
        </button>
      </div>
    </header>
    <section
      v-if="data && refreshFailure"
      class="capacity-boundary__notice"
      data-tone="warning"
      role="status"
    >
      <div>
        <b>{{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}</b>
        <p>{{ message || refreshFailureMessage }}</p>
      </div>
      <button type="button" :disabled="refreshing" @click="() => load()">重新核验</button>
    </section>
    <p
      v-if="data && operationMessage"
      class="capacity-boundary__operation-message"
      aria-live="polite"
    >
      {{ operationMessage }}
    </p>
    <section
      v-if="!['ready', 'warning', 'blocked'].includes(state)"
      class="capacity-boundary__state"
      aria-live="polite"
    >
      <i></i>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ message || verdict[1] }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <button
        v-if="!['loading', 'verifying'].includes(state)"
        type="button"
        :disabled="refreshing"
        @click="() => load()"
      >
        重新核验
      </button>
    </section>
    <template v-else-if="data"
      ><section class="capacity-boundary__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>{{
          data.boundary.capacity_claim === "measured_single_host_limited"
            ? "实测单机有限边界"
            : "容量未验证"
        }}</em>
      </section>
      <section class="capacity-boundary__metrics">
        <article>
          <span>最后通过并发档位</span><strong>{{ data.boundary.measured_concurrency }}</strong
          ><small>{{ boundaryHint }}</small>
        </article>
        <article>
          <span>95% 核心读取耗时</span><strong>{{ data.performance.read_p95_ms }} ms</strong
          ><small>停止线 300 毫秒</small>
        </article>
        <article>
          <span>95% 核心写入耗时</span><strong>{{ data.performance.write_p95_ms }} ms</strong
          ><small>停止线 600 毫秒</small>
        </article>
        <article>
          <span>错误率 / 异步滞后</span
          ><strong>{{ pct(data.performance.error_rate_basis_points) }}</strong
          ><small>{{ data.performance.async_lag_seconds }} 秒 · 停止线 60 秒</small>
        </article>
      </section>
      <div class="capacity-boundary__layout">
        <section class="capacity-boundary__panel">
          <header>
            <div>
              <p>资源水位</p>
              <h3>单机资源水位</h3>
            </div>
            <span>{{ time(data.observed_at) }}</span>
          </header>
          <div class="capacity-boundary__bars">
            <label
              ><span>归一化负载</span><b>{{ pct(data.resource.load_basis_points) }}</b
              ><progress :value="data.resource.load_basis_points" max="10000"></progress></label
            ><label
              ><span>可用内存</span><b>{{ data.resource.available_memory_mb }} MB</b
              ><progress
                :value="Math.min(data.resource.available_memory_mb, 8192)"
                max="8192"
              ></progress></label
            ><label
              ><span>可用磁盘</span><b>{{ data.resource.free_disk_mb }} MB</b
              ><progress
                :value="Math.min(data.resource.free_disk_mb, 262144)"
                max="262144"
              ></progress
            ></label>
          </div>
        </section>
        <aside class="capacity-boundary__panel">
          <header>
            <div>
              <p>降级策略</p>
              <h3>降载与恢复</h3>
            </div>
            <span>{{ data.degradation.mode }}</span>
          </header>
          <dl>
            <div>
              <dt>归档</dt>
              <dd>
                {{ data.resilience.archive_verified ? "已核验" : "未核验" }}
              </dd>
            </div>
            <div>
              <dt>隔离恢复</dt>
              <dd>
                {{ data.resilience.recovery_verified ? "已核验" : "未核验" }}
              </dd>
            </div>
            <div>
              <dt>后端接口拓扑</dt>
              <dd>单一 4101</dd>
            </div>
            <div>
              <dt>下一档</dt>
              <dd>{{ nextStageHint }}</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section class="capacity-boundary__panel capacity-boundary__findings">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>容量告警与处置手册动作</h3>
          </div>
          <span>{{ data.findings.length }} 项</span>
        </header>
        <div v-if="data.findings.length">
          <article
            v-for="(item, index) in data.findings"
            :key="item.code"
            :data-severity="item.severity"
          >
            <span>{{ String(index + 1).padStart(2, "0") }}</span>
            <div>
              <strong>{{ item.reason }}</strong>
              <small>责任人：{{ item.owner_label }}</small>
              <p>{{ item.action_hint }}</p>
              <details>
                <summary>技术详情</summary>
                <code>{{ item.code }} · {{ item.owner_role_code }}</code>
              </details>
            </div>
          </article>
        </div>
        <div v-else class="capacity-boundary__clear">
          <b>当前实测档位无阻断</b
          ><span
            >结论仅限本次惠州单机实测；不证明 100 人同时在线、多节点、高可用或 10,000
            用户能力。</span
          >
        </div>
      </section>
      <footer>
        <TechnicalDetails :request-id="requestId" /><span
          >未启用负载均衡 · 未配置备用服务器 · 未启用多节点</span
        ><strong>生产操作只允许通过宝塔</strong>
      </footer></template
    ><ConfirmDialog
      :open="confirming"
      title="签认归档与恢复演练？"
      description="服务端仅在同提交容量证据已证明归档与隔离恢复时允许签认。"
      impact="不会启动新服务、删除数据或改变并发上限；失败时保持未验证状态。"
      confirm-label="确认签认"
      confirmation-text="确认签认"
      @cancel="confirming = false"
      @confirm="attest"
    />
  </section>
</template>
