<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { opportunityProfitStatusLabel } from "./opportunity-workspace-presentation";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";
import AutomaticSelectionReadinessPanel from "./AutomaticSelectionReadinessPanel.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import UiStatePanel from "./UiStatePanel.vue";
import type { OpportunitySummary } from "./opportunity-workspace-types";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type SelectionView = "recommended" | "rule_candidates" | "evidence_pending" | "all";
interface OpportunityFilters {
  q: string;
  market: string;
  decision_status: string;
  coverage_status: string;
  blocking_reason: string;
  lifecycle_status: string;
  owner_id: string;
}
type Opportunity = OpportunitySummary;
const displayMode = ref<"grid" | "list">("grid");
const viewOptions: Array<{ value: SelectionView; label: string }> = [
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
  "owner_id",
] as const;

const props = defineProps<{
    items: Opportunity[];
    total: number;
    state: State;
    requestId: string;
    filters: OpportunityFilters;
    selectionView: SelectionView;
    memberOptions: Array<{ id: string; label: string }>;
    selectedIds: string[];
    currentPageSelectedCount: number;
    outsideCurrentPageSelectedCount: number;
    page: number;
    canDecide: boolean;
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
    "update:selectedIds": [value: string[]];
    batch: [value: "assign" | "archive" | "review"];
    create: [];
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
  showAutomationReadiness = computed(() =>
    ["recommended", "rule_candidates"].includes(props.selectionView),
  ),
  nextSetupPath = computed(
    () =>
      props.automationReadiness?.steps.find((step) => !step.ready)?.route ??
      "/opportunities/scoring-rules",
  ),
  viewCopy = computed(
    () =>
      ({
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
          title: `全部 ${props.total} 个机会`,
          description: "查看自动发现的商品与已有历史机会。",
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
        { label: "证据", value: `${item.evidence_count} 条 · ${item.source_count} 源` },
        { label: "下一项", value: nextMissingGate(item) },
      ];
    if (props.selectionView === "evidence_pending")
      return [
        { label: "独立来源", value: `${item.source_count} 个` },
        { label: "证据", value: `${item.evidence_count} 条` },
        { label: "命中规则", value: `${item.matched_rule_count} 条` },
      ];
    return [
      ...(props.selectionView === "all"
        ? [{ label: "当前结论", value: recommendationLabel(item) }]
        : []),
      { label: "综合评分", value: scoreLabel(item.overall_score) },
      { label: "证据", value: `${item.evidence_count} 条 · ${item.source_count} 源` },
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
  <section class="catalogue-controls" aria-label="推荐清单视图">
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
    <ResponsiveFilterDrawer label="高级筛选" :active-count="activeFilterCount">
      <form class="opportunity-filters" @submit.prevent="emit('apply')">
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
        ><label
          >负责人<select v-model="filters.owner_id">
            <option value="">全部负责人</option>
            <option v-for="member in memberOptions" :key="member.id" :value="member.id">
              {{ member.label }}
            </option>
          </select></label
        ><label>机会名称<input v-model="filters.q" maxlength="200" placeholder="搜索机会" /></label>
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
    :primary-label="
      state === 'empty'
        ? selectionView === 'all'
          ? canDecide
            ? '手工添加机会'
            : '刷新列表'
          : '完善自动推荐配置'
        : ''
    "
    :secondary-label="
      state === 'empty'
        ? hasFiltersToClear
          ? '清除筛选'
          : selectionView === 'all'
            ? '刷新列表'
            : '查看全部机会'
        : '返回机会列表'
    "
    @primary="
      state === 'empty' && selectionView !== 'all'
        ? emit('manageSetup', nextSetupPath)
        : state === 'empty' && canDecide
          ? emit('create')
          : emit('apply')
    "
    @secondary="state === 'empty' ? clearOrShowAll() : emit('reset')"
  />
  <section v-else class="opportunity-list product-catalog" :data-display="displayMode">
    <header>
      <div>
        <h3>{{ viewCopy.title }}</h3>
        <small>{{ viewCopy.description }}</small>
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
    <nav
      v-if="canDecide && selectionView === 'all' && selectedIds.length"
      class="opportunity-batch-bar"
      aria-label="机会批量操作"
    >
      <div class="opportunity-batch-summary" aria-live="polite">
        <strong>已选 {{ selectedIds.length }} 项</strong>
        <small v-if="currentPageSelectedCount">
          本次仅处理当前页已选的 {{ currentPageSelectedCount }} 项
          <template v-if="outsideCurrentPageSelectedCount">
            · 另有 {{ outsideCurrentPageSelectedCount }} 项不在当前结果中
          </template>
        </small>
        <small v-else>当前结果中没有已选机会，切换筛选或清除选择后再操作。</small>
      </div>
      <button
        type="button"
        :disabled="currentPageSelectedCount === 0"
        @click="emit('batch', 'assign')"
      >
        批量指派
      </button>
      <button
        type="button"
        :disabled="currentPageSelectedCount === 0"
        @click="emit('batch', 'review')"
      >
        批量复核
      </button>
      <button
        type="button"
        class="danger"
        :disabled="currentPageSelectedCount === 0"
        @click="emit('batch', 'archive')"
      >
        批量归档
      </button>
    </nav>
    <div class="catalog-products">
      <article
        v-for="item in items"
        :key="item.id"
        class="catalog-product"
        :class="{ 'is-selectable': canDecide && selectionView === 'all' }"
      >
        <label v-if="canDecide && selectionView === 'all'" class="opportunity-row-select">
          <input
            type="checkbox"
            :checked="selectedIds.includes(item.id)"
            :aria-label="`选择机会：${item.name}`"
            @change="
              emit(
                'update:selectedIds',
                selectedIds.includes(item.id)
                  ? selectedIds.filter((id) => id !== item.id)
                  : [...selectedIds, item.id],
              )
            "
          />
        </label>
        <RouterLink :to="{ path: `/opportunities/${item.id}`, query: { from: route.fullPath } }"
          ><span
            class="opportunity-picture"
            :role="imageFallbackLabel(item) ? 'img' : undefined"
            :aria-label="imageFallbackLabel(item)"
            ><img
              v-if="hasUsableImage(item)"
              :src="item.image_url ?? undefined"
              :alt="`${item.name} 商品图`"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImageError(item)"
            /><span v-else aria-hidden="true">图</span></span
          ><span class="catalog-product-identity"
            ><strong>{{ item.name }}</strong
            ><small v-if="item.main_asin"
              >ASIN <span>{{ item.main_asin }}</span></small
            ><small
              >{{ item.market }} · {{ item.category || "未分类" }} ·
              {{ freshness(item.updated_at) }}</small
            ><em
              >{{ sourceLabel(item)
              }}<template v-if="item.matched_rule_count">
                · 命中 {{ item.matched_rule_count }} 条规则</template
              ></em
            ></span
          >
          <div class="catalog-public-facts" :aria-label="`${item.name} 商品资料`">
            <template v-if="item.primary_product">
              <dl>
                <div v-for="fact in productFacts(item)" :key="fact.label">
                  <dt>{{ fact.label }}</dt>
                  <dd>{{ fact.value }}</dd>
                </div>
              </dl>
              <p>
                <span>{{
                  item.primary_product.public_signals?.sponsored
                    ? "已观察到广告标记"
                    : "广告标记未提供"
                }}</span
                ><time :datetime="item.primary_product.captured_at"
                  >资料 {{ freshness(item.primary_product.captured_at) }}</time
                >
              </p>
              <small>购买提示为公开下限，不等于精确销量。</small>
            </template>
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
              >竞品 <strong>{{ item.competitor_count }}</strong></span
            >
            <span
              >货源 <strong>{{ item.supplier_candidate_count }}</strong></span
            >
            <span>{{ opportunityProfitStatusLabel(item.profit_status) }}</span>
          </div>
          <b :data-status="item.decision_status"
            >{{ selectionStage(item) === "recommended" ? "审阅并采纳" : "查看进度" }} →</b
          ></RouterLink
        >
      </article>
    </div>
    <footer class="opportunity-pagination" aria-label="机会分页">
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
  .filter-apply-action {
    border-color: var(--so-primary);
    color: var(--so-on-primary);
    background-color: var(--so-primary);
  }
}
</style>
