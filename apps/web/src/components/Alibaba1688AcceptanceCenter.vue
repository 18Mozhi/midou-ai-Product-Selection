<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";

interface Acceptance {
  provider_id: string;
  source_status: "draft" | "disabled" | "enabled";
  owner_label: string;
  overall: "setup_required" | "ready_for_enable" | "production_ready";
  gates: Array<{
    key: "login" | "captcha" | "parser";
    state: "passed" | "blocked" | "pending";
    evidence_at: string | null;
    reason: string;
  }>;
  latest_run: {
    status: string;
    error_code: string | null;
    started_at: string;
    finished_at: string | null;
  } | null;
  coverage_matrix: {
    parser_version: string;
    observed_at: string | null;
    rows: Array<{
      key: "search" | "detail" | "pagination";
      contract: string;
      state: "covered" | "not_observed" | "not_exercised" | "invalid";
      observed_count: number;
      reason: string;
    }>;
  };
  pending_reasons: string[];
}

type ViewState = "loading" | "ready" | "error" | "forbidden" | "expired";
type NoticeTone = "success" | "danger";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading");
const data = ref<Acceptance | null>(null);
const message = ref("");
const requestId = ref("");
const refreshing = ref(false);
const lastUpdatedAt = ref<string | null>(null);
const notice = ref("");
const noticeTone = ref<NoticeTone>("success");
let activeController: AbortController | null = null;

const gateName = { login: "登录态", captcha: "验证码", parser: "字段解析" } as const;
const gateState = { passed: "已通过", blocked: "已阻断", pending: "待验收" } as const;
const gateAction = {
  login: "配置有效登录档案，并完成一次真实登录态运行。",
  captcha: "由同一次真实登录运行自动确认未被验证码阻断。",
  parser: "固定真实样本，完成当前解析器回放和第二人审批。",
} as const;
const matrixName = { search: "搜索结果", detail: "商品详情", pagination: "翻页覆盖" } as const;
const matrixState = {
  covered: "已覆盖",
  not_observed: "未观测",
  not_exercised: "未演练",
  invalid: "合同异常",
} as const;
const sourceState = { draft: "草稿", disabled: "已停用", enabled: "已启用" } as const;
const overallState = {
  setup_required: "尚未满足启用条件",
  ready_for_enable: "门禁已通过，等待负责人启用",
  production_ready: "生产验收已通过",
} as const;
const runState: Record<string, string> = {
  scheduled: "等待执行",
  leased: "已领取",
  running: "执行中",
  succeeded: "运行成功",
  succeeded_empty: "运行成功但无结果",
  failed: "运行失败",
  blocked: "运行受阻",
  cancelled: "已取消",
  dead_letter: "进入死信",
};
const passedGateCount = computed(
  () => data.value?.gates.filter((gate) => gate.state === "passed").length ?? 0,
);
const title = computed(() => (data.value ? overallState[data.value.overall] : "1688 验收事实"));
const conclusion = computed(() => {
  if (data.value?.overall === "production_ready")
    return "来源已经启用，仍应持续关注登录有效期、验证码和解析合同漂移。";
  if (data.value?.overall === "ready_for_enable")
    return "三道验收门均已通过；仍需由来源负责人显式启用，系统不会自动放行。";
  return "登录、验证码和字段解析必须全部通过；任一待验收或阻断都会保持来源停用。";
});
const stateTitle = computed(
  () =>
    ({
      loading: "正在读取真实验收事实",
      error: "验收服务暂不可用",
      forbidden: "当前账号无权读取验收事实",
      expired: "登录已失效",
      ready: "",
    })[state.value],
);
const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value
    ? new Date(lastUpdatedAt.value).toLocaleTimeString("zh-CN", { hour12: false })
    : "尚未完成读取",
);
const credentialsLink = computed(() =>
  data.value
    ? `/platform-admin/credentials?provider_id=${data.value.provider_id}&mode=login`
    : "/platform-admin/credentials",
);
const sampleLink = computed(() =>
  data.value
    ? `/platform-admin/providers/sources?provider_id=${data.value.provider_id}`
    : "/platform-admin/providers/sources",
);
const currentRunState = computed(() => {
  const status = data.value?.latest_run?.status;
  return status ? (runState[status] ?? status) : "尚无运行";
});
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无证据";

async function load() {
  if (refreshing.value) return;
  const preserve = data.value !== null;
  if (!preserve) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  notice.value = "";
  activeController = new AbortController();
  const timer = window.setTimeout(() => activeController?.abort(), 12_000);
  try {
    const response = await request<Acceptance>("/platform/provider-sources/1688-acceptance", {
      signal: activeController.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = "ready";
    lastUpdatedAt.value = new Date().toISOString();
    if (preserve) {
      noticeTone.value = "success";
      notice.value = "验收事实已刷新，页面结论来自最新一次真实数据库读取。";
    }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else {
      message.value = timedOut ? "读取超过 12 秒，请稍后重试。" : "网络连接异常，请稍后重试。";
    }
    if (preserve) {
      state.value = "ready";
      noticeTone.value = "danger";
      notice.value = timedOut
        ? "刷新超过 12 秒，已保留上一次成功读取的验收事实。"
        : `${message.value} 已保留上一次成功读取的验收事实。`;
    } else if (error instanceof ApiClientError) {
      state.value =
        error.kind === "expired" ? "expired" : error.kind === "forbidden" ? "forbidden" : "error";
    } else state.value = "error";
  } finally {
    window.clearTimeout(timer);
    activeController = null;
    refreshing.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => activeController?.abort());
</script>

<template>
  <section class="acceptance-1688" :data-state="state" :aria-busy="refreshing">
    <header class="acceptance-1688__hero">
      <div>
        <p>登录来源生产门禁</p>
        <h2>1688 生产启用验收</h2>
        <span>只展示真实浏览器运行、固定样本回放和审批结论，不展示 Cookie 或账号秘密。</span>
      </div>
      <div class="acceptance-1688__refresh">
        <small>最近读取 {{ lastUpdatedLabel }}</small>
        <button type="button" :disabled="refreshing" @click="load">
          {{ refreshing ? "刷新中…" : "刷新验收事实" }}
        </button>
      </div>
    </header>

    <p
      v-if="notice"
      class="acceptance-1688__notice"
      :data-tone="noticeTone"
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </p>

    <section v-if="state !== 'ready'" class="acceptance-1688__state" :data-kind="state">
      <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
      <div aria-live="polite">
        <p>验收事实</p>
        <h3>{{ stateTitle }}</h3>
        <p>{{ message || "正在核对登录、验证码和字段解析三项证据。" }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
      <RouterLink v-else-if="state === 'forbidden'" to="/platform-admin">返回平台概览</RouterLink>
      <button v-else-if="state !== 'loading'" type="button" :disabled="refreshing" @click="load">
        重新读取
      </button>
    </section>

    <template v-else-if="data">
      <section class="acceptance-1688__verdict" :data-overall="data.overall">
        <div class="acceptance-1688__verdict-copy">
          <span>当前结论</span>
          <h3>{{ title }}</h3>
          <p>{{ conclusion }}</p>
        </div>
        <dl>
          <div>
            <dt>来源状态</dt>
            <dd>{{ sourceState[data.source_status] }}</dd>
          </div>
          <div>
            <dt>通过门禁</dt>
            <dd>{{ passedGateCount }} / 3</dd>
          </div>
          <div>
            <dt>责任人</dt>
            <dd>{{ data.owner_label }}</dd>
          </div>
        </dl>
      </section>

      <section class="acceptance-1688__section" aria-labelledby="acceptance-1688-gates-title">
        <header>
          <div>
            <p>启用门禁</p>
            <h3 id="acceptance-1688-gates-title">三项必须逐项有证据</h3>
          </div>
          <small>全部通过仍需负责人显式启用</small>
        </header>
        <div class="acceptance-1688__gates" aria-label="1688 验收门">
          <article
            v-for="(gate, index) in data.gates"
            :key="gate.key"
            :data-gate-state="gate.state"
          >
            <div class="acceptance-1688__card-title">
              <span
                ><b>{{ index + 1 }}</b
                >{{ gateName[gate.key] }}</span
              >
              <strong>{{ gateState[gate.state] }}</strong>
            </div>
            <p>{{ gate.reason }}</p>
            <small>{{ gateAction[gate.key] }}</small>
            <time :datetime="gate.evidence_at || undefined"
              >证据时间：{{ time(gate.evidence_at) }}</time
            >
          </article>
        </div>
      </section>

      <section class="acceptance-1688__section" aria-labelledby="acceptance-1688-matrix-title">
        <header>
          <div>
            <p>真实作业覆盖</p>
            <h3 id="acceptance-1688-matrix-title">搜索、详情与翻页矩阵</h3>
          </div>
          <small
            >解析器 {{ data.coverage_matrix.parser_version }} ·
            {{ time(data.coverage_matrix.observed_at) }}</small
          >
        </header>
        <div class="acceptance-1688__matrix">
          <article
            v-for="row in data.coverage_matrix.rows"
            :key="row.key"
            :data-matrix-state="row.state"
          >
            <div class="acceptance-1688__card-title">
              <span>{{ matrixName[row.key] }}</span>
              <strong>{{ matrixState[row.state] }}</strong>
            </div>
            <p>{{ row.reason }}</p>
            <small>{{ row.contract }} · {{ row.observed_count }} 项</small>
          </article>
        </div>
      </section>

      <div class="acceptance-1688__operations">
        <section class="acceptance-1688__actions">
          <div>
            <p>下一步</p>
            <h3>{{ data.pending_reasons.length ? "按阻塞项逐项收口" : "门禁已全部通过" }}</h3>
          </div>
          <ol v-if="data.pending_reasons.length">
            <li v-for="reason in data.pending_reasons" :key="reason">{{ reason }}</li>
          </ol>
          <p v-else>当前没有待配置原因；由 {{ data.owner_label }} 复核后显式启用来源。</p>
          <nav aria-label="1688 验收下一步操作">
            <RouterLink :to="credentialsLink">配置或续期登录档案</RouterLink>
            <RouterLink :to="sampleLink">定位 1688 固定样本</RouterLink>
          </nav>
        </section>

        <section class="acceptance-1688__run">
          <div>
            <p>最近浏览器运行</p>
            <h3>{{ currentRunState }}</h3>
          </div>
          <dl v-if="data.latest_run">
            <div>
              <dt>开始</dt>
              <dd>{{ time(data.latest_run.started_at) }}</dd>
            </div>
            <div>
              <dt>完成</dt>
              <dd>{{ time(data.latest_run.finished_at) }}</dd>
            </div>
            <div>
              <dt>错误分类</dt>
              <dd>{{ data.latest_run.error_code || "无" }}</dd>
            </div>
          </dl>
          <p v-else>配置有效登录档案后，从真实业务采集任务发起一次 1688 浏览器运行。</p>
          <details>
            <summary>技术详情</summary>
            <code>overall {{ data.overall }}</code>
            <code>Provider UUID {{ data.provider_id }}</code>
            <code>request_id {{ requestId || "—" }}</code>
          </details>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.acceptance-1688 {
  display: grid;
  gap: 16px;
}
.acceptance-1688__hero,
.acceptance-1688__state,
.acceptance-1688__verdict,
.acceptance-1688__section,
.acceptance-1688__actions,
.acceptance-1688__run {
  border: 1px solid var(--so-border);
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
  border-radius: 14px;
}
.acceptance-1688__hero {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
  padding: 22px;
}
.acceptance-1688 p,
.acceptance-1688 h2,
.acceptance-1688 h3,
.acceptance-1688 dl {
  margin: 0;
}
.acceptance-1688 p,
.acceptance-1688 small,
.acceptance-1688 time {
  color: var(--so-text-muted);
}
.acceptance-1688 h2,
.acceptance-1688 h3 {
  margin-top: 5px;
}
.acceptance-1688__hero > div:first-child > p,
.acceptance-1688__section > header p,
.acceptance-1688__actions > div > p,
.acceptance-1688__run > div > p {
  color: var(--so-primary);
  font-size: 13px;
}
.acceptance-1688__refresh {
  display: grid;
  justify-items: end;
  gap: 8px;
  flex: 0 0 auto;
}
.acceptance-1688 button,
.acceptance-1688 a {
  min-height: 40px;
  border: 1px solid var(--so-primary-border);
  background: var(--so-primary-soft);
  color: var(--so-text);
  border-radius: 9px;
  padding: 9px 12px;
  text-decoration: none;
}
.acceptance-1688 button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.acceptance-1688 button:focus-visible,
.acceptance-1688 a:focus-visible,
.acceptance-1688 summary:focus-visible {
  outline: 3px solid var(--so-primary-soft);
  outline-offset: 2px;
}
.acceptance-1688__notice {
  padding: 11px 14px;
  border: 1px solid var(--so-success);
  border-radius: 10px;
  background: color-mix(in srgb, var(--so-success) 10%, var(--so-bg-elevated));
}
.acceptance-1688__notice[data-tone="danger"] {
  border-color: var(--so-danger);
  background: color-mix(in srgb, var(--so-danger) 10%, var(--so-bg-elevated));
}
.acceptance-1688__state {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.acceptance-1688__state > span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: var(--so-primary-soft);
  color: var(--so-primary);
  font-weight: 800;
}
.acceptance-1688__state code {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.acceptance-1688__verdict {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  padding: 20px;
  border-left: 4px solid var(--so-warning);
}
.acceptance-1688__verdict[data-overall="production_ready"],
.acceptance-1688__verdict[data-overall="ready_for_enable"] {
  border-left-color: var(--so-success);
}
.acceptance-1688__verdict-copy > span {
  color: var(--so-primary);
  font-size: 13px;
}
.acceptance-1688__verdict-copy p {
  margin-top: 7px;
  max-width: 760px;
}
.acceptance-1688__verdict dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(110px, auto));
  gap: 18px;
  align-content: center;
}
.acceptance-1688 dt {
  color: var(--so-text-muted);
  font-size: 13px;
}
.acceptance-1688 dd {
  margin: 4px 0 0;
  font-weight: 700;
}
.acceptance-1688__section {
  padding: 18px;
}
.acceptance-1688__section > header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 13px;
}
.acceptance-1688__gates,
.acceptance-1688__matrix {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.acceptance-1688__gates article,
.acceptance-1688__matrix article {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 15px;
  border: 1px solid var(--so-border);
  border-top: 3px solid var(--so-warning);
  border-radius: 10px;
}
.acceptance-1688__gates article[data-gate-state="passed"],
.acceptance-1688__matrix article[data-matrix-state="covered"] {
  border-top-color: var(--so-success);
}
.acceptance-1688__gates article[data-gate-state="blocked"],
.acceptance-1688__matrix article[data-matrix-state="invalid"] {
  border-top-color: var(--so-danger);
}
.acceptance-1688__card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.acceptance-1688__card-title > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.acceptance-1688__card-title b {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: var(--so-primary-soft);
  color: var(--so-primary);
}
.acceptance-1688__gates time,
.acceptance-1688__matrix small {
  display: block;
  margin-top: auto;
  font-size: 12px;
}
.acceptance-1688__operations {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.8fr);
  gap: 16px;
}
.acceptance-1688__actions,
.acceptance-1688__run {
  padding: 19px;
}
.acceptance-1688__actions ol {
  margin: 14px 0;
  padding-left: 22px;
}
.acceptance-1688__actions li + li {
  margin-top: 6px;
}
.acceptance-1688__actions nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.acceptance-1688__run dl {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.acceptance-1688__run > p {
  margin-top: 12px;
}
.acceptance-1688__run details {
  margin-top: 14px;
}
.acceptance-1688__run summary {
  cursor: pointer;
}
.acceptance-1688__run code {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
@media (max-width: 980px) {
  .acceptance-1688__verdict,
  .acceptance-1688__operations {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__verdict dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .acceptance-1688__hero,
  .acceptance-1688__section > header {
    align-items: stretch;
    flex-direction: column;
  }
  .acceptance-1688__refresh {
    justify-items: stretch;
  }
  .acceptance-1688__refresh small {
    text-align: left;
  }
  .acceptance-1688__state {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__verdict dl,
  .acceptance-1688__gates,
  .acceptance-1688__matrix {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__actions nav {
    display: grid;
  }
}
</style>
