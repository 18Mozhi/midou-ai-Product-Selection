<script setup lang="ts">
import { reactive, watch } from "vue";
import OpportunityCatalogueList from "./OpportunityCatalogueList.vue";
import UiStatePanel from "./UiStatePanel.vue";
import { useHomeCompletedProducts } from "./use-home-completed-products";
import {
  catalogueProductFacts,
  catalogueFreshness,
  catalogueMeta,
  catalogueSourceLabel,
} from "./opportunity-catalogue-facts";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";
import type { OpportunitySummary } from "./opportunity-workspace-types";

const props = defineProps<{
  apiBaseUrl: string;
  completedCount?: number | null;
  refreshVersion: number;
}>();
const { items, state, refreshing, stale, message, requestId, load } = useHomeCompletedProducts({
  apiBaseUrl: () => props.apiBaseUrl,
  completedCount: () => props.completedCount,
  refreshVersion: () => props.refreshVersion,
});
const failedImages = reactive(new Map<string, string>());
const imageFallbackLabel = (item: OpportunitySummary) =>
  !item.image_url
    ? "商品主图待采集"
    : failedImages.get(item.id) === item.image_url
      ? "商品主图加载失败"
      : undefined;
const hasUsableImage = (item: OpportunitySummary) =>
  Boolean(item.image_url && failedImages.get(item.id) !== item.image_url);
const imageError = (item: OpportunitySummary) => {
  if (item.image_url) failedImages.set(item.id, item.image_url);
};
watch(items, (rows) => {
  const current = new Map(rows.map((item) => [item.id, item.image_url]));
  for (const [id, url] of failedImages) if (current.get(id) !== url) failedImages.delete(id);
});
const rowFacts = (item: OpportunitySummary) => [
  { label: "分析状态", value: "已完成分析" },
  {
    label: "综合评分",
    value:
      item.overall_score == null
        ? "—"
        : Number.isInteger(item.overall_score)
          ? String(item.overall_score)
          : item.overall_score.toFixed(1),
  },
  { label: "当前结论", value: opportunityStatusLabel(item.recommendation_status) },
  { label: "风险", value: opportunityStatusLabel(item.risk_level) },
];
</script>

<template>
  <div class="home-completed-products" :aria-busy="refreshing" aria-label="已完成商品">
    <p class="home-result-caption">
      全部日期 · 按更新时间展示前5个，包含低分、不推荐和利润未知的分析结果。
    </p>
    <p v-if="stale" class="home-read-alert" role="alert">
      商品列表暂未刷新，当前显示上次读取的结果。{{ message }}
      <button type="button" :disabled="refreshing" @click="load">重试加载商品</button>
    </p>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      :action-hint="message"
      :hide-secondary="true"
      primary-label="重试加载商品"
      @primary="load"
    />
    <div v-else-if="state === 'empty'" class="home-quiet-empty">
      <b>暂无已完成分析的商品</b>
      <span>系统会继续补齐主品、竞品、评分和1688货源；候选数量不计作已完成。</span>
      <RouterLink to="/opportunities?view=rule_candidates">查看候选进度</RouterLink>
    </div>
    <OpportunityCatalogueList
      v-else
      :items="items"
      return-path="/home"
      :completed-view="true"
      :product-facts="catalogueProductFacts"
      :row-facts="rowFacts"
      :catalog-meta="catalogueMeta"
      :source-label="catalogueSourceLabel"
      :freshness="catalogueFreshness"
      :has-usable-image="hasUsableImage"
      :image-fallback-label="imageFallbackLabel"
      @image-error="imageError"
    />
  </div>
</template>
