<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { TrendDetail, TrendTopic, TrendTopicChangeRequest } from "./trend-workspace-types";

const props = defineProps<{
  topics: TrendTopic[];
  selected: TrendDetail | null;
  requests: TrendTopicChangeRequest[];
  busy: string;
}>();
const emit = defineEmits<{
  propose: [payload: Record<string, unknown>];
  decide: [
    payload: {
      requestId: string;
      decision: "confirm" | "reject";
      reason: string;
      expectedVersion: number;
    },
  ];
}>();

const operation = ref<"merge" | "split">("merge"),
  sourceIds = ref<string[]>([]),
  signalIds = ref<string[]>([]),
  newTitle = ref(""),
  newCategory = ref(""),
  reason = ref(""),
  decision = reactive({ requestId: "", action: "confirm" as "confirm" | "reject", reason: "" });

const mergeCandidates = computed(() =>
  props.topics.filter(
    (item) =>
      props.selected &&
      item.id !== props.selected.id &&
      item.status === "active" &&
      item.market === props.selected.market &&
      item.language === props.selected.language,
  ),
);
const pendingCount = computed(
  () => props.requests.filter((item) => item.status === "pending").length,
);

function submitProposal() {
  if (!props.selected || reason.value.trim().length < 2) return;
  const expectedVersions: Record<string, number> = { [props.selected.id]: props.selected.version };
  for (const id of sourceIds.value) {
    const topic = props.topics.find((item) => item.id === id);
    if (topic) expectedVersions[id] = topic.version;
  }
  emit("propose", {
    operation: operation.value,
    target_topic_id: props.selected.id,
    source_topic_ids: operation.value === "merge" ? sourceIds.value : [],
    signal_ids: operation.value === "split" ? signalIds.value : [],
    new_title: operation.value === "split" ? newTitle.value.trim() : null,
    new_category: operation.value === "split" ? newCategory.value.trim() || null : null,
    expected_versions: expectedVersions,
    reason: reason.value.trim(),
  });
}

function beginDecision(item: TrendTopicChangeRequest, action: "confirm" | "reject") {
  decision.requestId = item.id;
  decision.action = action;
  decision.reason = "";
}

function submitDecision(item: TrendTopicChangeRequest) {
  if (decision.reason.trim().length < 2) return;
  emit("decide", {
    requestId: item.id,
    decision: decision.action,
    reason: decision.reason.trim(),
    expectedVersion: item.version,
  });
}

function resetProposal() {
  sourceIds.value = [];
  signalIds.value = [];
  newTitle.value = "";
  newCategory.value = "";
  reason.value = "";
}

defineExpose({ resetProposal });
</script>

<template>
  <section class="trend-change-center">
    <header>
      <div>
        <p>主题治理</p>
        <h3>合并与拆分确认队列</h3>
        <span>提议人与确认人必须不同；确认前会再次校验主题版本和机会关联。</span>
      </div>
      <b>{{ pendingCount }} 项待确认</b>
    </header>

    <form class="trend-change-proposal" @submit.prevent="submitProposal">
      <fieldset>
        <legend>基于当前主题提出治理请求</legend>
        <strong>{{ selected?.title || "请先选择一个活动主题" }}</strong>
        <div class="trend-change-mode" role="group" aria-label="治理方式">
          <button type="button" :aria-pressed="operation === 'merge'" @click="operation = 'merge'">
            合并主题
          </button>
          <button type="button" :aria-pressed="operation === 'split'" @click="operation = 'split'">
            拆分主题
          </button>
        </div>
        <template v-if="operation === 'merge'">
          <p>选择并入当前主题的同市场、同语言主题。</p>
          <label v-for="item in mergeCandidates" :key="item.id" class="trend-change-check">
            <input v-model="sourceIds" type="checkbox" :value="item.id" />
            <span>{{ item.title }} · v{{ item.version }}</span>
          </label>
          <p v-if="!mergeCandidates.length">当前页没有可合并的同范围活动主题。</p>
        </template>
        <template v-else>
          <p>选择要移入新主题的具体证据；原主题至少保留一条证据。</p>
          <label v-for="item in selected?.evidence || []" :key="item.id" class="trend-change-check">
            <input v-model="signalIds" type="checkbox" :value="item.id" />
            <span>{{ item.title }} · {{ item.publisher }}</span>
          </label>
          <div class="trend-change-fields">
            <label>新主题名称<input v-model="newTitle" required maxlength="500" /></label>
            <label>新分类（可选）<input v-model="newCategory" maxlength="80" /></label>
          </div>
        </template>
        <label>
          提议原因
          <textarea v-model="reason" required minlength="2" maxlength="1000" rows="3"></textarea>
        </label>
        <button
          type="submit"
          :disabled="
            !selected ||
            Boolean(busy) ||
            reason.trim().length < 2 ||
            (operation === 'merge' ? !sourceIds.length : !signalIds.length || !newTitle.trim())
          "
        >
          提交确认队列
        </button>
      </fieldset>
    </form>

    <div class="trend-change-queue">
      <article v-for="item in requests" :key="item.id" :data-status="item.status">
        <header>
          <div>
            <small>{{ item.operation === "merge" ? "合并提议" : "拆分提议" }}</small>
            <h4>{{ item.target_topic.title }}</h4>
          </div>
          <b>{{
            item.status === "pending" ? "待确认" : item.status === "confirmed" ? "已确认" : "已驳回"
          }}</b>
        </header>
        <p v-if="item.operation === 'merge'">
          并入：{{ item.source_topics.map((topic) => topic.title).join("、") }}
        </p>
        <p v-else>新主题：{{ item.new_title }} · 移动 {{ item.signal_ids.length }} 条证据</p>
        <blockquote>{{ item.reason }}</blockquote>
        <small>提议人 {{ item.proposed_by.slice(0, 8) }}… · v{{ item.version }}</small>
        <template v-if="item.status === 'pending'">
          <footer>
            <button type="button" @click="beginDecision(item, 'reject')">驳回</button>
            <button type="button" @click="beginDecision(item, 'confirm')">确认执行</button>
          </footer>
          <form
            v-if="decision.requestId === item.id"
            class="trend-change-decision"
            @submit.prevent="submitDecision(item)"
          >
            <label>
              {{ decision.action === "confirm" ? "确认说明" : "驳回原因" }}
              <textarea
                v-model="decision.reason"
                required
                minlength="2"
                maxlength="1000"
              ></textarea>
            </label>
            <div>
              <button type="button" @click="decision.requestId = ''">取消</button>
              <button type="submit" :disabled="Boolean(busy) || decision.reason.trim().length < 2">
                提交{{ decision.action === "confirm" ? "确认" : "驳回" }}
              </button>
            </div>
          </form>
        </template>
        <p v-else-if="item.decision_reason">处理说明：{{ item.decision_reason }}</p>
      </article>
      <p v-if="!requests.length" class="trend-change-empty">确认队列为空。</p>
    </div>
  </section>
</template>

<style scoped>
.trend-change-center,
.trend-change-proposal fieldset,
.trend-change-queue,
.trend-change-queue article,
.trend-change-decision {
  display: grid;
  gap: 14px;
}
.trend-change-center > header,
.trend-change-queue article > header,
.trend-change-queue article > footer,
.trend-change-mode,
.trend-change-decision > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.trend-change-center > header,
.trend-change-proposal,
.trend-change-queue article {
  padding: 18px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-bg-elevated);
}
.trend-change-center h3,
.trend-change-center h4,
.trend-change-center p,
.trend-change-center blockquote {
  margin: 0;
}
.trend-change-proposal fieldset {
  padding: 0;
  border: 0;
}
.trend-change-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: 9px;
  background: var(--so-panel-soft);
}
.trend-change-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.trend-change-proposal label:not(.trend-change-check),
.trend-change-decision label {
  display: grid;
  gap: 6px;
}
.trend-change-queue article[data-status="pending"] {
  border-left: 4px solid var(--so-warning);
}
.trend-change-queue blockquote {
  padding: 10px 12px;
  border-left: 3px solid var(--so-border-strong);
  color: var(--so-text-muted);
}
.trend-change-empty {
  padding: 28px;
  text-align: center;
  color: var(--so-text-muted);
}
@media (max-width: 760px) {
  .trend-change-center > header,
  .trend-change-queue article > header,
  .trend-change-fields {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
