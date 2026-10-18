<script setup lang="ts">
import type { OpportunityProfitAnalysis as ProfitAnalysis } from "./opportunity-workspace-types";
import {
  opportunityProfitComponentLabel,
  opportunityStatusLabel,
} from "./opportunity-workspace-presentation";
withDefaults(
  defineProps<{
    profit: ProfitAnalysis | null;
    profitStatus?: string | null;
    profitLoadState?: "loading" | "ready" | "error";
    profitErrorMessage?: string;
    profitRequestId?: string;
    busy: boolean;
  }>(),
  { profitStatus: null, profitLoadState: "ready", profitErrorMessage: "", profitRequestId: "" },
);
defineEmits<{ retryProfit: [] }>();
const inputLabel = (value: string) =>
  ({ sale_price: "含税售价", purchase_price: "采购价", logistics: "物流" })[value] ?? value;
</script>

<template>
  <section class="opportunity-profit">
    <header>
      <div>
        <h4>利润与成本</h4>
        <span>净利润 = 含税售价 − 采购 − 物流 − 平台费 − 支付手续费 − 税费 − 履约成本</span>
      </div>
    </header>
    <aside v-if="profitLoadState === 'loading'" class="profit-missing" role="status">
      <strong>正在读取利润与成本</strong>
      <span>机会详情仍可继续查看。</span>
    </aside>
    <aside v-else-if="profitLoadState === 'error'" class="profit-missing" role="alert">
      <strong>利润与成本暂不可用</strong>
      <span>{{ profitErrorMessage || "暂时无法读取利润与成本，请稍后重试。" }}</span>
      <span v-if="profitRequestId">追踪编号：{{ profitRequestId }}</span>
      <span v-if="profit">已保留上次成功读取的利润结果。</span>
      <span v-else>机会详情仍可查看；利润数据尚未成功读取。</span>
      <button type="button" :disabled="busy" @click="$emit('retryProfit')">重新读取利润数据</button>
    </aside>
    <div
      v-if="profit?.latest_run?.status === 'calculated' && profitStatus === 'calculated'"
      class="profit-summary"
      :data-status="profit.latest_run.status"
    >
      <article>
        <small>状态</small><strong>{{ opportunityStatusLabel(profit.latest_run.status) }}</strong
        ><span>规则 {{ profit.latest_run.rule_version_code }}</span>
      </article>
      <article>
        <small>含税售价</small
        ><strong
          >{{ profit.latest_run.sale_price ?? "—" }} {{ profit.latest_run.currency ?? "" }}</strong
        >
      </article>
      <article>
        <small>总成本</small
        ><strong
          >{{ profit.latest_run.total_cost ?? "—" }} {{ profit.latest_run.currency ?? "" }}</strong
        >
      </article>
      <article>
        <small>净利润 / 净利率</small
        ><strong
          >{{ profit.latest_run.net_profit ?? "—" }} {{ profit.latest_run.currency ?? "" }}</strong
        ><span>{{ profit.latest_run.net_margin_percent ?? "—" }}%</span>
      </article>
    </div>
    <aside
      v-if="
        profitLoadState === 'ready' &&
        (profitStatus !== 'calculated' ||
          !profit?.latest_run ||
          profit.latest_run.status === 'insufficient_data')
      "
      class="profit-missing"
    >
      <strong>利润未知</strong>
      <span
        v-if="profitStatus === 'insufficient_data' && profit?.latest_run?.status === 'calculated'"
        >当前利润尚不能确认；下方保留上次计算明细，不作为当前利润。</span
      >
      <span v-else
        >缺失：{{ profit?.latest_run?.missing_fields.join("、") || "尚无利润计算运行" }}</span
      >
    </aside>
    <details
      v-if="profit?.latest_run || profit?.current_inputs.length"
      class="profit-calculation-evidence"
    >
      <summary>查看计算依据</summary>
      <div v-if="profit?.latest_run" class="profit-components">
        <article
          v-for="item in profit.latest_run.components"
          :key="item.component_type"
          :data-missing="Boolean(item.missing_reason)"
        >
          <header>
            <strong>{{ opportunityProfitComponentLabel(item.component_type) }}</strong
            ><b>{{ item.converted_amount ?? "缺失" }} {{ item.target_currency ?? "" }}</b>
          </header>
          <span>原始 {{ item.source_amount ?? "—" }} {{ item.source_currency ?? "" }}</span
          ><small>来源 {{ item.source_ref_id ?? "—" }} · 证据 {{ item.evidence_id ?? "—" }}</small
          ><small v-if="item.exchange_quote_id">汇率快照 {{ item.exchange_quote_id }}</small
          ><em v-if="item.missing_reason">{{ item.missing_reason }}</em>
        </article>
      </div>
      <section v-if="profit?.current_inputs.length" class="profit-current-inputs">
        <h5>已生效成本</h5>
        <article v-for="item in profit.current_inputs" :key="`${item.platform}:${item.input_type}`">
          <strong>{{ inputLabel(item.input_type) }}</strong>
          <span>{{ item.amount_value }} {{ item.currency }} · {{ item.platform }}</span>
          <small
            >v{{ item.input_version }} ·
            {{
              item.confirmation_mode === "automatic_evidence" ? "爬虫证据自动确认" : "人工双人复核"
            }}
            · {{ item.source_ref_id }}</small
          >
        </article>
      </section>
    </details>
  </section>
</template>
