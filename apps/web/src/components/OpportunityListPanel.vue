<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useRoute } from "vue-router";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";
import AutomaticSelectionReadinessPanel from "./AutomaticSelectionReadinessPanel.vue";
import OpportunityCatalogueList from "./OpportunityCatalogueList.vue";
import AppIcon from "./AppIcon.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import UiStatePanel from "./UiStatePanel.vue";
import type { OpportunitySummary } from "./opportunity-workspace-types";
import {
  catalogueProductFacts as productFacts,
  catalogueFreshness as freshness,
  catalogueMeta as catalogMeta,
  catalogueSourceLabel as sourceLabel,
} from "./opportunity-catalogue-facts";

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
  <header class="catalogue-page-heading">
    <div>
      <h2>选品库</h2>
      <span>从情报到商品，把比较和判断放在一张表里。</span>
    </div>
    <button type="button" class="so-action-secondary" @click="emit('apply')">
      <AppIcon name="refresh" />更新结果
    </button>
  </header>
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
        <label class="catalogue-search-field">
          <AppIcon
            v-if="selectionView === 'rule_candidates'"
            class="catalogue-search-icon"
            name="search"
          />
          <input
            v-model="filters.q"
            aria-label="商品名称"
            maxlength="200"
            placeholder="输入商品名称搜索"
          />
        </label>
        <button class="so-action-secondary" type="submit">搜索</button>
      </form>
      <label class="catalogue-market-filter"
        >市场<input
          v-model="filters.market"
          maxlength="40"
          placeholder="全部市场"
          @keydown.enter="emit('apply')"
      /></label>
      <button v-if="hasFiltersToClear" type="button" class="catalogue-clear" @click="emit('reset')">
        清除条件
      </button>
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
  <section
    v-if="state === 'empty' && selectionView === 'completed'"
    class="midou-completed-empty"
    aria-label="已完成分析空状态"
  >
    <div class="midou-completed-illustration">
      <svg
        viewBox="0 0 80 80"
        width="76"
        height="76"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="m11 39 29-9 29 9-29 10-29-10Zm0 0-6 12 28 9 7-11 7 11 28-9-6-12M12 54v13l28 10 28-10V54M40 49v28"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          class="midou-completed-sparks"
          d="M40 9v12M22 16l5 7m31-7-5 7"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <h3>{{ hasFiltersToClear ? "当前筛选下暂无已完成分析的商品" : "暂无已完成分析的商品" }}</h3>
    <p>系统正在补齐分析证据，可先查看候选商品。</p>
    <div class="midou-completed-actions">
      <button type="button" class="so-action-primary" @click="emit('view', 'rule_candidates')">
        查看候选商品</button
      ><button type="button" class="so-action-secondary" @click="emit('apply')">
        <AppIcon name="refresh" :size="20" />刷新结果
      </button>
    </div>
    <div class="midou-analysis-flow-frame">
      <strong class="midou-analysis-flow-heading" aria-hidden="true">分析流程说明</strong>
      <ol class="midou-analysis-flow" aria-label="分析流程说明">
        <li
          v-for="step in [
            { icon: 'target', label: '识别主品', description: '匹配商品关键信息' },
            { icon: 'chart', label: '补齐评分', description: '汇总多维分析证据' },
            { icon: 'users', label: '对比竞品', description: '识别差异与机会' },
            { icon: 'box', label: '匹配货源', description: '对接供应渠道' },
            { icon: 'database', label: '评估利润', description: '测算成本与利润空间' },
          ]"
          :key="step.label"
        >
          <AppIcon :name="step.icon" :size="24" /><span
            ><b>{{ step.label }}</b
            ><small>{{ step.description }}</small></span
          >
        </li>
      </ol>
    </div>
    <details v-if="requestId" class="midou-analysis-diagnostics">
      <summary>诊断信息</summary>
      <p>
        本次读取关联编号：<code>{{ requestId }}</code
        >。图示仅说明分析流程，不代表这些步骤已经完成。
      </p>
    </details>
  </section>
  <UiStatePanel
    v-else-if="state !== 'ready'"
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
  <section
    v-else
    class="product-catalog"
    :class="{ 'product-catalog--candidates': selectionView === 'rule_candidates' }"
  >
    <header>
      <div>
        <h2>{{ viewCopy.title }}</h2>
        <small :class="{ 'completed-analysis-summary': selectionView === 'completed' }">{{
          viewCopy.description
        }}</small>
      </div>
      <span class="catalogue-sort-note">最近更新优先 · 每页 20 个</span>
    </header>
    <p class="catalog-data-note">
      <AppIcon v-if="selectionView === 'rule_candidates'" name="info" :size="18" />
      <span v-if="selectionView === 'rule_candidates'">
        购买提示为公开下限，不等于精确销量；货源候选不代表可用货源。<span
          class="catalogue-inline-cost-note"
          >进货价为已有采集记录，不含其他成本。</span
        >
      </span>
      <span v-else
        >购买提示为公开下限，不等于精确销量；进货价为已有采集记录，不含其他成本；候选数量不代表可用货源。</span
      >
    </p>
    <div v-if="selectionView === 'rule_candidates'" class="catalogue-table-reading-band">
      <div class="catalogue-table-context">
        <span>当前页 {{ items.length }} 条</span>
      </div>
      <span class="catalogue-table-cost-note">进货价为已有采集记录，不含其他成本。</span>
    </div>
    <OpportunityCatalogueList
      :items="items"
      :return-path="route.fullPath"
      :completed-view="selectionView === 'completed'"
      :candidate-gate-count="selectionView === 'rule_candidates' ? passedGateCount : undefined"
      :product-facts="productFacts"
      :row-facts="rowFacts"
      :catalog-meta="catalogMeta"
      :source-label="sourceLabel"
      :freshness="freshness"
      :has-usable-image="hasUsableImage"
      :image-fallback-label="imageFallbackLabel"
      @image-error="onImageError"
    />
    <footer class="opportunity-pagination" aria-label="选品分页">
      <span v-if="selectionView === 'rule_candidates'" class="catalogue-pager-total">
        共 {{ total }} 条 · 每页 20 条
      </span>
      <button
        type="button"
        aria-label="上一页"
        :disabled="page <= 1"
        @click="emit('page', page - 1)"
      >
        <AppIcon
          v-if="selectionView === 'rule_candidates'"
          class="catalogue-pager-arrow is-previous"
          name="chevron"
        />
        <span class="catalogue-pager-label">上一页</span>
      </button>
      <span v-if="selectionView === 'rule_candidates'" class="catalogue-pager-position"
        ><span class="catalogue-pager-prefix">第 </span
        ><span class="catalogue-pager-current" aria-current="page">{{ page }}</span
        ><span> / {{ pageCount }} 页</span></span
      >
      <span v-else class="catalogue-pager-position">第 {{ page }} / {{ pageCount }} 页</span>
      <button
        type="button"
        aria-label="下一页"
        :disabled="page >= pageCount"
        @click="emit('page', page + 1)"
      >
        <AppIcon
          v-if="selectionView === 'rule_candidates'"
          class="catalogue-pager-arrow"
          name="chevron"
        />
        <span class="catalogue-pager-label">下一页</span>
      </button>
    </footer>
  </section>
</template>

<style scoped>
.product-catalog--candidates .catalog-data-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, var(--so-warning-border) 55%, var(--so-panel));
  border-radius: 8px;
  color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning-soft) 70%, var(--so-panel));
}

.product-catalog--candidates .catalog-data-note > svg {
  flex: 0 0 18px;
  block-size: 1lh;
}

.product-catalog--candidates :deep(.selection-product-list) {
  border-radius: 8px;
}

@media (min-width: 1100px) {
  .product-catalog--candidates :deep(table) {
    min-width: 960px;
  }
  .product-catalog--candidates :deep(.product-column) {
    width: 24%;
  }
  .product-catalog--candidates :deep(th) {
    height: 36px;
    padding: 6px 8px;
  }
  .product-catalog--candidates :deep(td) {
    padding: 10px 8px;
  }
  .product-catalog--candidates :deep(.selection-product-identity) {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 10px;
  }
  .product-catalog--candidates :deep(.selection-product-picture) {
    width: 64px;
    height: 64px;
    border-radius: 4px;
  }
}

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
