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
        <strong>{{ comparison.quotes.length }} 家现行报价</strong>
      </header>
      <aside
        class="sourcing-specification-hint"
        :data-status="specificationHint(comparison.quotes).status"
        aria-label="规格归一化提示"
      >
        <strong>{{ specificationHint(comparison.quotes).title }}</strong>
        <span>{{ specificationHint(comparison.quotes).detail }}</span>
      </aside>
      <div class="sourcing-comparison-grid" aria-label="规格、最小起订量与交期对比">
        <section v-for="item in comparison.quotes" :key="item.id">
          <b>{{ item.supplier_name }}</b
          ><small>{{ item.product_title }}</small>
          <dl>
            <div>
              <dt>规格</dt>
              <dd>{{ item.specification }}</dd>
            </div>
            <div>
              <dt>最小起订量</dt>
              <dd>{{ item.moq }}</dd>
            </div>
            <div>
              <dt>报价</dt>
              <dd>{{ item.currency }} {{ item.quoted_price }}</dd>
            </div>
            <div>
              <dt>交期</dt>
              <dd>{{ item.lead_time_days }} 天</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
    <p v-if="!comparisons.length && !failure && !loading">
      选择两家以上已确认报价后，可保存对比记录。
    </p>
  </section>
</template>
