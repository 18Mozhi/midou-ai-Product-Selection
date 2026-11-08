<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import {
  useSourcingWorkspace,
  type SourcingWorkspaceProps,
} from "../composables/useSourcingWorkspace";
import AppIcon from "./AppIcon.vue";
import ResearchThumbnail from "./ResearchThumbnail.vue";
import SourcingComparisonPanel from "./SourcingComparisonPanel.vue";
import SupplierOfferList from "./SupplierOfferList.vue";
import SourcingProfitSummary from "./SourcingProfitSummary.vue";
import SourcingWorkspaceDialogs from "./SourcingWorkspaceDialogs.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../sourcing.css";

const props = withDefaults(defineProps<SourcingWorkspaceProps>(), { capabilities: () => [] });
const {
  route,
  state,
  items,
  selected,
  detailLoading,
  requestId,
  dialogFailure,
  notice,
  busy,
  query,
  serverPaging,
  recordPage,
  recordPages,
  visibleRecords,
  matchingTotal,
  changeRecordPage,
  comparisons,
  comparisonFailure,
  comparisonLoading,
  loadComparisons,
  quoteCandidate,
  selectedQuotes,
  quote,
  canManage,
  canInspectCollection,
  candidates,
  searchName,
  filteredItems,
  summary,
  missingText,
  evidenceOptions,
  erpCosts,
  inputTypeText,
  candidateMissingText,
  timeText,
  localDateTimeInput,
  statusText,
  stabilityText,
  riskText,
  load,
  detail,
  closeQuote,
  resetQuery,
  handleStatePrimary,
  handleStateSecondary,
  confirm,
  choose,
  openQuote,
  compare,
} = useSourcingWorkspace(props);
const selectedTitle = computed(() => (selected.value ? searchName(selected.value) : ""));
const usesLatinTitleTracking = computed(
  () =>
    /\p{Script=Latin}/u.test(selectedTitle.value) &&
    !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      selectedTitle.value,
    ),
);
const recordPageSize = 20,
  supplierPageSize = 10;
const supplierPage = ref(1);
const detailTabs = [
  { key: "offers", label: "供应商报价" },
  { key: "profit", label: "成本与利润" },
  { key: "history", label: "报价历史" },
] as const;
const detailTab = ref<(typeof detailTabs)[number]["key"]>("offers");
const detailTabId = useId();
const recordPane = ref<HTMLElement | null>(null);
const emptyOffersProfitTarget = ref<HTMLElement | null>(null);
const emptyOffersBasisTarget = ref<HTMLElement | null>(null);
const showProfitBesideEmptyOffers = computed(
  () =>
    detailTab.value === "offers" &&
    !detailLoading.value &&
    !candidates.value.length &&
    selected.value?.input_type === "opportunity",
);
function handleDetailTabKey(event: KeyboardEvent, index: number) {
  const count = detailTabs.length;
  const destinations: Record<string, number> = {
    ArrowLeft: (index + count - 1) % count,
    ArrowRight: (index + 1) % count,
    Home: 0,
    End: count - 1,
  };
  const next = destinations[event.key];
  if (next === undefined || !Object.hasOwn(destinations, event.key)) return;
  const tab = detailTabs[next];
  if (!tab) return;
  event.preventDefault();
  detailTab.value = tab.key;
  (event.currentTarget as HTMLElement).parentElement?.querySelectorAll("button")[next]?.focus();
}
const supplierPages = computed(() =>
  Math.max(1, Math.ceil(candidates.value.length / supplierPageSize)),
);
const visibleCandidates = computed(() =>
  candidates.value.slice(
    (supplierPage.value - 1) * supplierPageSize,
    supplierPage.value * supplierPageSize,
  ),
);
watch([filteredItems, () => selected.value?.id], () => {
  if (serverPaging.value) return;
  const index = filteredItems.value.findIndex((item) => item.id === selected.value?.id);
  if (index >= 0) recordPage.value = Math.floor(index / recordPageSize) + 1;
  else {
    recordPage.value = 1;
    const first = filteredItems.value[0];
    if (first) void detail(first);
  }
});
watch(
  () => selected.value?.id,
  () => {
    supplierPage.value = 1;
    detailTab.value = "offers";
  },
);
// Move the inner pane only; opening a deep link must not move the workspace or steal focus.
watch(
  [recordPane, visibleRecords, () => selected.value?.id],
  ([pane]) => {
    const row = pane?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!pane || !row) return;
    const paneBounds = pane.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    const top = paneBounds.top + pane.clientTop;
    const bottom = top + pane.clientHeight;
    if (rowBounds.top < top) pane.scrollTop += rowBounds.top - top;
    else if (rowBounds.bottom > bottom) pane.scrollTop += rowBounds.bottom - bottom;
  },
  { flush: "post" },
);
watch(supplierPages, (count) => {
  supplierPage.value = Math.min(supplierPage.value, count);
});
// Lifecycle and result are separate: every source may have stopped without yielding a quote.
const allSourcesEnded = computed(() => {
  const progress = selected.value?.collection_progress;
  if (
    !progress ||
    !progress.total_subqueries ||
    progress.active_subqueries ||
    progress.blocked_subqueries
  )
    return false;
  if (progress.successful_subqueries + progress.failed_subqueries !== progress.total_subqueries)
    return false;
  return (
    ["completed", "succeeded"].includes(progress.status) ||
    (progress.failed_subqueries > 0 &&
      ["failed", "failed_terminal", "completed_with_warnings"].includes(progress.status))
  );
});
const pendingMessage = computed(() => {
  const progress = selected.value?.collection_progress;
  if (progress?.status === "retry_scheduled")
    return "采集任务正在等待重试，尚未取得供应商报价。可刷新记录查看最新进度。";
  if (progress?.active_subqueries)
    return progress.status === "running"
      ? "采集任务正在执行或等待来源返回，尚未取得供应商报价。可刷新记录查看最新进度。"
      : "采集任务仍在等待处理，尚未取得供应商报价。可刷新记录查看最新进度。";
  if (progress?.blocked_subqueries)
    return "来源采集受阻，尚未取得供应商报价。请核对采集进度，来源恢复后再查看结果。";
  if (
    progress?.failed_subqueries ||
    ["failed", "cancelled", "dead_letter"].includes(progress?.status ?? "")
  )
    return "本次采集已结束且未取得供应商报价，请核对来源采集状态。";
  return "当前记录尚无供应商候选，可刷新记录查看自动找货进度。";
});
const offerNeedsAttention = computed(() => {
  const progress = selected.value?.collection_progress;
  return Boolean(
    progress?.failed_subqueries ||
    progress?.blocked_subqueries ||
    ["failed", "cancelled", "dead_letter"].includes(progress?.status ?? ""),
  );
});
const showCollectionLinkInNotice = computed(
  () => offerNeedsAttention.value && !detailLoading.value && !candidates.value.length,
);
const terminalCollectionFailure = computed(() => {
  const progress = selected.value?.collection_progress;
  return Boolean(
    progress &&
    !progress.active_subqueries &&
    !progress.blocked_subqueries &&
    ["failed", "failed_terminal", "dead_letter"].includes(progress.status),
  );
});
</script>
<template>
  <section class="sourcing-workspace sourcing-workspace--review">
    <header class="sourcing-head">
      <div>
        <h1 id="sourcing-page-title" tabindex="-1">供应链找货</h1>
        <p class="sourcing-section-description">从选品详情查看匹配货源、规格报价与成本依据。</p>
      </div>
      <div class="sourcing-heading-actions">
        <RouterLink
          class="sourcing-cost-link"
          :to="{ path: '/sourcing/cost-rules', query: { from: route.fullPath } }"
          ><AppIcon name="calculator" />费用与利润规则</RouterLink
        >
        <button type="button" class="ghost" :disabled="state === 'loading' || busy" @click="load">
          <AppIcon name="refresh" />刷新记录
        </button>
      </div>
    </header>
    <p v-if="notice" class="sourcing-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div class="sourcing-overview">
      <div class="sourcing-toolbar">
        <label
          >搜索找货记录<span class="sourcing-search-input"
            ><AppIcon name="search" :size="16" /><input
              v-model="query"
              type="search"
              maxlength="200"
              placeholder="关键词、选品编号或状态" /></span></label
        ><span v-if="!['expired', 'forbidden'].includes(state)">共 {{ matchingTotal }} 条结果</span>
      </div>
      <dl
        v-if="!['expired', 'forbidden'].includes(state)"
        class="sourcing-summary"
        aria-label="供应链找货数据总览"
      >
        <div>
          <dt>找货任务</dt>
          <dd>{{ summary.total }}</dd>
        </div>
        <div>
          <dt title="按找货记录状态统计，不代表当前存活的采集会话">排队或采集中</dt>
          <dd>{{ summary.running }}</dd>
        </div>
        <div>
          <dt>真实候选</dt>
          <dd>{{ summary.candidates }}</dd>
        </div>
        <div>
          <dt>已有结果</dt>
          <dd>{{ summary.ready }}</dd>
        </div>
      </dl>
    </div>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      :action-hint="notice"
      :title="state === 'empty' ? (query.trim() ? '没有匹配的找货记录' : '尚无找货记录') : ''"
      :description="
        state === 'empty'
          ? query.trim()
            ? '当前搜索没有匹配记录，可清空搜索查看其他找货结果。'
            : '自动选品产生货源查询后，结果将在这里显示。可刷新记录查看最新状态。'
          : ''
      "
      :hide-secondary="state === 'empty'"
      :primary-label="state === 'empty' ? (query.trim() ? '清空搜索' : '刷新记录') : ''"
      @primary="handleStatePrimary"
      @secondary="handleStateSecondary"
    />
    <UiStatePanel
      v-else-if="!filteredItems.length"
      kind="empty"
      title="没有匹配的找货记录"
      description="当前搜索条件没有命中记录；清空搜索后可继续查看原有找货结果。"
      primary-label="清空搜索"
      secondary-label="刷新记录"
      @primary="resetQuery"
      @secondary="load"
    />
    <div v-else class="sourcing-layout">
      <aside aria-label="找货记录" :data-short="visibleRecords.length <= 2">
        <header class="sourcing-record-heading">
          <b>找货记录</b><span>{{ matchingTotal }} 条</span>
        </header>
        <div ref="recordPane" class="sourcing-record-items">
          <button
            v-for="item in visibleRecords"
            :key="item.id"
            type="button"
            :aria-pressed="selected?.id === item.id"
            :class="{ selected: selected?.id === item.id }"
            @click="detail(item)"
          >
            <ResearchThumbnail :src="item.image_url" :alt="searchName(item)" />
            <b :title="searchName(item)">{{ searchName(item) }}</b
            ><span class="sourcing-record-meta"
              ><small>{{ inputTypeText(item.input_type) }} · {{ statusText(item.status) }}</small
              ><em>{{ item.candidate_count }} 个候选</em></span
            >
          </button>
        </div>
        <nav v-if="recordPages > 1" class="sourcing-pagination" aria-label="找货记录分页">
          <button
            type="button"
            :disabled="recordPage === 1"
            @click="changeRecordPage(recordPage - 1)"
          >
            上一页</button
          ><span>{{ recordPage }} / {{ recordPages }}</span
          ><button
            type="button"
            :disabled="recordPage === recordPages"
            @click="changeRecordPage(recordPage + 1)"
          >
            下一页
          </button>
        </nav>
      </aside>
      <section
        v-if="selected"
        class="sourcing-detail"
        :aria-busy="detailLoading"
        aria-label="找货记录详情"
      >
        <header>
          <ResearchThumbnail :src="selected.image_url" :alt="selectedTitle" priority />
          <div>
            <p>{{ inputTypeText(selected.input_type) }}</p>
            <h3 :class="{ 'sourcing-title--latin-tracking': usesLatinTitleTracking }">
              {{ selectedTitle }}
            </h3>
            <code v-if="selected.input_type === 'opportunity'"
              >选品编号 {{ selected.input_ref }}</code
            >
            <section
              v-if="selected.collection_progress"
              class="sourcing-progress"
              aria-label="来源采集进度"
            >
              <header>
                <div>
                  <small>采集进度</small>
                  <h4
                    :data-status="selected.collection_progress.status"
                    :data-sources-ended="allSourcesEnded || undefined"
                    :title="
                      allSourcesEnded ? statusText(selected.collection_progress.status) : undefined
                    "
                  >
                    <template v-if="allSourcesEnded">
                      <span>来源已结束</span>
                      <span class="so-visually-hidden"
                        >：{{ statusText(selected.collection_progress.status) }}</span
                      >
                    </template>
                    <template v-else>{{
                      statusText(selected.collection_progress.status)
                    }}</template>
                  </h4>
                </div>
                <span
                  >{{
                    selected.collection_progress.successful_subqueries +
                    selected.collection_progress.failed_subqueries +
                    selected.collection_progress.blocked_subqueries
                  }}
                  / {{ selected.collection_progress.total_subqueries }} 个来源已结束</span
                >
              </header>
              <dl>
                <div>
                  <dt>成功</dt>
                  <dd>{{ selected.collection_progress.successful_subqueries }}</dd>
                </div>
                <div>
                  <dt>执行 / 等待</dt>
                  <dd>{{ selected.collection_progress.active_subqueries }}</dd>
                </div>
                <div>
                  <dt :data-fail="selected.collection_progress.failed_subqueries">失败</dt>
                  <dd>{{ selected.collection_progress.failed_subqueries }}</dd>
                </div>
                <div>
                  <dt>受阻</dt>
                  <dd>{{ selected.collection_progress.blocked_subqueries }}</dd>
                </div>
              </dl>
              <RouterLink
                v-if="
                  canInspectCollection && selected.collection_task_id && !showCollectionLinkInNotice
                "
                :to="`/platform-admin/collection?task=${selected.collection_task_id}`"
                >查看采集任务明细</RouterLink
              >
            </section>
          </div>
        </header>
        <p v-if="detailLoading" class="sourcing-detail-loading" role="status">
          正在读取货源报价与采集进度…
        </p>
        <p
          v-if="!detailLoading && candidates.length && selected.missing_fields.length"
          class="sourcing-missing"
        >
          待补齐：{{ missingText }}
        </p>
        <section v-if="selected.erp_reference" class="sourcing-erp-reference">
          <img
            v-if="selected.erp_reference.image_url"
            :src="selected.erp_reference.image_url"
            :alt="selected.erp_reference.title"
          />
          <div>
            <small>ERP 货源线索 · 不是已确认报价</small>
            <h4>{{ selected.erp_reference.title }}</h4>
            <p>供应商编码：{{ selected.erp_reference.supplier_code ?? "ERP 未提供" }}</p>
            <p>ERP 历史参考成本：{{ erpCosts.length ? erpCosts.join(" / ") : "未提供" }}</p>
            <span
              >仍需爬取供应商商品页、最小起订量、规格、交期与所在地后，才能形成可比较报价。</span
            >
            <footer>
              <a :href="selected.erp_reference.source_url" target="_blank" rel="noopener noreferrer"
                >打开 ERP 商品列表 ↗</a
              ><code>证据 {{ selected.erp_reference.evidence_id }}</code>
            </footer>
          </div>
        </section>
        <section
          v-if="!detailLoading && !candidates.length"
          class="sourcing-pending"
          :data-attention="offerNeedsAttention"
        >
          <div>
            <h4>
              <svg
                v-if="offerNeedsAttention"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  class="sourcing-notice-icon-surface"
                  d="M10.3 4.2 2.6 17.7A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.3L13.7 4.2a2 2 0 0 0-3.4 0Z"
                />
                <path d="M12 9v4m0 3h.01" />
              </svg>
              <AppIcon v-else name="box" />
              {{ offerNeedsAttention ? "未获得供应商报价" : "供应商报价" }}
            </h4>
            <p>{{ pendingMessage }}</p>
            <span v-if="selected.missing_fields.length" class="sourcing-missing"
              >待补齐：{{ missingText }}</span
            >
          </div>
          <RouterLink
            v-if="canInspectCollection && selected.collection_task_id && showCollectionLinkInNotice"
            class="so-action-secondary sourcing-notice-task"
            :data-failure-link="terminalCollectionFailure || undefined"
            :to="`/platform-admin/collection?task=${selected.collection_task_id}`"
            >{{ terminalCollectionFailure ? "查看失败原因" : "查看采集任务明细" }}</RouterLink
          >
        </section>
        <div class="sourcing-detail-tabs" role="tablist" aria-label="找货详情视图">
          <button
            v-for="(tab, index) in detailTabs"
            :id="`${detailTabId}-tab-${tab.key}`"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="detailTab === tab.key"
            :aria-controls="`${detailTabId}-panel-${tab.key}`"
            :tabindex="detailTab === tab.key ? 0 : -1"
            @click="detailTab = tab.key"
            @keydown="handleDetailTabKey($event, index)"
          >
            {{ tab.label }}
          </button>
        </div>
        <div
          role="tabpanel"
          tabindex="0"
          v-show="detailTab === 'offers'"
          :id="detailTabId + '-panel-offers'"
          :aria-labelledby="detailTabId + '-tab-offers'"
        >
          <SupplierOfferList
            :candidates="visibleCandidates"
            :selected-quotes="selectedQuotes"
            :can-manage="canManage"
            :status-text="statusText"
            :time-text="timeText"
            :stability-text="stabilityText"
            :risk-text="riskText"
            :missing-text="candidateMissingText"
            @choose="choose"
            @confirm-quote="openQuote"
          />
          <nav v-if="supplierPages > 1" class="sourcing-pagination" aria-label="货源报价分页">
            <button type="button" :disabled="supplierPage === 1" @click="supplierPage--">
              上一页</button
            ><span
              >{{ supplierPage }} / {{ supplierPages }} · 共 {{ candidates.length }} 个候选</span
            ><button
              type="button"
              :disabled="supplierPage === supplierPages"
              @click="supplierPage++"
            >
              下一页
            </button>
          </nav>
          <div
            v-show="!detailLoading && !candidates.length"
            class="sourcing-empty-offers"
            :class="{ 'sourcing-empty-offers--with-profit': showProfitBesideEmptyOffers }"
          >
            <div class="sourcing-quote-empty">
              <svg
                width="72"
                height="44"
                viewBox="0 0 72 44"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18 21-8 21 8-21 9-21-9Zm0 12v4l21 8 21-8v-4M36 27v15" />
                <path d="m15 18-13 9 21 9 13-9 13 9 21-9-13-9 8-6-21-8-8 6-8-6-21 8 8 6Z" />
              </svg>
              <strong>暂无供应商报价</strong>
              <span>{{
                offerNeedsAttention
                  ? "本次采集未获得供应商报价，请核对来源采集状态。"
                  : "报价返回后将在这里展示。"
              }}</span>
            </div>
            <div v-show="showProfitBesideEmptyOffers" ref="emptyOffersProfitTarget"></div>
            <div ref="emptyOffersBasisTarget" class="sourcing-empty-offers-basis"></div>
          </div>
        </div>
        <div
          role="tabpanel"
          tabindex="0"
          v-show="detailTab === 'profit'"
          :id="detailTabId + '-panel-profit'"
          :aria-labelledby="detailTabId + '-tab-profit'"
        >
          <Teleport
            v-if="selected.input_type === 'opportunity'"
            :to="emptyOffersProfitTarget ?? undefined"
            :disabled="!showProfitBesideEmptyOffers || !emptyOffersProfitTarget"
          >
            <SourcingProfitSummary
              :key="selected.input_ref"
              :api-base-url="apiBaseUrl"
              :opportunity-id="selected.input_ref"
              :return-path="route.fullPath"
              :beside-empty-offers="showProfitBesideEmptyOffers"
              :basis-target="showProfitBesideEmptyOffers ? emptyOffersBasisTarget : null"
            />
          </Teleport>
          <p v-else class="sourcing-quote-empty">当前找货记录未关联选品，暂无成本与利润可查看。</p>
        </div>
        <div
          role="tabpanel"
          tabindex="0"
          v-show="detailTab === 'history'"
          :id="detailTabId + '-panel-history'"
          :aria-labelledby="detailTabId + '-tab-history'"
        >
          <SourcingComparisonPanel
            :comparisons="comparisons"
            :failure="comparisonFailure"
            :loading="comparisonLoading"
            @retry="loadComparisons"
          />
        </div>
      </section>
    </div>
    <aside
      v-if="canManage && selectedQuotes.length"
      class="sourcing-compare-tray"
      aria-live="polite"
    >
      <strong>已选 {{ selectedQuotes.length }} / 5 家供应商</strong>
      <span>{{ selectedQuotes.length < 2 ? "至少再选一家才能对比" : "可以保存本次报价对比" }}</span>
      <button type="button" :disabled="selectedQuotes.length < 2 || busy" @click="compare">
        保存报价对比
      </button>
    </aside>
    <SourcingWorkspaceDialogs
      v-if="canManage"
      :quote-candidate="quoteCandidate"
      :quote="quote"
      :evidence-options="evidenceOptions"
      :busy="busy"
      :failure="dialogFailure"
      @close-quote="closeQuote"
      @confirm-quote="confirm"
    />
  </section>
</template>
