<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  useSourcingWorkspace,
  type SourcingWorkspaceProps,
} from "../composables/useSourcingWorkspace";
import SourcingComparisonPanel from "./SourcingComparisonPanel.vue";
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
  requestId,
  dialogFailure,
  notice,
  busy,
  showSearch,
  query,
  deleting,
  deleteReason,
  comparisons,
  comparisonFailure,
  comparisonLoading,
  loadComparisons,
  quoteCandidate,
  purchaseCandidate,
  selectedQuotes,
  form,
  quote,
  purchaseForm,
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
  create,
  openSearch,
  closeSearch,
  closeQuote,
  closePurchase,
  openDelete,
  closeDelete,
  resetQuery,
  handleStatePrimary,
  handleStateSecondary,
  confirm,
  choose,
  openQuote,
  compare,
  openPurchase,
  purchase,
  refreshSearch,
  removeSearch,
} = useSourcingWorkspace(props);
const recordPageSize = 20,
  supplierPageSize = 10;
const recordPage = ref(1),
  supplierPage = ref(1);
const recordPages = computed(() =>
  Math.max(1, Math.ceil(filteredItems.value.length / recordPageSize)),
);
const supplierPages = computed(() =>
  Math.max(1, Math.ceil(candidates.value.length / supplierPageSize)),
);
const visibleRecords = computed(() =>
  filteredItems.value.slice(
    (recordPage.value - 1) * recordPageSize,
    recordPage.value * recordPageSize,
  ),
);
const visibleCandidates = computed(() =>
  candidates.value.slice(
    (supplierPage.value - 1) * supplierPageSize,
    supplierPage.value * supplierPageSize,
  ),
);
watch([filteredItems, () => selected.value?.id], () => {
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
  },
);
watch(supplierPages, (count) => {
  supplierPage.value = Math.min(supplierPage.value, count);
});
function changeRecordPage(next: number) {
  recordPage.value = Math.max(1, Math.min(next, recordPages.value));
  const first = visibleRecords.value[0];
  if (first) void detail(first);
}
const pendingMessage = computed(() => {
  const progress = selected.value?.collection_progress;
  if (progress?.active_subqueries && progress.status === "running")
    return "采集任务正在执行或等待来源返回，尚未取得供应商报价。可刷新记录查看最新进度。";
  if (progress?.blocked_subqueries)
    return "来源采集受阻，尚未取得供应商报价。请核对采集进度，来源恢复后再查看结果。";
  if (
    progress?.failed_subqueries ||
    ["failed", "cancelled", "dead_letter"].includes(progress?.status ?? "")
  )
    return "本次采集已结束且未取得供应商报价，请核对失败或取消状态后再决定是否重新采集。";
  if (progress?.active_subqueries)
    return "采集任务仍在等待处理，尚未取得供应商报价。可刷新记录查看最新进度。";
  return "当前记录没有供应商候选，请核对采集结果。需要再次查询时可点击“重新采集”。";
});
</script>
<template>
  <section class="sourcing-workspace sourcing-workspace--review">
    <header class="sourcing-head">
      <div>
        <h1 id="sourcing-page-title" tabindex="-1">供应链找货</h1>
      </div>
      <div class="sourcing-heading-actions">
        <RouterLink to="/sourcing/cost-rules">费用与利润规则</RouterLink>
        <button type="button" class="ghost" :disabled="state === 'loading' || busy" @click="load">
          刷新记录
        </button>
        <button v-if="canManage" type="button" @click="openSearch">发起供应商找货</button>
      </div>
    </header>
    <p v-if="notice" class="sourcing-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div class="sourcing-overview">
      <div class="sourcing-toolbar">
        <label
          >搜索找货记录<input
            v-model="query"
            type="search"
            placeholder="关键词、机会编号或状态" /></label
        ><span>共 {{ filteredItems.length }} 条结果</span>
      </div>
      <dl class="sourcing-summary" aria-label="供应链找货数据总览">
        <div>
          <dt>找货任务</dt>
          <dd>{{ summary.total }}</dd>
        </div>
        <div>
          <dt>采集中</dt>
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
      :primary-label="state === 'empty' && !canManage ? '重新加载' : ''"
      @primary="handleStatePrimary"
      @secondary="handleStateSecondary"
    />
    <UiStatePanel
      v-else-if="!filteredItems.length"
      kind="empty"
      title="没有匹配的找货记录"
      description="当前搜索条件没有命中记录；清空搜索后可继续查看原有找货结果。"
      primary-label="清空搜索"
      :secondary-label="canManage ? '发起新找货' : '重新加载'"
      @primary="resetQuery"
      @secondary="canManage ? openSearch() : load()"
    />
    <div v-else class="sourcing-layout">
      <aside aria-label="找货记录" :data-short="visibleRecords.length <= 2">
        <header class="sourcing-record-heading">
          <b>找货记录</b><span>{{ filteredItems.length }} 条</span>
        </header>
        <div class="sourcing-record-items">
          <button
            v-for="item in visibleRecords"
            :key="item.id"
            type="button"
            :aria-pressed="selected?.id === item.id"
            :class="{ selected: selected?.id === item.id }"
            @click="detail(item)"
          >
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
      <section v-if="selected" class="sourcing-detail" aria-label="找货记录详情">
        <header>
          <div>
            <p>{{ inputTypeText(selected.input_type) }}</p>
            <h3>{{ searchName(selected) }}</h3>
            <code v-if="selected.input_type === 'opportunity'"
              >机会编号 {{ selected.input_ref }}</code
            >
          </div>
          <div class="sourcing-actions">
            <template v-if="canManage">
              <button type="button" :disabled="busy" @click="refreshSearch">
                重新采集
              </button></template
            ><RouterLink
              class="sourcing-cost-link"
              :to="{ path: '/sourcing/cost-rules', query: { from: route.fullPath } }"
              >费用与利润规则</RouterLink
            ><button v-if="canManage" type="button" class="danger ghost" @click="openDelete">
              删除找货记录
            </button>
          </div>
        </header>
        <p v-if="candidates.length && selected.missing_fields.length" class="sourcing-missing">
          待补齐：{{ missingText }}
        </p>
        <section
          v-if="selected.collection_progress"
          class="sourcing-progress"
          aria-label="来源采集进度"
        >
          <header>
            <div>
              <small>来源采集</small>
              <h4>{{ statusText(selected.collection_progress.status) }}</h4>
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
              <dt>执行中 / 等待</dt>
              <dd>{{ selected.collection_progress.active_subqueries }}</dd>
            </div>
            <div>
              <dt>失败</dt>
              <dd>{{ selected.collection_progress.failed_subqueries }}</dd>
            </div>
            <div>
              <dt>受阻</dt>
              <dd>{{ selected.collection_progress.blocked_subqueries }}</dd>
            </div>
          </dl>
          <RouterLink
            v-if="canInspectCollection"
            :to="`/platform-admin/collection?task=${selected.collection_task_id}`"
            >查看采集任务明细</RouterLink
          >
        </section>
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
        <section v-if="!candidates.length" class="sourcing-pending">
          <h4>供应商报价</h4>
          <p>{{ pendingMessage }}</p>
          <span v-if="selected.missing_fields.length" class="sourcing-missing"
            >待补齐：{{ missingText }}</span
          >
        </section>
        <section class="supplier-cards">
          <article
            v-for="item in visibleCandidates"
            :key="item.id"
            :data-ready="item.status === 'ready'"
          >
            <header>
              <b>{{ item.supplier_name }}</b
              ><span>{{ statusText(item.status) }}</span>
            </header>
            <h4 :title="item.product_title">{{ item.product_title }}</h4>
            <dl>
              <div data-priority="primary">
                <dt>报价</dt>
                <dd>{{ item.currency }} {{ item.quoted_price }}</dd>
              </div>
              <div v-if="!item.quote && item.source_price_description" data-priority="primary">
                <dt>采集价格说明</dt>
                <dd>{{ item.source_price_description }}</dd>
              </div>
              <div data-priority="primary">
                <dt>最小起订量（MOQ）</dt>
                <dd>{{ item.moq ?? "待确认" }}</dd>
              </div>
              <div data-priority="primary">
                <dt>报价新鲜度</dt>
                <dd>{{ timeText(item.quote?.observed_at ?? item.observed_at) }}</dd>
              </div>
              <div data-priority="primary">
                <dt>到岸价</dt>
                <dd>待费用规则计算</dd>
              </div>
              <div data-priority="primary">
                <dt>交期</dt>
                <dd>{{ item.lead_time_days == null ? "待确认" : `${item.lead_time_days} 天` }}</dd>
              </div>
              <div>
                <dt>规格</dt>
                <dd>{{ item.specification ?? "缺失" }}</dd>
              </div>
              <div>
                <dt>所在地</dt>
                <dd>{{ item.location ?? "缺失" }}</dd>
              </div>
              <div>
                <dt>稳定性 / 风险</dt>
                <dd>
                  {{ stabilityText(item.quote?.stability_status) }} /
                  {{ riskText(item.quote?.risk_level) }}
                </dd>
              </div>
            </dl>
            <ul v-if="item.missing_fields.length" class="supplier-missing-actions">
              <li v-for="field in candidateMissingText(item)" :key="field">
                {{ field }}：确认报价时补齐
              </li>
            </ul>
            <footer>
              <label v-if="canManage && item.quote"
                ><input
                  type="checkbox"
                  :checked="selectedQuotes.includes(item.quote.id)"
                  @change="choose(item, $event)"
                />加入对比</label
              >
              <a :href="item.original_url" target="_blank" rel="noopener noreferrer"
                >打开外部原始商品页（新窗口）</a
              ><time>采集于 {{ timeText(item.observed_at) }}</time
              ><code>证据 {{ item.evidence_id }}</code
              ><button v-if="canManage && !item.quote" type="button" @click="openQuote(item)">
                确认报价</button
              ><button v-else-if="canManage" type="button" @click="openPurchase(item)">
                创建采购任务
              </button>
            </footer>
          </article>
        </section>
        <nav v-if="supplierPages > 1" class="sourcing-pagination" aria-label="货源报价分页">
          <button type="button" :disabled="supplierPage === 1" @click="supplierPage--">
            上一页</button
          ><span>{{ supplierPage }} / {{ supplierPages }} · 共 {{ candidates.length }} 个候选</span
          ><button type="button" :disabled="supplierPage === supplierPages" @click="supplierPage++">
            下一页
          </button>
        </nav>
        <SourcingProfitSummary
          v-if="selected.input_type === 'opportunity'"
          :key="selected.input_ref"
          :api-base-url="apiBaseUrl"
          :opportunity-id="selected.input_ref"
        />
        <SourcingComparisonPanel
          :comparisons="comparisons"
          :failure="comparisonFailure"
          :loading="comparisonLoading"
          @retry="loadComparisons"
        />
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
      :show-search="showSearch"
      :search-form="form"
      :quote-candidate="quoteCandidate"
      :quote="quote"
      :evidence-options="evidenceOptions"
      :purchase-candidate="purchaseCandidate"
      :purchase-form="purchaseForm"
      :deleting="deleting"
      :delete-reason="deleteReason"
      :busy="busy"
      :failure="dialogFailure"
      @close-search="closeSearch"
      @create="create"
      @close-quote="closeQuote"
      @confirm-quote="confirm"
      @close-purchase="closePurchase"
      @purchase="purchase"
      @close-delete="closeDelete"
      @remove-search="removeSearch"
      @update-delete-reason="deleteReason = $event"
    />
  </section>
</template>
