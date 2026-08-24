<script setup lang="ts">
import type { OpportunityPartialLoadState } from "./opportunity-workspace-types";
import {
  formatOpportunityTime,
  opportunityAiErrorLabel,
  opportunityStatusLabel,
} from "./opportunity-workspace-presentation";

defineProps<{
  analyses: any[];
  loadState: OpportunityPartialLoadState;
  busy: boolean;
  canDecide: boolean;
}>();

defineEmits<{
  queue: [];
  retry: [];
  review: [resultId: string, outcome: "approved" | "rejected"];
}>();
</script>

<template>
  <section class="opportunity-ai">
    <header>
      <div>
        <p>智能辅助</p>
        <h4>AI 辅助分析</h4>
        <span>仅摘要、分类和缺失提示；输出不能替代事实、评分、利润或人工决策。</span>
      </div>
      <button v-if="canDecide" type="button" :disabled="busy" @click="$emit('queue')">
        生成新分析
      </button>
    </header>
    <aside>所有内容均标记 ai_generated，并保留输入快照哈希、模型名和人工抽检状态。</aside>
    <p v-if="loadState === 'loading'" class="opportunity-empty-copy">正在读取 AI 分析记录…</p>
    <div v-else-if="loadState === 'error'" class="opportunity-partial-error" role="alert">
      <strong>AI 分析读取失败</strong>
      <span>接口暂不可用，当前不能判定为“尚无分析”。</span>
      <button type="button" :disabled="busy" @click="$emit('retry')">重试读取</button>
    </div>
    <p v-else-if="!analyses.length" class="opportunity-empty-copy">
      尚无 AI 分析；当前机会事实未被修改。
    </p>
    <article v-for="item in analyses" :key="item.id">
      <header>
        <div>
          <b>{{ opportunityStatusLabel(item.status) }}</b>
          <small
            >{{ formatOpportunityTime(item.created_at) }} · 输入
            {{ item.input_sha256.slice(0, 12) }}…</small
          >
        </div>
        <em v-if="item.result"
          >智能分析 ·
          {{
            opportunityStatusLabel(
              item.result.review_status === "pending"
                ? "pending_review"
                : item.result.review_status,
            )
          }}</em
        >
      </header>
      <template v-if="item.result">
        <h5>{{ item.result.content.summary }}</h5>
        <section>
          <div>
            <strong>分类观察</strong>
            <p v-for="entry in item.result.content.classifications" :key="entry.label">
              <b>{{ entry.label }}</b
              >{{ entry.rationale }}<code>{{ entry.source_refs.join(" · ") }}</code>
            </p>
          </div>
          <div>
            <strong>缺失提示</strong>
            <p v-for="entry in item.result.content.missing_fields" :key="entry.field">
              <b>{{ entry.field }}</b
              >{{ entry.reason }}<code>{{ entry.source_refs.join(" · ") }}</code>
            </p>
          </div>
        </section>
        <footer>
          <span>模型 {{ item.result.model_name }} · 原始输出不可改写</span>
          <template v-if="canDecide && item.result.review_status === 'pending'">
            <button type="button" @click="$emit('review', item.result.id, 'approved')">
              抽检通过
            </button>
            <button
              type="button"
              class="reject"
              @click="$emit('review', item.result.id, 'rejected')"
            >
              抽检驳回
            </button>
          </template>
          <b v-else>{{ item.result.review?.notes }}</b>
        </footer>
      </template>
      <p v-else>
        {{ item.status === "failed_terminal" ? "处理已终止" : "等待 Worker" }}；错误：
        {{ opportunityAiErrorLabel(item.last_error_code) }}。可重新生成且不会覆盖本记录。
      </p>
    </article>
  </section>
</template>
