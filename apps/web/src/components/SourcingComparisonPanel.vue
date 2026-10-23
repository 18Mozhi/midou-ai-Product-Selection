<script setup lang="ts">
import { sanitizeCorrelationId } from "../ui/state-contract";
import type { SourcingComparisonFailure } from "../composables/useSourcingComparisons";
import type { SourcingComparison, SourcingComparisonQuote } from "./sourcing-workspace-types";

defineProps<{
  comparisons: SourcingComparison[];
  failure: SourcingComparisonFailure | null;
  loading: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
const specificationHint = (quotes: SourcingComparisonQuote[]) => {
  const raw = [...new Set(quotes.map((item) => item.specification.trim()))];
  const formatted = new Set(
    raw.map((value) => value.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase()),
  );
  if (raw.length === 1)
    return {
      status: "aligned",
      title: "规格文本一致",
      detail: "仍需按各自证据核对型号、容量、包装和计量单位。",
    };
  if (formatted.size === 1)
    return {
      status: "format_only",
      title: "规格仅存在格式差异",
      detail: "大小写、空格或全半角不同；保存新报价时可统一书写。",
    };
  return {
    status: "needs_review",
    title: `存在 ${raw.length} 种规格文本，尚未归一`,
    detail: "请先统一型号、容量、包装和计量单位再比较价格；系统不会自动换算或判断等价。",
  };
};
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

<style scoped>
.sourcing-quote-scroll {
  margin-top: 12px;
  overflow-x: auto;
}
.sourcing-quote-table {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: 13px;
  line-height: 1.6;
}
.sourcing-quote-table :is(th, td) {
  padding: 12px;
  border-bottom: 1px solid var(--so-border);
  vertical-align: top;
}
.sourcing-quote-table thead th {
  background: var(--so-panel-soft);
  white-space: nowrap;
  font-weight: 600;
  color: var(--so-text-muted);
}
.sourcing-quote-table thead th:first-child,
.sourcing-quote-table tbody th {
  position: sticky;
  left: 0;
  z-index: 1;
}
.sourcing-quote-table tbody th {
  width: 32%;
  background: var(--so-panel);
  font-weight: 400;
  overflow-wrap: anywhere;
}
.sourcing-quote-table tbody :is(strong, span) {
  display: block;
}
.sourcing-quote-table strong {
  font-weight: 600;
  margin-bottom: 6px;
}
.sourcing-quote-table tbody span {
  color: var(--so-text-muted);
}
.sourcing-quote-table td {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sourcing-quote-table td[data-label="规格"] {
  width: 28%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.sourcing-quote-scroll:focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .sourcing-quote-scroll {
    overflow: visible;
  }
  .sourcing-quote-table {
    display: block;
    min-width: 0;
  }
  .sourcing-quote-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .sourcing-quote-table tbody {
    display: block;
  }
  .sourcing-quote-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--so-border);
  }
  .sourcing-quote-table tbody :is(th, td) {
    width: auto;
    min-width: 0;
    padding: 0;
    border: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .sourcing-quote-table tbody th {
    position: static;
    z-index: auto;
    grid-column: 1 / -1;
    background: transparent;
  }
  .sourcing-quote-table td[data-label="规格"] {
    width: auto;
    grid-column: 1 / -1;
  }
  .sourcing-quote-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 5px;
    color: var(--so-text-muted);
  }
}
</style>
