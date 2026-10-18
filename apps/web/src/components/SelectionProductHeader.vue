<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { OpportunityDetail } from "./opportunity-workspace-types";
import {
  formatOpportunityTime,
  opportunityStatusLabel,
  opportunityProfitStatusLabel,
} from "./opportunity-workspace-presentation";

const props = defineProps<{ detail: OpportunityDetail }>();
const product = computed(() => props.detail.primary_product);
const purchaseHint = computed(() => {
  const badge = product.value?.public_signals?.sales_badge;
  return badge
    ? `${badge.period === "past_month" ? "近月" : "近周"} ≥ ${badge.quantity_lower_bound}`
    : "未采集";
});
const imageFailed = ref(false);
watch(
  () => [props.detail.id, props.detail.image_url],
  () => {
    imageFailed.value = false;
  },
);
const asin = computed(() =>
  /^[A-Z0-9]{10}$/i.test(props.detail.main_asin ?? "")
    ? props.detail.main_asin!.toUpperCase()
    : null,
);
</script>

<template>
  <header class="selection-product-header">
    <div class="selection-product-header__image">
      <img
        v-if="detail.image_url && !imageFailed"
        :src="detail.image_url"
        :alt="detail.name"
        @error="imageFailed = true"
      />
      <span v-else>{{ imageFailed ? "图片暂不可用" : "主图待采集" }}</span>
    </div>
    <div class="selection-product-header__identity">
      <div class="selection-product-header__tags">
        <span>{{ detail.market }}</span
        ><span>{{ detail.category || "未分类" }}</span
        ><span>{{ opportunityStatusLabel(detail.selection_stage) }}</span>
      </div>
      <h1>{{ detail.name }}</h1>
      <div class="selection-product-header__meta">
        <a
          v-if="asin"
          :href="`https://www.amazon.com/dp/${asin}`"
          target="_blank"
          rel="noopener noreferrer"
          >{{ asin }} ↗</a
        >
        <span v-else>主品待识别</span>
        <span>来源 {{ opportunityStatusLabel(detail.source_type) }}</span>
        <span>更新 {{ formatOpportunityTime(detail.updated_at) }}</span>
      </div>
      <dl class="selection-product-header__facts" aria-label="主品采集资料">
        <div>
          <dt>售价</dt>
          <dd>
            {{
              product?.price != null && product.currency
                ? `${product.currency} ${product.price.toFixed(2)}`
                : "未采集"
            }}
          </dd>
        </div>
        <div>
          <dt>评分 / 评价</dt>
          <dd>
            {{ product?.rating_value != null ? product.rating_value.toFixed(1) : "—" }} /
            {{ product?.review_count != null ? `${product.review_count} 条` : "未采集" }}
          </dd>
        </div>
        <div>
          <dt>购买提示</dt>
          <dd>{{ purchaseHint }}</dd>
        </div>
        <div>
          <dt>类目排名</dt>
          <dd>
            {{
              product?.public_signals?.best_seller_rank
                ? `#${product.public_signals.best_seller_rank.rank}`
                : "未采集"
            }}
          </dd>
        </div>
      </dl>
      <p class="selection-product-header__provenance">
        <span>{{ product?.public_signals?.sponsored ? "观察到广告标记" : "广告标记未提供" }}</span>
        <span v-if="product">商品采集 {{ formatOpportunityTime(product.captured_at) }}</span>
        <span v-if="product?.public_signals?.sales_badge">购买提示为平台公开下限，非精确销量</span>
      </p>
      <details class="selection-product-header__runtime">
        <summary>运行信息</summary>
        <small
          >数据版本 v{{ detail.version }} · 评分规则
          {{ detail.score_rule_version ?? "尚未计算" }}</small
        >
      </details>
    </div>
    <dl class="selection-product-header__score">
      <div>
        <dt>综合评分</dt>
        <dd>
          {{ detail.overall_score ?? "—" }}<small v-if="detail.overall_score != null"> / 100</small>
        </dd>
      </div>
      <div>
        <dt>利润状态</dt>
        <dd>{{ opportunityProfitStatusLabel(detail.profit_status) }}</dd>
      </div>
      <div>
        <dt>证据覆盖</dt>
        <dd>{{ opportunityStatusLabel(detail.coverage_status) }}</dd>
      </div>
    </dl>
  </header>
</template>

<style scoped>
.selection-product-header {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr) 150px;
  align-items: start;
  gap: 24px;
  padding: 24px;
  background: var(--so-panel);
  color: var(--so-text);
}
.selection-product-header__image {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 8px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
}
.selection-product-header__image img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
}
.selection-product-header__image span {
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-product-header__identity {
  min-width: 0;
}
.selection-product-header__tags,
.selection-product-header__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  font-size: 13px;
  color: var(--so-text-muted);
}
.selection-product-header__tags span {
  padding: 3px 7px;
  border: 1px solid var(--so-border);
}
.selection-product-header h1 {
  margin: 12px 0;
  font-size: 21px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.selection-product-header a {
  color: var(--so-primary);
  text-underline-offset: 3px;
}
.selection-product-header__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 10px;
  padding-top: 14px;
  border-top: 1px solid var(--so-border);
}
.selection-product-header__facts dt {
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-product-header__facts dd {
  margin: 5px 0 0;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.selection-product-header__provenance {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.5;
}
.selection-product-header__runtime {
  margin-top: 10px;
  color: var(--so-text-muted);
  font-size: 13px;
}
.selection-product-header__runtime summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  width: fit-content;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.selection-product-header__runtime small {
  display: block;
  padding: 6px 0;
  overflow-wrap: anywhere;
}
.selection-product-header :is(a, summary):focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 3px;
}
.selection-product-header__score {
  display: grid;
  gap: 14px;
  margin: 0;
  padding-left: 24px;
  border-left: 1px solid var(--so-border);
}
.selection-product-header__score dt {
  font-size: 13px;
  color: var(--so-text-muted);
}
.selection-product-header__score dd {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 600;
}
.selection-product-header__score > div:first-child dd {
  font-size: 30px;
  line-height: 1.2;
  color: var(--so-primary);
  font-variant-numeric: tabular-nums;
}
.selection-product-header__score small {
  font-size: 13px;
  font-weight: 400;
  color: var(--so-text-muted);
}
@media (max-width: 760px) {
  .selection-product-header {
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 14px;
    padding: 16px;
  }
  .selection-product-header h1 {
    font-size: 17px;
    margin: 8px 0;
  }
  .selection-product-header__tags {
    gap: 5px;
  }
  .selection-product-header__tags span {
    padding: 2px 5px;
  }
  .selection-product-header__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 8px;
  }
  .selection-product-header__score {
    grid-column: 1/-1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 14px 0 0;
    border-left: 0;
    border-top: 1px solid var(--so-border);
  }
}
</style>
