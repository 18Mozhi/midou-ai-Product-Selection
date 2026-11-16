<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type { OpportunityProfitAnalysis } from "./opportunity-workspace-types";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  apiBaseUrl: string;
  opportunityId: string;
  returnPath: string;
  besideEmptyOffers?: boolean;
  basisTarget?: HTMLElement | null;
}>();
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
      <div>
        <h4>成本与利润</h4>
        <p
          v-if="state === 'ready' && !calculated && besideEmptyOffers"
          class="sourcing-profit-unconfirmed"
        >
          当前利润结果未知<span v-if="profit?.latest_run?.missing_fields.length">
            · {{ profit.latest_run.missing_fields.join("、") }}</span
          >
        </p>
      </div>
      <RouterLink
        :to="{
          path: `/opportunities/${opportunityId}`,
          query: { tab: 'profit', from: returnPath },
        }"
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
      <template v-else-if="besideEmptyOffers">
        <dl class="sourcing-profit-unconfirmed-breakdown" aria-label="未确认的成本与利润">
          <div v-for="label in ['采购成本', '头程费用', '平台费用', '预计利润']" :key="label">
            <dt>{{ label }}</dt>
            <dd aria-label="未确认">—</dd>
          </div>
        </dl>
      </template>
      <p v-else>
        <strong>利润未知</strong> ·
        {{ profit?.latest_run?.missing_fields.join("、") || "尚无可确认的当前利润结果" }}
      </p>
      <Teleport :to="basisTarget ?? undefined" :disabled="!basisTarget">
        <details
          v-if="besideEmptyOffers || profit?.current_inputs.length || profit?.latest_run"
          class="sourcing-profit-basis"
        >
          <summary>
            <AppIcon v-if="basisTarget" name="chevron" :size="16" />
            {{ basisTarget ? "计算依据" : "查看计算依据" }}
          </summary>
          <p v-if="!profit?.latest_run && !profit?.current_inputs.length">
            暂无已保存的成本输入或利润计算记录。
          </p>
          <p v-if="profit?.latest_run">
            规则 {{ profit.latest_run.rule_version_code }} · {{ profit.latest_run.calculated_at
            }}<span v-if="!calculated"> · 历史结果不作为当前利润</span>
          </p>
          <ul v-if="profit?.current_inputs.length">
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
      </Teleport>
    </template>
  </section>
</template>
