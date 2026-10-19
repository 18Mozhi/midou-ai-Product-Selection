<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { sanitizeCorrelationId } from "../ui/state-contract";
import type { OpportunitySummary } from "./opportunity-workspace-types";

const props = defineProps<{
  apiBaseUrl: string;
  topicId: string;
  organizationId: string;
  workspaceId: string;
}>();
const route = useRoute(),
  items = ref<OpportunitySummary[]>([]),
  total = ref(0),
  page = ref(1),
  requestId = ref(""),
  state = ref<"loading" | "ready" | "error" | "forbidden" | "expired">("loading"),
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / 5)));
let active = true,
  generation = 0,
  controller: AbortController | null = null;
const contextKey = () =>
  JSON.stringify([props.apiBaseUrl, props.topicId, props.organizationId, props.workspaceId]);
function stop() {
  generation++;
  controller?.abort();
  controller = null;
}
async function load() {
  if (!active) return;
  stop();
  const current = generation,
    key = contextKey(),
    requestedPage = page.value;
  const pending = new AbortController();
  controller = pending;
  const isCurrent = () =>
    active &&
    current === generation &&
    !pending.signal.aborted &&
    key === contextKey() &&
    requestedPage === page.value;
  items.value = [];
  requestId.value = "";
  total.value = 0;
  state.value = "loading";
  try {
    const query = new URLSearchParams({
      selection_view: "all",
      source_topic_id: props.topicId,
      page: String(requestedPage),
      page_size: "5",
    });
    const response = await createApiClient(props.apiBaseUrl)<OpportunitySummary[]>(
      `/opportunities?${query}`,
      { signal: pending.signal },
    );
    if (!isCurrent()) return;
    items.value = response.data;
    total.value = Number((response.meta as { total: number }).total);
    if (requestedPage > Math.max(1, Math.ceil(total.value / 5))) {
      page.value = 1;
      void load();
      return;
    }
    state.value = "ready";
  } catch (error) {
    if (!isCurrent()) return;
    requestId.value = error instanceof ApiClientError ? sanitizeCorrelationId(error.requestId) : "";
    state.value =
      error instanceof ApiClientError && (error.kind === "forbidden" || error.kind === "expired")
        ? error.kind
        : "error";
  } finally {
    if (current === generation) controller = null;
  }
}
function goPage(next: number) {
  if (next < 1 || next > pageCount.value || state.value === "loading") return;
  page.value = next;
  void load();
}
watch(
  contextKey,
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);
onDeactivated(() => {
  active = false;
  stop();
});
onActivated(() => {
  if (!active) {
    active = true;
    void load();
  }
});
onBeforeUnmount(() => {
  active = false;
  stop();
});
</script>

<template>
  <section class="trend-related-products" aria-label="关联选品" :aria-busy="state === 'loading'">
    <header>
      <h4>关联选品</h4>
      <span v-if="state === 'ready'">{{ total }} 个未归档记录</span>
    </header>
    <p class="trend-related-note">按已保存的情报归属与证据关联；有关联不代表已推荐或整链完成。</p>
    <p v-if="state === 'loading'" role="status">正在读取关联选品…</p>
    <p v-else-if="state === 'forbidden'" role="alert">无权读取关联选品，情报证据仍可查看。</p>
    <p v-else-if="state === 'expired'" role="alert">登录已失效，请重新登录后刷新页面。</p>
    <div v-else-if="state === 'error'" role="alert">
      <p>关联选品暂时读取失败，情报证据仍可查看。</p>
      <button type="button" class="so-action-secondary" @click="load">重试关联选品</button>
    </div>
    <p v-else-if="!items.length">尚无已关联的未归档选品记录。</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id">
        <RouterLink :to="{ path: `/opportunities/${item.id}`, query: { from: route.fullPath } }">
          <strong>{{ item.name }}</strong
          ><small
            >{{ item.main_asin ? `ASIN ${item.main_asin}` : "主品待确认" }} ·
            {{ item.market }}</small
          >
        </RouterLink>
        <dl>
          <div>
            <dt>综合评分</dt>
            <dd>{{ item.overall_score == null ? "未知" : item.overall_score.toFixed(1) }}</dd>
          </div>
          <div>
            <dt>竞品候选</dt>
            <dd>{{ item.competitor_count }}</dd>
          </div>
          <div>
            <dt>货源候选</dt>
            <dd>{{ item.supplier_candidate_count }}</dd>
          </div>
          <div>
            <dt>利润</dt>
            <dd>{{ item.profit_status === "calculated" ? "已计算" : "未知" }}</dd>
          </div>
        </dl>
      </li>
    </ul>
    <details v-if="requestId">
      <summary>技术详情</summary>
      <code>请求 {{ requestId }}</code>
    </details>
    <nav v-if="state === 'ready' && pageCount > 1" aria-label="关联选品分页">
      <button
        type="button"
        class="so-action-secondary"
        :disabled="page <= 1"
        @click="goPage(page - 1)"
      >
        上一页</button
      ><span>第 {{ page }} / {{ pageCount }} 页</span
      ><button
        type="button"
        class="so-action-secondary"
        :disabled="page >= pageCount"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </nav>
  </section>
</template>

<style scoped>
.trend-related-products {
  margin-top: 18px;
  padding-block: 16px;
  border-bottom: 1px solid var(--so-border);
  font-size: 13px;
}
.trend-related-products > header,
.trend-related-products nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.trend-related-products h4 {
  margin: 0;
  font-size: 16px;
}
.trend-related-products p,
.trend-related-products small,
.trend-related-products dt,
.trend-related-products header span {
  color: var(--so-text-muted);
}
.trend-related-products p {
  line-height: 1.6;
  font-weight: 400;
  letter-spacing: normal;
}
.trend-related-products ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.trend-related-products li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 1fr);
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--so-border);
}
.trend-related-products a {
  min-width: 0;
  color: var(--so-primary);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.trend-related-products a:hover {
  text-decoration: underline;
}
.trend-related-products small {
  display: block;
  margin-top: 6px;
}
.trend-related-products dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}
.trend-related-products dd {
  margin: 6px 0 0;
  color: var(--so-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.trend-related-products nav {
  justify-content: flex-end;
  margin-top: 10px;
}
.trend-related-products button {
  min-height: 44px;
}
@media (max-width: 1100px) {
  .trend-related-products li {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .trend-related-products dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .trend-related-products nav {
    justify-content: space-between;
  }
}
</style>
