<script setup lang="ts">
import type { SourcingCandidate } from "./sourcing-workspace-types";
import SupplierSkuFacts from "./SupplierSkuFacts.vue";
import "../supplier-offer-list.css";

defineProps<{
  candidates: SourcingCandidate[];
  selectedQuotes: string[];
  canManage: boolean;
  statusText: (value: string) => string;
  timeText: (value: string) => string;
  stabilityText: (value: string | undefined) => string;
  riskText: (value: string | undefined) => string;
  missingText: (candidate: SourcingCandidate) => string[];
}>();
const emit = defineEmits<{
  choose: [candidate: SourcingCandidate, event: Event];
  confirmQuote: [candidate: SourcingCandidate];
}>();
</script>

<template>
  <section v-if="candidates.length" class="supplier-offer-list" aria-label="供应商报价列表">
    <table class="supplier-offer-table">
      <caption>
        当前找货记录的真实供应商报价
      </caption>
      <colgroup>
        <col class="offer-product-column" />
        <col class="offer-price-column" />
        <col class="offer-terms-column" />
        <col class="offer-state-column" />
        <col class="offer-actions-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">商品 / 供应商</th>
          <th scope="col">原币报价</th>
          <th scope="col">起订 / 交期</th>
          <th scope="col">状态 / 观测时间</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in candidates" :key="item.id" :data-ready="Boolean(item.quote)">
          <td class="supplier-offer-product">
            <h4 :title="item.product_title">{{ item.product_title }}</h4>
            <p class="supplier-offer-name">{{ item.supplier_name }}</p>
            <p v-if="item.source_sku">{{ item.specification || "SKU 规格未提供" }}</p>
            <SupplierSkuFacts v-if="item.source_sku" :sku="item.source_sku" />
            <details>
              <summary :aria-label="'查看' + item.supplier_name + '的证据与详情'">
                证据与详情
              </summary>
              <dl>
                <div>
                  <dt>商品完整标题</dt>
                  <dd>{{ item.product_title }}</dd>
                </div>
                <div>
                  <dt>规格</dt>
                  <dd>{{ item.specification ?? "缺失" }}</dd>
                </div>
                <div>
                  <dt>所在地</dt>
                  <dd>{{ item.location ?? "缺失" }}</dd>
                </div>
                <div>
                  <dt>可信度</dt>
                  <dd>{{ item.confidence_value == null ? "待确认" : item.confidence_value }}</dd>
                </div>
                <div>
                  <dt>稳定性 / 风险</dt>
                  <dd>
                    {{ stabilityText(item.quote?.stability_status) }} /
                    {{ riskText(item.quote?.risk_level) }}
                  </dd>
                </div>
                <div>
                  <dt>到岸价</dt>
                  <dd>待费用规则计算</dd>
                </div>
                <div>
                  <dt>原始采集</dt>
                  <dd>
                    <time :datetime="item.observed_at"
                      >采集于 {{ timeText(item.observed_at) }}</time
                    >
                  </dd>
                </div>
                <div>
                  <dt>采集证据</dt>
                  <dd>
                    <code>证据 {{ item.evidence_id }}</code>
                  </dd>
                </div>
                <div v-if="item.quote">
                  <dt>报价证据</dt>
                  <dd>
                    <code>{{ item.quote.evidence_id ?? "缺失" }}</code>
                  </dd>
                </div>
                <div v-if="item.missing_fields.length">
                  <dt>待补齐</dt>
                  <dd>{{ missingText(item).join("、") }}</dd>
                </div>
              </dl>
            </details>
          </td>
          <td class="supplier-offer-price" data-label="原币报价">
            <strong>{{ item.currency }} {{ item.quoted_price }}</strong>
            <small v-if="item.source_sku_pending && !item.quote">图搜参考价，SKU 尚未绑定</small>
            <span
              v-if="!item.quote && item.source_price_description"
              class="supplier-offer-price-note"
            >
              <small>采集价格说明</small><span>{{ item.source_price_description }}</span>
            </span>
          </td>
          <td class="supplier-offer-terms" data-label="起订 / 交期">
            <span
              >MOQ <b>{{ item.moq ?? "待确认" }}</b></span
            >
            <span>{{
              item.lead_time_days == null ? "交期待确认" : item.lead_time_days + " 天"
            }}</span>
          </td>
          <td class="supplier-offer-state" data-label="状态 / 观测时间">
            <span class="supplier-offer-status">{{
              item.quote ? "已确认报价" : statusText(item.status)
            }}</span>
            <small v-if="item.missing_fields.length">缺 {{ item.missing_fields.length }} 项</small>
            <time :datetime="item.quote?.observed_at ?? item.observed_at">{{
              timeText(item.quote?.observed_at ?? item.observed_at)
            }}</time>
          </td>
          <td class="supplier-offer-actions" data-label="操作">
            <a
              :href="item.original_url"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="打开外部原始商品页（新窗口）"
              >原商品 ↗</a
            >
            <label v-if="canManage && item.quote"
              ><input
                type="checkbox"
                :checked="selectedQuotes.includes(item.quote.id)"
                @change="emit('choose', item, $event)"
              />加入对比</label
            >
            <button
              v-if="canManage && !item.quote"
              type="button"
              class="ghost"
              @click="emit('confirmQuote', item)"
            >
              确认报价
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
