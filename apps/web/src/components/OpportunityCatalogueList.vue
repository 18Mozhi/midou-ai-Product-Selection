<script setup lang="ts">
import { computed } from "vue";
import type { OpportunitySummary } from "./opportunity-workspace-types";
import { opportunityProfitStatusLabel } from "./opportunity-workspace-presentation";

type Fact = { label: string; value: string };
const props = defineProps<{
  items: OpportunitySummary[];
  returnPath: string;
  completedView?: boolean;
  productFacts: (item: OpportunitySummary) => Fact[];
  rowFacts: (item: OpportunitySummary) => Fact[];
  catalogMeta: (item: OpportunitySummary) => string;
  sourceLabel: (item: OpportunitySummary) => string;
  freshness: (value: string) => string;
  hasUsableImage: (item: OpportunitySummary) => boolean;
  imageFallbackLabel: (item: OpportunitySummary) => string | undefined;
}>();
const emit = defineEmits<{ imageError: [item: OpportunitySummary] }>();
const rows = computed(() =>
  props.items.map((item) => ({
    item,
    facts: props.productFacts(item),
    result: props.rowFacts(item),
    to: { path: `/opportunities/${item.id}`, query: { from: props.returnPath } },
  })),
);
</script>

<template>
  <div class="selection-product-list" tabindex="0" aria-label="商品数据表，可横向滚动">
    <table aria-label="选品商品列表">
      <colgroup>
        <col class="product-column" />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col class="result-column" />
        <col class="action-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">商品信息</th>
          <th scope="col">Amazon 售价</th>
          <th scope="col">购买 / 排名</th>
          <th scope="col">评分 / 评价</th>
          <th scope="col">1688 进货价</th>
          <th scope="col">竞品 / 货源</th>
          <th scope="col">选品结论</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ item, facts, result, to } in rows"
          :key="item.id"
          class="selection-product-row"
        >
          <td class="selection-product-identity-cell">
            <div class="selection-product-identity">
              <span
                class="selection-product-picture"
                :role="imageFallbackLabel(item) ? 'img' : undefined"
                :aria-label="imageFallbackLabel(item)"
                ><img
                  v-if="hasUsableImage(item)"
                  :src="item.image_url ?? undefined"
                  :alt="`${item.name} 商品图`"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="emit('imageError', item)"
                /><span v-else aria-hidden="true">{{ imageFallbackLabel(item) }}</span></span
              >
              <div class="selection-product-name">
                <strong
                  ><RouterLink :to="to" :title="item.name">{{ item.name }}</RouterLink></strong
                ><small
                  ><span class="catalogue-market">{{ item.market }}</span
                  ><span>{{ item.main_asin || "主品待确认" }}</span></small
                ><small :title="catalogMeta(item)"
                  >{{ item.category || "未分类" }} · {{ sourceLabel(item) }}</small
                >
              </div>
            </div>
          </td>
          <td data-label="Amazon 售价">
            <strong
              class="catalogue-price"
              :class="{ 'is-missing': !item.primary_product || item.primary_product.price == null }"
              >{{ facts[0]?.value }}</strong
            ><small class="catalogue-cell-note">{{
              item.primary_product ? freshness(item.primary_product.captured_at) : "等待资料"
            }}</small
            ><small class="catalogue-cell-note">{{
              item.primary_product?.public_signals?.sponsored ? "观察到广告标记" : "广告标记未提供"
            }}</small>
          </td>
          <td data-label="购买 / 排名">
            <strong class="catalogue-number">{{ facts[3]?.value }}</strong
            ><small class="catalogue-cell-note">类目 {{ facts[4]?.value }}</small
            ><small class="catalogue-cell-note">公开购买下限</small>
          </td>
          <td data-label="评分 / 评价">
            <strong class="catalogue-number">{{ facts[2]?.value }}</strong
            ><small class="catalogue-cell-note">平台公开评价</small>
          </td>
          <td data-label="1688 进货价">
            <strong
              class="catalogue-price catalogue-cost"
              :class="{ 'is-missing': !item.automatic_purchase_price }"
              >{{ facts[1]?.value }}</strong
            ><small class="catalogue-cell-note">{{ facts[5]?.value }}</small
            ><small class="catalogue-cell-note">{{
              opportunityProfitStatusLabel(item.profit_status)
            }}</small>
          </td>
          <td data-label="竞品 / 货源">
            <dl class="catalogue-counts">
              <div>
                <dt>竞品候选</dt>
                <dd>{{ item.competitor_count }}</dd>
              </div>
              <div>
                <dt>货源候选</dt>
                <dd>{{ item.supplier_candidate_count }}</dd>
              </div>
            </dl>
          </td>
          <td data-label="选品结论">
            <span class="catalogue-verdict" :data-stage="item.selection_stage">{{
              completedView
                ? "分析完成"
                : item.selection_stage === "recommended"
                  ? "建议采纳"
                  : item.selection_stage === "rule_candidate"
                    ? "选品候选"
                    : "待补证据"
            }}</span>
            <dl class="selection-product-results" :aria-label="`${item.name} 决策摘要`">
              <div v-for="fact in result" :key="fact.label">
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
          </td>
          <td class="selection-product-action-cell">
            <RouterLink
              :to="to"
              :aria-label="`${item.selection_stage === 'recommended' ? '审阅并采纳' : completedView ? '查看分析' : '查看进度'}：${item.name}`"
              >{{
                item.selection_stage === "recommended"
                  ? "审阅并采纳"
                  : completedView
                    ? "查看分析"
                    : "查看进度"
              }}<span aria-hidden="true"> →</span></RouterLink
            ><time :datetime="item.updated_at">{{ freshness(item.updated_at) }}</time>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.selection-product-list {
  overflow-x: auto;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
  border-radius: 4px;
}
table {
  width: 100%;
  min-width: 1280px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12px;
  line-height: 1.6;
}
.product-column {
  width: 28%;
}
.result-column {
  width: 16%;
}
.action-column {
  width: 112px;
}
th {
  height: 46px;
  padding: 10px 12px;
  text-align: left;
  color: var(--so-text-muted);
  font-weight: 500;
  background: var(--so-panel-soft);
  border-bottom: 1px solid var(--so-border);
  white-space: nowrap;
}
td {
  padding: 18px 12px;
  vertical-align: top;
  border-bottom: 1px solid var(--so-border);
  overflow-wrap: anywhere;
}
tbody tr:last-child td {
  border-bottom: 0;
}
tbody tr:hover {
  background: var(--so-primary-soft);
}
.selection-product-identity {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 14px;
}
.selection-product-picture {
  display: grid;
  place-items: center;
  width: 80px;
  height: 90px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
  color: var(--so-text-muted);
  font-size: 12px;
  text-align: center;
}
.selection-product-picture img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}
.selection-product-name {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
}
.selection-product-name strong {
  font-size: 13px;
  line-height: 22px;
  font-weight: 500;
}
.selection-product-name a {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--so-text);
  text-decoration: none;
  min-height: 44px;
}
.selection-product-name a:hover {
  color: var(--so-primary);
  text-decoration: underline;
}
.selection-product-name small {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--so-text-muted);
  font-size: 11px;
}
.catalogue-market {
  color: var(--so-primary);
  background: var(--so-primary-soft);
  padding: 0 5px;
  border-radius: 2px;
}
.catalogue-price {
  display: block;
  color: var(--so-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 24px;
  font-variant-numeric: tabular-nums;
}
.catalogue-cost {
  color: var(--so-warning);
}
.is-missing {
  font-size: 12px;
  color: var(--so-text-muted);
  font-weight: 400;
}
.catalogue-number {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  font-variant-numeric: tabular-nums;
}
.catalogue-cell-note {
  display: block;
  color: var(--so-text-muted);
  font-size: 11px;
  margin-top: 5px;
}
.catalogue-counts {
  margin: 0;
  display: grid;
  gap: 8px;
}
.catalogue-counts div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.catalogue-counts dt {
  white-space: nowrap;
  color: var(--so-text-muted);
}
.catalogue-counts dd {
  margin: 0;
  font-weight: 600;
}
.catalogue-verdict {
  display: inline-block;
  padding: 2px 7px;
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  border-radius: 2px;
  font-size: 11px;
}
.catalogue-verdict[data-stage="recommended"] {
  background: var(--so-success-soft);
  color: var(--so-success);
}
.catalogue-verdict[data-stage="rule_candidate"] {
  color: var(--so-primary);
  background: var(--so-primary-soft);
}
.selection-product-results {
  display: grid;
  gap: 3px;
  margin: 8px 0 0;
}
.selection-product-results div {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
.selection-product-results dt {
  color: var(--so-text-muted);
}
.selection-product-results dd {
  margin: 0;
  font-weight: 500;
}
.selection-product-action-cell a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--so-primary);
  text-decoration: none;
  font-size: 12px;
  white-space: nowrap;
}
.selection-product-action-cell time {
  display: block;
  font-size: 11px;
  color: var(--so-text-muted);
}
a:focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 3px;
}
th:last-child,
.selection-product-action-cell {
  position: sticky;
  right: 0;
  background: var(--so-panel);
  border-left: 1px solid var(--so-border);
  z-index: 1;
}
th:last-child {
  background: var(--so-panel-soft);
  z-index: 2;
}
tbody tr:hover .selection-product-action-cell {
  background: var(--so-primary-soft);
}
@media (max-width: 640px) {
  table,
  tbody {
    display: block;
    min-width: 0;
  }
  colgroup {
    display: none;
  }
  thead {
    position: absolute;
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--so-border);
  }
  td {
    display: block;
    padding: 0;
    border: 0;
  }
  td[data-label]::before {
    content: attr(data-label);
    display: block;
    color: var(--so-text-muted);
    font-size: 11px;
    margin-bottom: 3px;
  }
  .selection-product-identity-cell {
    grid-column: 1/-1;
  }
  .selection-product-action-cell {
    position: static;
    border-left: 0;
    grid-column: 1/-1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .selection-product-picture {
    width: 80px;
    height: 90px;
  }
  .selection-product-results div {
    justify-content: flex-start;
  }
  .catalogue-price {
    font-size: 16px;
  }
  .catalogue-counts div {
    justify-content: flex-start;
  }
  .catalogue-counts dd {
    margin-left: 8px;
  }
}
</style>
