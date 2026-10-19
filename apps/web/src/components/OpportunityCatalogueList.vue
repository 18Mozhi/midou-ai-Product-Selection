<script setup lang="ts">
import { computed } from "vue";
import type { OpportunitySummary } from "./opportunity-workspace-types";
import { opportunityProfitStatusLabel } from "./opportunity-workspace-presentation";

type Fact = { label: string; value: string };
const props = defineProps<{
  items: OpportunitySummary[];
  returnPath: string;
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
  <div class="selection-product-list">
    <table aria-label="选品商品列表">
      <colgroup>
        <col class="product-column" />
        <col class="facts-column" />
        <col class="result-column" />
        <col class="action-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">商品</th>
          <th scope="col">Amazon 公开资料 / 1688 进货价</th>
          <th scope="col">分析结果</th>
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
              >
                <img
                  v-if="hasUsableImage(item)"
                  :src="item.image_url ?? undefined"
                  :alt="`${item.name} 商品图`"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="emit('imageError', item)"
                />
                <span v-else aria-hidden="true">{{ imageFallbackLabel(item) }}</span>
              </span>
              <div class="selection-product-name">
                <small>
                  <span v-if="item.main_asin"
                    >ASIN <span>{{ item.main_asin }}</span></span
                  >
                  <span v-else>主品待确认</span>
                  <span>{{ sourceLabel(item) }}</span>
                </small>
                <strong
                  ><RouterLink :to="to" :title="item.name">{{ item.name }}</RouterLink></strong
                >
                <small :title="catalogMeta(item)">{{ catalogMeta(item) }}</small>
              </div>
            </div>
          </td>
          <td class="selection-product-facts-cell">
            <dl class="selection-product-facts" :aria-label="`${item.name} 商品资料`">
              <div
                v-for="fact in facts"
                :key="fact.label"
                :class="{
                  'is-price': ['售价', '1688进货价'].includes(fact.label),
                  'is-missing': ['未采集', '未取得'].includes(fact.value),
                }"
              >
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <p v-if="item.primary_product" class="selection-product-observation">
              <span>{{
                item.primary_product.public_signals?.sponsored
                  ? "已观察到广告标记"
                  : "广告标记未提供"
              }}</span
              ><time :datetime="item.primary_product.captured_at"
                >资料 {{ freshness(item.primary_product.captured_at) }}</time
              >
            </p>
            <p v-else class="selection-product-observation">商品资料待采集</p>
          </td>
          <td class="selection-product-result-cell">
            <dl class="selection-product-results" :aria-label="`${item.name} 决策摘要`">
              <div v-for="fact in result" :key="fact.label">
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <div class="selection-product-coverage">
              <span
                >竞品候选 <strong>{{ item.competitor_count }}</strong></span
              ><span
                >货源候选 <strong>{{ item.supplier_candidate_count }}</strong></span
              ><span>{{ opportunityProfitStatusLabel(item.profit_status) }}</span>
            </div>
          </td>
          <td class="selection-product-action-cell">
            <RouterLink
              :to="to"
              :aria-label="`${item.selection_stage === 'recommended' ? '审阅并采纳' : '查看进度'}：${item.name}`"
              >{{ item.selection_stage === "recommended" ? "审阅并采纳" : "查看进度"
              }}<span aria-hidden="true"> →</span></RouterLink
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.selection-product-list {
  border: 1px solid var(--so-border);
  border-radius: 4px;
  background: var(--so-panel);
}
.selection-product-list table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.5;
}
.product-column {
  width: 34%;
}
.facts-column {
  width: 33%;
}
.result-column {
  width: 22%;
}
.action-column {
  width: 112px;
}
.selection-product-list th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 500;
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
  border-bottom: 1px solid var(--so-border);
}
.selection-product-list td {
  padding: 14px;
  vertical-align: top;
  border-bottom: 1px solid var(--so-border);
  overflow-wrap: anywhere;
}
.selection-product-list tbody tr:last-child td {
  border-bottom: 0;
}
.selection-product-row:hover {
  background: var(--so-primary-soft);
}
.selection-product-identity {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 14px;
}
.selection-product-picture {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 90px;
  background: var(--so-panel);
  color: var(--so-text-muted);
  font-size: 12px;
  text-align: center;
}
.selection-product-picture img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.selection-product-name {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 6px;
}
.selection-product-name small {
  color: var(--so-text-muted);
  font-size: 12px;
}
.selection-product-name small:first-child {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.selection-product-name strong {
  font-size: 14px;
  line-height: 22px;
}
.selection-product-name a {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 44px;
  color: var(--so-text);
  text-decoration: none;
}
.selection-product-name a:hover {
  color: var(--so-primary);
  text-decoration: underline;
}
.selection-product-facts,
.selection-product-results {
  display: grid;
  gap: 8px 12px;
  margin: 0;
  padding: 0;
}
.selection-product-facts {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.selection-product-results {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.selection-product-list dt {
  color: var(--so-text-muted);
  font-size: 12px;
}
.selection-product-list dd {
  margin: 2px 0 0;
  color: var(--so-text);
  font-weight: 600;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.selection-product-facts .is-price dd {
  font-size: 20px;
  line-height: 1.35;
}
.selection-product-facts .is-missing dd {
  color: var(--so-text-muted);
  font-weight: 400;
  font-size: 14px;
}
.selection-product-observation {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 8px 0 0;
  color: var(--so-text-muted);
  font-size: 12px;
}
.selection-product-coverage {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--so-border);
  color: var(--so-text-muted);
  font-size: 12px;
}
.selection-product-action-cell a {
  font-size: 13px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--so-primary);
  text-decoration: none;
}
.selection-product-list a:focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .selection-product-list table,
  .selection-product-list tbody {
    display: block;
  }
  .selection-product-list colgroup {
    display: none;
  }
  .selection-product-list thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .selection-product-list .selection-product-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
    gap: 12px;
    border-bottom: 1px solid var(--so-border);
  }
  .selection-product-list .selection-product-row:last-child {
    border-bottom: 0;
  }
  .selection-product-list td {
    display: block;
    padding: 0;
    border: 0;
  }
  .selection-product-name a {
    min-height: 44px;
  }
  .selection-product-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-block: 10px;
    border-block: 1px solid var(--so-border);
  }
  .selection-product-action-cell a {
    padding-inline: 10px;
    border: 1px solid var(--so-border);
    border-radius: 4px;
  }
  .selection-product-list .selection-product-facts-cell {
    grid-row: 3;
  }
  .selection-product-list .selection-product-result-cell {
    grid-row: 2;
  }
}
</style>
