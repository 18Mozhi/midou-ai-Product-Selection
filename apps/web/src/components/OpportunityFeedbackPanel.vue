<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { OpportunityDetail } from "./opportunity-workspace-types";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";

const props = defineProps<{
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
  canWrite: boolean;
  errorMessage: string;
  requestId: string;
  unknownWrite: boolean;
}>();
defineEmits<{ submit: []; retryUnknown: [] }>();

const showForm = ref(false);
const metric = (value: number | null, suffix = "", signed = false) => {
  if (value == null) return "没有可比基线";
  return `${signed && value > 0 ? "+" : ""}${value}${suffix}`;
};
const formIssues = computed(() => {
  const issues: string[] = [];
  if (
    props.form.period_start &&
    props.form.period_end &&
    props.form.period_end < props.form.period_start
  )
    issues.push("周期结束日期不能早于开始日期。");
  if (props.form.returned_units > props.form.sales_units) issues.push("退货量不能大于实际销量。");
  if (!Number.isInteger(props.form.sales_units) || !Number.isInteger(props.form.returned_units))
    issues.push("销量和退货量须为非负整数。");
  return issues;
});

watch(
  () => props.feedback,
  (feedback, previous) => {
    if (previous && feedback !== previous) showForm.value = false;
  },
);
</script>

<template>
  <section class="opportunity-feedback opportunity-feedback--c">
    <header class="opportunity-feedback-heading">
      <div>
        <p>已提交的经营事实</p>
        <h4>决策后反馈</h4>
        <span
          >当前仅展示接口返回的记录与服务端校准；历史事实不可改写，校准不会自动更新规则或决定。</span
        >
      </div>
      <strong>已返回 {{ feedback.facts.length }} 条</strong>
    </header>

    <section
      v-if="feedback.calibration"
      class="opportunity-feedback-calibration"
      aria-label="服务端校准快照"
    >
      <header>
        <div>
          <p>当前服务端快照</p>
          <h5>经营偏差参考</h5>
        </div>
        <span>需人工复核；不自动改规则或决策</span>
      </header>
      <dl>
        <div>
          <dt>实际退货率</dt>
          <dd>{{ metric(feedback.calibration.return_rate_percent, "%") }}</dd>
        </div>
        <div>
          <dt>广告投入占比</dt>
          <dd>{{ metric(feedback.calibration.ad_spend_ratio_percent, "%") }}</dd>
        </div>
        <div>
          <dt>利润预测偏差</dt>
          <dd>
            {{ metric(feedback.calibration.profit_variance_amount, "", true) }}
            {{ feedback.calibration.profit_variance_currency ?? "" }}
          </dd>
        </div>
        <div>
          <dt>采购交期偏差</dt>
          <dd>{{ metric(feedback.calibration.lead_time_variance_days, " 天", true) }}</dd>
        </div>
      </dl>
      <footer>
        评分规则 {{ feedback.calibration.score_rule_version ?? "无快照" }} · 利润规则
        {{ feedback.calibration.profit_rule_version ?? "无快照" }} · 决策
        {{ opportunityStatusLabel(feedback.calibration.decision_status_snapshot) }}
      </footer>
    </section>
    <p v-else class="opportunity-feedback-no-calibration">
      当前没有可比较的校准快照；页面不会用零值或其他周期补出基线。
    </p>

    <div v-if="canWrite" class="opportunity-feedback-actions">
      <button v-if="!showForm" type="button" :disabled="busy" @click="showForm = true">
        录入经营复盘
      </button>
      <button v-else type="button" :disabled="busy || unknownWrite" @click="showForm = false">
        返回已提交记录
      </button>
    </div>
    <aside v-else class="opportunity-feedback-readonly">
      当前角色可查看已提交事实；写入经营反馈需要“机会决策”权限。
    </aside>

    <form
      v-if="canWrite && showForm"
      class="opportunity-feedback-form"
      @submit.prevent="$emit('submit')"
    >
      <header>
        <p>新增事实 · 不修改历史行</p>
        <h5>记录实际经营表现</h5>
      </header>
      <fieldset :disabled="busy || unknownWrite">
        <legend>统计周期</legend>
        <div class="opportunity-feedback-fields">
          <label>周期开始<input v-model="form.period_start" type="date" required /></label>
          <label>周期结束<input v-model="form.period_end" type="date" required /></label>
        </div>
      </fieldset>
      <fieldset :disabled="busy || unknownWrite">
        <legend>销售与广告</legend>
        <div class="opportunity-feedback-fields">
          <label
            >实际销量<input
              v-model.number="form.sales_units"
              type="number"
              min="0"
              step="1"
              required
            /><small>按本周期实际销售件数填写。</small></label
          >
          <label
            >实际销售额<input
              v-model.number="form.revenue_amount"
              type="number"
              min="0"
              step="0.000001"
              required
            /><small>与所选币种一致。</small></label
          >
          <label
            >实际广告花费<input
              v-model.number="form.ad_spend_amount"
              type="number"
              min="0"
              step="0.000001"
              required
            /><small>不由页面推算广告占比。</small></label
          >
          <label
            >实际退货量<input
              v-model.number="form.returned_units"
              type="number"
              min="0"
              step="1"
              required
            /><small>不能高于实际销量。</small></label
          >
        </div>
      </fieldset>
      <fieldset :disabled="busy || unknownWrite">
        <legend>采购与利润</legend>
        <div class="opportunity-feedback-fields">
          <label
            >实际采购交期（天）<input
              v-model.number="form.purchase_lead_time_days"
              type="number"
              min="0"
              max="3650"
              step="1"
              required
            /><small>服务端允许范围为 0–3650 天。</small></label
          >
          <label
            >实际利润<input
              v-model.number="form.actual_profit_amount"
              type="number"
              step="0.000001"
              required
            /><small>允许填写负值，保留实际亏损。</small></label
          >
          <label
            >币种<input
              v-model.trim="form.currency"
              maxlength="3"
              pattern="[A-Za-z]{3}"
              required
            /><small>提交时按接口合同转为大写。</small></label
          >
        </div>
      </fieldset>
      <fieldset :disabled="busy || unknownWrite">
        <legend>来源与说明</legend>
        <div class="opportunity-feedback-fields">
          <label class="wide"
            >事实来源<input
              v-model.trim="form.source_ref"
              maxlength="255"
              placeholder="ERP 报表编号、财务表编号或人工核对来源"
              required
            /><small>保留可追溯的来源标识，最多 255 字符。</small></label
          >
          <label class="wide"
            >复盘说明<textarea v-model.trim="form.notes" maxlength="1000" rows="3" /><small
              >选填，最多 1000 字符。</small
            ></label
          >
        </div>
      </fieldset>

      <p v-if="formIssues.length" class="opportunity-feedback-validation" role="status">
        {{ formIssues.join(" ") }}
      </p>
      <div v-if="errorMessage" class="opportunity-feedback-write-error" role="alert">
        <strong>{{ unknownWrite ? "提交结果暂未确认" : "本次提交未成功" }}</strong>
        <p>{{ errorMessage }}</p>
        <small v-if="requestId">请求追踪：{{ requestId }}</small>
      </div>
      <div v-if="unknownWrite" class="opportunity-feedback-unknown" role="status">
        <p>已保留原始表单与请求标识。为避免重复记录，请勿另行修改后再次提交。</p>
        <button type="button" :disabled="busy" @click="$emit('retryUnknown')">
          {{ busy ? "正在安全重试…" : "使用同一请求标识恢复提交" }}
        </button>
      </div>
      <footer v-else>
        <button type="submit" :disabled="busy || formIssues.length > 0">
          {{ busy ? "正在写入…" : "提交新的经营事实" }}
        </button>
      </footer>
      <p class="opportunity-feedback-observed-at">
        观测时间由提交时记录；此表单不覆盖机会评分、利润运行或人工决定。
      </p>
    </form>

    <p v-if="!feedback.facts.length" class="opportunity-feedback-empty">
      尚无已返回的经营复盘记录。
    </p>
    <ol v-else class="opportunity-feedback-facts">
      <li v-for="fact in feedback.facts" :key="fact.id">
        <header>
          <div>
            <strong>{{ fact.period_start }} 至 {{ fact.period_end }}</strong>
            <small
              >销量 {{ fact.sales_units }} · 销售额 {{ fact.revenue_amount }} {{ fact.currency }} ·
              广告 {{ fact.ad_spend_amount }} {{ fact.currency }}</small
            >
          </div>
          <span>已提交事实</span>
        </header>
        <dl>
          <div>
            <dt>退货</dt>
            <dd>{{ fact.returned_units }}</dd>
          </div>
          <div>
            <dt>采购交期</dt>
            <dd>{{ fact.purchase_lead_time_days }} 天</dd>
          </div>
          <div>
            <dt>实际利润</dt>
            <dd>{{ fact.actual_profit_amount }} {{ fact.currency }}</dd>
          </div>
          <div>
            <dt>决策快照</dt>
            <dd>{{ opportunityStatusLabel(fact.decision_status_snapshot) }}</dd>
          </div>
        </dl>
        <p>事实来源：{{ fact.source_ref }}</p>
        <p v-if="fact.notes">复盘说明：{{ fact.notes }}</p>
        <details>
          <summary>不可变快照与审计链路</summary>
          <dl>
            <div>
              <dt>事实 ID</dt>
              <dd>
                <code>{{ fact.id }}</code>
              </dd>
            </div>
            <div>
              <dt>评分规则版本</dt>
              <dd>{{ fact.score_rule_version_snapshot ?? "未提供" }}</dd>
            </div>
            <div>
              <dt>利润规则版本</dt>
              <dd>{{ fact.profit_rule_version_snapshot ?? "未提供" }}</dd>
            </div>
            <div>
              <dt>预测利润</dt>
              <dd>
                {{ fact.predicted_profit_amount ?? "未提供" }} {{ fact.predicted_currency ?? "" }}
              </dd>
            </div>
            <div>
              <dt>报价交期</dt>
              <dd>
                {{ fact.quoted_lead_time_days ?? "未提供"
                }}{{ fact.quoted_lead_time_days === null ? "" : " 天" }}
              </dd>
            </div>
            <div>
              <dt>观测时间</dt>
              <dd>{{ fact.observed_at }}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ fact.created_at }}</dd>
            </div>
            <div>
              <dt>request_id</dt>
              <dd>
                <code>{{ fact.request_id }}</code>
              </dd>
            </div>
            <div>
              <dt>trace_id</dt>
              <dd>
                <code>{{ fact.trace_id }}</code>
              </dd>
            </div>
          </dl>
        </details>
      </li>
    </ol>
  </section>
</template>
