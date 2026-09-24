<script setup lang="ts">
import { computed, ref } from "vue";
import ProviderParserSampleReview from "./ProviderParserSampleReview.vue";
import { useProviderSourceDialogFocus } from "./useProviderSourceDialogFocus";

interface ParserSample {
  id: string;
  name: string;
  baseline_parser_version: string;
  last_replay_status: "never" | "passed" | "changed" | "failed";
  last_replay_at: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  review_version: number;
  created_by: string;
  can_review: boolean;
  created_at: string;
}

interface ParserSampleCandidate {
  browser_job_id: string;
  captured_at: string;
  item_count: number;
  parser_version: string;
}

interface ParserSampleReplay {
  status: "passed" | "changed" | "failed";
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  error_code: string | null;
}

const props = defineProps<{
  sourceName: string;
  loading: boolean;
  loaded: boolean;
  readError: string;
  readRequestId: string;
  samples: ParserSample[];
  candidates: ParserSampleCandidate[];
  latestReplay: ParserSampleReplay | null;
  savingCandidateId: string | null;
  replayingSampleId: string | null;
  reviewingSampleId: string | null;
  message: string;
  requestId: string;
}>();

const emit = defineEmits<{
  close: [];
  create: [candidate: ParserSampleCandidate];
  replay: [sample: ParserSample];
  review: [sample: ParserSample, decision: "approved" | "rejected", reason: string];
  retry: [];
}>();

const sampleDialog = ref<HTMLElement | null>(null);
const sampleTitle = ref<HTMLElement | null>(null);
const busy = computed(
  () =>
    props.savingCandidateId !== null ||
    props.replayingSampleId !== null ||
    props.reviewingSampleId !== null,
);
const dialogFocus = useProviderSourceDialogFocus(
  () => true,
  sampleDialog,
  sampleTitle,
  () => {
    if (!busy.value) emit("close");
  },
);

const replayText = (value: ParserSample["last_replay_status"] | ParserSampleReplay["status"]) =>
  ({ never: "尚未回放", passed: "一致通过", changed: "发现差异", failed: "解析失败" })[value];
const reviewText = (value: ParserSample["review_status"]) =>
  ({ pending: "待另一管理员审批", approved: "审批通过", rejected: "已驳回" })[value];

const displayValue = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text == null ? "未提供" : text.length > 240 ? `${text.slice(0, 240)}…` : text;
};
</script>

<template>
  <div
    ref="sampleDialog"
    class="source-modal p48-parser-samples-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="parser-sample-title"
    @keydown="dialogFocus.onKeydown"
  >
    <section class="parser-sample-panel p48-parser-samples-panel" :aria-busy="loading || busy">
      <header class="p48-parser-samples-identity">
        <div>
          <p>来源采集 / 固定样本与独立复核</p>
          <h3 id="parser-sample-title" ref="sampleTitle" tabindex="-1">
            固定样本回放 · {{ sourceName }}
          </h3>
          <p>回放只使用已保存的真实作业快照，不会重新访问外部页面。</p>
        </div>
        <button
          type="button"
          aria-label="关闭固定样本回放"
          :disabled="busy"
          @click="!busy && emit('close')"
        >
          ×
        </button>
      </header>
      <section class="p48-parser-samples-gates" aria-label="来源启用前的固定样本检查">
        <p>启用前需完成三项核对</p>
        <ol>
          <li>保存真实浏览器作业</li>
          <li>当前解析器回放一致</li>
          <li>另一位管理员完成复核</li>
        </ol>
      </section>
      <div class="p48-parser-samples-body">
        <section
          v-if="message"
          class="p48-parser-samples-feedback"
          role="status"
          aria-live="polite"
        >
          <strong>本次样本操作结果</strong>
          <p>{{ message }}</p>
          <details v-if="requestId">
            <summary>技术详情</summary>
            <code>{{ requestId }}</code>
          </details>
        </section>
        <div v-if="loading && !loaded" class="source-state">正在读取固定样本…</div>
        <template v-else>
          <section v-if="loading && loaded" class="p48-parser-samples-refreshing" role="status">
            正在刷新列表；仍显示上次成功读取的样本。
          </section>
          <section v-if="readError" class="p48-parser-samples-read-error" role="alert">
            <strong>最新样本列表暂未更新</strong>
            <p>
              {{ readError }} 已保留上次成功读取的样本；可以只重新读取，不会重复提交刚才的操作。
            </p>
            <details v-if="readRequestId">
              <summary>读取追踪</summary>
              <code>{{ readRequestId }}</code>
            </details>
            <button type="button" :disabled="loading || busy" @click="emit('retry')">
              {{ loading ? "正在重新读取…" : "重新读取固定样本" }}
            </button>
          </section>
          <section>
            <h4>可固定的真实作业</h4>
            <article v-for="candidate in candidates" :key="candidate.browser_job_id">
              <div>
                <strong>{{ new Date(candidate.captured_at).toLocaleString("zh-CN") }}</strong>
                <span>{{ candidate.item_count }} 条结果</span>
              </div>
              <button type="button" :disabled="busy" @click="$emit('create', candidate)">
                {{ savingCandidateId === candidate.browser_job_id ? "保存中…" : "固定为样本" }}
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ candidate.parser_version }}</code>
              </details>
            </article>
            <p v-if="!candidates.length">暂无合格候选；先完成一条真实登录采集。</p>
          </section>
          <section>
            <h4>已固定样本</h4>
            <article v-for="sample in samples" :key="sample.id">
              <div class="sample-summary">
                <div>
                  <strong>{{ sample.name }}</strong>
                  <span
                    >{{ replayText(sample.last_replay_status) }} ·
                    {{ reviewText(sample.review_status) }}</span
                  >
                </div>
                <p v-if="sample.review_reason">审批结论：{{ sample.review_reason }}</p>
                <ProviderParserSampleReview
                  v-if="sample.review_status === 'pending'"
                  :sample="sample"
                  :reviewing="busy"
                  @review="(decision, reason) => $emit('review', sample, decision, reason)"
                />
              </div>
              <button type="button" :disabled="busy" @click="$emit('replay', sample)">
                {{ replayingSampleId === sample.id ? "回放中…" : "运行差异回放" }}
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ sample.baseline_parser_version }}</code>
              </details>
            </article>
            <p v-if="!samples.length">还没有固定样本。</p>
          </section>
          <section v-if="latestReplay" class="parser-diff" :data-status="latestReplay.status">
            <h4>本次回放：{{ replayText(latestReplay.status) }}</h4>
            <p v-if="latestReplay.error_code">解析器未能读取固定样本，来源继续停用。</p>
            <ol v-else-if="latestReplay.diff.length">
              <li v-for="item in latestReplay.diff" :key="item.path">
                <code>{{ item.path }}</code>
                <span>{{ displayValue(item.before) }} → {{ displayValue(item.after) }}</span>
              </li>
            </ol>
            <p v-else>字段、路径与结果顺序均与基线一致。</p>
          </section>
        </template>
      </div>
      <footer class="p48-parser-samples-actions">
        <p>通过回放和独立复核并不自动启用来源；启用操作仍在来源设置中单独完成。</p>
        <button type="button" :disabled="busy" @click="emit('close')">关闭</button>
      </footer>
    </section>
  </div>
</template>

<style scoped src="./ProviderParserSampleDialog.css"></style>
