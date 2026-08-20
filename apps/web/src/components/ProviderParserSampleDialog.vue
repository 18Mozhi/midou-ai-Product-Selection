<script setup lang="ts">
interface ParserSample {
  id: string;
  name: string;
  baseline_parser_version: string;
  last_replay_status: "never" | "passed" | "changed" | "failed";
  last_replay_at: string | null;
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

defineProps<{
  sourceName: string;
  loading: boolean;
  samples: ParserSample[];
  candidates: ParserSampleCandidate[];
  latestReplay: ParserSampleReplay | null;
  savingCandidateId: string | null;
  replayingSampleId: string | null;
}>();

defineEmits<{
  close: [];
  create: [candidate: ParserSampleCandidate];
  replay: [sample: ParserSample];
}>();

const replayText = (value: ParserSample["last_replay_status"] | ParserSampleReplay["status"]) =>
  ({ never: "尚未回放", passed: "一致通过", changed: "发现差异", failed: "解析失败" })[value];

const displayValue = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text == null ? "未提供" : text.length > 240 ? `${text.slice(0, 240)}…` : text;
};
</script>

<template>
  <div class="source-modal" role="dialog" aria-modal="true" aria-labelledby="parser-sample-title">
    <section class="parser-sample-panel">
      <header>
        <div>
          <p>真实登录采集验收</p>
          <h3 id="parser-sample-title">固定样本回放 · {{ sourceName }}</h3>
        </div>
        <button type="button" aria-label="关闭固定样本回放" @click="$emit('close')">×</button>
      </header>
      <p>只能从同时保存截图、DOM 和结构化快照的真实浏览器作业固化；回放一致才允许启用来源。</p>
      <div v-if="loading" class="source-state">正在读取固定样本…</div>
      <template v-else>
        <section>
          <h4>可固定的真实作业</h4>
          <article v-for="candidate in candidates" :key="candidate.browser_job_id">
            <div>
              <strong>{{ new Date(candidate.captured_at).toLocaleString("zh-CN") }}</strong>
              <span>{{ candidate.item_count }} 条结果</span>
            </div>
            <button
              type="button"
              :disabled="savingCandidateId === candidate.browser_job_id"
              @click="$emit('create', candidate)"
            >
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
            <div>
              <strong>{{ sample.name }}</strong>
              <span>{{ replayText(sample.last_replay_status) }}</span>
            </div>
            <button
              type="button"
              :disabled="replayingSampleId === sample.id"
              @click="$emit('replay', sample)"
            >
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
</style>
