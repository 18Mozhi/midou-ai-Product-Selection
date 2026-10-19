<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { opportunityProfitStatusLabel } from "./opportunity-workspace-presentation";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";
import AutomaticSelectionReadinessPanel from "./AutomaticSelectionReadinessPanel.vue";
import OpportunityCatalogueList from "./OpportunityCatalogueList.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import UiStatePanel from "./UiStatePanel.vue";
import type { OpportunitySummary } from "./opportunity-workspace-types";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type SelectionView = "recommended" | "rule_candidates" | "evidence_pending" | "completed" | "all";
interface OpportunityFilters {
  q: string;
  market: string;
  decision_status: string;
  coverage_status: string;
  blocking_reason: string;
  lifecycle_status: string;
}
type Opportunity = OpportunitySummary;
const displayMode = ref<"grid" | "list">("list");
const viewOptions: Array<{ value: SelectionView; label: string }> = [
  { value: "completed", label: "已完成分析" },
  { value: "recommended", label: "推荐商品" },
  { value: "rule_candidates", label: "候选商品" },
  { value: "evidence_pending", label: "采集中" },
  { value: "all", label: "全部商品" },
];
const filterQueryKeys = [
  "q",
  "market",
  "decision_status",
  "coverage_status",
  "blocking_reason",
  "lifecycle_status",
] as const;

const props = defineProps<{
    items: Opportunity[];
    total: number;
    state: State;
    requestId: string;
    filters: OpportunityFilters;
    selectionView: SelectionView;
    page: number;
    automationReadiness: AutomaticSelectionReadiness | null;
  }>(),
  failedImageSources = reactive(new Map<string, string>()),
  imageFailureResetSources = computed(() =>
    props.items.map((item) => [item.id, item.image_url] as const),
  ),
  imageFallbackLabel = (item: Opportunity) => {
    if (!item.image_url) return "商品主图待采集";
    return failedImageSources.get(item.id) === item.image_url ? "商品主图加载失败" : undefined;
  },
  hasUsableImage = (item: Opportunity) =>
    Boolean(item.image_url && failedImageSources.get(item.id) !== item.image_url),
  onImageError = (item: Opportunity) => {
    if (item.image_url) failedImageSources.set(item.id, item.image_url);
  },
  emit = defineEmits<{
    apply: [];
    page: [value: number];
    view: [value: SelectionView];
    manageSetup: [path: string];
    reset: [];
  }>(),
  route = useRoute(),
  pageCount = computed(() => Math.max(1, Math.ceil(props.total / 20))),
  activeFilterCount = computed(
    () =>
      filterQueryKeys.filter((key) => {
        const value = route.query[key];
        return typeof value === "string" && value.length > 0;
      }).length,
  ),
  draftFilterCount = computed(() => Object.values(props.filters).filter(Boolean).length),
  hasFiltersToClear = computed(() => activeFilterCount.value > 0 || draftFilterCount.value > 0),
  needsRuleSetup = computed(
    () => props.automationReadiness?.available === true && !props.automationReadiness.allReady,
  ),
  showAutomationReadiness = computed(
    () =>
      ["recommended", "rule_candidates"].includes(props.selectionView) &&
      props.automationReadiness != null &&
      !props.automationReadiness.allReady,
  ),
  nextSetupPath = computed(
    () =>
      props.automationReadiness?.steps.find((step) => !step.ready)?.route ??
      "/opportunities/scoring-rules",
  ),
  viewCopy = computed(
    () =>
      ({
        completed: {
          title: `${props.total} 个商品已完成分析`,
          description:
            "全部日期 · 按工作区内首次完成的主品 ASIN 去重，包含低分、不推荐和利润未知的结果。",
        },
        recommended: {
          title: `${props.total} 个商品建议采纳`,
          description: "评分、市场、竞争、成本和风险五项质量门均已通过，只等你最终采纳。",
        },
        rule_candidates: {
          title: `${props.total} 个选品候选`,
          description: "已识别 Amazon 主品，系统继续补齐五项质量门所需的证据。",
        },
        evidence_pending: {
          title: `${props.total} 个商品仍在采集`,
          description: "尚未取得可确认身份的 Amazon 主品证据，系统会继续采集。",
        },
        all: {
          title: `全部 ${props.total} 个商品`,
          description: "查看自动发现的商品与已有历史选品。",
        },
      })[props.selectionView],
  );

const productFacts = (item: Opportunity) => {
  const p = item.primary_product;
  const sales = p?.public_signals?.sales_badge;
  return [
    {
      label: "售价",
      value: p?.price != null && p.currency ? `${p.currency} ${p.price.toFixed(2)}` : "未采集",
    },
    {
      label: "1688进货价",
      value: item.automatic_purchase_price
        ? `CNY ${item.automatic_purchase_price.amount_value.toFixed(2)}`
        : "未取得",
    },
    {
      label: "评分 / 评价",
      value: `${p?.rating_value != null ? p.rating_value.toFixed(1) : "—"} / ${p?.review_count != null ? `${p.review_count} 条` : "未采集"}`,
    },
    {
      label: "购买提示",
      value: sales
        ? `${sales.period === "past_month" ? "近月" : "近周"} ≥ ${sales.quantity_lower_bound}`
        : "未采集",
    },
    {
      label: "类目排名",
      value: p?.public_signals?.best_seller_rank
        ? `#${p.public_signals.best_seller_rank.rank}`
        : "未采集",
    },
    {
      label: "采价时间",
      value: item.automatic_purchase_price
        ? freshness(item.automatic_purchase_price.observed_at)
        : "未取得",
    },
  ];
};

const opportunityStatus = (value: string) =>
    (
      ({
        pending: "待判断",
        adopted: "已采纳",
        observing: "观察中",
        rejected: "已驳回",
        insufficient_data: "待补充数据",
        calculated: "已计算",
        unknown: "待识别",
        low: "低",
        medium: "中",
        high: "高",
        evidence_insufficient: "缺少可采纳证据",
        recommendation_insufficient: "尚无可靠推荐结论",
        candidate: "候选",
        validating: "验证中",
        ready: "可决策",
        archived: "已归档",
      }) as Record<string, string>
    )[value] ?? value,
  freshness = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value)),
  sourceLabel = (item: Opportunity) =>
    item.source_type === "trend_topic"
      ? "情报发现"
      : item.source_type === "manual"
        ? "手工添加"
        : "其他线索",
  catalogMeta = (item: Opportunity) =>
    `${item.market} · ${item.category || "未分类"} · ${freshness(item.updated_at)}${item.matched_rule_count ? ` · 命中 ${item.matched_rule_count} 条规则` : ""}`,
  scoreLabel = (value: number | null) =>
    value == null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1),
  selectionStage = (item: Opportunity) => item.selection_stage ?? "not_eligible",
  recommendationLabel = (item: Opportunity) =>
    selectionStage(item) === "recommended"
      ? "建议采纳"
      : selectionStage(item) === "rule_candidate"
        ? "选品候选"
        : opportunityStatus(item.decision_status),
  qualityGateKeys = ["score", "market", "competition", "cost", "risk"] as const,
  qualityGateLabels = {
    score: "评分",
    market: "市场",
    competition: "竞争",
    cost: "成本",
    risk: "风险",
  } as const,
  passedGateCount = (item: Opportunity) =>
    qualityGateKeys.filter((key) => Boolean(item.quality_gates?.[key])).length,
  nextMissingGate = (item: Opportunity) => {
    const key = qualityGateKeys.find((candidate) => !item.quality_gates?.[candidate]);
    return key ? qualityGateLabels[key] : "全部通过";
  },
  rowFacts = (item: Opportunity) => {
    if (props.selectionView === "rule_candidates")
      return [
        { label: "质量门", value: `${passedGateCount(item)}/5` },
        {
          label: "证据",
          value: `${item.evidence_count} 条 · ${item.source_count} 源`,
        },
        { label: "下一项", value: nextMissingGate(item) },
      ];
    if (props.selectionView === "evidence_pending")
      return [
        { label: "独立来源", value: `${item.source_count} 个` },
        { label: "证据", value: `${item.evidence_count} 条` },
        { label: "命中规则", value: `${item.matched_rule_count} 条` },
      ];
    return [
      ...(["all", "completed"].includes(props.selectionView)
        ? [{ label: "当前结论", value: recommendationLabel(item) }]
        : []),
      { label: "综合评分", value: scoreLabel(item.overall_score) },
      {
        label: "证据",
        value: `${item.evidence_count} 条 · ${item.source_count} 源`,
      },
      { label: "风险", value: opportunityStatus(item.risk_level) },
    ];
  },
  clearOrShowAll = () => {
    if (hasFiltersToClear.value) emit("reset");
    else if (props.selectionView === "all") emit("apply");
    else emit("view", "all");
  };

watch(imageFailureResetSources, (items) => {
  const currentImageSources = new Map(items);
  for (const [id, failedUrl] of failedImageSources) {
    if (currentImageSources.get(id) !== failedUrl) failedImageSources.delete(id);
  }
});
</script>

<template>
  <section class="catalogue-controls" aria-label="选品结果视图">
    <nav>
      <button
        v-for="option in viewOptions"
        :key="option.value"
        type="button"
        :aria-current="selectionView === option.value ? 'page' : undefined"
        @click="emit('view', option.value)"
      >
        {{ option.label }}
      </button>
    </nav>
    <div class="catalogue-querybar">
      <form
        class="catalogue-search"
        role="search"
        aria-label="搜索商品"
        @submit.prevent="emit('apply')"
      >
        <label>
          <input
            v-model="filters.q"
            aria-label="商品名称"
            maxlength="200"
            placeholder="搜索商品名称"
          />
        </label>
        <button class="so-action-secondary" type="submit">搜索</button>
      </form>
      <ResponsiveFilterDrawer mode="dialog" label="高级筛选" :active-count="activeFilterCount">
        <form
          class="opportunity-filters catalogue-advanced-filters"
          @submit.prevent="emit('apply')"
        >
          <label>市场<input v-model="filters.market" maxlength="40" placeholder="全部市场" /></label
          ><label v-if="selectionView === 'all'"
            >决策状态<select v-model="filters.decision_status">
              <option value="">全部状态</option>
              <option value="pending">待决策</option>
              <option value="adopted">已采纳</option>
              <option value="observing">继续观察</option>
              <option value="rejected">已驳回</option>
            </select></label
          ><label
            >证据完整度<select v-model="filters.coverage_status">
              <option value="">全部完整度</option>
              <option value="insufficient">不完整</option>
              <option value="partial">部分完整</option>
              <option value="complete">完整</option>
            </select></label
          ><label
            >阻断原因<select v-model="filters.blocking_reason">
              <option value="">全部原因</option>
              <option value="evidence_insufficient">缺少可采纳证据</option>
              <option value="recommendation_insufficient">尚无可靠推荐结论</option>
            </select></label
          ><label
            >阶段<select v-model="filters.lifecycle_status">
              <option value="">全部阶段</option>
              <option value="candidate">候选</option>
              <option value="validating">验证中</option>
              <option value="ready">可决策</option>
              <option value="adopted">已采纳</option>
              <option value="observing">观察中</option>
              <option value="rejected">已驳回</option>
              <option value="archived">已归档</option>
            </select></label
          >
          <footer class="opportunity-filter-actions">
            <button class="filter-apply-action secondary so-action-secondary" type="submit">
              筛选
            </button>
            <button class="secondary so-action-secondary" type="button" @click="emit('reset')">
              重置
            </button>
          </footer>
        </form>
      </ResponsiveFilterDrawer>
    </div>
  </section>
  <AutomaticSelectionReadinessPanel
    class="catalogue-readiness"
    v-if="showAutomationReadiness && automationReadiness"
    :readiness="automationReadiness"
  />
  <UiStatePanel
    v-if="state !== 'ready'"
    :kind="state"
    :request-id="requestId"
    :title="state === 'empty' ? '暂无选品结果' : ''"
    :description="
      state === 'empty' ? '没有符合当前条件的商品。可以调整筛选、稍后刷新，或查看全部商品。' : ''
    "
    :primary-label="
      state === 'empty'
        ? !['all', 'completed'].includes(selectionView) && needsRuleSetup
          ? '完善自动推荐配置'
          : '刷新列表'
        : ''
    "
    :hide-secondary="state === 'empty' && selectionView === 'all' && !hasFiltersToClear"
    :secondary-label="
      state === 'empty'
        ? hasFiltersToClear
          ? '清除筛选'
          : selectionView === 'all'
            ? '刷新列表'
            : '查看全部选品'
        : '返回选品列表'
    "
    @primary="
      state === 'empty' && !['all', 'completed'].includes(selectionView) && needsRuleSetup
        ? emit('manageSetup', nextSetupPath)
        : emit('apply')
    "
    @secondary="state === 'empty' ? clearOrShowAll() : emit('reset')"
  />
  <section v-else class="product-catalog" :data-display="displayMode">
    <header>
      <div>
        <h2>{{ viewCopy.title }}</h2>
        <small :class="{ 'completed-analysis-summary': selectionView === 'completed' }">{{
          viewCopy.description
        }}</small>
      </div>
      <div class="catalog-display" role="group" aria-label="商品展示方式">
        <span>按更新时间排序</span>
        <button type="button" :aria-pressed="displayMode === 'grid'" @click="displayMode = 'grid'">
          图卡
        </button>
        <button type="button" :aria-pressed="displayMode === 'list'" @click="displayMode = 'list'">
          列表
        </button>
      </div>
    </header>
    <p class="catalog-data-note">
      购买提示为公开下限，不等于精确销量；进货价为已有采集记录，不含其他成本；候选数量不代表可用货源。
    </p>
    <OpportunityCatalogueList
      v-if="displayMode === 'list'"
      :items="items"
      :return-path="route.fullPath"
      :product-facts="productFacts"
      :row-facts="rowFacts"
      :catalog-meta="catalogMeta"
      :source-label="sourceLabel"
      :freshness="freshness"
      :has-usable-image="hasUsableImage"
      :image-fallback-label="imageFallbackLabel"
      @image-error="onImageError"
    />
    <div v-else class="catalog-products">
      <article v-for="item in items" :key="item.id" class="catalog-product">
        <RouterLink
          :to="{
            path: `/opportunities/${item.id}`,
            query: { from: route.fullPath },
          }"
          ><span
            class="opportunity-picture"
            :class="{ 'is-placeholder': !hasUsableImage(item) }"
            :role="imageFallbackLabel(item) ? 'img' : undefined"
            :aria-label="imageFallbackLabel(item)"
            ><img
              v-if="hasUsableImage(item)"
              :src="item.image_url ?? undefined"
              :alt="`${item.name} 商品图`"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImageError(item)"
            /><span v-else aria-hidden="true">{{ imageFallbackLabel(item) }}</span></span
          ><span class="catalog-product-identity"
            ><span class="catalog-product-key">
              <small v-if="item.main_asin" :title="`ASIN ${item.main_asin}`"
                >ASIN <span>{{ item.main_asin }}</span></small
              >
              <small v-else>主品待确认</small>
              <em>{{ sourceLabel(item) }}</em>
            </span>
            <strong>{{ item.name }}</strong
            ><small :title="catalogMeta(item)">{{ catalogMeta(item) }}</small></span
          >
          <div class="catalog-public-facts" :aria-label="`${item.name} 商品资料`">
            <dl>
              <div
                v-for="fact in productFacts(item)"
                :key="fact.label"
                :class="{
                  'is-price': ['售价', '1688进货价'].includes(fact.label),
                  'is-missing': ['未采集', '未取得'].includes(fact.value),
                }"
              >
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <p v-if="item.primary_product">
              <span>{{
                item.primary_product.public_signals?.sponsored
                  ? "已观察到广告标记"
                  : "广告标记未提供"
              }}</span
              ><time :datetime="item.primary_product.captured_at"
                >资料 {{ freshness(item.primary_product.captured_at) }}</time
              >
            </p>
            <p v-else>商品资料待采集</p>
          </div>
          <dl class="catalog-product-metrics" :aria-label="`${item.name} 决策摘要`">
            <div v-for="fact in rowFacts(item)" :key="fact.label">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>
          <div class="catalog-product-coverage">
            <span
              >竞品候选 <strong>{{ item.competitor_count }}</strong></span
            >
            <span
              >货源候选 <strong>{{ item.supplier_candidate_count }}</strong></span
            >
            <span>{{ opportunityProfitStatusLabel(item.profit_status) }}</span>
          </div>
          <b :data-status="item.decision_status"
            >{{ selectionStage(item) === "recommended" ? "审阅并采纳" : "查看进度" }} →</b
          ></RouterLink
        >
      </article>
    </div>
    <footer class="opportunity-pagination" aria-label="选品分页">
      <button type="button" :disabled="page <= 1" @click="emit('page', page - 1)">上一页</button>
      <span>第 {{ page }} / {{ pageCount }} 页</span>
      <button type="button" :disabled="page >= pageCount" @click="emit('page', page + 1)">
        下一页
      </button>
    </footer>
  </section>
</template>

<style scoped>
.filter-apply-action {
  border-color: var(--so-border);
  color: var(--so-text);
  background-color: transparent;
  background-image: none;
}

.opportunity-filter-actions {
  display: contents;
}

@media (max-width: 760px) {
  .completed-analysis-summary {
    display: block;
    white-space: normal;
    line-height: 1.6;
  }
  .filter-apply-action {
    border-color: var(--so-primary);
    color: var(--so-on-primary);
    background-color: var(--so-primary);
  }
}
</style>
