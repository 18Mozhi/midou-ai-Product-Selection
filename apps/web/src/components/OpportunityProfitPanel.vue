<script setup lang="ts">
import { computed } from "vue";
import type { OpportunityProfitAnalysis as ProfitAnalysis } from "./opportunity-workspace-types";
import {
  opportunityProfitComponentLabel,
  opportunityStatusLabel,
} from "./opportunity-workspace-presentation";
const props = withDefaults(
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
const purchaseInputs = computed(
  () => props.profit?.current_inputs.filter((item) => item.input_type === "purchase_price") ?? [],
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
      <span>选品详情仍可继续查看。</span>
    </aside>
    <aside v-else-if="profitLoadState === 'error'" class="profit-missing" role="alert">
      <strong>利润与成本暂不可用</strong>
      <span>{{ profitErrorMessage || "暂时无法读取利润与成本，请稍后重试。" }}</span>
      <span v-if="profitRequestId">追踪编号：{{ profitRequestId }}</span>
      <span v-if="profit">已保留上次成功读取的利润结果。</span>
      <span v-else>选品详情仍可查看；利润数据尚未成功读取。</span>
      <button type="button" :disabled="busy" @click="$emit('retryProfit')">重新读取利润数据</button>
    </aside>
    <section
      v-if="profitLoadState === 'ready'"
      class="profit-current-input"
      aria-label="当前采购输入"
    >
      <h5>当前采购输入</h5>
      <template v-if="purchaseInputs.length">
        <div
          v-for="purchaseInput in purchaseInputs"
          :key="`${purchaseInput.platform}:${purchaseInput.input_version}:${purchaseInput.evidence_id}`"
        >
          <span>{{ purchaseInput.platform }} · </span>
          <strong>{{ purchaseInput.currency }} {{ purchaseInput.amount_value }}</strong>
          <span
            >{{
              purchaseInput.confirmation_mode === "automatic_evidence" ? "自动证据记录" : "人工记录"
            }}
            · v{{ purchaseInput.input_version }}</span
          >
          <small class="profit-observed-at"
            >观测时间：<time
              v-if="purchaseInput.observed_at"
              :datetime="purchaseInput.observed_at"
              >{{ purchaseInput.observed_at }}</time
            ><span v-else>未知</span></small
          >
          <details>
            <summary>采购输入依据</summary>
            <p>来源 {{ purchaseInput.source_ref_id }} · 证据 {{ purchaseInput.evidence_id }}</p>
            <p>记录类型不代表双人复核已完成；是否进入利润计算以下方计算依据为准。</p>
          </details>
        </div>
      </template>
      <p v-else>采购输入未知：尚无当前采购价。货源候选报价不等于已匹配进货价。</p>
    </section>
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
      <section v-if="profit?.latest_run" class="profit-run-record" aria-label="利润计算记录">
        <h5>已保存的计算记录</h5>
        <p class="profit-run-record-note">
          这是已保存的计算运行，不代表已按当前输入重新计算；当前利润是否可用以上方状态为准。
        </p>
        <dl>
          <div>
            <dt>运行编号</dt>
            <dd>
              <code>{{ profit.latest_run.id || "未知" }}</code>
            </dd>
          </div>
          <div>
            <dt>计算时间（原始时间）</dt>
            <dd>
              <time
                v-if="profit.latest_run.calculated_at"
                :datetime="profit.latest_run.calculated_at"
                >{{ profit.latest_run.calculated_at }}</time
              ><span v-else>未知</span>
            </dd>
          </div>
          <div>
            <dt>平台</dt>
            <dd>{{ profit.latest_run.platform || "未知" }}</dd>
          </div>
          <div>
            <dt>市场</dt>
            <dd>{{ profit.latest_run.market || "未知" }}</dd>
          </div>
          <div>
            <dt>规则版本</dt>
            <dd>{{ profit.latest_run.rule_version_code || "未知" }}</dd>
          </div>
          <div>
            <dt>运行状态</dt>
            <dd>{{ opportunityStatusLabel(profit.latest_run.status) }}</dd>
          </div>
          <div>
            <dt>计算币种</dt>
            <dd>{{ profit.latest_run.currency || "未知" }}</dd>
          </div>
        </dl>
      </section>
      <p v-else class="profit-run-record-note">
        暂无保存的利润计算记录；下列为当前成本输入，不代表已有利润结果。
      </p>
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
        <h5>当前成本输入</h5>
        <article v-for="item in profit.current_inputs" :key="`${item.platform}:${item.input_type}`">
          <strong>{{ inputLabel(item.input_type) }}</strong>
          <span>{{ item.amount_value }} {{ item.currency }} · {{ item.platform }}</span>
          <small
            >v{{ item.input_version }} ·
            {{ item.confirmation_mode === "automatic_evidence" ? "自动证据记录" : "人工记录" }}
            · {{ item.source_ref_id }}</small
          >
          <small>证据 {{ item.evidence_id || "未知" }}</small>
          <small class="profit-observed-at"
            >观测时间：<time v-if="item.observed_at" :datetime="item.observed_at">{{
              item.observed_at
            }}</time
            ><span v-else>未知</span></small
          >
        </article>
      </section>
    </details>
  </section>
</template>

<style scoped>
.profit-run-record {
  margin: 12px 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--so-border);
  overflow-wrap: anywhere;
}
.profit-run-record h5 {
  margin: 0 0 8px;
  font-size: 14px;
}
.opportunity-profit .profit-run-record-note {
  color: var(--so-text-muted);
  font-weight: 400;
  letter-spacing: normal;
  line-height: 1.6;
}
.profit-run-record dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 12px 0 0;
}
.profit-run-record :is(dt, dd) {
  min-width: 0;
  margin: 0;
  font-weight: 400;
}
.profit-run-record dt {
  margin-bottom: 4px;
  color: var(--so-text-muted);
}
.profit-observed-at {
  display: block;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .profit-run-record dl {
    grid-template-columns: minmax(0, 1fr);
  }
}

.profit-current-input {
  padding: 12px 0;
  margin: 12px 0;
  border-block: 1px solid var(--so-border);
}
.profit-current-input h5 {
  margin: 0 0 8px;
  font-size: 14px;
}
.profit-current-input > strong {
  margin-right: 12px;
}
.profit-current-input p {
  overflow-wrap: anywhere;
}
</style>
