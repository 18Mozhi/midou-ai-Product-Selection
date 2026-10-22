<script setup lang="ts">
import { computed } from "vue";
import { MINIMUM_SELECTION_COMPETITORS, MAXIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import type { OpportunityCompetitorSummary } from "./opportunity-workspace-types";
import { formatOpportunityTime } from "./opportunity-workspace-presentation";

const props = defineProps<{ mainAsin?: string | null; items: OpportunityCompetitorSummary[] }>();
const main = computed(
  () =>
    props.items.find(
      (item) =>
        item.source_site.toLowerCase() === "amazon" &&
        item.external_id.toUpperCase() === props.mainAsin?.toUpperCase(),
    ) ?? null,
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
const comparisonRows = computed(() => [
  ...(main.value ? [{ item: main.value, role: "primary" as const }] : []),
  ...competitors.value.map((item) => ({ item, role: "competitor" as const })),
]);
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
const reviewBarrier = (item: OpportunityCompetitorSummary) => {
  const count = item.latest_snapshot?.review_count;
  return count == null || !Number.isSafeInteger(count) || count < 0
    ? "未知"
    : Math.min(100, Math.max(0, Math.round((100 - (Math.log10(count + 1) / 5) * 100) * 100) / 100));
};
const sourceHealth = (status?: string) =>
  status === "healthy"
    ? "健康"
    : status === "degraded"
      ? "降级"
      : status === "unavailable"
        ? "不可用"
        : "未知";
const observedFlag = (value: boolean | undefined, yes: string, no: string) =>
  value === true ? yes : value === false ? no : "未知";
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
      <span>对照主品</span>
      <a
        v-if="mainAsin && /^[A-Z0-9]{10}$/i.test(mainAsin)"
        :href="`https://www.amazon.com/dp/${mainAsin}`"
        target="_blank"
        rel="noopener noreferrer"
        >{{ mainAsin }} ↗</a
      >
      <span v-if="!main">{{ mainAsin ? "主品详情待采集" : "主品待识别" }}</span>
    </header>
    <header class="selection-comparison-heading">
      <h4>
        竞品对比 <small>{{ competitors.length }} 个</small>
      </h4>
      <span :data-ready="analyzed >= MINIMUM_SELECTION_COMPETITORS"
        >详情齐备快照 {{ analyzed }} / 至少 {{ MINIMUM_SELECTION_COMPETITORS }} 个</span
      >
    </header>
    <p>
      详情齐备仅核对字段、来源及新鲜度，不代表相关性证明通过或已参与评分；实际竞争分以“商品与评分”的证据为准。
    </p>
    <p v-if="analyzed < MINIMUM_SELECTION_COMPETITORS" class="selection-comparison-pending">
      竞品数据尚不完整，继续采集后再判断竞争情况。
    </p>
    <div
      v-if="comparisonRows.length"
      class="selection-comparison-scroll"
      tabindex="0"
      aria-label="横向滚动竞品对比表"
    >
      <table>
        <caption class="so-visually-hidden">
          主品与独立竞品的价格、评价、购买提示、类目排名、广告标记和采集时间
        </caption>
        <thead>
          <tr>
            <th scope="col">商品 / ASIN</th>
            <th scope="col">售价</th>
            <th scope="col">星级</th>
            <th scope="col">评价数</th>
            <th scope="col">购买提示</th>
            <th scope="col">类目排名</th>
            <th scope="col">广告标记</th>
            <th scope="col">采集时间</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ item, role } in comparisonRows"
            :key="`${role}-${item.id}`"
            :data-product-role="role"
          >
            <th scope="row">
              <span class="selection-comparison-role">{{
                role === "primary" ? "主品" : "竞品"
              }}</span>
              <strong>{{ item.title }}</strong
              ><a
                :href="`https://www.amazon.com/dp/${item.external_id}`"
                target="_blank"
                rel="noopener noreferrer"
                >{{ item.external_id }} ↗</a
              >
              <details class="selection-comparison-provenance">
                <summary>详情依据</summary>
                <p>
                  快照编号：<code>{{ item.latest_snapshot?.id || "未知" }}</code>
                </p>
                <p>
                  证据编号：<code>{{ item.latest_snapshot?.evidence_id || "未知" }}</code>
                </p>
                <p>来源状态：{{ sourceHealth(item.latest_snapshot?.source_status) }}</p>
                <p>
                  详情证据：{{
                    observedFlag(item.latest_snapshot?.detail_collected, "已通过", "未通过")
                  }}
                </p>
                <p>
                  来源启用：{{
                    observedFlag(item.latest_snapshot?.source_enabled, "已启用", "已停用")
                  }}
                </p>
                <p>
                  新鲜度：{{
                    item.latest_snapshot?.freshness === "fresh"
                      ? "新鲜"
                      : item.latest_snapshot?.freshness === "stale"
                        ? "已过期"
                        : "未知"
                  }}
                </p>
                <p>仅为当前快照资料，不代表该快照或评价数参与历史评分。</p>
              </details>
            </th>
            <td data-label="售价">{{ price(item) }}</td>
            <td data-label="星级">{{ item.latest_snapshot?.rating_value ?? "未采集" }}</td>
            <td data-label="评价数">
              {{ item.latest_snapshot?.review_count ?? "未知" }}
              <small v-if="role === 'competitor'"
                >当前评价门槛试算：{{ reviewBarrier(item) }}</small
              >
            </td>
            <td
              data-label="购买提示"
              :title="item.latest_snapshot?.public_signals?.sales_badge?.text"
            >
              {{ purchaseLabel(item) }}
            </td>
            <td
              data-label="类目排名"
              :title="item.latest_snapshot?.public_signals?.best_seller_rank?.text"
            >
              {{ rankLabel(item) }}
            </td>
            <td data-label="广告标记">
              {{
                item.latest_snapshot?.public_signals?.sponsored === true
                  ? "已观察到广告位"
                  : "未采集"
              }}
            </td>
            <td data-label="采集时间">
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
    <p v-if="!competitors.length">暂无相关竞品记录，请核对采集结果。</p>
    <p>
      购买提示为页面展示的数量下限；精确销量、广告花费未知。评价门槛试算只使用当前评价数，不代表该竞品通过相关性及详情证据门，也不替代历史评分输入。
    </p>
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
  border-radius: 4px;
  overflow: hidden;
}
.selection-comparison-primary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel-soft);
}
.selection-comparison h4 {
  margin: 6px 0;
  font-size: 16px;
}
.selection-comparison span,
.selection-comparison small {
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-comparison a {
  display: block;
  color: var(--so-primary);
  font-size: 13px;
  text-decoration: none;
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
.selection-comparison-provenance {
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.6;
}
.selection-comparison-provenance summary {
  cursor: pointer;
  color: var(--so-primary);
}
.selection-comparison .selection-comparison-provenance p {
  margin: 6px 0;
  color: var(--so-text);
  font-weight: 400;
  letter-spacing: normal;
  line-height: 1.6;
}
.selection-comparison-provenance code {
  white-space: normal;
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
.selection-comparison tr[data-product-role="primary"] {
  background: var(--so-panel-soft);
}
.selection-comparison-role {
  display: inline-block;
  margin-bottom: 5px;
  padding: 1px 6px;
  border: 1px solid var(--so-border);
  border-radius: 2px;
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
  .selection-comparison-scroll {
    overflow: visible;
  }
  .selection-comparison table {
    display: block;
    min-width: 0;
  }
  .selection-comparison thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .selection-comparison tbody {
    display: block;
  }
  .selection-comparison tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--so-border);
    padding: 12px;
    gap: 12px;
  }
  .selection-comparison tbody th {
    grid-column: 1 / -1;
    width: auto;
  }
  .selection-comparison :is(th, td) {
    min-width: 0;
    padding: 0;
    border: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .selection-comparison td[data-label]::before {
    content: attr(data-label);
    display: block;
    color: var(--so-text-muted);
    margin-bottom: 5px;
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
