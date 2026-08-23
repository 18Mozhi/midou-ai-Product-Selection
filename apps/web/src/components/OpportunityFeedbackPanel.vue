<script setup lang="ts">
import type { OpportunityDetail } from "./opportunity-workspace-types";

defineProps<{
  feedback: OpportunityDetail["operating_feedback"];
  form: {
    period_start: string;
    period_end: string;
    sales_units: number;
    revenue_amount: number;
    ad_spend_amount: number;
    returned_units: number;
    purchase_lead_time_days: number;
    actual_profit_amount: number;
    currency: string;
    source_ref: string;
    notes: string;
    observed_at: string;
  };
  busy: boolean;
}>();
defineEmits<{ submit: [] }>();
const metric = (value: number | null, suffix = "") =>
  value == null ? "没有可比基线" : (value > 0 ? "+" : "") + value + suffix;
</script>

<template>
  <section class="opportunity-feedback">
    <header>
      <div>
        <p>经营复盘事实</p>
        <h4>决策后反馈</h4>
        <span>事实用于人工校准规则和提示偏差，不会自动改规则或替你决策。</span>
      </div>
      <b>{{ feedback.facts.length }} 期</b>
    </header>
    <article v-if="feedback.calibration" class="opportunity-feedback-calibration">
      <div>
        <span>实际退货率</span>
        <strong>{{ metric(feedback.calibration.return_rate_percent, "%") }}</strong>
      </div>
      <div>
        <span>广告投入占比</span>
        <strong>{{ metric(feedback.calibration.ad_spend_ratio_percent, "%") }}</strong>
      </div>
      <div>
        <span>利润预测偏差</span>
        <strong
          >{{ metric(feedback.calibration.profit_variance_amount) }}
          {{ feedback.calibration.profit_variance_currency ?? "" }}</strong
        >
      </div>
      <div>
        <span>采购交期偏差</span>
        <strong>{{ metric(feedback.calibration.lead_time_variance_days, " 天") }}</strong>
      </div>
      <footer>
        评分规则 {{ feedback.calibration.score_rule_version ?? "无快照" }} · 利润规则
        {{ feedback.calibration.profit_rule_version ?? "无快照" }} ·
        {{ feedback.calibration.decision_status_snapshot }}
      </footer>
    </article>
    <form @submit.prevent="$emit('submit')">
      <label>周期开始<input v-model="form.period_start" type="date" required /></label>
      <label>周期结束<input v-model="form.period_end" type="date" required /></label>
      <label
        >实际销量<input v-model.number="form.sales_units" type="number" min="0" required
      /></label>
      <label
        >实际销售额<input
          v-model.number="form.revenue_amount"
          type="number"
          min="0"
          step="0.000001"
          required
      /></label>
      <label
        >实际广告花费<input
          v-model.number="form.ad_spend_amount"
          type="number"
          min="0"
          step="0.000001"
          required
      /></label>
      <label
        >实际退货量<input v-model.number="form.returned_units" type="number" min="0" required
      /></label>
      <label
        >实际采购交期（天）<input
          v-model.number="form.purchase_lead_time_days"
          type="number"
          min="0"
          max="3650"
          required
      /></label>
      <label
        >实际利润<input
          v-model.number="form.actual_profit_amount"
          type="number"
          step="0.000001"
          required
      /></label>
      <label
        >币种<input v-model.trim="form.currency" maxlength="3" pattern="[A-Za-z]{3}" required
      /></label>
      <label class="wide"
        >事实来源<input
          v-model.trim="form.source_ref"
          maxlength="255"
          placeholder="ERP 报表编号、财务表编号或人工核对来源"
          required
      /></label>
      <label class="wide"
        >复盘说明<textarea v-model.trim="form.notes" maxlength="1000" rows="3"></textarea>
      </label>
      <button type="submit" :disabled="busy">{{ busy ? "正在写入…" : "写入复盘事实" }}</button>
    </form>
    <p v-if="!feedback.facts.length" class="opportunity-empty-copy">尚无经营复盘事实。</p>
    <ol v-else>
      <li v-for="fact in feedback.facts" :key="fact.id">
        <div>
          <strong>{{ fact.period_start }} 至 {{ fact.period_end }}</strong>
          <span
            >销量 {{ fact.sales_units }} · 广告 {{ fact.ad_spend_amount }} · 退货
            {{ fact.returned_units }} · 交期 {{ fact.purchase_lead_time_days }} 天 · 利润
            {{ fact.actual_profit_amount }} {{ fact.currency }}</span
          >
          <small>来源：{{ fact.source_ref }} · 决策快照：{{ fact.decision_status_snapshot }}</small>
        </div>
        <details>
          <summary>审计链路</summary>
          <code>request_id: {{ fact.request_id }}</code>
          <code>trace_id: {{ fact.trace_id }}</code>
        </details>
      </li>
    </ol>
  </section>
</template>
