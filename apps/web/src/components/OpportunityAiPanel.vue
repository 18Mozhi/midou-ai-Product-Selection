<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  OpportunityAiAnalysis,
  OpportunityPartialLoadState,
} from "./opportunity-workspace-types";
import {
  formatOpportunityTime,
  opportunityAiErrorLabel,
  opportunityStatusLabel,
} from "./opportunity-workspace-presentation";

const props = defineProps<{
  analyses: OpportunityAiAnalysis[];
  loadState: OpportunityPartialLoadState;
  loadErrorMessage: string;
  requestId: string;
  busy: boolean;
  canDecide: boolean;
}>();

defineEmits<{
  queue: [];
  retry: [];
  review: [resultId: string, outcome: "approved" | "rejected"];
}>();

const selectedAnalysisId = ref("");
const selectedAnalysis = computed(
  () => props.analyses.find((analysis) => analysis.id === selectedAnalysisId.value) ?? null,
);
const pendingReviewEnabled = computed(
  () => props.canDecide && props.loadState === "ready" && !props.busy,
);
const attemptLabel = (status: string) =>
  ({
    queued: "等待处理",
    leased: "正在处理",
    retry_scheduled: "等待重试",
    succeeded: "已完成",
    failed_terminal: "处理终止",
    dead_letter: "进入失败队列",
  })[status] ?? opportunityStatusLabel(status);

watch(
  () => props.analyses,
  (analyses) => {
    if (!analyses.some((analysis) => analysis.id === selectedAnalysisId.value))
      selectedAnalysisId.value = analyses[0]?.id ?? "";
  },
  { immediate: true },
);
</script>

<template>
  <section class="opportunity-ai opportunity-ai--c">
    <header class="opportunity-ai-heading">
      <div>
        <p>辅助判断 · 不替代事实</p>
        <h4>AI 辅助分析</h4>
        <span
          >仅提供摘要、分类与缺失项提示；评分、利润、风险和决定仍以持久化事实与人工判断为准。</span
        >
      </div>
      <button v-if="canDecide" type="button" :disabled="busy" @click="$emit('queue')">
        生成新分析
      </button>
    </header>

    <aside class="opportunity-ai-boundary">
      每次分析保留独立输入快照、哈希与人工抽检；新分析不会覆盖旧输出。
    </aside>

    <div class="opportunity-ai-workspace">
      <nav class="opportunity-ai-directory" aria-label="AI 分析记录">
        <header>
          <strong>分析记录</strong>
          <span>已返回 {{ analyses.length }} 条</span>
        </header>
        <p v-if="!analyses.length && loadState === 'loading'" class="opportunity-empty-copy">
          正在读取分析记录…
        </p>
        <p v-else-if="!analyses.length && loadState === 'ready'" class="opportunity-empty-copy">
          尚无 AI 分析记录。
        </p>
        <button
          v-for="item in analyses"
          :key="item.id"
          type="button"
          :aria-current="item.id === selectedAnalysisId ? 'true' : undefined"
          @click="selectedAnalysisId = item.id"
        >
          <span>{{ attemptLabel(item.status) }}</span>
          <small>{{ formatOpportunityTime(item.created_at) }}</small>
          <code>{{ item.id }}</code>
        </button>
      </nav>

      <div class="opportunity-ai-output">
        <div v-if="loadState === 'error'" class="opportunity-ai-read-error" role="alert">
          <div>
            <strong>AI 分析记录暂时无法读取</strong>
            <p>{{ loadErrorMessage || "本次读取没有成功；不能据此判定记录为空。" }}</p>
            <small v-if="requestId">读取追踪：{{ requestId }}</small>
          </div>
          <button type="button" :disabled="busy" @click="$emit('retry')">重新读取</button>
        </div>
        <p v-else-if="loadState === 'loading'" class="opportunity-ai-loading" role="status">
          {{ analyses.length ? "正在更新；下方仍是上次成功读取的快照。" : "正在读取 AI 分析记录…" }}
        </p>

        <p v-if="!selectedAnalysis && analyses.length" class="opportunity-empty-copy">
          选择左侧记录以查看该次分析。
        </p>
        <article
          v-if="selectedAnalysis"
          class="opportunity-ai-result"
          :class="{ 'is-stale': loadState !== 'ready' }"
        >
          <header>
            <div>
              <p>请求状态</p>
              <h5>{{ attemptLabel(selectedAnalysis.status) }}</h5>
              <small
                >{{ formatOpportunityTime(selectedAnalysis.created_at) }} · 尝试
                {{ selectedAnalysis.attempt_count }} 次</small
              >
            </div>
            <em v-if="selectedAnalysis.result">
              抽检
              {{
                opportunityStatusLabel(
                  selectedAnalysis.result.review_status === "pending"
                    ? "pending_review"
                    : selectedAnalysis.result.review_status,
                )
              }}
            </em>
          </header>

          <template v-if="selectedAnalysis.result">
            <section class="opportunity-ai-content">
              <div>
                <strong>摘要</strong>
                <p>{{ selectedAnalysis.result.content.summary }}</p>
              </div>
              <div>
                <strong>分类观察</strong>
                <ul>
                  <li
                    v-for="entry in selectedAnalysis.result.content.classifications"
                    :key="entry.label"
                  >
                    <b>{{ entry.label }}</b>
                    <p>{{ entry.rationale }}</p>
                    <small>事实出处：{{ entry.source_refs.join(" · ") || "未提供" }}</small>
                  </li>
                </ul>
              </div>
              <div>
                <strong>缺失项提示</strong>
                <ul>
                  <li
                    v-for="entry in selectedAnalysis.result.content.missing_fields"
                    :key="entry.field"
                  >
                    <b>{{ entry.field }}</b>
                    <p>{{ entry.reason }}</p>
                    <small>事实出处：{{ entry.source_refs.join(" · ") || "未提供" }}</small>
                  </li>
                </ul>
              </div>
            </section>
            <footer>
              <span>AI 生成内容只读，人工抽检不会改写原文。</span>
              <template v-if="selectedAnalysis.result.review_status === 'pending'">
                <button
                  v-if="canDecide"
                  type="button"
                  :disabled="!pendingReviewEnabled"
                  @click="$emit('review', selectedAnalysis.result.id, 'approved')"
                >
                  抽检通过
                </button>
                <button
                  v-if="canDecide"
                  type="button"
                  class="reject"
                  :disabled="!pendingReviewEnabled"
                  @click="$emit('review', selectedAnalysis.result.id, 'rejected')"
                >
                  抽检驳回
                </button>
                <b v-if="!canDecide">当前角色只能查看，不能提交人工抽检。</b>
                <b v-else-if="loadState !== 'ready'">刷新成功后才能对该快照执行抽检。</b>
              </template>
              <span v-else-if="selectedAnalysis.result.review">
                {{ opportunityStatusLabel(selectedAnalysis.result.review.outcome) }} ·
                {{ selectedAnalysis.result.review.notes }} ·
                {{ formatOpportunityTime(selectedAnalysis.result.review.reviewed_at) }}
              </span>
            </footer>
          </template>
          <p v-else class="opportunity-ai-request-state">
            <strong
              v-if="['queued', 'leased', 'retry_scheduled'].includes(selectedAnalysis.status)"
            >
              {{
                selectedAnalysis.status === "queued"
                  ? "等待 Worker 领取。"
                  : selectedAnalysis.status === "leased"
                    ? "Worker 正在处理。"
                    : "处理失败后已安排重试。"
              }}
            </strong>
            <strong v-else-if="selectedAnalysis.status === 'failed_terminal'"
              >本次处理已终止；不会生成未返回的分析内容。</strong
            >
            <strong v-else-if="selectedAnalysis.status === 'dead_letter'"
              >本次处理已进入失败队列；不会生成未返回的分析内容。</strong
            >
            <strong v-else
              >该记录暂未返回分析结果，当前状态为 {{ selectedAnalysis.status }}。</strong
            >
            <span v-if="selectedAnalysis.last_error_code"
              >错误：{{ opportunityAiErrorLabel(selectedAnalysis.last_error_code) }}</span
            >
          </p>

          <details class="opportunity-ai-provenance">
            <summary>输入快照与技术出处</summary>
            <dl>
              <div>
                <dt>分析请求 ID</dt>
                <dd>
                  <code>{{ selectedAnalysis.id }}</code>
                </dd>
              </div>
              <div>
                <dt>分析结果 ID</dt>
                <dd>
                  <code>{{ selectedAnalysis.result?.id ?? "尚无结果" }}</code>
                </dd>
              </div>
              <div>
                <dt>输入 SHA-256</dt>
                <dd>
                  <code>{{ selectedAnalysis.input_sha256 }}</code>
                </dd>
              </div>
              <div>
                <dt>提示合同</dt>
                <dd>
                  <code>{{ selectedAnalysis.prompt_contract_version ?? "未提供" }}</code>
                </dd>
              </div>
              <div v-if="selectedAnalysis.result">
                <dt>历史模型标识</dt>
                <dd>{{ selectedAnalysis.result.model_name }}</dd>
              </div>
              <div v-if="selectedAnalysis.result?.provider_request_id">
                <dt>模型请求 ID</dt>
                <dd>
                  <code>{{ selectedAnalysis.result.provider_request_id }}</code>
                </dd>
              </div>
              <div>
                <dt>AI 输出标记</dt>
                <dd>{{ selectedAnalysis.result?.ai_generated ? "ai_generated" : "尚无结果" }}</dd>
              </div>
            </dl>
          </details>
        </article>
      </div>
    </div>
  </section>
</template>
