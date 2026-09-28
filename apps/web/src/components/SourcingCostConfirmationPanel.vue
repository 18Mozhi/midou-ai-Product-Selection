<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import OpportunityProfitPanel from "./OpportunityProfitPanel.vue";
import type { OpportunityProfitAnalysis } from "./opportunity-workspace-types";

const props = withDefaults(
    defineProps<{ apiBaseUrl: string; opportunityId: string; canConfirmCost?: boolean }>(),
    { canConfirmCost: false },
  ),
  request = createApiClient(props.apiBaseUrl),
  scopeGeneration = ref(0),
  writeScopes = reactive(new Set<string>()),
  scopeKey = computed(() => `${scopeGeneration.value}:${props.opportunityId}`),
  busy = computed(() => writeScopes.has(scopeKey.value)),
  profit = ref<OpportunityProfitAnalysis | null>(null),
  opportunityVersion = ref(0),
  versionReady = ref(false),
  versionLoadState = ref<"loading" | "ready" | "error">("loading"),
  versionErrorMessage = ref(""),
  versionRequestId = ref(""),
  reviewers = ref<Array<{ id: string; label: string }>>([]),
  profitLoadState = ref<"loading" | "ready" | "error">("loading"),
  profitErrorMessage = ref(""),
  profitRequestId = ref(""),
  reviewerLoadState = ref<"unknown" | "loading" | "ready" | "error">("unknown"),
  reviewerErrorMessage = ref(""),
  reviewerRequestId = ref(""),
  writeMessage = ref(""),
  writeRequestId = ref(""),
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

type OpportunityScope = { generation: number; id: string; key: string };
const readGeneration = { version: 0, profit: 0, reviewers: 0 };
let mounted = true;

function currentScope(): OpportunityScope {
  return {
    generation: scopeGeneration.value,
    id: props.opportunityId,
    key: scopeKey.value,
  };
}

function isCurrent(scope: OpportunityScope) {
  return mounted && scope.generation === scopeGeneration.value && scope.id === props.opportunityId;
}

function failureDetails(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? { message: error.actionHint, requestId: error.requestId }
    : { message: fallback, requestId: "" };
}

async function loadOpportunityVersion(scope: OpportunityScope) {
  const generation = ++readGeneration.version;
  versionLoadState.value = "loading";
  versionReady.value = false;
  versionErrorMessage.value = "";
  versionRequestId.value = "";
  try {
    const response = await request<any>(`/opportunities/${scope.id}`);
    if (!isCurrent(scope) || generation !== readGeneration.version) return;
    const version = Number(response.data.version);
    if (!Number.isFinite(version)) {
      versionLoadState.value = "error";
      versionErrorMessage.value = "暂时无法确认当前机会版本，成本写入已暂停。";
      return;
    }
    opportunityVersion.value = version;
    versionReady.value = true;
    versionLoadState.value = "ready";
  } catch (error) {
    if (!isCurrent(scope) || generation !== readGeneration.version) return;
    const failure = failureDetails(error, "暂时无法确认当前机会版本，成本写入已暂停。");
    versionErrorMessage.value = failure.message;
    versionRequestId.value = failure.requestId;
    versionLoadState.value = "error";
  }
}

async function loadProfit(scope: OpportunityScope) {
  const generation = ++readGeneration.profit;
  profitLoadState.value = "loading";
  profitErrorMessage.value = "";
  profitRequestId.value = "";
  try {
    const response = await request<OpportunityProfitAnalysis>(
      `/opportunities/${scope.id}/profit-analysis`,
    );
    if (!isCurrent(scope) || generation !== readGeneration.profit) return;
    profit.value = response.data;
    profitRequestId.value = response.request_id;
    profitLoadState.value = "ready";
  } catch (error) {
    if (!isCurrent(scope) || generation !== readGeneration.profit) return;
    const failure = failureDetails(error, "暂时无法读取利润与成本，请稍后重试。");
    profitErrorMessage.value = failure.message;
    profitRequestId.value = failure.requestId;
    profitLoadState.value = "error";
  }
}

async function loadReviewers(scope: OpportunityScope) {
  if (!props.canConfirmCost) {
    reviewers.value = [];
    reviewerLoadState.value = "unknown";
    reviewerErrorMessage.value = "";
    reviewerRequestId.value = "";
    return;
  }
  const generation = ++readGeneration.reviewers;
  reviewerLoadState.value = "loading";
  reviewerErrorMessage.value = "";
  reviewerRequestId.value = "";
  try {
    const response = await request<Array<{ id: string; label: string }>>("/cost-input-reviewers");
    if (!isCurrent(scope) || generation !== readGeneration.reviewers) return;
    reviewers.value = response.data;
    reviewerRequestId.value = response.request_id;
    reviewerLoadState.value = "ready";
  } catch (error) {
    if (!isCurrent(scope) || generation !== readGeneration.reviewers) return;
    const failure = failureDetails(error, "暂时无法读取成本复核人名单。");
    reviewerErrorMessage.value = failure.message;
    reviewerRequestId.value = failure.requestId;
    reviewerLoadState.value = "error";
  }
}

function loadScope(scope: OpportunityScope) {
  return Promise.all([loadOpportunityVersion(scope), loadProfit(scope), loadReviewers(scope)]);
}

async function write(path: string, body: unknown, successMessage: string, scope = currentScope()) {
  if (!isCurrent(scope) || writeScopes.has(scope.key)) return false;
  writeScopes.add(scope.key);
  writeMessage.value = "";
  writeRequestId.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    if (!isCurrent(scope)) return false;
    writeMessage.value = successMessage;
    writeRequestId.value = response.request_id;
    await loadScope(scope);
    return true;
  } catch (error) {
    if (!isCurrent(scope)) return false;
    const failure = failureDetails(error, "成本复核依赖暂不可用。");
    writeMessage.value = failure.message;
    writeRequestId.value = failure.requestId;
    return false;
  } finally {
    writeScopes.delete(scope.key);
  }
}

async function submitCost() {
  if (!versionReady.value) return;
  const scope = currentScope();
  await write(
    `/opportunities/${scope.id}/cost-inputs`,
    {
      ...costForm,
      amount_value: Number(costForm.amount_value),
      observed_at: new Date(costForm.observed_at).toISOString(),
      expected_version: opportunityVersion.value,
    },
    "成本已提交给指定复核人；通过前不会影响利润。",
    scope,
  );
}

async function reviewCost(payload: {
  reviewId: string;
  decision: "approved" | "rejected";
  reason: string;
  expectedVersion: number;
}) {
  const scope = currentScope();
  await write(
    `/opportunities/${scope.id}/cost-input-reviews/${payload.reviewId}/actions`,
    {
      decision: payload.decision,
      reason: payload.reason,
      expected_version: payload.expectedVersion,
    },
    payload.decision === "approved" ? "成本复核已通过并生效。" : "成本复核已驳回。",
    scope,
  );
}

async function queueProfit() {
  if (!versionReady.value) return;
  const scope = currentScope();
  await write(
    `/opportunities/${scope.id}/profit-runs`,
    { platform: costForm.platform, expected_version: opportunityVersion.value },
    "利润重算已进入 Worker 队列。",
    scope,
  );
}

function resetScope() {
  scopeGeneration.value += 1;
  readGeneration.version += 1;
  readGeneration.profit += 1;
  readGeneration.reviewers += 1;
  opportunityVersion.value = 0;
  versionReady.value = false;
  versionLoadState.value = "loading";
  versionErrorMessage.value = "";
  versionRequestId.value = "";
  profit.value = null;
  profitLoadState.value = "loading";
  profitErrorMessage.value = "";
  profitRequestId.value = "";
  reviewers.value = [];
  reviewerLoadState.value = props.canConfirmCost ? "loading" : "unknown";
  reviewerErrorMessage.value = "";
  reviewerRequestId.value = "";
  writeMessage.value = "";
  writeRequestId.value = "";
  void loadScope(currentScope());
}

watch(() => props.opportunityId, resetScope, {
  immediate: true,
  flush: "sync",
});
watch(
  () => props.canConfirmCost,
  () => {
    readGeneration.reviewers += 1;
    reviewers.value = [];
    reviewerLoadState.value = props.canConfirmCost ? "loading" : "unknown";
    reviewerErrorMessage.value = "";
    reviewerRequestId.value = "";
    if (props.canConfirmCost) void loadReviewers(currentScope());
  },
  { flush: "sync" },
);
onBeforeUnmount(() => {
  mounted = false;
  scopeGeneration.value += 1;
  readGeneration.version += 1;
  readGeneration.profit += 1;
  readGeneration.reviewers += 1;
});
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
    <p v-if="versionLoadState === 'loading'" role="status">
      正在读取当前机会版本；读取完成前暂不能提交成本或重新计算。
    </p>
    <p v-else-if="versionLoadState === 'error'" role="alert">
      {{ versionErrorMessage }}
      <code v-if="versionRequestId">{{ versionRequestId }}</code>
      <button type="button" :disabled="busy" @click="loadOpportunityVersion(currentScope())">
        重新读取机会版本
      </button>
    </p>
    <p v-if="writeMessage" role="status">
      {{ writeMessage }} <code v-if="writeRequestId">{{ writeRequestId }}</code>
    </p>
    <OpportunityProfitPanel
      :profit="profit"
      :profit-load-state="profitLoadState"
      :profit-error-message="profitErrorMessage"
      :profit-request-id="profitRequestId"
      :cost-form="costForm"
      :reviewer-options="reviewers"
      :reviewer-load-state="reviewerLoadState"
      :reviewer-error-message="reviewerErrorMessage"
      :reviewer-request-id="reviewerRequestId"
      :cost-version-ready="versionReady"
      :can-confirm-cost="canConfirmCost"
      :busy="busy"
      @confirm-cost="submitCost"
      @review-cost="reviewCost"
      @queue-profit="queueProfit"
      @retry-profit="loadProfit(currentScope())"
      @retry-reviewers="loadReviewers(currentScope())"
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
