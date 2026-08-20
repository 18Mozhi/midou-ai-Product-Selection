<script setup lang="ts">
import { statusLabel } from "../ui/status-labels";

interface ProfitAnalysis {
  latest_run: null | {
    status: "calculated" | "insufficient_data";
    rule_version_code: string;
    currency: string | null;
    sale_price: number | null;
    total_cost: number | null;
    net_profit: number | null;
    net_margin_percent: number | null;
    missing_fields: string[];
    components: Array<{
      component_type: string;
      source_amount: number | null;
      source_currency: string | null;
      converted_amount: number | null;
      target_currency: string | null;
      source_ref_id: string | null;
      evidence_id: string | null;
      exchange_quote_id: string | null;
      missing_reason: string | null;
    }>;
  };
}

defineProps<{
  profit: ProfitAnalysis | null;
  costForm: {
    platform: string;
    input_type: "sale_price" | "purchase_price" | "logistics";
    amount_value: number;
    currency: string;
    source_type: string;
    source_ref_id: string;
    evidence_id: string;
    observed_at: string;
  };
  busy: boolean;
}>();

defineEmits<{
  confirmCost: [];
  queueProfit: [];
}>();
</script>

<template>
  <section class="opportunity-profit">
    <header>
      <div>
        <p>利润与成本</p>
        <h4>利润与成本</h4>
        <span>净利润 = 含税售价 − 采购 − 物流 − 平台费 − 支付手续费 − 税费 − 履约成本</span>
      </div>
      <RouterLink to="/sourcing/cost-rules">管理费用规则</RouterLink>
    </header>
    <div
      v-if="profit?.latest_run?.status === 'calculated'"
      class="profit-summary"
      :data-status="profit.latest_run.status"
    >
      <article>
        <small>状态</small><strong>{{ statusLabel(profit.latest_run.status) }}</strong
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
      v-if="!profit?.latest_run || profit.latest_run.status === 'insufficient_data'"
      class="profit-missing"
    >
      <strong>数据不足，不能生成可靠 ROI</strong
      ><span>缺失：{{ profit?.latest_run?.missing_fields.join("、") || "尚无利润计算运行" }}</span>
    </aside>
    <div v-if="profit?.latest_run" class="profit-components">
      <article
        v-for="item in profit.latest_run.components"
        :key="item.component_type"
        :data-missing="Boolean(item.missing_reason)"
      >
        <header>
          <strong>{{ item.component_type }}</strong
          ><b>{{ item.converted_amount ?? "缺失" }} {{ item.target_currency ?? "" }}</b>
        </header>
        <span>原始 {{ item.source_amount ?? "—" }} {{ item.source_currency ?? "" }}</span
        ><small>来源 {{ item.source_ref_id ?? "—" }} · 证据 {{ item.evidence_id ?? "—" }}</small
        ><small v-if="item.exchange_quote_id">汇率快照 {{ item.exchange_quote_id }}</small
        ><em v-if="item.missing_reason">{{ item.missing_reason }}</em>
      </article>
    </div>
    <form class="profit-input" @submit.prevent="$emit('confirmCost')">
      <h5>确认成本输入</h5>
      <label>平台<input v-model="costForm.platform" required maxlength="80" /></label>
      <label
        >类型<select v-model="costForm.input_type">
          <option value="sale_price">含税售价</option>
          <option value="purchase_price">采购价</option>
          <option value="logistics">物流</option>
        </select></label
      >
      <label
        >金额<input
          v-model.number="costForm.amount_value"
          required
          type="number"
          min="0"
          step="0.000001"
      /></label>
      <label>币种<input v-model="costForm.currency" required maxlength="3" /></label>
      <label>来源类型<input v-model="costForm.source_type" required maxlength="80" /></label>
      <label>来源标识<input v-model="costForm.source_ref_id" required maxlength="255" /></label>
      <label>证据 ID<input v-model="costForm.evidence_id" required maxlength="36" /></label>
      <label>观测时间<input v-model="costForm.observed_at" required type="datetime-local" /></label>
      <footer>
        <button type="submit" :disabled="busy">确认当前输入</button
        ><button type="button" :disabled="busy" @click="$emit('queueProfit')">重新计算</button>
      </footer>
    </form>
  </section>
</template>
