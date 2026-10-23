<script setup lang="ts">
import { nextTick, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import { sanitizeCorrelationId } from "../ui/state-contract";
import type { SourcingCandidate } from "./sourcing-workspace-types";

type DialogFailure = {
  dialog: "quote";
  message: string;
  requestId: string;
};

const props = defineProps<{
  quoteCandidate: SourcingCandidate | null;
  quote: {
    moq: number;
    specification: string;
    lead_time_days: number;
    location: string;
    confidence_value: number;
    stability_status: string;
    risk_level: string;
    observed_at: string;
    evidence_id: string;
  };
  evidenceOptions: Array<{ id: string; label: string }>;
  busy: boolean;
  failure: DialogFailure | null;
}>();
const emit = defineEmits<{
  closeQuote: [];
  confirmQuote: [];
}>();
const failureFor = (dialog: DialogFailure["dialog"]) =>
  props.failure?.dialog === dialog ? props.failure : null;
const pageHeading = () => document.querySelector<HTMLElement>("#sourcing-page-title"),
  { dialogElement: quoteDialog, handleCancel: handleQuoteCancel } = useModalDialog(
    () => Boolean(props.quoteCandidate),
    () => emit("closeQuote"),
    pageHeading,
    { trapFocus: true },
  );
function focusFirst(dialog: () => HTMLDialogElement | null) {
  void nextTick(() =>
    window.requestAnimationFrame(() => {
      const element = dialog();
      if (element?.open)
        element.querySelector<HTMLElement>("select, input, textarea, button")?.focus();
    }),
  );
}
watch(
  () => props.quoteCandidate,
  (value) => value && focusFirst(() => quoteDialog.value),
);
</script>

<template>
  <dialog
    v-if="quoteCandidate"
    ref="quoteDialog"
    class="sourcing-modal"
    aria-labelledby="sourcing-quote-title"
    @cancel="handleQuoteCancel"
  >
    <form
      :aria-describedby="failureFor('quote') ? 'sourcing-quote-error' : undefined"
      @submit.prevent="emit('confirmQuote')"
    >
      <header>
        <h3 id="sourcing-quote-title">确认完整供应商报价</h3>
        <button
          type="button"
          aria-label="关闭报价编辑"
          title="关闭报价编辑"
          @click="emit('closeQuote')"
        >
          ×
        </button>
      </header>
      <section class="sourcing-quote-context" aria-label="当前确认报价对象">
        <h4>{{ quoteCandidate.product_title }}</h4>
        <dl>
          <div>
            <dt>供应商</dt>
            <dd>{{ quoteCandidate.supplier_name }}</dd>
          </div>
          <div>
            <dt>候选报价（原币）</dt>
            <dd>{{ quoteCandidate.currency }} {{ quoteCandidate.quoted_price }}</dd>
          </div>
        </dl>
      </section>
      <label>规格<input v-model="quote.specification" required /></label>
      <div class="form-grid">
        <label>最小起订量<input v-model.number="quote.moq" type="number" min="1" required /></label>
        <label
          >交期（天）<input v-model.number="quote.lead_time_days" type="number" min="0" required
        /></label>
        <label>所在地<input v-model="quote.location" required /></label>
        <label
          >可信度（0–100）<input
            v-model.number="quote.confidence_value"
            type="number"
            min="0"
            max="100"
            required
        /></label>
        <label
          >稳定性<select v-model="quote.stability_status">
            <option value="stable">稳定</option>
            <option value="variable">波动</option>
            <option value="unknown">未知</option>
          </select></label
        >
        <label
          >风险<select v-model="quote.risk_level">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="unknown">未知</option>
          </select></label
        >
        <label>观测时间<input v-model="quote.observed_at" type="datetime-local" required /></label>
      </div>
      <label
        >确认依据证据（可搜索）<input
          v-model="quote.evidence_id"
          type="search"
          list="sourcing-evidence-options"
          required
          placeholder="输入证据编号或从候选中选择"
      /></label>
      <datalist id="sourcing-evidence-options">
        <option v-for="option in evidenceOptions" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </datalist>
      <p
        v-if="failureFor('quote')"
        id="sourcing-quote-error"
        class="sourcing-dialog-error"
        role="alert"
      >
        {{ failureFor("quote")?.message }}
        <code v-if="sanitizeCorrelationId(failureFor('quote')?.requestId)">
          请求编号 {{ sanitizeCorrelationId(failureFor("quote")?.requestId) }}
        </code>
      </p>
      <footer>
        <button type="button" class="ghost" @click="emit('closeQuote')">取消</button
        ><button type="submit" :disabled="busy">确认新版本</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.sourcing-quote-context {
  margin: 16px 0;
  padding: 14px 0;
  border-block: 1px solid var(--so-border);
}
.sourcing-quote-context h4 {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.sourcing-quote-context dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin: 0;
}
.sourcing-quote-context dt {
  color: var(--so-text-muted);
  font-size: 12px;
}
.sourcing-quote-context dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .sourcing-quote-context dl {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
