<script setup lang="ts">
import { computed, ref, watch } from "vue";
import HomeCompletedProducts from "./HomeCompletedProducts.vue";
import "../home-selection-results.css";
type RecommendedItem = {
  id: string;
  title: string;
  reason: string;
  route: string;
  value_score: number | null;
};
const props = defineProps<{
  apiBaseUrl: string;
  capabilities: string[];
  items: RecommendedItem[];
  completedCount?: number | null;
  refreshVersion: number;
  selection: {
    recommended_count: number;
    rule_candidate_count: number;
    awaiting_evidence_count: number;
  } | null;
}>();
const canReadProducts = computed(() => props.capabilities.includes("opportunity:read"));
const view = ref(canReadProducts.value ? "completed" : "recommended");
watch(canReadProducts, (allowed) => {
  view.value = allowed ? "completed" : "recommended";
});
const score = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
</script>

<template>
  <section class="home-result-workspace" aria-label="选品结果">
    <header class="home-result-header">
      <nav aria-label="工作台结果视图">
        <button
          v-if="canReadProducts"
          type="button"
          :aria-pressed="view === 'completed'"
          @click="view = 'completed'"
        >
          已完成分析
        </button>
        <button type="button" :aria-pressed="view === 'recommended'" @click="view = 'recommended'">
          待采纳推荐 <span v-if="selection">{{ selection.recommended_count }}</span>
        </button>
      </nav>
      <RouterLink
        v-if="canReadProducts"
        :to="
          view === 'completed' ? '/opportunities?view=completed' : '/opportunities?view=recommended'
        "
        >{{ view === "completed" ? "全部已完成分析" : "全部推荐商品" }} →</RouterLink
      >
    </header>
    <HomeCompletedProducts
      v-if="canReadProducts && view === 'completed'"
      :api-base-url="apiBaseUrl"
      :completed-count="completedCount"
      :refresh-version="refreshVersion"
    />
    <div v-else class="home-recommendation-results" role="region" aria-label="推荐清单">
      <h3 class="home-result-title">推荐清单</h3>
      <RouterLink v-for="item in items" :key="item.id" :to="item.route" class="home-review-row">
        <div>
          <strong>{{ item.title }}</strong
          ><small>{{ item.reason }}</small>
        </div>
        <span>{{ item.value_score === null ? "评分未读取" : `${score(item.value_score)} 分` }}</span
        ><b>查看 →</b>
      </RouterLink>
      <div v-if="!selection" class="home-quiet-empty" role="status">
        <b>自动选品数据暂不可用</b><span>推荐与运行统计暂不可用，请稍后刷新。</span>
      </div>
      <div v-else-if="!items.length" class="home-quiet-empty">
        <b>当前没有待人工采纳的推荐</b>
        <span>{{
          selection.rule_candidate_count > 0
            ? `${selection.rule_candidate_count} 条选品候选尚待五项质量门校验，可查看缺失资料。`
            : selection.awaiting_evidence_count > 0
              ? `${selection.awaiting_evidence_count} 条商品等待补充主品证据。`
              : "系统会在五项质量门全部通过后自动加入这里。"
        }}</span>
        <RouterLink
          v-if="selection.rule_candidate_count > 0"
          to="/opportunities?view=rule_candidates"
          >查看候选进度</RouterLink
        >
        <RouterLink
          v-else-if="selection.awaiting_evidence_count > 0"
          to="/opportunities?view=evidence_pending"
          >查看采集进度</RouterLink
        >
      </div>
    </div>
  </section>
</template>
