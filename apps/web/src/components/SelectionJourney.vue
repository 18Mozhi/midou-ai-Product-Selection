<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import { statusLabel } from "../ui/status-labels";
import { ApiClientError, createApiClient } from "../api-client";
import "../selection-journey.css";
import "../selection-journey-enhancements.css";
type Kind = "keyword" | "asin" | "product_url";
type JourneyState =
  "accepted" | "running" | "result_ready" | "succeeded_empty" | "blocked" | "failed" | "decided";
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
  results: Array<{
    raw_evidence_id: string;
    title: string | null;
    publisher: string | null;
    canonical_url: string;
    observed_at: string;
    topic_id: string | null;
  }>;
  first_result: Journey["results"][number] | null;
  blocked_reason: string | null;
  blocked_owner: string | null;
  blocked_next_step: string | null;
  timeline: Array<{
    stage: "queued" | "collecting" | "parsing" | "decision";
    status: "waiting" | "active" | "completed" | "blocked";
    occurred_at: string | null;
  }>;
  decision: null | {
    action: string;
    reason: string;
    selected_raw_evidence_id: string | null;
    created_at: string;
  };
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
  progressStorageKey = "scoutops.selection-journey.active-id",
  journeyIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  form = reactive<{ input_kind: Kind; input_value: string }>({
    input_kind: "keyword",
    input_value: "",
  }),
  decision = reactive({ action: "observe", reason: "" }),
  journey = ref<Journey | null>(null),
  state = ref<"ready" | "loading" | "error" | "expired" | "forbidden" | "blocked">("ready"),
  message = ref(""),
  requestId = ref(""),
  selectedResultId = ref(""),
  busy = ref(false);
let timer: number | undefined;
const terminal = computed(
    () =>
      journey.value &&
      ["result_ready", "succeeded_empty", "blocked", "failed", "decided"].includes(
        journey.value.state,
      ),
  ),
  seconds = computed(() => Math.ceil((journey.value?.elapsed_ms ?? 0) / 1000)),
  candidates = computed(() =>
    journey.value?.results?.length
      ? journey.value.results
      : journey.value?.first_result
        ? [journey.value.first_result]
        : [],
  ),
  selectedCandidate = computed(() =>
    candidates.value.find((candidate) => candidate.raw_evidence_id === selectedResultId.value),
  ),
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
    ({ queued: "已排队", collecting: "正在收集", parsing: "正在整理", decision: "等待决策" })[
      stage
    ],
  decisionLabel = (action: string) =>
    ({ adopt: "已采纳", observe: "继续观察", reject: "已驳回" })[action] ?? action;
function applyFailure(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    state.value =
      error.kind === "conflict" || error.kind === "rate_limited" ? "blocked" : error.kind;
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
  if (!terminal.value) timer = window.setTimeout(load, 2000);
}
function applyJourney(next: Journey) {
  journey.value = next;
  const available = next.results?.length
    ? next.results
    : next.first_result
      ? [next.first_result]
      : [];
  if (!available.some((candidate) => candidate.raw_evidence_id === selectedResultId.value))
    selectedResultId.value = available.length === 1 ? (available[0]?.raw_evidence_id ?? "") : "";
  if (next.state === "decided") localStorage.removeItem(progressStorageKey);
  else localStorage.setItem(progressStorageKey, next.id);
}
async function create() {
  busy.value = true;
  state.value = "loading";
  message.value = "";
  try {
    const result = await request<Journey>("/selection-journeys", { method: "POST", body: form });
    requestId.value = result.request_id;
    applyJourney(result.data);
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
    applyJourney(result.data);
    state.value = "ready";
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
    const result = await request<Journey>(`/selection-journeys/${journey.value.id}/decisions`, {
      method: "POST",
      body: {
        ...decision,
        selected_raw_evidence_id:
          decision.action === "adopt" ? selectedResultId.value || null : null,
      },
    });
    requestId.value = result.request_id;
    applyJourney(result.data);
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
  selectedResultId.value = "";
  localStorage.removeItem(progressStorageKey);
}
function handleStateSecondary() {
  if (state.value === "blocked") {
    message.value = journey.value
      ? "本次仅状态读取受阻；已创建的后台任务不会自动取消，也不会自动重复提交。"
      : "本次创建未获得服务端成功确认；页面未保存活动旅程，也不会自动重复提交。";
    return;
  }
  if (state.value === "forbidden") {
    message.value =
      "请联系组织管理员核对 task:create 与 opportunity:decide 能力；当前页面不会展示或写入受限数据。";
    return;
  }
  window.history.back();
}
async function resume() {
  const savedJourneyId = localStorage.getItem(progressStorageKey);
  if (!savedJourneyId) return;
  if (!journeyIdPattern.test(savedJourneyId)) {
    localStorage.removeItem(progressStorageKey);
    return;
  }
  state.value = "loading";
  try {
    const result = await request<Journey>(`/selection-journeys/${savedJourneyId}`);
    requestId.value = result.request_id;
    applyJourney(result.data);
    state.value = "ready";
    message.value = result.data.state === "decided" ? "" : "已恢复上次未完成的选品进度。";
    schedule();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      localStorage.removeItem(progressStorageKey);
      state.value = "ready";
      return;
    }
    applyFailure(error, "暂时无法恢复上次进度，请稍后重试。");
  }
}
onMounted(resume);
onUnmounted(stop);
</script>
<template>
  <section class="selection-journey" aria-label="选品旅程">
    <header>
      <div>
        <p>选品旅程</p>
        <h2>开始一次选品</h2>
        <span>输入商品线索后可离开页面，系统会保存进度并在回来时继续显示。</span>
      </div>
      <RouterLink to="/opportunities">返回机会列表</RouterLink>
    </header>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'loading'"
      :kind="state"
      :request-id="requestId"
      :action-hint="message"
      @primary="journey ? load() : reset()"
      @secondary="handleStateSecondary"
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
        <strong>任务会在后台继续</strong
        ><span>关闭或离开本页不会取消任务，返回后会自动恢复当前进度。</span>
      </aside>
      <button type="submit" :disabled="busy">
        {{ busy ? "正在创建真实任务…" : "创建真实选品任务" }}
      </button>
    </form>
    <template v-else
      ><section class="selection-status" :data-state="journey.state" aria-live="polite">
        <header>
          <div>
            <small>选品进度</small>
            <h3>{{ stateTitle }}</h3>
          </div>
          <strong>已进行 {{ seconds }} 秒</strong>
        </header>
        <ol class="selection-timeline" aria-label="选品处理时间轴">
          <li v-for="step in journey.timeline" :key="step.stage" :data-status="step.status">
            <i aria-hidden="true"></i>
            <span
              ><b>{{ stageLabel(step.stage) }}</b
              ><small>{{ statusLabel(step.status) }}</small></span
            >
            <time>{{
              step.occurred_at
                ? new Date(step.occurred_at).toLocaleString("zh-CN", { hour12: false })
                : "等待前序步骤"
            }}</time>
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
            <dt>候选结果</dt>
            <dd>{{ journey.available_result_count }} 条</dd>
          </div>
        </dl>
      </section>
      <section v-if="candidates.length" class="selection-candidates">
        <header>
          <div>
            <p>候选比较</p>
            <h3>比较 {{ candidates.length }} 条候选后再生成机会</h3>
          </div>
          <b>已选 {{ selectedResultId ? 1 : 0 }} 条</b>
        </header>
        <div class="selection-candidate-grid">
          <label
            v-for="(candidate, index) in candidates"
            :key="candidate.raw_evidence_id"
            :data-selected="selectedResultId === candidate.raw_evidence_id"
          >
            <input
              v-model="selectedResultId"
              type="radio"
              name="selection-candidate"
              :value="candidate.raw_evidence_id"
            />
            <span>
              <small>候选 {{ index + 1 }}</small>
              <strong>{{ candidate.title || "真实来源记录" }}</strong>
              <em
                >{{ candidate.publisher || "来源未提供发布者" }} ·
                {{ new Date(candidate.observed_at).toLocaleString() }}</em
              >
              <i v-if="!candidate.topic_id">暂不能生成机会，可继续观察</i>
            </span>
            <a :href="candidate.canonical_url" target="_blank" rel="noopener noreferrer" @click.stop
              >查看来源原文 ↗</a
            >
          </label>
        </div>
      </section>
      <article v-else-if="terminal" class="selection-evidence selection-evidence--empty">
        <header>
          <div>
            <p>明确终止状态</p>
            <h3>
              {{
                journey.task_status === "succeeded_empty"
                  ? "真实来源没有返回可用结果"
                  : "真实来源已明确受阻"
              }}
            </h3>
          </div>
          <b>{{ journey.task_status }}</b>
        </header>
        <p>
          错误码：{{ journey.blocked_reason || "none" }}。请结合任务状态与事件记录排查阻塞原因。
        </p>
        <dl v-if="journey.blocked_reason" class="selection-block-owner">
          <div>
            <dt>责任人</dt>
            <dd>{{ journey.blocked_owner || "采集负责人" }}</dd>
          </div>
          <div>
            <dt>下一步</dt>
            <dd>{{ journey.blocked_next_step || "查看失败根因后再处理。" }}</dd>
          </div>
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
              { value: 'adopt', label: '采纳并生成机会' },
              { value: 'observe', label: '继续观察' },
              { value: 'reject', label: '驳回' },
            ]"
            :key="item.value"
            :class="{
              disabled: item.value === 'adopt' && !selectedCandidate?.topic_id,
            }"
            ><input
              v-model="decision.action"
              type="radio"
              name="decision"
              :value="item.value"
              :disabled="item.value === 'adopt' && !selectedCandidate?.topic_id"
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
        <p>决策已保存 · {{ decisionLabel(journey.decision.action) }}</p>
        <h3>{{ journey.decision.reason }}</h3>
        <span>{{ new Date(journey.decision.created_at).toLocaleString() }}</span
        ><RouterLink v-if="journey.opportunity_id" :to="`/opportunities/${journey.opportunity_id}`"
          >查看机会、证据与决策历史 ↗</RouterLink
        >
        <RouterLink
          v-if="journey.verification_task_id"
          :to="`/tasks/${journey.verification_task_id}`"
          >打开自动生成的验证任务 ↗</RouterLink
        >
      </article>
      <footer class="selection-footer">
        <span v-if="message" role="status">{{ message }}</span
        ><code>关联编号 {{ requestId || journey.request_id }}</code
        ><button type="button" @click="reset">开始下一次</button>
      </footer></template
    >
  </section>
</template>
