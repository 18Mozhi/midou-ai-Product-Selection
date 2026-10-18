<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
const OpportunityListPanel = defineAsyncComponent(() => import("./OpportunityListPanel.vue"));
const OpportunityDecisionPanel = defineAsyncComponent(
  () => import("./OpportunityDecisionPanel.vue"),
);
const OpportunitySupplyPanel = defineAsyncComponent(() => import("./OpportunitySupplyPanel.vue"));
const OpportunityProfitPanel = defineAsyncComponent(() => import("./OpportunityProfitPanel.vue"));
const OpportunityEvidencePanel = defineAsyncComponent(
  () => import("./OpportunityEvidencePanel.vue"),
);
const OpportunityDetailInsights = defineAsyncComponent(
  () => import("./OpportunityDetailInsights.vue"),
);
const OpportunityDetailNavigation = defineAsyncComponent(
  () => import("./OpportunityDetailNavigation.vue"),
);
const OpportunityWorkspaceDialogs = defineAsyncComponent(
  () => import("./OpportunityWorkspaceDialogs.vue"),
);
import { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
import UiStatePanel from "./UiStatePanel.vue";
import SelectionProductHeader from "./SelectionProductHeader.vue";
import { useModalDialog } from "../use-modal-dialog";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";
import {
  formatOpportunityTime as freshness,
  opportunityStatusLabel,
  opportunityTabs as detailTabs,
} from "./opportunity-workspace-presentation";
import type { SourcingSearch } from "./sourcing-workspace-types";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import {
  useOpportunityWorkspaceReads,
  type OpportunityDownstreamStates,
} from "./use-opportunity-workspace-reads";
import { useOpportunityWorkspaceNavigation } from "./use-opportunity-workspace-navigation";
import { useOpportunityWorkspaceAccess } from "./use-opportunity-workspace-access";
import { useOpportunityWorkspaceDecisionFocus } from "./use-opportunity-workspace-decision-focus";
import { useOpportunityWorkspaceLifecycle } from "./use-opportunity-workspace-lifecycle";
import { useOpportunityWorkspaceWriteScopes } from "./use-opportunity-workspace-write-scopes";
import { useOpportunityWorkspaceCollectionActions } from "./use-opportunity-workspace-collection-actions";
import { useOpportunityWorkspaceListState } from "./use-opportunity-workspace-list-state";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../selection-catalogue.css";
import "../automatic-selection.css";
const route = useRoute(),
  router = useRouter();
const props = defineProps<{
    apiBaseUrl: string;
    opportunityId?: string;
    capabilities?: string[];
  }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<OpportunityTypes.OpportunityWorkspaceState>("loading"),
  items = ref<OpportunityTypes.OpportunitySummary[]>([]),
  memberOptions = ref<Array<{ id: string; label: string }>>([]),
  selectedOpportunityIds = ref<string[]>([]),
  detail = ref<OpportunityTypes.OpportunityDetail | null>(null),
  profit = ref<OpportunityTypes.OpportunityProfitAnalysis | null>(null),
  profitLoadState = ref<"loading" | "ready" | "error">("loading"),
  profitErrorMessage = ref(""),
  profitRequestId = ref(""),
  downstreamLoadState = ref<OpportunityDownstreamStates>({
    competitors: "loading",
    sourcing: "loading",
  }),
  competitorItems = ref<OpportunityTypes.OpportunityCompetitorSummary[]>([]),
  sourcingSearches = ref<SourcingSearch[]>([]),
  total = ref(0),
  page = ref(1),
  requestId = ref(""),
  message = ref(""),
  automationReadiness = ref<AutomaticSelectionReadiness | null>(null),
  busy = ref(false),
  selectionView = ref<"recommended" | "rule_candidates" | "evidence_pending" | "all">(
    "recommended",
  ),
  downstream = ref({ competitors: 0, snapshots: 0, searches: 0, suppliers: 0 }),
  tab = ref<OpportunityTypes.OpportunityTab>("overview"),
  showDecision = ref(false),
  showBatch = ref(false),
  batchAction = ref<"assign" | "archive" | "review">("assign"),
  batchReason = ref(""),
  batchAssigneeId = ref(""),
  decisionAction = ref<"adopt" | "observe" | "reject">("observe"),
  decisionReason = ref("");
let workspaceActive = true;
const { pendingDecisionFocus, captureDecisionFocus, restoreDecisionFocus } =
  useOpportunityWorkspaceDecisionFocus({
    opportunityId: () => props.opportunityId,
    workspaceActive: () => workspaceActive,
  });
const { pageCount, currentPageSelectedItems, outsideCurrentPageSelectedCount } =
  useOpportunityWorkspaceListState({ items, selectedOpportunityIds, total });
let batchDialogGeneration = 0;
let batchIntentGeneration = 0;
let batchSelectionGeneration = 0;
let decisionDialogGeneration = 0;
let writeScopeGeneration = 0;
const { writeScopeKey, beginScopedWrite, finishScopedWrite, pendingWriteCount } =
  useOpportunityWorkspaceWriteScopes({
    opportunityId: () => props.opportunityId,
    workspaceActive: () => workspaceActive,
    busy,
  });
const { filters } = createOpportunityWorkspaceForms();
const { dialogElement: batchDialogElement, handleCancel: handleBatchCancel } = useModalDialog(
  () => showBatch.value,
  () => (showBatch.value = false),
  undefined,
  { trapFocus: true },
);
const {
  canDecide,
  canManageCompetitors,
  canReadCompetitors,
  canManageSuppliers,
  canReadSourcing,
  canOpenCompetitorComparison,
  canOpenSourcingWorkspace,
  returnPath,
  statePanelKind,
  statePanelPrimaryLabel,
  statePanelSecondaryLabel,
  returnToOpportunityList,
  handleStatePrimary,
} = useOpportunityWorkspaceAccess({
  capabilities: () => props.capabilities,
  route,
  router,
  state,
  load: () => load(),
});
const {
  invalidateReads,
  load,
  loadDownstream,
  retryDownstream,
  loadAutomationReadiness,
  loadProfitAnalysis,
  retryProfitAnalysis,
} = useOpportunityWorkspaceReads({
  request,
  opportunityId: () => props.opportunityId,
  state,
  items,
  memberOptions,
  detail,
  profit,
  profitLoadState,
  profitErrorMessage,
  profitRequestId,
  downstreamLoadState,
  competitorItems,
  sourcingSearches,
  total,
  page,
  requestId,
  message,
  automationReadiness,
  selectionView,
  downstream,
  filters,
  canReadCompetitors,
  canReadSourcing,
  pendingDecisionFocus,
  captureDecisionFocus,
  restoreDecisionFocus,
});
const {
  syncListRoute,
  applyListFilters,
  resetListFilters,
  setSelectionView,
  goListPage,
  setTab,
  syncTabFromRoute,
} = useOpportunityWorkspaceNavigation({
  route,
  router,
  filters,
  selectionView,
  selectedOpportunityIds,
  page,
  pageCount,
  tab,
  load,
});
const { discoverCompetitors, discoverSuppliers } = useOpportunityWorkspaceCollectionActions({
  detail,
  write,
  message,
});
async function write(path: string, body: unknown) {
  if (busy.value) return null;
  const generation = writeScopeGeneration;
  const scopeKey = writeScopeKey();
  const ownsScope = () => generation === writeScopeGeneration;
  beginScopedWrite(scopeKey);
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    if (!ownsScope()) {
      if (workspaceActive && scopeKey === writeScopeKey()) {
        requestId.value = response.request_id;
        await load();
        message.value = "页面切换期间写入回执已到达；已刷新当前工作区，请核对最新状态。";
      }
      return null;
    }
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (!ownsScope()) {
      if (workspaceActive && scopeKey === writeScopeKey()) {
        const apiError = error instanceof ApiClientError ? error : null;
        await load();
        if (apiError) {
          requestId.value = apiError.requestId;
          message.value = `页面切换期间未能确认写入结果；已重新读取当前工作区。${apiError.actionHint}`;
        } else {
          message.value = "页面切换期间未能确认写入结果；已重新读取当前工作区，且不会自动重试。";
        }
      }
      return null;
    }
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "依赖暂不可用，未写入任何状态。";
    return null;
  } finally {
    finishScopedWrite(scopeKey);
  }
}
function startDecision(action: "adopt" | "observe" | "reject") {
  decisionAction.value = action;
  decisionReason.value = "";
  showDecision.value = true;
}
async function decide() {
  if (busy.value || !detail.value) return;
  const submitted = {
    opportunityId: detail.value.id,
    action: decisionAction.value,
    reason: decisionReason.value,
    expectedVersion: detail.value.version,
  };
  const dialogGeneration = decisionDialogGeneration;
  const result = await write(`/opportunities/${submitted.opportunityId}/decisions`, {
    action: submitted.action,
    reason: submitted.reason,
    expected_version: submitted.expectedVersion,
  });
  if (result) {
    if (detail.value?.id !== submitted.opportunityId) return;
    if (decisionDialogGeneration === dialogGeneration) showDecision.value = false;
    await load();
    message.value = "决策已记录；原始评分与证据未被改写。";
  }
}
async function queueScore() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/score-runs`, {
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    const queueReceipt = "评分任务已进入宝塔 Node Worker 队列；完成后刷新可见新运行记录。";
    if (state.value !== "ready") {
      const refreshFailure = message.value || "工作区暂时无法刷新。";
      message.value = `${queueReceipt} 工作区刷新失败：${refreshFailure}`;
      return;
    }
    message.value = queueReceipt;
  }
}
function openBatch(action: "assign" | "archive" | "review") {
  if (!currentPageSelectedItems.value.length) return;
  batchAction.value = action;
  batchReason.value = "";
  batchAssigneeId.value = "";
  showBatch.value = true;
}
async function confirmBatch() {
  if (busy.value) return;
  const selectedItems = currentPageSelectedItems.value;
  if (!selectedItems.length || !batchReason.value.trim()) return;
  const dialogGeneration = batchDialogGeneration,
    intentGeneration = batchIntentGeneration,
    selectionGeneration = batchSelectionGeneration,
    routePath = route.fullPath,
    opportunityId = props.opportunityId;
  const result = await write("/opportunities/batch", {
    action: batchAction.value,
    items: selectedItems.map((item) => ({ id: item.id, expected_version: item.version })),
    reason: batchReason.value.trim(),
    assignee_id: batchAction.value === "assign" ? batchAssigneeId.value : null,
  });
  if (!result || route.fullPath !== routePath || props.opportunityId !== opportunityId) return;

  if (batchDialogGeneration === dialogGeneration) showBatch.value = false;
  if (
    batchIntentGeneration === intentGeneration &&
    batchSelectionGeneration === selectionGeneration
  )
    selectedOpportunityIds.value = [];
  const completionGeneration = batchDialogGeneration;
  await load();
  if (
    route.fullPath === routePath &&
    props.opportunityId === opportunityId &&
    batchDialogGeneration === completionGeneration &&
    !showBatch.value
  )
    message.value = `批量操作已完成 ${result.affected_count} 项，每个机会均保留独立事件。`;
}
function closeTransientDialogs() {
  showBatch.value = false;
  showDecision.value = false;
  decisionAction.value = "observe";
  decisionReason.value = "";
}
useOpportunityWorkspaceLifecycle({
  route,
  opportunityId: () => props.opportunityId,
  showBatch,
  showDecision,
  decisionAction,
  decisionReason,
  selectedOpportunityIds,
  busy,
  detail,
  profit,
  profitLoadState,
  profitErrorMessage,
  profitRequestId,
  invalidateReads,
  pendingWriteCount,
  syncTabFromRoute,
  syncListRoute,
  load,
  setWorkspaceActive: (active) => {
    workspaceActive = active;
  },
  closeTransientDialogs,
  advanceDecisionDialog: () => {
    decisionDialogGeneration += 1;
  },
  advanceBatchDialog: () => {
    batchDialogGeneration += 1;
  },
  advanceBatchIntent: () => {
    batchIntentGeneration += 1;
  },
  advanceBatchSelection: () => {
    batchSelectionGeneration += 1;
  },
  advanceWriteScope: () => {
    writeScopeGeneration += 1;
  },
});
</script>
<template>
  <section class="opportunity-workspace opportunity-workspace--review">
    <p v-if="!opportunityId && !canDecide" class="catalogue-readonly" role="note">
      当前为只读权限。
    </p>
    <nav v-if="opportunityId" class="opportunity-detail-return" aria-label="机会详情返回路径">
      <RouterLink :to="returnPath">← 返回来源列表</RouterLink>
    </nav>
    <p v-if="message" class="opportunity-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <OpportunityListPanel
      v-if="!opportunityId"
      :selection-view="selectionView"
      :items="items"
      :total="total"
      :state="state"
      :request-id="requestId"
      :filters="filters"
      :member-options="memberOptions"
      :selected-ids="selectedOpportunityIds"
      :current-page-selected-count="currentPageSelectedItems.length"
      :outside-current-page-selected-count="outsideCurrentPageSelectedCount"
      :page="page"
      :can-decide="canDecide"
      :automation-readiness="automationReadiness"
      @apply="applyListFilters"
      @batch="openBatch"
      @manage-setup="router.push($event)"
      @page="goListPage"
      @reset="resetListFilters"
      @view="setSelectionView"
      @update:selected-ids="selectedOpportunityIds = $event"
    />
    <template v-else
      ><UiStatePanel
        v-if="state !== 'ready' || !detail"
        :kind="statePanelKind"
        :request-id="requestId"
        :primary-label="statePanelPrimaryLabel"
        :secondary-label="statePanelSecondaryLabel"
        :hide-secondary="!statePanelSecondaryLabel"
        @primary="handleStatePrimary"
        @secondary="returnToOpportunityList"
      />
      <article v-else class="opportunity-detail opportunity-detail--c">
        <main class="opportunity-detail-main">
          <SelectionProductHeader :detail="detail" />
          <OpportunityDetailNavigation :active-tab="tab" :items="detailTabs" @select="setTab" />
          <div class="opportunity-detail-workface">
            <div class="opportunity-detail-section-content">
              <OpportunityDetailInsights
                v-if="['overview', 'competition', 'risk'].includes(tab)"
                :tab="tab"
                :detail="detail"
                :profit="profit"
                :downstream="downstream"
                :downstream-state="downstreamLoadState"
                :competitor-items="competitorItems"
                :busy="busy"
                :can-decide="canDecide"
                :can-manage-competitors="canManageCompetitors"
                :can-manage-suppliers="canManageSuppliers"
                :can-read-competitors="canReadCompetitors"
                :can-read-sourcing="canReadSourcing"
                :can-open-competitor-comparison="canOpenCompetitorComparison"
                :can-open-sourcing-workspace="canOpenSourcingWorkspace"
                @discover-competitors="discoverCompetitors"
                @discover-suppliers="discoverSuppliers"
                @queue-score="queueScore"
                @retry-downstream="retryDownstream($event)"
                @select-tab="setTab"
              />
              <template v-else-if="tab === 'profit'">
                <OpportunitySupplyPanel
                  :api-base-url="apiBaseUrl"
                  :opportunity-id="detail.id"
                  :searches="sourcingSearches"
                  :list-state="downstreamLoadState.sourcing"
                  :can-read="canReadSourcing"
                  @retry-list="retryDownstream('sourcing')"
                />
                <OpportunityProfitPanel
                  :profit="profit"
                  :profit-status="detail.profit_status"
                  :profit-load-state="profitLoadState"
                  :profit-error-message="profitErrorMessage"
                  :profit-request-id="profitRequestId"
                  :busy="busy"
                  @retry-profit="retryProfitAnalysis"
                />
              </template>
              <OpportunityEvidencePanel
                v-else-if="tab === 'evidence'"
                :evidence="detail.evidence"
                :opportunity-id="detail.id"
              />
              <section v-else class="opportunity-decisions">
                <header>
                  <div>
                    <p>决策历史</p>
                    <h4>决策历史</h4>
                  </div>
                  <span>{{ detail.decisions.length }} 条</span>
                </header>
                <p v-if="!detail.decisions.length" class="opportunity-empty-copy">尚无决策记录。</p>
                <article v-for="item in detail.decisions" :key="item.id">
                  <b>{{ opportunityStatusLabel(item.action) }}</b>
                  <div>
                    <strong>{{ item.reason }}</strong
                    ><small
                      >{{ freshness(item.created_at) }} · 版本 v{{ item.opportunity_version }} ·
                      操作者 {{ item.actor_id.slice(0, 8) }}…</small
                    >
                  </div>
                </article>
              </section>
            </div>
            <OpportunityDecisionPanel
              v-if="tab === 'overview'"
              :detail="detail"
              :busy="busy"
              :can-decide="canDecide"
              @decide="startDecision"
            />
            <section
              v-if="tab === 'overview' && detail.selection_stage !== 'recommended'"
              class="opportunity-next-steps opportunity-collection-tools"
            >
              <details>
                <summary>补证异常时手动处理</summary>
                <p>补证状态以当前记录为准；需要立即重试时可使用下面的操作。</p>
                <div>
                  <button
                    v-if="canManageCompetitors"
                    type="button"
                    :disabled="busy"
                    @click="discoverCompetitors"
                  >
                    采集 Amazon 竞品</button
                  ><button
                    v-if="canManageSuppliers"
                    type="button"
                    :disabled="busy"
                    @click="discoverSuppliers"
                  >
                    采集公开供应商</button
                  ><RouterLink to="/opportunities/scoring-rules">检查评分规则</RouterLink>
                </div>
              </details>
            </section>
          </div>
        </main>
      </article></template
    >
    <OpportunityWorkspaceDialogs
      v-if="canDecide"
      v-model:decision-open="showDecision"
      v-model:decision-reason="decisionReason"
      :busy="busy"
      :decision-action="decisionAction"
      :has-detail="Boolean(detail)"
      @decide="decide"
    />
    <dialog
      v-if="canDecide"
      ref="batchDialogElement"
      class="opportunity-modal opportunity-batch-dialog"
      aria-label="机会批量操作影响预览"
      @cancel="handleBatchCancel"
    >
      <form @submit.prevent="confirmBatch">
        <header>
          <p>影响预览</p>
          <h3>
            批量{{
              batchAction === "assign" ? "指派" : batchAction === "archive" ? "归档" : "复核"
            }}
          </h3>
        </header>
        <p>
          本次仅处理当前结果中已选的
          {{ currentPageSelectedItems.length }} 个机会；任一版本变化都会整批回滚。
        </p>
        <p v-if="outsideCurrentPageSelectedCount" class="opportunity-batch-scope-note">
          另有 {{ outsideCurrentPageSelectedCount }} 个已选机会不在当前结果中，不会随本次操作提交。
        </p>
        <label v-if="batchAction === 'assign'">
          负责人
          <select v-model="batchAssigneeId" required>
            <option value="" disabled>请选择可访问当前工作区的成员</option>
            <option v-for="member in memberOptions" :key="member.id" :value="member.id">
              {{ member.label }}
            </option>
          </select>
        </label>
        <aside v-if="batchAction === 'review'">
          每个机会会进入“验证中”阶段，并创建或复用一条人工复核任务；不会自动改变决策结论。
        </aside>
        <aside v-else-if="batchAction === 'archive'">
          已归档机会默认不在列表显示，可通过“阶段：已归档”筛选恢复查看。
        </aside>
        <label>
          操作原因
          <textarea v-model="batchReason" required maxlength="1000"></textarea>
        </label>
        <footer>
          <button type="button" @click="showBatch = false">返回</button>
          <button type="submit" :disabled="busy">确认执行</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
