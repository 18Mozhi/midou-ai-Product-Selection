<script setup lang="ts">
import { computed } from "vue";
import { MINIMUM_SELECTION_COMPETITORS, MAXIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import type { OpportunityCompetitorSummary } from "./opportunity-workspace-types";
import { formatOpportunityTime } from "./opportunity-workspace-presentation";

const props = defineProps<{ mainAsin?: string | null; items: OpportunityCompetitorSummary[] }>();
const main = computed(
  () =>
    props.items.find((item) => item.external_id.toUpperCase() === props.mainAsin?.toUpperCase()) ??
    null,
);
const competitors = computed(() => {
  const seen = new Set<string>(props.mainAsin ? [props.mainAsin.toUpperCase()] : []);
  return props.items
    .filter((item) => {
      if (
        item.source_site.toLowerCase() !== "amazon" ||
        !/^[A-Z0-9]{10}$/i.test(item.external_id) ||
        seen.has(item.external_id.toUpperCase())
      )
        return false;
      seen.add(item.external_id.toUpperCase());
      return true;
    })
    .slice(0, MAXIMUM_SELECTION_COMPETITORS);
});
const reviewItems = computed(() =>
  (main.value ? [main.value, ...competitors.value] : competitors.value).filter(
    (item) => item.latest_snapshot?.public_signals?.review_samples?.length,
  ),
);
const analyzed = computed(
  () =>
    competitors.value.filter((item) => {
      const snapshot = item.latest_snapshot;
      return (
        snapshot &&
        snapshot.current_price != null &&
        snapshot.currency &&
        snapshot.review_count != null &&
        snapshot.rating_value != null &&
        snapshot.freshness === "fresh" &&
        snapshot.source_status === "healthy" &&
        snapshot.detail_collected === true &&
        snapshot.source_enabled === true
      );
    }).length,
);
const price = (item: OpportunityCompetitorSummary) => {
  const snapshot = item.latest_snapshot;
  return snapshot?.current_price != null && snapshot.currency
    ? `${snapshot.currency} ${snapshot.current_price}`
    : "未采集";
};
const purchaseLabel = (item: OpportunityCompetitorSummary) => {
  const badge = item.latest_snapshot?.public_signals?.sales_badge;
  return badge
    ? `${badge.period === "past_month" ? "近月" : "近周"} ≥ ${badge.quantity_lower_bound.toLocaleString("zh-CN")}`
    : "未采集";
};
const rankLabel = (item: OpportunityCompetitorSummary) => {
  const rank = item.latest_snapshot?.public_signals?.best_seller_rank;
  return rank ? `#${rank.rank.toLocaleString("zh-CN")}` : "未采集";
};
</script>

<template>
  <section class="selection-comparison" aria-label="Amazon 主品与竞品">
    <header class="selection-comparison-primary">
      <div>
        <span>主要商品</span>
        <h4>{{ main?.title ?? (mainAsin ? "主品详情待采集" : "主品待识别") }}</h4>
        <a
          v-if="mainAsin && /^[A-Z0-9]{10}$/.test(mainAsin)"
          :href="`https://www.amazon.com/dp/${mainAsin}`"
          target="_blank"
          rel="noopener noreferrer"
          >{{ mainAsin }} ↗</a
        >
      </div>
      <dl v-if="main">
        <div>
          <dt>售价</dt>
          <dd>{{ price(main) }}</dd>
        </div>
        <div>
          <dt>星级 / 评价数</dt>
          <dd>
            {{ main.latest_snapshot?.rating_value ?? "—" }} /
            {{ main.latest_snapshot?.review_count ?? "—" }}
          </dd>
        </div>
        <div>
          <dt>购买提示</dt>
          <dd :title="main.latest_snapshot?.public_signals?.sales_badge?.text">
            {{ purchaseLabel(main) }}
          </dd>
        </div>
        <div>
          <dt>类目排名</dt>
          <dd :title="main.latest_snapshot?.public_signals?.best_seller_rank?.text">
            {{ rankLabel(main) }}
          </dd>
        </div>
      </dl>
    </header>
    <header class="selection-comparison-heading">
      <h4>
        竞品对比 <small>{{ competitors.length }} 个</small>
      </h4>
      <span :data-ready="analyzed >= MINIMUM_SELECTION_COMPETITORS"
        >有效快照 {{ analyzed }} / 至少 {{ MINIMUM_SELECTION_COMPETITORS }} 个</span
      >
    </header>
    <p v-if="analyzed < MINIMUM_SELECTION_COMPETITORS" class="selection-comparison-pending">
      竞品数据尚不完整，继续采集后再判断竞争情况。
    </p>
    <div
      v-if="competitors.length"
      class="selection-comparison-scroll"
      tabindex="0"
      aria-label="横向滚动竞品对比表"
    >
      <table>
        <caption class="so-visually-hidden">
          独立竞品的价格、评价、购买提示、类目排名、广告标记和采集时间
        </caption>
        <thead>
          <tr>
            <th scope="col">商品 / ASIN</th>
            <th scope="col">售价</th>
            <th scope="col">评分</th>
            <th scope="col">评价数</th>
            <th scope="col">购买提示</th>
            <th scope="col">类目排名</th>
            <th scope="col">广告标记</th>
            <th scope="col">采集时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in competitors" :key="item.id">
            <th scope="row">
              <strong>{{ item.title }}</strong
              ><a
                :href="`https://www.amazon.com/dp/${item.external_id}`"
                target="_blank"
                rel="noopener noreferrer"
                >{{ item.external_id }} ↗</a
              >
            </th>
            <td>{{ price(item) }}</td>
            <td>{{ item.latest_snapshot?.rating_value ?? "未采集" }}</td>
            <td>{{ item.latest_snapshot?.review_count ?? "未采集" }}</td>
            <td :title="item.latest_snapshot?.public_signals?.sales_badge?.text">
              {{ purchaseLabel(item) }}
            </td>
            <td :title="item.latest_snapshot?.public_signals?.best_seller_rank?.text">
              {{ rankLabel(item) }}
            </td>
            <td>
              {{
                item.latest_snapshot?.public_signals?.sponsored === true
                  ? "已观察到广告位"
                  : "未采集"
              }}
            </td>
            <td>
              {{
                item.latest_snapshot
                  ? formatOpportunityTime(item.latest_snapshot.captured_at)
                  : "等待采集"
              }}<small v-if="item.latest_snapshot?.freshness === 'stale'">数据已过期</small
              ><small v-else-if="!item.latest_snapshot?.detail_collected">详情待采集</small>
              <small v-if="item.latest_snapshot?.source_enabled === false">来源已停用</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>正在等待相关商品的采集结果。</p>
    <p>购买提示为页面展示的数量下限；精确销量、广告花费未采集。</p>
    <section class="selection-review-samples" aria-label="公开评价样本">
      <h4>评价样本</h4>
      <p>以下为商品页公开的部分评价节选，可能包含不同款式，不代表全部评价。</p>
      <p v-if="!reviewItems.length">尚未采集评价明细。</p>
      <details v-for="item in reviewItems" :key="item.id">
        <summary>
          {{ item.title }} ·
          {{ item.latest_snapshot?.public_signals?.review_samples?.length }} 条样本
        </summary>
        <article
          v-for="review in item.latest_snapshot?.public_signals?.review_samples"
          :key="review.review_id"
        >
          <header>
            <strong>{{ review.title }}</strong
            ><span>{{ review.rating == null ? "星级未展示" : `${review.rating} / 5` }}</span>
          </header>
          <p class="selection-review-meta">
            {{ review.date_text ?? "日期未展示"
            }}<span v-if="review.variation_text"> · {{ review.variation_text }}</span>
          </p>
          <p>{{ review.text }}</p>
          <footer>
            <span>{{ review.verified_purchase === true ? "页面标记已购" : "未展示购买认证" }}</span
            ><span>{{
              review.helpful_votes == null ? "有用票数未展示" : `${review.helpful_votes} 人认为有用`
            }}</span>
          </footer>
        </article>
      </details>
    </section>
  </section>
</template>

<style scoped>
.selection-comparison {
  color: var(--so-text);
  background: var(--so-panel);
  border: 1px solid var(--so-border);
  border-radius: 7px;
  overflow: hidden;
}
.selection-comparison-primary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 20px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel-soft);
}
.selection-comparison h4 {
  margin: 6px 0;
  font-size: 16px;
}
.selection-comparison span,
.selection-comparison small,
.selection-comparison dt {
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-comparison a {
  display: block;
  color: var(--so-primary);
  font-size: 13px;
  text-decoration: none;
}
.selection-comparison-primary dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 24px;
  min-width: 220px;
  margin: 0;
  flex-shrink: 0;
}
.selection-comparison dd {
  margin: 6px 0 0;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
.selection-comparison-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
}
.selection-comparison-heading span[data-ready="true"] {
  color: var(--so-success);
}
.selection-comparison > p {
  margin: 0;
  padding: 0 20px 16px;
  font-size: 13px;
  color: var(--so-text-muted);
}
.selection-comparison-scroll {
  overflow-x: auto;
}
.selection-comparison table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.selection-comparison th,
.selection-comparison td {
  padding: 12px 16px;
  border-top: 1px solid var(--so-border);
  vertical-align: top;
}
.selection-comparison thead {
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
}
.selection-comparison tbody th {
  width: 38%;
  font-weight: 400;
}
.selection-comparison tbody th strong {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}
.selection-comparison td {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.selection-comparison td small {
  display: block;
  margin-top: 5px;
  color: var(--so-warning);
}
@media (max-width: 760px) {
  .selection-comparison-primary {
    flex-direction: column;
    align-items: stretch;
  }
  .selection-comparison-heading {
    flex-wrap: wrap;
  }
}

.selection-review-samples {
  padding: 18px 20px;
  border-top: 1px solid var(--so-border);
}
.selection-comparison .selection-review-samples > p {
  font-weight: 400;
  letter-spacing: normal;
  margin: 8px 0 14px;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.6;
}
.selection-review-samples details {
  border-top: 1px solid var(--so-border);
}
.selection-review-samples summary {
  padding: 14px 0;
  cursor: pointer;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.selection-review-samples article {
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--so-border);
  border-radius: 4px;
}
.selection-review-samples article header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
}
.selection-review-samples article header strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.selection-review-samples article header > span {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.selection-comparison .selection-review-samples article p {
  color: var(--so-text);
  font-weight: 400;
  letter-spacing: normal;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.selection-comparison .selection-review-samples .selection-review-meta,
.selection-review-samples footer {
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-review-samples footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
