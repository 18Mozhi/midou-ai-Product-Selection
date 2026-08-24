<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import UiStatePanel from "./UiStatePanel.vue";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type Scope = "product" | "all";
interface OpportunityFilters {
  q: string;
  market: string;
  decision_status: string;
  coverage_status: string;
  blocking_reason: string;
  lifecycle_status: string;
  owner_id: string;
}
interface Opportunity {
  id: string;
  name: string;
  image_url: string | null;
  market: string;
  category: string | null;
  decision_status: string;
  profit_status: string;
  risk_level: string;
  evidence_count: number;
  source_count: number;
  competitor_count: number;
  supplier_candidate_count: number;
  blocking_reasons: Array<"evidence_insufficient" | "recommendation_insufficient">;
  owner_id: string | null;
  lifecycle_status: string;
  lifecycle_entered_at: string;
  lifecycle_dwell_seconds: number;
  version: number;
  updated_at: string;
}

const props = defineProps<{
    items: Opportunity[];
    total: number;
    state: State;
    requestId: string;
    filters: OpportunityFilters;
    listScope: Scope;
    memberOptions: Array<{ id: string; label: string }>;
    selectedIds: string[];
    page: number;
    canDecide: boolean;
  }>(),
  emit = defineEmits<{
    apply: [];
    page: [value: number];
    "update:listScope": [value: Scope];
    "update:selectedIds": [value: string[]];
    batch: [value: "assign" | "archive" | "review"];
  }>(),
  route = useRoute(),
  pageCount = computed(() => Math.max(1, Math.ceil(props.total / 20))),
  summary = computed(() => ({
    withImage: props.items.filter((item) => Boolean(item.image_url)).length,
    competitors: props.items.reduce((sum, item) => sum + (item.competitor_count ?? 0), 0),
    suppliers: props.items.reduce((sum, item) => sum + (item.supplier_candidate_count ?? 0), 0),
  })),
  activeFilterCount = computed(
    () => Object.values(props.filters).filter(Boolean).length + (props.listScope === "all" ? 1 : 0),
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
  freshness = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value)),
  ownerLabel = (ownerId: string | null) =>
    props.memberOptions.find((member) => member.id === ownerId)?.label ?? "未指派",
  dwellLabel = (seconds: number) => {
    const safe = Math.max(0, Number(seconds) || 0),
      days = Math.floor(safe / 86400),
      hours = Math.floor((safe % 86400) / 3600),
      minutes = Math.floor((safe % 3600) / 60);
    if (days) return `${days} 天 ${hours} 小时`;
    if (hours) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  };

function changeScope(event: Event) {
  emit("update:listScope", (event.target as HTMLSelectElement).value as Scope);
}
</script>

<template>
  <ResponsiveFilterDrawer label="筛选机会" :active-count="activeFilterCount">
    <form class="opportunity-filters" @submit.prevent="emit('apply')">
      <label>市场<input v-model="filters.market" maxlength="40" placeholder="全部市场" /></label
      ><label
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
      ><label>机会名称<input v-model="filters.q" maxlength="200" placeholder="搜索机会" /></label
      ><label
        >显示范围<select :value="listScope" @change="changeScope">
          <option value="product">可分析商品</option>
          <option value="all">全部线索</option>
        </select></label
      ><button type="submit">筛选</button>
    </form>
  </ResponsiveFilterDrawer>
  <section class="opportunity-list-summary" aria-label="选品机会数据总览">
    <article>
      <span>当前结果</span><b>{{ total }}</b>
    </article>
    <article>
      <span>已补商品图</span><b>{{ summary.withImage }}</b>
    </article>
    <article>
      <span>关联竞品</span><b>{{ summary.competitors }}</b>
    </article>
    <article>
      <span>供应商候选</span><b>{{ summary.suppliers }}</b>
    </article>
  </section>
  <UiStatePanel
    v-if="state !== 'ready'"
    :kind="state"
    :request-id="requestId"
    @primary="emit('apply')"
  />
  <section v-else class="opportunity-list">
    <header>
      <div>
        <p>机会流程</p>
        <h3>机会列表</h3>
      </div>
      <span>共 {{ total }} 个机会 · 按更新时间排序</span>
    </header>
    <nav
      v-if="canDecide && selectedIds.length"
      class="opportunity-batch-bar"
      aria-label="机会批量操作"
    >
      <span>已选 {{ selectedIds.length }} 项</span>
      <button type="button" @click="emit('batch', 'assign')">批量指派</button>
      <button type="button" @click="emit('batch', 'review')">批量复核</button>
      <button type="button" class="danger" @click="emit('batch', 'archive')">批量归档</button>
    </nav>
    <article v-for="item in items" :key="item.id" class="opportunity-list-row">
      <label v-if="canDecide" class="opportunity-row-select">
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
        ><span class="opportunity-picture"
          ><img
            v-if="item.image_url"
            :src="item.image_url"
            :alt="`${item.name} 商品图`"
            loading="lazy"
            referrerpolicy="no-referrer"
          /><i v-else>主图<br />待采集</i></span
        ><span
          ><strong>{{ item.name }}</strong
          ><small
            >{{ item.market }} · {{ item.category || "未分类" }} ·
            {{ freshness(item.updated_at) }}</small
          ></span
        >
        <dl>
          <div>
            <dt>证据 / 来源</dt>
            <dd>{{ item.evidence_count }} / {{ item.source_count }}</dd>
          </div>
          <div>
            <dt>关联竞品</dt>
            <dd>{{ item.competitor_count }}</dd>
          </div>
          <div>
            <dt>供应商候选</dt>
            <dd>{{ item.supplier_candidate_count }}</dd>
          </div>
          <div>
            <dt>利润</dt>
            <dd>{{ opportunityStatus(item.profit_status) }}</dd>
          </div>
          <div>
            <dt>风险</dt>
            <dd>{{ opportunityStatus(item.risk_level) }}</dd>
          </div>
          <div>
            <dt>阻断原因</dt>
            <dd>
              {{
                (item.blocking_reasons ?? []).length
                  ? item.blocking_reasons.map(opportunityStatus).join("、")
                  : "无采纳阻断"
              }}
            </dd>
          </div>
          <div>
            <dt>当前阶段 / 停留</dt>
            <dd>
              {{ opportunityStatus(item.lifecycle_status) }} ·
              {{ dwellLabel(item.lifecycle_dwell_seconds) }}
            </dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>{{ ownerLabel(item.owner_id) }}</dd>
          </div>
        </dl>
        <b :data-status="item.decision_status"
          >{{ opportunityStatus(item.decision_status) }} · 查看详情 →</b
        ></RouterLink
      >
    </article>
    <footer class="opportunity-pagination" aria-label="机会分页">
      <button type="button" :disabled="page <= 1" @click="emit('page', page - 1)">上一页</button>
      <span>第 {{ page }} / {{ pageCount }} 页</span>
      <button type="button" :disabled="page >= pageCount" @click="emit('page', page + 1)">
        下一页
      </button>
    </footer>
  </section>
</template>
