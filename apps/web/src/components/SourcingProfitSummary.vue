<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type { OpportunityProfitAnalysis } from "./opportunity-workspace-types";

const props = defineProps<{ apiBaseUrl: string; opportunityId: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<"loading" | "ready" | "error">("loading");
const profit = ref<OpportunityProfitAnalysis | null>(null);
const profitStatus = ref("");
const failure = ref("");
const requestId = ref("");
let generation = 0;
let mounted = true;
let active = true;
const calculated = computed(
  () => profitStatus.value === "calculated" && profit.value?.latest_run?.status === "calculated",
);
const money = (amount: number | null | undefined, currency: string | null | undefined) =>
  amount != null && currency ? `${amount} ${currency}` : "未知";
async function load() {
  if (!active) return;
  const current = ++generation;
  const id = props.opportunityId;
  state.value = "loading";
  profit.value = null;
  profitStatus.value = "";
  failure.value = "";
  requestId.value = "";
  try {
    const [detail, analysis] = await Promise.all([
      request<{ profit_status: string }>(`/opportunities/${id}`),
      request<OpportunityProfitAnalysis>(`/opportunities/${id}/profit-analysis`),
    ]);
    if (!mounted || current !== generation || id !== props.opportunityId) return;
    profit.value = analysis.data;
    profitStatus.value = detail.data.profit_status;
    state.value = "ready";
  } catch (error) {
    if (!mounted || current !== generation || id !== props.opportunityId) return;
    failure.value = error instanceof ApiClientError ? error.actionHint : "暂时无法读取利润资料。";
    requestId.value = error instanceof ApiClientError ? error.requestId : "";
    state.value = "error";
  }
}
watch(() => props.opportunityId, load, { immediate: true });
onDeactivated(() => {
  active = false;
  generation++;
});
onActivated(() => {
  if (!active) {
    active = true;
    void load();
  }
});
onBeforeUnmount(() => {
  mounted = false;
  generation++;
});
</script>

<template>
  <section class="sourcing-profit-summary" aria-label="成本与利润摘要">
    <header>
      <h4>成本与利润</h4>
      <RouterLink :to="`/opportunities/${opportunityId}?tab=profit&from=/sourcing`"
        >查看商品分析</RouterLink
      >
    </header>
    <p v-if="state === 'loading'" role="status">正在读取利润资料</p>
    <div v-else-if="state === 'error'" role="alert">
      <p>
        {{ failure }} <code v-if="requestId">{{ requestId }}</code>
      </p>
      <button type="button" class="ghost" @click="load">重新读取利润资料</button>
    </div>
    <template v-else>
      <dl v-if="calculated && profit?.latest_run">
        <div>
          <dt>含税售价</dt>
          <dd>{{ money(profit.latest_run.sale_price, profit.latest_run.currency) }}</dd>
        </div>
        <div>
          <dt>总成本</dt>
          <dd>{{ money(profit.latest_run.total_cost, profit.latest_run.currency) }}</dd>
        </div>
        <div>
          <dt>净利润</dt>
          <dd>{{ money(profit.latest_run.net_profit, profit.latest_run.currency) }}</dd>
        </div>
        <div>
          <dt>净利率</dt>
          <dd>
            {{
              profit.latest_run.net_margin_percent == null
                ? "未知"
                : `${profit.latest_run.net_margin_percent}%`
            }}
          </dd>
        </div>
      </dl>
      <p v-else>
        <strong>利润未知</strong> ·
        {{ profit?.latest_run?.missing_fields.join("、") || "尚无可确认的当前利润结果" }}
      </p>
      <details v-if="profit?.current_inputs.length || profit?.latest_run">
        <summary>查看计算依据</summary>
        <p v-if="profit.latest_run">
          规则 {{ profit.latest_run.rule_version_code }} · {{ profit.latest_run.calculated_at
          }}<span v-if="!calculated"> · 历史结果不作为当前利润</span>
        </p>
        <ul>
          <li v-for="item in profit.current_inputs" :key="`${item.platform}:${item.input_type}`">
            <b>{{
              { sale_price: "含税售价", purchase_price: "采购价", logistics: "物流" }[
                item.input_type
              ]
            }}</b>
            {{ money(item.amount_value, item.currency) }} · {{ item.platform }} · 证据
            {{ item.evidence_id }} · {{ item.observed_at }}
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>
