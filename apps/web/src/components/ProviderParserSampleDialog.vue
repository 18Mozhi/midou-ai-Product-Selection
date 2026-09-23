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
        <div v-if="loading" class="source-state">正在读取固定样本…</div>
        <template v-else>
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

<style scoped>
.source-modal {
  position: fixed;
  z-index: 80;
  inset: 0;
  padding: 20px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--so-bg) 80%, transparent);
}
.parser-sample-panel {
  width: min(820px, 100%);
  max-height: min(760px, 90vh);
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 18px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
}
.parser-sample-panel > header,
.parser-sample-panel article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.parser-sample-panel article {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
}
.parser-sample-panel article div,
.parser-diff li {
  display: grid;
  gap: 4px;
}
.parser-sample-panel article .sample-summary {
  flex: 1;
  gap: 10px;
}
.parser-sample-panel span,
.parser-sample-panel > p {
  color: var(--so-text-muted);
}
.parser-sample-panel h3,
.parser-sample-panel p {
  margin: 0;
}
.parser-sample-panel > header > button {
  font-size: 22px;
  color: var(--so-text);
  background: transparent;
}
.parser-diff {
  padding: 14px;
  border-left: 4px solid var(--so-success);
  background: var(--so-panel-soft);
}
.parser-diff[data-status="changed"],
.parser-diff[data-status="failed"] {
  border-left-color: var(--so-warning);
}
.parser-diff ol {
  display: grid;
  gap: 10px;
  padding-left: 24px;
}
.source-state {
  padding: 30px;
  text-align: center;
}
.source-modal.p48-parser-samples-modal {
  padding: 24px;
  background: rgb(15 23 42 / 72%);
  backdrop-filter: blur(8px);
}
.p48-parser-samples-panel {
  width: min(900px, 100%);
  max-height: calc(100dvh - 48px);
  gap: 0;
  padding: 0;
  overflow: auto;
  border: 1px solid #d3deec;
  border-radius: 20px;
  background: #f7f9fc;
  box-shadow: 0 28px 72px rgb(15 23 42 / 28%);
}
.p48-parser-samples-panel > .p48-parser-samples-identity {
  align-items: flex-start;
  padding: 26px 30px;
  color: #fff;
  background: #164fae;
}
.p48-parser-samples-identity > div {
  display: grid;
  gap: 8px;
}
.p48-parser-samples-identity p {
  color: rgb(255 255 255 / 82%);
  font-size: 13px;
  line-height: 1.55;
}
.p48-parser-samples-identity h3 {
  color: #fff;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  outline: none;
}
.p48-parser-samples-identity > button {
  flex: 0 0 44px;
  width: 44px;
  min-height: 44px;
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 10px;
  color: #fff;
  background: rgb(255 255 255 / 10%);
}
.p48-parser-samples-gates {
  padding: 16px 30px;
  border-bottom: 1px solid #cbdcf6;
  color: #244a7c;
  background: #eaf3ff;
}
.p48-parser-samples-gates p {
  margin: 0 0 10px;
  color: #164fae;
  font-weight: 700;
}
.p48-parser-samples-gates ol {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding-left: 22px;
}
.p48-parser-samples-body {
  display: grid;
  gap: 0;
  background: #fff;
}
.p48-parser-samples-body > section {
  padding: 20px 30px;
  border-bottom: 1px solid #dce4ef;
}
.p48-parser-samples-body > .p48-parser-samples-feedback {
  display: grid;
  gap: 6px;
  margin: 0 30px;
  padding: 13px 15px;
  border: 0;
  border-left: 4px solid #1769e0;
  color: #344d6a;
  background: #eaf3ff;
}
.p48-parser-samples-feedback p {
  margin: 0;
  line-height: 1.55;
}
.p48-parser-samples-feedback summary {
  min-height: 44px;
  line-height: 44px;
}
.p48-parser-samples-feedback code {
  overflow-wrap: anywhere;
}
.p48-parser-samples-body h4 {
  margin: 0 0 12px;
  color: #172033;
  font-size: 17px;
}
.p48-parser-samples-body article {
  margin: 0;
  padding: 14px 0;
  border: 0;
  border-top: 1px solid #e2e8f0;
  border-radius: 0;
  background: transparent;
}
.p48-parser-samples-body article > div {
  min-width: 0;
}
.p48-parser-samples-body article strong {
  color: #172033;
}
.p48-parser-samples-body article button,
.p48-parser-samples-body .sample-review button,
.p48-parser-samples-actions button {
  min-height: 44px;
  padding: 9px 14px;
  border-radius: 9px;
}
.p48-parser-samples-body button:disabled,
.p48-parser-samples-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.p48-parser-samples-body :focus-visible,
.p48-parser-samples-actions :focus-visible {
  outline: 3px solid #66a3ff;
  outline-offset: 3px;
}
.p48-parser-samples-body details summary {
  min-height: 44px;
  line-height: 44px;
}
.p48-parser-samples-body .parser-diff {
  border-left: 4px solid #1769e0;
  background: #edf4ff;
}
.p48-parser-samples-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 30px;
  border-top: 1px solid #d3deec;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 -10px 22px rgb(15 23 42 / 6%);
  backdrop-filter: blur(10px);
}
.p48-parser-samples-actions p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
@media (max-width: 760px) {
  .source-modal.p48-parser-samples-modal {
    display: block;
    padding: 0;
  }
  .p48-parser-samples-panel {
    width: 100%;
    max-height: 100dvh;
    min-height: 100dvh;
    border-radius: 0;
  }
  .p48-parser-samples-identity,
  .p48-parser-samples-gates,
  .p48-parser-samples-body > section {
    padding-right: 20px;
    padding-left: 20px;
  }
  .p48-parser-samples-feedback {
    margin-right: 20px;
    margin-left: 20px;
  }
  .p48-parser-samples-gates ol {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .p48-parser-samples-body article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .p48-parser-samples-body article > .sample-summary {
    grid-column: 1 / -1;
  }
  .p48-parser-samples-body article > details {
    grid-column: 1 / -1;
  }
  .p48-parser-samples-actions {
    display: grid;
    gap: 8px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  }
  .p48-parser-samples-actions button {
    width: 100%;
  }
}
@media (forced-colors: active) {
  .p48-parser-samples-panel,
  .p48-parser-samples-identity,
  .p48-parser-samples-gates,
  .p48-parser-samples-body > section {
    border: 1px solid CanvasText;
  }
}
</style>
