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
          <dt>评分 / 评论</dt>
          <dd>
            {{ main.latest_snapshot?.rating_value ?? "—" }} /
            {{ main.latest_snapshot?.review_count ?? "—" }}
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
          独立竞品的当前价格、评价和采集时间
        </caption>
        <thead>
          <tr>
            <th scope="col">商品 / ASIN</th>
            <th scope="col">售价</th>
            <th scope="col">评分</th>
            <th scope="col">评论数</th>
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
  display: flex;
  gap: 24px;
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
  min-width: 660px;
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
</style>
