<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import OpportunityProfitPanel from "./OpportunityProfitPanel.vue";
import type { OpportunityProfitAnalysis } from "./opportunity-workspace-types";

const props = defineProps<{ apiBaseUrl: string; opportunityId: string }>(),
  request = createApiClient(props.apiBaseUrl),
  profit = ref<OpportunityProfitAnalysis | null>(null),
  opportunityVersion = ref(0),
  reviewers = ref<Array<{ id: string; label: string }>>([]),
  busy = ref(false),
  message = ref(""),
  requestId = ref(""),
  costForm = reactive({
    platform: "amazon",
    input_type: "purchase_price" as "sale_price" | "purchase_price" | "logistics",
    amount_value: 0,
    currency: "USD",
    source_type: "supplier_quote",
    source_ref_id: "",
    evidence_id: "",
    observed_at: new Date().toISOString().slice(0, 16),
    reviewer_id: "",
  });

async function load() {
  busy.value = true;
  message.value = "";
  try {
    const [opportunity, analysis, reviewerList] = await Promise.all([
      request<any>(`/opportunities/${props.opportunityId}`),
      request<OpportunityProfitAnalysis>(`/opportunities/${props.opportunityId}/profit-analysis`),
      request<Array<{ id: string; label: string }>>("/cost-input-reviewers"),
    ]);
    opportunityVersion.value = Number(opportunity.data.version);
    profit.value = analysis.data;
    reviewers.value = reviewerList.data;
    requestId.value = analysis.request_id;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "成本复核依赖暂不可用。";
  } finally {
    busy.value = false;
  }
}

async function write(path: string, body: unknown) {
  busy.value = true;
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      return null;
    }
    message.value = "成本复核依赖暂不可用。";
    return null;
  } finally {
    busy.value = false;
  }
}

async function submitCost() {
  const result = await write(`/opportunities/${props.opportunityId}/cost-inputs`, {
    ...costForm,
    amount_value: Number(costForm.amount_value),
    observed_at: new Date(costForm.observed_at).toISOString(),
    expected_version: opportunityVersion.value,
  });
  if (!result) return;
  message.value = "成本已提交给指定复核人；通过前不会影响利润。";
  await load();
}

async function reviewCost(payload: {
  reviewId: string;
  decision: "approved" | "rejected";
  reason: string;
  expectedVersion: number;
}) {
  const result = await write(
    `/opportunities/${props.opportunityId}/cost-input-reviews/${payload.reviewId}/actions`,
    {
      decision: payload.decision,
      reason: payload.reason,
      expected_version: payload.expectedVersion,
    },
  );
  if (!result) return;
  message.value = payload.decision === "approved" ? "成本复核已通过并生效。" : "成本复核已驳回。";
  await load();
}

async function queueProfit() {
  const result = await write(`/opportunities/${props.opportunityId}/profit-runs`, {
    platform: costForm.platform,
    expected_version: opportunityVersion.value,
  });
  if (!result) return;
  message.value = "利润重算已进入 Worker 队列。";
  await load();
}

watch(() => props.opportunityId, load);
onMounted(load);
</script>

<template>
  <section class="sourcing-cost-confirmation">
    <header>
      <div>
        <small>机会成本闭环</small>
        <h4>双人成本复核</h4>
      </div>
      <RouterLink :to="`/opportunities/${opportunityId}?tab=profit&from=/sourcing`"
        >打开机会详情</RouterLink
      >
    </header>
    <p v-if="message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <OpportunityProfitPanel
      :profit="profit"
      :cost-form="costForm"
      :reviewer-options="reviewers"
      :busy="busy"
      @confirm-cost="submitCost"
      @review-cost="reviewCost"
      @queue-profit="queueProfit"
    />
  </section>
</template>

<style scoped>
.sourcing-cost-confirmation {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel-soft);
}
.sourcing-cost-confirmation > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sourcing-cost-confirmation h4,
.sourcing-cost-confirmation p {
  margin: 0;
}
@media (max-width: 760px) {
  .sourcing-cost-confirmation > header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
