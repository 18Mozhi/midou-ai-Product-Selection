import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const parserSamplesCopy = {
  titlePrefix: "固定样本",
  description: "用真实浏览器作业建立基线，再核对当前解析器并由另一管理员复核。",
  gateNote: "三项都完成后，样本才满足来源启用所需的固定样本条件。",
};

const behavior = `
const sampleDialog = ref<HTMLElement | null>(null);
const sampleDialogTitle = ref<HTMLElement | null>(null);
let sampleDialogTrigger: HTMLElement | null = null;
const sampleDialogInerted = new Map<HTMLElement, boolean>();
const sampleDialogBusy = computed(
  () =>
    props.savingCandidateId !== null ||
    props.replayingSampleId !== null ||
    props.reviewingSampleId !== null,
);
const approvedSamples = computed(
  () => props.samples.filter((sample) => sample.review_status === "approved").length,
);
const replayPassedSamples = computed(
  () => props.samples.filter((sample) => sample.last_replay_status === "passed").length,
);
const pendingReviews = computed(
  () => props.samples.filter((sample) => sample.review_status === "pending").length,
);
const candidateGateText = computed(() =>
  props.samples.length || props.candidates.length ? "已有真实作业" : "等待真实作业",
);
const replayGateText = computed(() =>
  replayPassedSamples.value
    ? "当前解析器已有通过记录"
    : props.samples.some((sample) => ["changed", "failed"].includes(sample.last_replay_status))
      ? "回放结果需要处理"
      : "等待运行差异回放",
);
const reviewGateText = computed(() =>
  approvedSamples.value
    ? "已有另一管理员批准"
    : pendingReviews.value
      ? "等待另一管理员复核"
      : props.samples.some((sample) => sample.review_status === "rejected")
        ? "已驳回，需要新样本"
        : "等待样本复核",
);

const sampleDialogFocusable = () =>
  Array.from(
    sampleDialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);

function setSampleDialogBackgroundInert(active: boolean) {
  if (!active) {
    for (const [element, wasInert] of sampleDialogInerted)
      if (!wasInert) element.removeAttribute("inert");
    sampleDialogInerted.clear();
    return;
  }
  const modal = sampleDialog.value;
  if (!modal?.parentElement) return;
  for (const child of Array.from(modal.parentElement.children)) {
    if (!(child instanceof HTMLElement) || child === modal || child.classList.contains("source-modal"))
      continue;
    sampleDialogInerted.set(child, child.hasAttribute("inert"));
    child.setAttribute("inert", "");
  }
}

function closeSampleDialog() {
  if (!sampleDialogBusy.value) emit("close");
}

function handleSampleDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeSampleDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = sampleDialogFocusable();
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable[focusable.length - 1],
    active = document.activeElement;
  if (!focusable.includes(active as HTMLElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  sampleDialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick();
  setSampleDialogBackgroundInert(true);
  sampleDialogTitle.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  setSampleDialogBackgroundInert(false);
  sampleDialogTrigger?.focus({ preventScroll: true });
  sampleDialogTrigger = null;
});
`;

const template = `<template>
  <div
    ref="sampleDialog"
    class="source-modal p48-parser-samples-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="parser-sample-title"
    aria-describedby="parser-sample-description"
    @keydown="handleSampleDialogKeydown"
  >
    <section class="parser-sample-panel p48-parser-samples-panel">
      <header class="p48-parser-samples-identity">
        <div>
          <p>来源采集 / 真实登录验收</p>
          <h3 id="parser-sample-title" ref="sampleDialogTitle" tabindex="-1">
            固定样本 · {{ sourceName }}
          </h3>
          <p id="parser-sample-description">
            用真实浏览器作业建立基线，再核对当前解析器并由另一管理员复核。
          </p>
          <div class="p48-parser-samples-meta" aria-label="样本概览">
            <span>{{ candidates.length }} 个候选作业</span>
            <span>{{ samples.length }} 个固定样本</span>
            <span>{{ approvedSamples }} 个已批准</span>
          </div>
        </div>
        <button
          type="button"
          :aria-label="\`关闭 \${sourceName} 固定样本\`"
          :disabled="sampleDialogBusy"
          @click="closeSampleDialog"
        >
          ×
        </button>
      </header>

      <div class="p48-parser-samples-body">
        <section class="p48-parser-samples-gates" aria-labelledby="parser-sample-gates-title">
          <header>
            <p>启用条件</p>
            <h4 id="parser-sample-gates-title">固定样本的三步核对</h4>
          </header>
          <ol>
            <li>
              <span>1</span>
              <div><strong>真实浏览器作业</strong><small>{{ candidateGateText }}</small></div>
            </li>
            <li>
              <span>2</span>
              <div><strong>当前解析器回放</strong><small>{{ replayGateText }}</small></div>
            </li>
            <li>
              <span>3</span>
              <div><strong>独立复核</strong><small>{{ reviewGateText }}</small></div>
            </li>
          </ol>
          <p>三项都完成后，样本才满足来源启用所需的固定样本条件。</p>
        </section>

        <section
          v-if="loading"
          class="p48-parser-samples-state"
          data-kind="loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p>正在读取</p>
          <h4>正在读取固定样本</h4>
          <p>读取完成后会显示候选作业、回放状态和复核结论。</p>
        </section>

        <template v-else>
          <section
            v-if="latestReplay"
            class="p48-parser-samples-replay-result"
            :data-status="latestReplay.status"
            aria-labelledby="parser-replay-result-title"
          >
            <header>
              <p>本次回放</p>
              <h4 id="parser-replay-result-title">{{ replayText(latestReplay.status) }}</h4>
            </header>
            <p v-if="latestReplay.error_code">解析器未能读取固定样本，来源继续停用。</p>
            <ol v-else-if="latestReplay.diff.length">
              <li v-for="item in latestReplay.diff" :key="item.path">
                <code>{{ item.path }}</code>
                <span>{{ displayValue(item.before) }}</span>
                <span aria-hidden="true">→</span>
                <strong>{{ displayValue(item.after) }}</strong>
              </li>
            </ol>
            <p v-else>字段、路径与结果顺序均与基线一致。</p>
            <details v-if="latestReplay.error_code">
              <summary>技术详情</summary>
              <code>{{ latestReplay.error_code }}</code>
            </details>
          </section>

          <section class="p48-parser-samples-section" aria-labelledby="parser-candidates-title">
            <header>
              <div>
                <p>步骤 1</p>
                <h4 id="parser-candidates-title">可固定的真实作业</h4>
              </div>
              <span>{{ candidates.length }} 个</span>
            </header>
            <div v-if="candidates.length" class="p48-parser-candidate-list">
              <article v-for="candidate in candidates" :key="candidate.browser_job_id">
                <div>
                  <strong>{{ new Date(candidate.captured_at).toLocaleString("zh-CN") }}</strong>
                  <span>{{ candidate.item_count }} 条真实结果</span>
                </div>
                <button
                  type="button"
                  :disabled="savingCandidateId !== null"
                  @click="$emit('create', candidate)"
                >
                  {{ savingCandidateId === candidate.browser_job_id ? "正在固定…" : "固定为样本" }}
                </button>
                <details>
                  <summary>技术详情</summary>
                  <code>解析器：{{ candidate.parser_version }}</code>
                </details>
              </article>
            </div>
            <div v-else class="p48-parser-samples-empty">
              <strong>暂无合格候选作业</strong>
              <p>先完成一条同时保存截图、DOM 和结构化快照的真实登录采集。</p>
            </div>
          </section>

          <section class="p48-parser-samples-section" aria-labelledby="parser-fixed-title">
            <header>
              <div>
                <p>步骤 2–3</p>
                <h4 id="parser-fixed-title">已固定样本</h4>
              </div>
              <span>{{ samples.length }} 个</span>
            </header>
            <div v-if="samples.length" class="p48-parser-sample-list">
              <article v-for="sample in samples" :key="sample.id">
                <header>
                  <div>
                    <strong>{{ sample.name }}</strong>
                    <span>{{ new Date(sample.created_at).toLocaleString("zh-CN") }} 固定</span>
                  </div>
                  <div class="p48-parser-sample-statuses">
                    <span :data-replay="sample.last_replay_status">{{ replayText(sample.last_replay_status) }}</span>
                    <span :data-review="sample.review_status">{{ reviewText(sample.review_status) }}</span>
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>最近回放</dt>
                    <dd>
                      {{ sample.last_replay_at ? new Date(sample.last_replay_at).toLocaleString("zh-CN") : "尚未运行" }}
                    </dd>
                  </div>
                  <div>
                    <dt>复核结论</dt>
                    <dd>{{ sample.review_reason || "尚未填写" }}</dd>
                  </div>
                </dl>
                <ProviderParserSampleReview
                  v-if="sample.review_status === 'pending'"
                  :sample="sample"
                  :reviewing="reviewingSampleId === sample.id"
                  @review="(decision, reason) => $emit('review', sample, decision, reason)"
                />
                <div class="p48-parser-sample-actions">
                  <button
                    type="button"
                    :disabled="replayingSampleId !== null || savingCandidateId !== null || reviewingSampleId !== null"
                    @click="$emit('replay', sample)"
                  >
                    {{ replayingSampleId === sample.id ? "正在回放…" : "运行差异回放" }}
                  </button>
                  <details>
                    <summary>技术详情</summary>
                    <code>基线解析器：{{ sample.baseline_parser_version }}</code>
                  </details>
                </div>
              </article>
            </div>
            <div v-else class="p48-parser-samples-empty">
              <strong>还没有固定样本</strong>
              <p>出现合格候选作业后，可在上方固定为不可变样本。</p>
            </div>
          </section>
        </template>
      </div>

      <footer class="p48-parser-samples-actions">
        <p>回放只解析已保存快照，不会重新打开外部页面。</p>
        <button type="button" :disabled="sampleDialogBusy" @click="closeSampleDialog">关闭</button>
      </footer>
    </section>
  </div>
</template>`;

export function previewProviderParserSampleDialog(source) {
  let review = once(
    source,
    '<script setup lang="ts">\nimport ProviderParserSampleReview from "./ProviderParserSampleReview.vue";',
    '<script setup lang="ts">\nimport { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";\nimport ProviderParserSampleReview from "./ProviderParserSampleReview.vue";',
    "sample dialog import anchor must be unique",
  );
  review = once(review, "defineProps<{", "const props = defineProps<{", "sample props anchor");
  review = once(review, "defineEmits<{", "const emit = defineEmits<{", "sample emit anchor");
  review = once(review, "</script>", `${behavior}\n</script>`, "sample script close anchor");
  const start = review.indexOf("<template>");
  const end = review.indexOf("<style scoped>", start);
  assert.ok(start >= 0 && end > start, "sample template boundaries");
  return review.slice(0, start) + template + "\n\n" + review.slice(end);
}

export function previewProviderParserSampleReview(source) {
  let review = source;
  const start = review.indexOf("<template>");
  const end = review.indexOf("<style scoped>", start);
  assert.ok(start >= 0 && end > start, "sample review template boundaries");
  const reviewTemplate = `<template>
  <section class="sample-review p48-parser-sample-review" aria-label="独立复核">
    <template v-if="sample.can_review">
      <label :for="\`sample-review-reason-\${sample.id}\`">
        <span>复核原因</span>
        <input
          :id="\`sample-review-reason-\${sample.id}\`"
          v-model="reason"
          type="text"
          minlength="2"
          maxlength="1000"
          required
          :disabled="reviewing"
          :aria-describedby="\`sample-review-help-\${sample.id}\`"
          placeholder="填写通过或驳回依据"
        />
        <small :id="\`sample-review-help-\${sample.id}\`">填写 2–1000 个字符；通过与驳回都必须说明依据。</small>
      </label>
      <div class="sample-review-actions">
        <button type="button" :disabled="reviewing || reason.trim().length < 2" @click="submit('approved')">
          {{ reviewing ? "正在提交…" : "审批通过" }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="reviewing || reason.trim().length < 2"
          @click="submit('rejected')"
        >
          {{ reviewing ? "正在提交…" : "驳回样本" }}
        </button>
      </div>
    </template>
    <p v-else class="p48-parser-sample-self-note">
      创建人不能审批自己的样本，需要另一管理员处理。
    </p>
  </section>
</template>`;
  return review.slice(0, start) + reviewTemplate + "\n\n" + review.slice(end);
}

export function previewProviderParserSamplesParent(source) {
  return once(
    source,
    `  sampleLoading.value = true;
  latestReplay.value = null;
  try {`,
    `  sampleLoading.value = true;
  latestReplay.value =
    (globalThis as typeof globalThis & { __P48_PARSER_SAMPLE_REPLAY__?: ParserSampleReplay | null })
      .__P48_PARSER_SAMPLE_REPLAY__ ?? null;
  try {`,
    "sample parent latest replay anchor must be unique",
  );
}
