<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
  pending_reasons: string[];
}
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<"loading" | "ready" | "error" | "forbidden" | "expired">("loading"),
  data = ref<Acceptance | null>(null),
  message = ref(""),
  requestId = ref("");
const title = computed(() =>
  data.value?.overall === "production_ready"
    ? "1688 来源已通过生产验收"
    : data.value?.overall === "ready_for_enable"
      ? "验收已通过，等待负责人启用"
      : "1688 来源仍需完成验收",
);
const gateName = { login: "登录态", captcha: "验证码", parser: "字段解析" } as const;
const gateState = { passed: "已通过", blocked: "已阻断", pending: "待验收" } as const;
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无证据";
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await request<Acceptance>("/platform/provider-sources/1688-acceptance");
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = "ready";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value =
        error.kind === "expired" ? "expired" : error.kind === "forbidden" ? "forbidden" : "error";
    } else state.value = "error";
  }
}
onMounted(load);
</script>

<template>
  <section class="acceptance-1688" :data-state="state">
    <header>
      <div>
        <p>登录来源验收</p>
        <h2>1688 登录态与验证码</h2>
        <span
          >使用真实浏览器档案、真实运行结果和当前解析器固定样本判定；不展示 Cookie
          或账号秘密。</span
        >
      </div>
      <button type="button" @click="load">刷新验收事实</button>
    </header>
    <section v-if="state !== 'ready'" class="acceptance-1688__state" aria-live="polite">
      <b>{{ state === "loading" ? "正在核对三项验收证据" : "验收事实暂不可用" }}</b>
      <p>{{ message || "请稍后重试。" }}</p>
      <code v-if="requestId">request_id {{ requestId }}</code>
    </section>
    <template v-else-if="data">
      <section class="acceptance-1688__verdict" :data-overall="data.overall">
        <div>
          <small>{{ data.overall }}</small
          ><strong>{{ title }}</strong>
        </div>
        <dl>
          <div>
            <dt>当前来源状态</dt>
            <dd>{{ data.source_status === "enabled" ? "已启用" : "待配置" }}</dd>
          </div>
          <div>
            <dt>责任人</dt>
            <dd>{{ data.owner_label }}</dd>
          </div>
        </dl>
      </section>
      <section class="acceptance-1688__gates" aria-label="1688 验收门">
        <article v-for="gate in data.gates" :key="gate.key" :data-gate-state="gate.state">
          <div>
            <span>{{ gateName[gate.key] }}</span
            ><strong>{{ gateState[gate.state] }}</strong>
          </div>
          <p>{{ gate.reason }}</p>
          <small>证据时间：{{ time(gate.evidence_at) }}</small>
        </article>
      </section>
      <section v-if="data.pending_reasons.length" class="acceptance-1688__actions">
        <div>
          <p>待配置原因</p>
          <h3>由 {{ data.owner_label }} 逐项收口</h3>
        </div>
        <ol>
          <li v-for="reason in data.pending_reasons" :key="reason">{{ reason }}</li>
        </ol>
        <nav>
          <RouterLink :to="`/platform-admin/credentials?provider_id=${data.provider_id}&mode=login`"
            >配置或续期登录档案</RouterLink
          ><RouterLink to="/platform-admin/providers/sources">进入固定样本回放</RouterLink>
        </nav>
      </section>
      <section class="acceptance-1688__run">
        <div>
          <p>最近浏览器运行</p>
          <h3>{{ data.latest_run ? data.latest_run.status : "尚无运行" }}</h3>
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
            <dt>错误</dt>
            <dd>{{ data.latest_run.error_code || "无" }}</dd>
          </div>
        </dl>
        <p v-else>先配置有效登录档案，再从业务采集任务发起一次真实 1688 浏览器运行。</p>
        <details>
          <summary>技术详情</summary>
          <code>Provider UUID {{ data.provider_id }}</code
          ><code>request_id {{ requestId || "—" }}</code>
        </details>
      </section>
    </template>
  </section>
</template>

<style scoped>
.acceptance-1688 {
  display: grid;
  gap: 16px;
}
.acceptance-1688 > header,
.acceptance-1688__state,
.acceptance-1688__verdict,
.acceptance-1688__gates article,
.acceptance-1688__actions,
.acceptance-1688__run {
  border: 1px solid var(--so-border);
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
  border-radius: 14px;
}
.acceptance-1688 > header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 22px;
}
.acceptance-1688 p {
  margin: 0;
  color: var(--so-text-muted);
}
.acceptance-1688 h2,
.acceptance-1688 h3 {
  margin: 5px 0;
}
.acceptance-1688 > header > div > p,
.acceptance-1688__actions > div > p,
.acceptance-1688__run > div > p {
  color: var(--so-primary);
  font-size: 12px;
}
.acceptance-1688 button,
.acceptance-1688 a {
  border: 1px solid var(--so-primary-border);
  background: var(--so-primary-soft);
  color: var(--so-text);
  border-radius: 9px;
  padding: 9px 12px;
  text-decoration: none;
}
.acceptance-1688__state {
  padding: 20px;
}
.acceptance-1688__state p {
  margin: 6px 0;
}
.acceptance-1688__verdict {
  display: flex;
  justify-content: space-between;
  padding: 18px;
  border-left: 4px solid var(--so-warning);
}
.acceptance-1688__verdict[data-overall="production_ready"],
.acceptance-1688__verdict[data-overall="ready_for_enable"] {
  border-left-color: var(--so-success);
}
.acceptance-1688__verdict div {
  display: grid;
}
.acceptance-1688__verdict dl,
.acceptance-1688__run dl {
  display: flex;
  gap: 20px;
  margin: 0;
}
.acceptance-1688 dt {
  font-size: 12px;
  color: var(--so-text-muted);
}
.acceptance-1688 dd {
  margin: 4px 0 0;
}
.acceptance-1688__gates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.acceptance-1688__gates article {
  padding: 16px;
  border-top: 3px solid var(--so-warning);
}
.acceptance-1688__gates article[data-gate-state="passed"] {
  border-top-color: var(--so-success);
}
.acceptance-1688__gates article[data-gate-state="blocked"] {
  border-top-color: var(--so-danger);
}
.acceptance-1688__gates article > div {
  display: flex;
  justify-content: space-between;
}
.acceptance-1688__gates p {
  margin: 12px 0;
}
.acceptance-1688__gates small {
  color: var(--so-text-muted);
}
.acceptance-1688__actions,
.acceptance-1688__run {
  padding: 19px;
}
.acceptance-1688__actions nav {
  display: flex;
  gap: 8px;
}
.acceptance-1688__run details {
  margin-top: 14px;
}
.acceptance-1688__run code {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .acceptance-1688 > header,
  .acceptance-1688__verdict {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }
  .acceptance-1688__gates {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__verdict dl,
  .acceptance-1688__run dl,
  .acceptance-1688__actions nav {
    display: grid;
  }
  .acceptance-1688 > header button {
    width: 100%;
  }
}
</style>
