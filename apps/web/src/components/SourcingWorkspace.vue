<script setup lang="ts">
import {
  useSourcingWorkspace,
  type SourcingWorkspaceProps,
} from "../composables/useSourcingWorkspace";
import SourcingComparisonPanel from "./SourcingComparisonPanel.vue";
import SourcingCostConfirmationPanel from "./SourcingCostConfirmationPanel.vue";
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
  canConfirmCost,
  canInspectCollection,
  candidates,
  searchName,
  filteredItems,
  summary,
  missingText,
  evidenceOptions,
  journeyStage,
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
</script>
<template>
  <section class="sourcing-workspace sourcing-workspace--review">
    <section class="member-module-guide">
      <div>
        <p>供应链与利润怎么用</p>
        <h3>从机会或商品出发，查找真实货源并比较到岸利润</h3>
        <span
          >先发起货源搜索，再确认供应商报价；系统最多并排比较五家，并明确标出缺少运费、税费或平台费的项目。</span
        >
      </div>
      <ol>
        <li>输入关键词、图片或商品链接</li>
        <li>爬取货源候选</li>
        <li>确认报价与起订量</li>
        <li>补齐费用后比较利润</li>
      </ol>
    </section>
    <nav class="sourcing-tabs">
      <RouterLink to="/sourcing" aria-current="page">供应商找货</RouterLink
      ><RouterLink to="/sourcing/cost-rules">费用与利润规则</RouterLink>
    </nav>
    <ol class="sourcing-journey" aria-label="找货流程">
      <li :aria-current="journeyStage === 1 ? 'step' : undefined">1 搜索货源</li>
      <li :aria-current="journeyStage === 2 ? 'step' : undefined">2 确认报价</li>
      <li :aria-current="journeyStage === 3 ? 'step' : undefined">3 对比供应商</li>
      <li>4 创建采购任务</li>
    </ol>
    <header class="sourcing-head">
      <div>
        <p>供应商发现</p>
        <h1 id="sourcing-page-title" tabindex="-1">供应链找货</h1>
        <span>采集事实先投影为候选；缺失规格、交期、地点、可信度与风险时禁止进入可靠对比。</span>
      </div>
      <button v-if="canManage" type="button" @click="openSearch">发起供应商找货</button>
    </header>
    <p v-if="notice" class="sourcing-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <section class="sourcing-summary" aria-label="供应链找货数据总览">
      <article>
        <span>找货任务</span><b>{{ summary.total }}</b>
      </article>
      <article>
        <span>采集中</span><b>{{ summary.running }}</b>
      </article>
      <article>
        <span>真实候选</span><b>{{ summary.candidates }}</b>
      </article>
      <article>
        <span>已有结果</span><b>{{ summary.ready }}</b>
      </article>
    </section>
    <div class="sourcing-toolbar">
      <label
        >搜索找货记录<input
          v-model="query"
          type="search"
          placeholder="关键词、机会编号或状态" /></label
      ><span>共 {{ filteredItems.length }} 条结果</span>
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
      <aside>
        <button
          v-for="item in filteredItems"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          @click="detail(item)"
        >
          <b>{{ searchName(item) }}</b
          ><small>{{ inputTypeText(item.input_type) }} · {{ statusText(item.status) }}</small
          ><em>{{ item.candidate_count }} 个候选</em><strong>查看详情 →</strong>
        </button>
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
        <p v-if="selected.missing_fields.length" class="missing">
          当前候选仍缺：{{ missingText }}。必须人工带证据确认。
        </p>
        <SourcingCostConfirmationPanel
          v-if="selected.input_type === 'opportunity'"
          :api-base-url="apiBaseUrl"
          :opportunity-id="selected.input_ref"
          :can-confirm-cost="canConfirmCost"
        />
        <section v-if="selected.collection_progress" class="sourcing-progress">
          <header>
            <div>
              <small>完整采集进度</small>
              <h4>{{ statusText(selected.collection_progress.status) }}</h4>
            </div>
            <strong
              >{{
                selected.collection_progress.successful_subqueries +
                selected.collection_progress.failed_subqueries +
                selected.collection_progress.blocked_subqueries
              }}
              / {{ selected.collection_progress.total_subqueries }} 个来源已结束</strong
            >
          </header>
          <progress
            :value="
              selected.collection_progress.successful_subqueries +
              selected.collection_progress.failed_subqueries +
              selected.collection_progress.blocked_subqueries
            "
            :max="Math.max(1, selected.collection_progress.total_subqueries)"
          ></progress>
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
          <strong>找货任务已经建立，尚未取得真实供应商报价</strong>
          <p>
            任务已经提交到公开供应商网页爬虫。系统不会虚构供应商、起订量或报价；可以点击“重新采集”，任务结束后真实候选会自动显示在这里。
          </p>
          <span v-if="selected.missing_fields.length">待补齐：{{ missingText }}</span>
        </section>
        <section class="supplier-cards">
          <article v-for="item in candidates" :key="item.id" :data-ready="item.status === 'ready'">
            <header>
              <label v-if="canManage && item.quote"
                ><input
                  type="checkbox"
                  :checked="selectedQuotes.includes(item.quote.id)"
                  @change="choose(item, $event)"
                />加入对比</label
              ><b>{{ item.supplier_name }}</b
              ><span>{{ statusText(item.status) }}</span>
            </header>
            <h4>{{ item.product_title }}</h4>
            <dl>
              <div data-priority="primary">
                <dt>报价</dt>
                <dd>{{ item.currency }} {{ item.quoted_price }}</dd>
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
