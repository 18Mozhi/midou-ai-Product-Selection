<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, createApiResponseClient } from "../api-client";
import { useAuditedReason } from "../use-audited-reason";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import DataQualityCenter from "./DataQualityCenter.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";

type Entity = "trends" | "opportunities" | "competitors" | "suppliers";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
const entityStatuses: Record<Entity, string[]> = {
  trends: ["active", "irrelevant", "stale", "archived"],
  opportunities: ["pending", "adopted", "observing", "rejected"],
  competitors: ["active", "paused"],
  suppliers: ["incomplete", "ready", "quarantined"],
};
const statusLabels: Record<Entity, Record<string, string>> = {
  trends: { active: "展示中", irrelevant: "无关", stale: "已过期", archived: "已归档" },
  opportunities: {
    pending: "待决策",
    adopted: "已采纳",
    observing: "观察中",
    rejected: "已拒绝",
  },
  competitors: { active: "监控中", paused: "已暂停" },
  suppliers: { incomplete: "信息不完整", ready: "可评估", quarantined: "已隔离" },
};
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  requestResponse = createApiResponseClient(props.apiBaseUrl),
  route = useRoute(),
  router = useRouter(),
  queryValue = (name: string) => {
    const value = route.query[name];
    return typeof value === "string" ? value : "";
  },
  initialEntity = (["trends", "opportunities", "competitors", "suppliers"] as Entity[]).includes(
    queryValue("entity") as Entity,
  )
    ? (queryValue("entity") as Entity)
    : "trends",
  hasQualityDeepLink = Boolean(
    queryValue("evidence") || queryValue("evidence_id") || queryValue("issue_id"),
  ),
  initialStatus = entityStatuses[initialEntity].includes(queryValue("status"))
    ? queryValue("status")
    : "",
  pageSize = 20,
  tab = ref<"records" | "quality">(
    queryValue("view") === "quality" || hasQualityDeepLink ? "quality" : "records",
  ),
  entity = ref<Entity>(initialEntity),
  query = ref(queryValue("q").trim()),
  queryDraft = ref(query.value),
  status = ref(initialStatus),
  statusDraft = ref(initialStatus),
  page = ref(/^\d{1,3}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1),
  state = ref<State>("loading"),
  data = ref<any>({ summary: {}, items: [] }),
  message = ref(""),
  requestId = ref(""),
  exporting = ref(false),
  refreshing = ref(false);
let activeController: AbortController | null = null;
const {
  request: exportReasonRequest,
  open: exportReasonOpen,
  ask: askExportReason,
  submit: submitExportReason,
  cancel: cancelExportReason,
} = useAuditedReason();
const entities: Array<{
  value: Entity;
  label: string;
  primary: string;
  secondary: string;
}> = [
  { value: "trends", label: "热点", primary: "信号", secondary: "来源" },
  { value: "opportunities", label: "机会", primary: "证据", secondary: "来源" },
  { value: "competitors", label: "竞品", primary: "版本", secondary: "变更" },
  {
    value: "suppliers",
    label: "供应商",
    primary: "最小起订量",
    secondary: "报价",
  },
];
const current = computed(() => entities.find((item) => item.value === entity.value)!);
const summary = computed(() => Object.entries(data.value?.summary ?? {}));
const statusOptions = computed(() => entityStatuses[entity.value]);
const activeFilterCount = computed(
  () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
);
const statusName = (value: unknown) => statusLabels[entity.value][String(value)] ?? "状态未知";
const summaryName = (key: string) => (key === "total" ? "当前筛选" : statusName(key));
const pagination = computed<Pagination>(() => {
    const total = data.value?.items?.length ?? 0,
      totalPages = total ? Math.ceil(total / pageSize) : 0;
    return {
      page: totalPages ? Math.min(page.value, totalPages) : 1,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    };
  }),
  pagedItems = computed(() => {
    const start = (pagination.value.page - 1) * pageSize;
    return (data.value?.items ?? []).slice(start, start + pageSize);
  }),
  rangeLabel = computed(() => {
    if (!pagination.value.total) return "0 条";
    const start = (pagination.value.page - 1) * pageSize + 1,
      end = Math.min(pagination.value.page * pageSize, pagination.value.total);
    return `${start}–${end} / ${pagination.value.total} 条`;
  });

function failureState(error: ApiClientError): State {
  return error.kind === "expired" || error.kind === "forbidden"
    ? error.kind
    : error.kind === "blocked" || error.kind === "rate_limited"
      ? "blocked"
      : "error";
}
async function syncRecordsUrl() {
  const next: Record<string, string> = {};
  if (entity.value !== "trends") next.entity = entity.value;
  if (query.value) next.q = query.value;
  if (status.value) next.status = status.value;
  if (page.value > 1) next.page = String(page.value);
  await router.replace({ query: next });
}

async function load(options: { updateUrl?: boolean } = {}) {
  if (refreshing.value) return;
  const hadData = Boolean(data.value?.items?.length);
  refreshing.value = true;
  if (!hadData) state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "data", entity: entity.value });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    if (options.updateUrl !== false) await syncRecordsUrl();
    const response = await request<any>(`/platform/management?${params}`, {
      signal: controller.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    const totalPages = Math.max(1, Math.ceil(response.data.items.length / pageSize));
    if (page.value > totalPages) {
      page.value = totalPages;
      if (options.updateUrl !== false) await syncRecordsUrl();
    }
    state.value = response.data.items.length ? "ready" : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    const hint = controller.signal.aborted
      ? "读取超过 15 秒，已安全取消；上一份结果仍保留。"
      : (failure?.actionHint ?? "网络或服务异常，上一份结果仍保留。");
    message.value = hint;
    state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) activeController = null;
    refreshing.value = false;
  }
}
async function exportCsv() {
  if (exporting.value || exportReasonOpen.value) return;
  const reason = await askExportReason({
    title: "填写受控导出原因",
    description: "导出原因会与筛选范围、操作者和文件审计记录一起保存。",
    initialValue: "平台运营数据核对",
  });
  if (reason === null) return;
  if (reason.trim().length < 2) {
    message.value = "导出原因至少需要 2 个字。";
    return;
  }
  exporting.value = true;
  try {
    const response = await requestResponse("/platform/management/data/exports", {
      method: "POST",
      headers: { accept: "text/csv" },
      body: {
        entity: entity.value,
        query: query.value.trim(),
        status: status.value,
        reason: reason.trim(),
      },
    });
    requestId.value = response.headers.get("x-request-id") ?? requestId.value;
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `platform-${entity.value}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.value = "受控表格文件已生成，导出原因和记录数已写入平台审计。";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = failure?.actionHint ?? "受控导出未完成";
  } finally {
    exporting.value = false;
  }
}
function selectEntity(value: Entity) {
  if (refreshing.value || value === entity.value) return;
  entity.value = value;
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  void load();
}
function applyFilters() {
  if (refreshing.value) return;
  query.value = queryDraft.value.trim();
  status.value = statusDraft.value;
  page.value = 1;
  void load();
}
function resetFilters() {
  if (refreshing.value) return;
  query.value = "";
  queryDraft.value = "";
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  void load();
}
function goToPage(nextPage: number) {
  if (
    refreshing.value ||
    nextPage < 1 ||
    nextPage > pagination.value.total_pages ||
    nextPage === page.value
  )
    return;
  page.value = nextPage;
  void syncRecordsUrl();
}
async function selectTab(value: "records" | "quality") {
  if (value === tab.value) return;
  tab.value = value;
  if (value === "quality") await router.replace({ query: { view: "quality" } });
  else {
    await syncRecordsUrl();
    if (!data.value.items.length) void load({ updateUrl: false });
  }
}
onMounted(() => {
  if (tab.value === "records") void load();
});
onBeforeUnmount(() => activeController?.abort());
</script>

<template>
  <section class="platform-data">
    <header class="platform-data-hero">
      <div>
        <p>平台近期数据中心</p>
        <h2>跨组织业务数据</h2>
        <span
          >按当前筛选查看最近 100
          条热点、机会、竞品与供应商事实；受控导出会记录操作人、原因和范围。</span
        >
      </div>
      <nav aria-label="平台数据视图">
        <button
          :aria-current="tab === 'records' ? 'page' : undefined"
          @click="selectTab('records')"
        >
          近期记录
        </button>
        <button
          :aria-current="tab === 'quality' ? 'page' : undefined"
          @click="selectTab('quality')"
        >
          证据与质量
        </button>
      </nav>
    </header>

    <DataQualityCenter v-if="tab === 'quality'" :api-base-url="apiBaseUrl" />
    <template v-else>
      <nav class="platform-data-entities" aria-label="数据类型">
        <button
          v-for="item in entities"
          :key="item.value"
          :aria-current="entity === item.value ? 'page' : undefined"
          @click="selectEntity(item.value)"
        >
          {{ item.label }}
        </button>
      </nav>
      <ResponsiveFilterDrawer label="筛选近期数据" :active-count="activeFilterCount">
        <form class="platform-data-filter" @submit.prevent="applyFilters">
          <label
            >搜索
            <input
              v-model="queryDraft"
              placeholder="搜索名称、组织或工作区"
              maxlength="120"
              @keydown.enter.prevent="applyFilters"
          /></label>
          <label
            >记录状态
            <select v-model="statusDraft" aria-label="记录状态">
              <option value="">全部状态</option>
              <option v-for="value in statusOptions" :key="value" :value="value">
                {{ statusName(value) }}
              </option>
            </select></label
          >
          <button :disabled="refreshing">{{ refreshing ? "正在筛选…" : "筛选" }}</button>
          <button
            type="button"
            :disabled="refreshing || (!queryDraft && !statusDraft)"
            @click="resetFilters"
          >
            重置
          </button>
          <button type="button" :disabled="exporting || refreshing" @click="exportCsv">
            {{ exporting ? "正在导出…" : "导出表格文件" }}
          </button>
        </form>
      </ResponsiveFilterDrawer>
      <p v-if="message" class="platform-data-notice" role="status">{{ message }}</p>
      <section v-if="state !== 'ready'" class="platform-data-state">
        <h3>
          {{
            state === "loading"
              ? "正在读取全量数据"
              : state === "empty"
                ? "当前筛选没有记录"
                : "全量数据暂不可用"
          }}
        </h3>
        <p v-if="message">{{ message }}</p>
        <button v-if="state !== 'loading'" :disabled="refreshing" @click="load()">重新加载</button>
      </section>
      <template v-else>
        <div class="platform-data-summary">
          <article v-for="[key, value] in summary" :key="key">
            <small>{{ summaryName(String(key)) }}</small
            ><strong>{{ value }}</strong>
          </article>
        </div>
        <div class="platform-data-table">
          <ResponsiveDataView
            :rows="pagedItems"
            :row-key="(item) => item.id"
            :title="`${current.label}记录`"
            :detail-title="(item) => item.title"
          >
            <template #desktop>
              <table>
                <thead>
                  <tr>
                    <th>{{ current.label }}</th>
                    <th>组织 / 工作区</th>
                    <th>分类 / 市场</th>
                    <th>状态</th>
                    <th>{{ current.primary }} / {{ current.secondary }}</th>
                    <th>更新时间</th>
                    <th>技术信息</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pagedItems" :key="item.id">
                    <td>
                      <strong>{{ item.title }}</strong>
                    </td>
                    <td>
                      {{ item.organization_name }}<small>{{ item.workspace_name }}</small>
                    </td>
                    <td>
                      {{ item.category || "—" }}<small>{{ item.market || "—" }}</small>
                    </td>
                    <td>
                      <b :data-state="item.status">{{ statusName(item.status) }}</b>
                    </td>
                    <td>{{ item.metric_primary }} / {{ item.metric_secondary }}</td>
                    <td>{{ new Date(item.updated_at).toLocaleString("zh-CN") }}</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <code>{{ item.id }}</code>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row }">
              <span class="responsive-record-summary">
                <strong>{{ row.title }} · {{ statusName(row.status) }}</strong>
                <small>{{ row.organization_name }} · {{ row.workspace_name }}</small>
              </span>
            </template>
            <template #detail="{ row }">
              <dl>
                <div>
                  <dt>所属组织</dt>
                  <dd>{{ row.organization_name }}</dd>
                </div>
                <div>
                  <dt>工作区</dt>
                  <dd>{{ row.workspace_name }}</dd>
                </div>
                <div>
                  <dt>分类 / 市场</dt>
                  <dd>{{ row.category || "—" }} / {{ row.market || "—" }}</dd>
                </div>
                <div>
                  <dt>当前状态</dt>
                  <dd>{{ statusName(row.status) }}</dd>
                </div>
                <div>
                  <dt>{{ current.primary }} / {{ current.secondary }}</dt>
                  <dd>{{ row.metric_primary }} / {{ row.metric_secondary }}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{{ new Date(row.updated_at).toLocaleString("zh-CN") }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <code>{{ row.id }}</code>
              </details>
            </template>
          </ResponsiveDataView>
        </div>
        <footer class="platform-data-footer">
          <span>当前筛选最近 100 条范围内 · {{ rangeLabel }}</span>
          <nav v-if="pagination.total_pages > 1" aria-label="业务数据分页">
            <button
              type="button"
              :disabled="refreshing || pagination.page <= 1"
              @click="goToPage(pagination.page - 1)"
            >
              上一页
            </button>
            <span>第 {{ pagination.page }} / {{ pagination.total_pages }} 页</span>
            <button
              type="button"
              :disabled="refreshing || pagination.page >= pagination.total_pages"
              @click="goToPage(pagination.page + 1)"
            >
              下一页
            </button>
          </nav>
          <details v-if="requestId">
            <summary>技术详情</summary>
            <span>请求 ID {{ requestId }}</span>
          </details>
        </footer>
      </template>
    </template>
    <AuditedReasonDialog
      :open="exportReasonOpen"
      :title="exportReasonRequest?.title || '填写导出原因'"
      :description="exportReasonRequest?.description || ''"
      :initial-value="exportReasonRequest?.initialValue"
      :minimum-length="exportReasonRequest?.minimumLength"
      @submit="submitExportReason"
      @cancel="cancelExportReason"
    />
  </section>
</template>

<style scoped>
.platform-data {
  display: grid;
  gap: 16px;
  color: var(--so-text);
}
.platform-data-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-panel);
}
.platform-data-hero p {
  margin: 0;
  color: var(--so-primary);
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.16em;
}
.platform-data-hero h2 {
  margin: 6px 0;
}
.platform-data-hero span,
.platform-data-footer {
  color: var(--so-text-muted);
}
.platform-data nav,
.platform-data-filter {
  display: flex;
  gap: 8px;
}
.platform-data button,
.platform-data input,
.platform-data select {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
}
.platform-data button[aria-current="page"],
.platform-data-filter button:first-of-type {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.platform-data-filter label {
  display: grid;
  flex: 1;
  gap: 5px;
  color: var(--so-text-muted);
  font-size: 12px;
  font-weight: 750;
}
.platform-data-filter label:first-child {
  min-width: min(360px, 100%);
}
.platform-data-filter input {
  flex: 1;
}
.platform-data-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}
.platform-data-summary article,
.platform-data-table,
.platform-data-state,
.platform-data-notice {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.platform-data-summary small,
.platform-data-summary strong,
.platform-data-table td small {
  display: block;
}
.platform-data-summary small,
.platform-data-table td small {
  color: var(--so-text-muted);
}
.platform-data-summary strong {
  margin-top: 6px;
  font-size: 24px;
}
.platform-data-table {
  overflow: auto;
}
.platform-data table {
  width: 100%;
  border-collapse: collapse;
}
.platform-data th,
.platform-data td {
  padding: 11px 9px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  font-size: 13px;
}
.platform-data td small {
  margin-top: 4px;
}
.platform-data-state,
.platform-data-notice {
  text-align: center;
}
.platform-data-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.platform-data-footer nav {
  align-items: center;
}
.platform-data-table details summary,
.platform-data footer details summary {
  display: inline-flex;
  min-height: var(--so-touch-target);
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.platform-data-table code,
.platform-data footer span {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .platform-data-hero,
  .platform-data-filter {
    flex-direction: column;
  }
  .platform-data nav {
    flex-wrap: wrap;
  }
  .platform-data-filter input,
  .platform-data-filter select,
  .platform-data-filter button {
    width: 100%;
  }
  .platform-data-filter label:first-child {
    min-width: 0;
  }
  .platform-data-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .platform-data-footer nav {
    justify-content: space-between;
  }
}
</style>
