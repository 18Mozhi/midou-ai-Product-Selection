<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { FileResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import TechnicalDetails from "./TechnicalDetails.vue";
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
const percent = (value: number) => `${(value / 100).toFixed(1)}%`;
const rootLabel = (kind: "evidence" | "export" | "temp") =>
  ({ evidence: "证据目录", export: "导出目录", temp: "临时目录" })[kind];
const rootPurpose = (kind: "evidence" | "export" | "temp") =>
  ({ evidence: "不可变证据", export: "限时导出", temp: "运行临时文件" })[kind];
const bytes = (value: number) =>
  value >= 1099511627776
    ? `${(value / 1099511627776).toFixed(2)} TiB`
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
const time = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
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
  <section class="file-resilience" :data-state="state">
    <header class="file-resilience__hero">
      <div>
        <p>本机受管存储</p>
        <h2>本机文件韧性</h2>
        <span
          >证据、导出与临时文件只写入惠州当前主机的宝塔受控目录；不使用共享存储或备用服务器。</span
        >
      </div>
      <button type="button" :disabled="refreshing" :aria-busy="refreshing" @click="load">
        {{ refreshing ? "正在刷新…" : "刷新文件事实" }}
      </button>
    </header>
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
      <i></i>
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
      <strong>!</strong>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
      ><button v-else type="button" :disabled="refreshing" @click="load">重新核验</button>
    </section>
    <template v-else-if="data">
      <section class="file-resilience__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>本机目录 · 状态已核对</em>
      </section>
      <section class="file-resilience__metrics">
        <article v-for="root in data.directories" :key="root.kind">
          <span>{{ rootLabel(root.kind) }}</span
          ><strong>{{ percent(root.usage_basis_points) }}</strong
          ><small>
            {{ bytes(root.used_bytes) }} / {{ bytes(root.total_bytes) }} ·
            {{ root.kind === "temp" ? "不建立持久索引" : `${root.active_files} 个活动文件` }}
          </small>
        </article>
        <article>
          <span>校验和</span
          ><strong>{{ data.integrity.verified_files }} / {{ data.integrity.sampled_files }}</strong
          ><small
            >不一致 {{ data.integrity.mismatch_files }} · 缺失
            {{ data.integrity.missing_files }}</small
          >
        </article>
        <article>
          <span>恢复演练</span><strong>{{ data.recovery.status }}</strong
          ><small>{{ data.recovery.drill_age_days ?? "—" }} 天 · 同机加密副本</small>
        </article>
      </section>
      <div class="file-resilience__layout">
        <section class="file-resilience__panel">
          <header>
            <div>
              <p>目录状态</p>
              <h3>宝塔受控目录</h3>
            </div>
            <span>组织 / 工作区隔离</span>
          </header>
          <div class="file-resilience__roots">
            <article v-for="root in data.directories" :key="root.kind">
              <div>
                <b>{{ rootPurpose(root.kind) }}</b
                ><span>{{ root.available && root.writable ? "可读写" : "不可用" }}</span>
              </div>
              <progress :value="root.usage_basis_points" max="10000"></progress>
              <dl>
                <div>
                  <dt>索引体积</dt>
                  <dd>{{ bytes(root.indexed_bytes) }}</dd>
                </div>
                <div>
                  <dt>公网访问</dt>
                  <dd>
                    {{ data.public_access_enabled ? "已启用" : "已禁用" }}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
        <aside class="file-resilience__panel">
          <header>
            <div>
              <p>恢复能力</p>
              <h3>同机恢复边界</h3>
            </div>
          </header>
          <dl class="file-resilience__facts">
            <div>
              <dt>加密恢复副本</dt>
              <dd>
                {{ data.recovery.encrypted_same_host_copy ? "已核验" : "未核验" }}
              </dd>
            </div>
            <div>
              <dt>隔离恢复</dt>
              <dd>
                {{ data.recovery.isolated_restore_verified ? "已核验" : "未核验" }}
              </dd>
            </div>
            <div>
              <dt>共享存储</dt>
              <dd>{{ data.shared_storage_enabled ? "已启用" : "未启用" }}</dd>
            </div>
            <div>
              <dt>备用服务器</dt>
              <dd>{{ data.backup_server_used ? "已启用" : "未启用" }}</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section class="file-resilience__panel file-resilience__findings">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>完整性与恢复告警</h3>
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
        <div v-else class="file-resilience__clear">
          <b>当前无本机文件韧性阻断</b
          ><span>证据、导出、临时目录、校验和与同机恢复功能均可正常使用。</span>
        </div>
      </section>
      <footer class="file-resilience__footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><TechnicalDetails :request-id="requestId" /><strong
          >目录、备份、恢复与清理只允许通过宝塔</strong
        >
      </footer>
    </template>
  </section>
</template>
