<script setup lang="ts">
import { computed } from "vue";
import PlatformContentPagination from "./PlatformContentPagination.vue";
import PlatformManagementFilter from "./PlatformManagementFilter.vue";
import PlatformManagementRecordList from "./PlatformManagementRecordList.vue";

type PageState = "loading" | "ready" | "empty" | "error";
type ReviewStatus = "active" | "irrelevant" | "stale";

const props = defineProps<{
  state: PageState;
  data: any;
  message: string;
  requestId: string;
  refreshing: boolean;
  busy: string;
  activeFilterCount: number;
  appliedQuery: string;
  appliedStatus: string;
  snapshotQuery: string;
  snapshotStatus: string;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();

const emit = defineEmits<{
  refresh: [];
  apply: [];
  reset: [];
  changePage: [page: number];
  review: [item: any, status: ReviewStatus];
}>();

const query = defineModel<string>("query", { required: true });
const status = defineModel<string>("status", { required: true });

const hasSnapshot = computed(() => props.data?.domain === "content");
const items = computed<any[]>(() => props.data?.items ?? []);
const summaryItems = computed(() => [
  { key: "total", label: "查询匹配总量", value: Number(props.data?.summary?.total ?? 0) },
  { key: "active", label: "展示中", value: Number(props.data?.summary?.active ?? 0) },
  { key: "irrelevant", label: "无关", value: Number(props.data?.summary?.irrelevant ?? 0) },
  { key: "stale", label: "已过期", value: Number(props.data?.summary?.stale ?? 0) },
  { key: "archived", label: "已归档", value: Number(props.data?.summary?.archived ?? 0) },
]);
const snapshotScope = computed(() => {
  const parts = [
    props.snapshotQuery ? `搜索“${props.snapshotQuery}”` : "全部主题",
    props.snapshotStatus ? props.stateName(props.snapshotStatus) : "全部状态",
  ];
  return parts.join(" · ");
});
const requestedScope = computed(() => {
  const parts = [
    props.appliedQuery ? `搜索“${props.appliedQuery}”` : "全部主题",
    props.appliedStatus ? props.stateName(props.appliedStatus) : "全部状态",
  ];
  return parts.join(" · ");
});
const scopeChanged = computed(
  () => props.snapshotQuery !== props.appliedQuery || props.snapshotStatus !== props.appliedStatus,
);
</script>

<template>
  <section
    class="platform-content platform-content--review"
    aria-live="polite"
    :aria-busy="refreshing"
  >
    <aside class="platform-content__rail" aria-label="内容治理说明">
      <div>
        <small>CONTENT OPERATIONS</small>
        <strong>内容治理</strong>
        <span>跨组织热点事实目录</span>
      </div>
      <ol>
        <li aria-current="page"><b>01</b><span>核对热点事实</span></li>
        <li><b>02</b><span>判断展示状态</span></li>
        <li><b>03</b><span>记录审核依据</span></li>
      </ol>
      <p>不修改标题、正文、热度与来源；只处理现有展示状态。</p>
    </aside>

    <div class="platform-content__surface">
      <header class="platform-content__hero">
        <div>
          <p>P56 / CONTENT OPERATIONS</p>
          <h1>内容管理</h1>
          <span>核对热点事实，再决定如何展示。</span>
        </div>
        <button type="button" :disabled="refreshing" @click="emit('refresh')">
          {{ refreshing ? "读取中…" : "刷新内容" }}
        </button>
      </header>

      <section v-if="!hasSnapshot" class="platform-content__first-state">
        <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
        <div>
          <h3>{{ state === "loading" ? "正在读取内容台账" : "当前无法读取内容台账" }}</h3>
          <p>
            {{
              state === "loading"
                ? "正在核对跨组织热点记录与状态统计。"
                : message || "内容事实暂时不可用，请稍后重新加载。"
            }}
          </p>
        </div>
        <button v-if="state !== 'loading'" type="button" @click="emit('refresh')">重新加载</button>
      </section>

      <template v-else>
        <section class="platform-content__summary" aria-label="当前查询统计">
          <article
            v-for="(entry, index) in summaryItems"
            :key="entry.key"
            :class="{ 'platform-content__summary-main': index === 0 }"
          >
            <strong>{{ entry.value }}</strong>
            <span>{{ entry.label }}</span>
          </article>
        </section>

        <p class="platform-content__scope-note">
          统计仅随搜索词变化，不随状态筛选变化。当前快照：{{ snapshotScope }}。
          <template v-if="refreshing && scopeChanged"
            >正在读取目标范围：{{ requestedScope }}。</template
          >
        </p>

        <p v-if="message" class="platform-content__message" role="status">{{ message }}</p>

        <section class="platform-content__ledger">
          <header>
            <div>
              <p>FACT LEDGER</p>
              <h3>热点内容</h3>
              <span>搜索标题、分类、市场；按最近观测时间倒序。</span>
            </div>
            <PlatformManagementFilter
              v-model:query="query"
              v-model:status="status"
              domain="content"
              label="内容管理"
              :active-count="activeFilterCount"
              appearance="content"
              mode="dialog"
              @apply="emit('apply')"
              @reset="emit('reset')"
            />
          </header>

          <p class="platform-content__review-note">
            当前行状态的直接入口会禁用；审核表单仍允许选择原状态，并会如实记录版本与原因。
          </p>

          <PlatformManagementRecordList
            v-if="items.length"
            domain="content"
            appearance="content"
            :items="items"
            :busy="busy"
            :state-name="stateName"
            :when="when"
            @review="(item, nextStatus) => emit('review', item, nextStatus)"
          />

          <section v-else class="platform-content__empty">
            <span aria-hidden="true">0</span>
            <div>
              <h4>当前筛选没有内容记录</h4>
              <p>查询统计仍来自当前搜索范围；可以调整状态或清除筛选后重新查看。</p>
            </div>
            <button type="button" :disabled="!activeFilterCount" @click="emit('reset')">
              清除筛选
            </button>
          </section>

          <PlatformContentPagination
            v-if="data.pagination"
            :pagination="data.pagination"
            :refreshing="refreshing"
            @change="emit('changePage', $event)"
          />
        </section>

        <footer class="platform-content__footer">
          <span>读取时间：{{ when(data.observed_at) }}</span>
          <details v-if="requestId">
            <summary>本次读取追踪</summary>
            <span>关联编号 {{ requestId }}</span>
          </details>
        </footer>
      </template>
    </div>
  </section>
</template>

<style src="../platform-content.css"></style>
