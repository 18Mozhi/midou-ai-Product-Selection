<script setup lang="ts">
import { sanitizeCorrelationId } from "../ui/state-contract";
import type { SourcingComparisonFailure } from "../composables/useSourcingComparisons";
import { specificationHint } from "./sourcing-comparison-specification";
import type { SourcingComparison } from "./sourcing-workspace-types";

defineProps<{
  comparisons: SourcingComparison[];
  failure: SourcingComparisonFailure | null;
  loading: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="sourcing-comparisons">
    <header>
      <div>
        <small>已保存记录</small>
        <h4>供应商报价对比历史</h4>
      </div>
      <span>{{ comparisons.length }} 份</span>
    </header>
    <div v-if="loading" class="sourcing-comparison-loading" role="status" aria-live="polite">
      正在读取已保存的对比记录…
    </div>
    <section v-if="failure" class="sourcing-comparison-error" role="status" aria-live="polite">
      <div>
        <strong>对比历史暂未读取</strong>
        <p v-if="failure.retainedSnapshot">
          本次读取未完成，仍显示上次成功读取的记录；当前找货列表和候选可以继续查看。
        </p>
        <p v-else>本次读取未完成。找货列表和候选仍可查看；历史记录不会被当作空列表。</p>
        <small>{{ failure.actionHint }}</small>
        <code v-if="sanitizeCorrelationId(failure.requestId)">
          请求编号 {{ sanitizeCorrelationId(failure.requestId) }}
        </code>
      </div>
      <button v-if="failure.retryable" type="button" :disabled="loading" @click="emit('retry')">
        重新读取对比历史
      </button>
    </section>
    <article v-for="comparison in comparisons" :key="comparison.id">
      <header>
        <div>
          <b>{{ comparison.name }}</b
          ><small>{{
            new Date(comparison.created_at).toLocaleString("zh-CN", { hour12: false })
          }}</small>
        </div>
        <strong>{{ comparison.quotes.length }} 条报价记录</strong>
      </header>
      <p>保存时引用的报价记录，不代表当前最新报价或已作为进货价。</p>
      <aside
        class="sourcing-specification-hint"
        :data-status="specificationHint(comparison.quotes).status"
        aria-label="规格归一化提示"
      >
        <strong>{{ specificationHint(comparison.quotes).title }}</strong>
        <span>{{ specificationHint(comparison.quotes).detail }}</span>
      </aside>
      <div class="sourcing-quote-scroll" tabindex="0" aria-label="规格、最小起订量与交期对比">
        <table class="sourcing-quote-table">
          <caption class="so-visually-hidden">
            {{
              comparison.name
            }}：保存时引用的报价明细
          </caption>
          <thead>
            <tr>
              <th scope="col">商品 / 供应商</th>
              <th scope="col">规格</th>
              <th scope="col">最小起订量</th>
              <th scope="col">报价</th>
              <th scope="col">交期</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in comparison.quotes" :key="item.id">
              <th scope="row">
                <strong>{{ item.supplier_name }}</strong
                ><span>{{ item.product_title }}</span>
              </th>
              <td data-label="规格">{{ item.specification }}</td>
              <td data-label="最小起订量">{{ item.moq }}</td>
              <td data-label="报价">{{ item.currency }} {{ item.quoted_price }}</td>
              <td data-label="交期">{{ item.lead_time_days }} 天</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
    <p v-if="!comparisons.length && !failure && !loading">
      选择两家以上已确认报价后，可保存对比记录。
    </p>
  </section>
</template>

<style scoped src="../sourcing-comparison-table.css"></style>
