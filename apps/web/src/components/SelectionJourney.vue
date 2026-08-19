<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import { statusLabel } from "../ui/status-labels";
import { ApiClientError, createApiClient } from "../api-client";
import "../selection-journey.css";
import "../selection-journey-enhancements.css";
type Kind = "keyword" | "asin" | "product_url";
type JourneyState =
  | "accepted"
  | "running"
  | "result_ready"
  | "succeeded_empty"
  | "blocked"
  | "failed"
  | "decided";
interface Journey {
  id: string;
  input_kind: Kind;
  input_value: string;
  provider_code: string;
  task_id: string;
  task_status: string;
  state: JourneyState;
  coverage_status: string | null;
  available_result_count: number;
  first_result: null | {
    raw_evidence_id: string;
    title: string | null;
    publisher: string | null;
    canonical_url: string;
    observed_at: string;
    topic_id: string | null;
  };
  blocked_reason: string | null;
  blocked_owner: string | null;
  blocked_next_step: string | null;
  timeline: Array<{
    stage: "queued" | "collecting" | "parsing" | "decision";
    status: "waiting" | "active" | "completed" | "blocked";
    occurred_at: string | null;
  }>;
  decision: null | { action: string; reason: string; created_at: string };
  opportunity_id: string | null;
  verification_task_id: string | null;
  accepted_at: string;
  terminal_at: string | null;
  decided_at: string | null;
  elapsed_ms: number;
  deadline_ms: 180000;
  within_deadline: boolean;
  request_id: string;
  trace_id: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  form = reactive<{ input_kind: Kind; input_value: string }>({
    input_kind: "keyword",
    input_value: "",
  }),
  decision = reactive({ action: "observe", reason: "" }),
  journey = ref<Journey | null>(null),
  state = ref<
    "ready" | "loading" | "error" | "expired" | "forbidden" | "blocked"
  >("ready"),
  message = ref(""),
  requestId = ref(""),
  busy = ref(false);
let timer: number | undefined,
  startedAt = 0;
const terminal = computed(
    () =>
      journey.value &&
      [
        "result_ready",
        "succeeded_empty",
        "blocked",
        "failed",
        "decided",
      ].includes(journey.value.state),
  ),
  seconds = computed(() => Math.ceil((journey.value?.elapsed_ms ?? 0) / 1000)),
  stateTitle = computed(
    () =>
      ({
        accepted: "任务已接收",
        running: "真实来源处理中",
        result_ready: "首个可验证结果已到达",
        succeeded_empty: "真实来源返回空结果",
        blocked: "来源明确受阻",
        failed: "任务终止失败",
        decided: "旅程已完成决策",
      })[journey.value?.state ?? "accepted"],
  ),
  stageLabel = (stage: Journey["timeline"][number]["stage"]) =>
    ({ queued: "排队", collecting: "采集", parsing: "解析", decision: "决策" })[stage];
function applyFailure(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    state.value = error.kind === "conflict" || error.kind === "rate_limited" ? "blocked" : error.kind;
    requestId.value = error.requestId;
    message.value = error.actionHint;
  } else {
    state.value = "blocked";
    message.value = fallback;
  }
}
function stop() {
  if (timer) window.clearTimeout(timer);
  timer = undefined;
}
function schedule() {
  stop();
  if (!terminal.value && Date.now() - startedAt <= 180000)
    timer = window.setTimeout(load, 2000);
}
async function create() {
  busy.value = true;
  state.value = "loading";
  message.value = "";
  startedAt = Date.now();
  try {
    const result = await request<Journey>("/selection-journeys", { method: "POST", body: form });
    requestId.value = result.request_id;
    journey.value = result.data;
    state.value = "ready";
    schedule();
  } catch (error) {
    applyFailure(error, "依赖不可用，真实任务未创建。");
  } finally {
    busy.value = false;
  }
}
async function load() {
  if (!journey.value) return;
  try {
    const result = await request<Journey>(`/selection-journeys/${journey.value.id}`);
    requestId.value = result.request_id;
    journey.value = result.data;
    state.value = "ready";
    if (Date.now() - startedAt > 180000 && !terminal.value)
      message.value =
        "已超过 180 秒生产验收阈值；任务仍保留，当前验收判定为阻断。";
    schedule();
  } catch (error) {
    applyFailure(error, "状态连接中断；任务不会因页面关闭而取消。");
  }
}
async function decide() {
  if (!journey.value) return;
  busy.value = true;
  message.value = "";
  try {
    const result = await request<Journey>(`/selection-journeys/${journey.value.id}/decisions`, { method: "POST", body: decision });
    requestId.value = result.request_id;
    journey.value = result.data;
    decision.reason = "";
    stop();
  } catch (error) {
    applyFailure(error, "依赖不可用，决策未写入。");
  } finally {
    busy.value = false;
  }
}
function reset() {
  stop();
  journey.value = null;
  state.value = "ready";
  message.value = "";
  form.input_value = "";
}
onUnmounted(stop);
</script>
<template>
  <section
    class="selection-journey"
    aria-label="真实选品验收，桌面与 390px 移动布局"
  >
    <header>
      <div>
        <p>真实选品</p>
        <h2>开始一次真实选品</h2>
        <span>成员直接输入，系统选择已启用真实来源；不需要进入来源 配置。</span>
      </div>
      <a href="/opportunities">返回机会列表</a>
    </header>
    <UiStatePanel
      v-if="!['ready', 'loading'].includes(state)"
      :kind="state"
      :request-id="requestId"
      :action-hint="message"
      @primary="journey ? load() : reset()"
    />
    <form v-if="!journey" class="selection-start" @submit.prevent="create">
      <div class="selection-kind" role="radiogroup" aria-label="输入类型">
        <label
          v-for="item in [
            { value: 'keyword', label: '关键词' },
            { value: 'asin', label: 'ASIN' },
            { value: 'product_url', label: '商品链接' },
          ]"
          :key="item.value"
          ><input
            v-model="form.input_kind"
            type="radio"
            name="input-kind"
            :value="item.value"
          /><span>{{ item.label }}</span></label
        >
      </div>
      <label class="selection-input"
        ><span>{{
          form.input_kind === "keyword"
            ? "商品关键词"
            : form.input_kind === "asin"
              ? "10 位 ASIN"
              : "HTTPS 商品链接"
        }}</span
        ><input
          v-model="form.input_value"
          required
          maxlength="200"
          :pattern="form.input_kind === 'asin' ? '[A-Za-z0-9]{10}' : undefined"
          :type="form.input_kind === 'product_url' ? 'url' : 'text'"
          :placeholder="
            form.input_kind === 'keyword'
              ? '例如 portable blender'
              : form.input_kind === 'asin'
                ? '例如 B0XXXXXXXX'
                : 'https://…'
          "
      /></label>
      <aside>
        <strong>验收时钟</strong
        ><span
          >95% 的任务创建在 3 秒内完成 · 15 秒内显示已接收/排队 · 180
          秒内出现首个真实结果、succeeded_empty 或明确受阻状态。</span
        >
      </aside>
      <button type="submit" :disabled="busy">
        {{ busy ? "正在创建真实任务…" : "创建真实选品任务" }}
      </button>
    </form>
    <template v-else
      ><section
        class="selection-status"
        :data-state="journey.state"
        aria-live="polite"
      >
        <header>
          <div>
            <small
              >{{ journey.state.toUpperCase() }} ·
              {{ journey.task_status }}</small
            >
            <h3>{{ stateTitle }}</h3>
          </div>
          <strong>{{ seconds }} 秒 / 180 秒</strong>
        </header>
        <div class="selection-progress">
          <i
            :style="{
              width: `${Math.min(100, (journey.elapsed_ms / 180000) * 100)}%`,
            }"
          ></i>
        </div>
        <ol class="selection-timeline" aria-label="选品处理时间轴">
          <li
            v-for="step in journey.timeline"
            :key="step.stage"
            :data-status="step.status"
          >
            <i aria-hidden="true"></i>
            <span><b>{{ stageLabel(step.stage) }}</b><small>{{ statusLabel(step.status) }}</small></span>
            <time>{{ step.occurred_at ? new Date(step.occurred_at).toLocaleString('zh-CN', { hour12: false }) : '等待前序步骤' }}</time>
          </li>
        </ol>
        <dl>
          <div>
            <dt>输入</dt>
            <dd>{{ journey.input_kind }} · {{ journey.input_value }}</dd>
          </div>
          <div>
            <dt>真实来源</dt>
            <dd>{{ journey.provider_code }}</dd>
          </div>
          <div>
            <dt>任务</dt>
            <dd>{{ journey.task_id.slice(0, 8) }}…</dd>
          </div>
          <div>
            <dt>覆盖 / 结果</dt>
            <dd>
              {{ journey.coverage_status ?? "等待中" }} ·
              {{ journey.available_result_count }} 条
            </dd>
          </div>
        </dl>
      </section>
      <article v-if="journey.first_result" class="selection-evidence">
        <header>
          <div>
            <p>首个可核验结果</p>
            <h3>{{ journey.first_result.title || "真实来源记录" }}</h3>
          </div>
          <b>真实来源</b>
        </header>
        <p>
          {{ journey.first_result.publisher || "来源未提供发布者" }} ·
          {{ new Date(journey.first_result.observed_at).toLocaleString() }}
        </p>
        <code>证据 {{ journey.first_result.raw_evidence_id }}</code
        ><a
          :href="journey.first_result.canonical_url"
          target="_blank"
          rel="noopener noreferrer"
          >查看来源原文 ↗</a
        >
      </article>
      <article
        v-else-if="terminal"
        class="selection-evidence selection-evidence--empty"
      >
        <header>
          <div>
            <p>明确终止状态</p>
            <h3>
              {{
                journey.state === "succeeded_empty"
                  ? "真实来源没有返回可用结果"
                  : "真实来源已明确受阻"
              }}
            </h3>
          </div>
          <b>{{ journey.task_status }}</b>
        </header>
        <p>
          错误码：{{
            journey.blocked_reason || "none"
          }}。没有演示数据替代真实结果，任务状态和事件仍作为验收证据。
        </p>
        <dl v-if="journey.blocked_reason" class="selection-block-owner">
          <div><dt>责任人</dt><dd>{{ journey.blocked_owner || "采集负责人" }}</dd></div>
          <div><dt>下一步</dt><dd>{{ journey.blocked_next_step || "查看失败根因后再处理。" }}</dd></div>
        </dl>
      </article>
      <form
        v-if="terminal && journey.state !== 'decided'"
        class="selection-decision"
        @submit.prevent="decide"
      >
        <header>
          <div>
            <p>留痕决策</p>
            <h3>对本次真实结果作出决策</h3>
          </div>
          <span>决策不会改写原始证据</span>
        </header>
        <div class="selection-actions">
          <label
            v-for="item in [
              { value: 'adopt', label: '采纳' },
              { value: 'observe', label: '继续观察' },
              { value: 'reject', label: '驳回' },
            ]"
            :key="item.value"
            :class="{
              disabled:
                item.value === 'adopt' && !journey.first_result?.topic_id,
            }"
            ><input
              v-model="decision.action"
              type="radio"
              name="decision"
              :value="item.value"
              :disabled="
                item.value === 'adopt' && !journey.first_result?.topic_id
              "
            /><span>{{ item.label }}</span></label
          >
        </div>
        <label
          >决策原因<textarea
            v-model="decision.reason"
            required
            maxlength="1000"
            rows="4"
          ></textarea></label
        ><button type="submit" :disabled="busy">
          {{ busy ? "正在保存…" : "保存审计决策" }}
        </button>
      </form>
      <article v-if="journey.decision" class="selection-complete">
        <p>DECIDED · {{ journey.decision.action }}</p>
        <h3>{{ journey.decision.reason }}</h3>
        <span
          >{{ new Date(journey.decision.created_at).toLocaleString() }} ·
          {{
            journey.within_deadline ? "在 180 秒阈值内" : "超过 180 秒阈值"
          }}</span
        ><a
          v-if="journey.opportunity_id"
          :href="`/opportunities/${journey.opportunity_id}`"
          >查看机会、证据与决策历史 ↗</a
        >
        <a v-if="journey.verification_task_id" :href="`/tasks?task=${journey.verification_task_id}`">打开自动生成的验证任务 ↗</a>
      </article>
      <footer class="selection-footer">
        <span v-if="message" role="status">{{ message }}</span
        ><code>关联编号 {{ requestId || journey.request_id }}</code
        ><button type="button" @click="reset">开始下一次</button>
      </footer></template
    >
  </section>
</template>
