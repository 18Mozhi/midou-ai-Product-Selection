<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, createApiResponseClient } from "../api-client";
import { useAuditedReason } from "../use-audited-reason";
const AuditedReasonDialog = defineAsyncComponent(() => import("./AuditedReasonDialog.vue"));
const DataQualityCenter = defineAsyncComponent(() => import("./DataQualityCenter.vue"));
const ResponsiveDataView = defineAsyncComponent(() => import("./ResponsiveDataView.vue"));
const ResponsiveFilterDrawer = defineAsyncComponent(() => import("./ResponsiveFilterDrawer.vue"));
const TechnicalDetails = defineAsyncComponent(() => import("./TechnicalDetails.vue"));

type Entity = "trends" | "opportunities" | "competitors" | "suppliers";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
interface RecordScope {
  entity: Entity;
  query: string;
  status: string;
  page: number;
}
type ExportSettlement =
  | { kind: "success"; requestId: string }
  | { kind: "failure"; message: string; requestId: string; unknown: boolean };
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
  qualityVisited = ref(tab.value === "quality"),
  entity = ref<Entity>(initialEntity),
  query = ref(queryValue("q").trim()),
  queryDraft = ref(query.value),
  status = ref(initialStatus),
  statusDraft = ref(initialStatus),
  page = ref(/^\d{1,3}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1),
  state = ref<State>("loading"),
  data = ref<any>({ summary: {}, items: [] }),
  snapshotScope = ref<{ entity: Entity; query: string; status: string } | null>(null),
  message = ref(""),
  requestId = ref(""),
  exporting = ref(false),
  exportUnknown = ref(false),
  refreshing = ref(false);
let activeController: AbortController | null = null;
let readSequence = 0,
  pageActive = true,
  resumeRead = false,
  detachedExport: ExportSettlement | null = null;
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
const current = computed(() =>
  entities.find((item) => item.value === (snapshotScope.value?.entity ?? entity.value))!,
);
const operationLocked = computed(
  () => refreshing.value || exporting.value || exportReasonOpen.value,
);
const scopeMismatch = computed(() =>
  Boolean(
    snapshotScope.value &&
    (snapshotScope.value.entity !== entity.value ||
      snapshotScope.value.query !== query.value ||
      snapshotScope.value.status !== status.value),
  ),
);
const snapshotLabel = computed(() =>
  snapshotScope.value
    ? `${current.value.label} · 搜索：${snapshotScope.value.query || "不限"} · 状态：${snapshotScope.value.status ? statusName(snapshotScope.value.status, snapshotScope.value.entity) : "全部"}`
    : "",
);
const summary = computed(() => Object.entries(data.value?.summary ?? {}));
const statusOptions = computed(() => entityStatuses[entity.value]);
const activeFilterCount = computed(
  () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
);
const statusName = (value: unknown, owner: Entity = entity.value) =>
  statusLabels[owner][String(value)] ?? "状态未知";
const summaryName = (key: string) =>
  key === "total" ? "当前筛选" : statusName(key, current.value.value);
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
function readScope(): RecordScope {
  return {
    entity: entity.value,
    query: query.value,
    status: status.value,
    page: page.value,
  };
}
function routeScope(): RecordScope {
  const routeEntity = (
      ["trends", "opportunities", "competitors", "suppliers"] as Entity[]
    ).includes(queryValue("entity") as Entity)
      ? (queryValue("entity") as Entity)
      : "trends",
    routeStatus = entityStatuses[routeEntity].includes(queryValue("status"))
      ? queryValue("status")
      : "";
  return {
    entity: routeEntity,
    query: queryValue("q").trim(),
    status: routeStatus,
    page: /^\d{1,3}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1,
  };
}
function applyRouteScope() {
  const next = routeScope(),
    changed =
      next.entity !== entity.value ||
      next.query !== query.value ||
      next.status !== status.value ||
      next.page !== page.value;
  if (!changed) return false;
  entity.value = next.entity;
  query.value = next.query;
  queryDraft.value = next.query;
  status.value = next.status;
  statusDraft.value = next.status;
  page.value = next.page;
  return true;
}
async function syncRecordsUrl(scope: RecordScope = readScope()) {
  const next: Record<string, string> = {};
  if (scope.entity !== "trends") next.entity = scope.entity;
  if (scope.query) next.q = scope.query;
  if (scope.status) next.status = scope.status;
  if (scope.page > 1) next.page = String(scope.page);
  await router.replace({ query: next });
}

async function load(options: { updateUrl?: boolean } = {}) {
  if (!pageActive) return;
  const sequence = ++readSequence;
  activeController?.abort("superseded");
  activeController = null;
  const hadData = Boolean(data.value?.items?.length);
  const scope = readScope();
  refreshing.value = true;
  if (!hadData) state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "data", entity: scope.entity });
  if (scope.query) params.set("query", scope.query);
  if (scope.status) params.set("status", scope.status);
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort("request_timeout"), 15_000);
  try {
    if (options.updateUrl !== false) await syncRecordsUrl(scope);
    if (sequence !== readSequence || !pageActive) return;
    const response = await request<any>(`/platform/management?${params}`, {
      signal: controller.signal,
    });
    if (sequence !== readSequence || !pageActive) return;
    requestId.value = response.request_id;
    data.value = response.data;
    snapshotScope.value = { entity: scope.entity, query: scope.query, status: scope.status };
    exportUnknown.value = false;
    const totalPages = Math.max(1, Math.ceil(response.data.items.length / pageSize));
    if (scope.page > totalPages) {
      page.value = totalPages;
      if (options.updateUrl !== false) await syncRecordsUrl({ ...scope, page: totalPages });
    }
    state.value = response.data.items.length ? "ready" : "empty";
  } catch (error) {
    if (sequence !== readSequence || !pageActive) return;
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    const timedOut = controller.signal.aborted && controller.signal.reason === "request_timeout";
    if (controller.signal.aborted && !timedOut) return;
    const hint = timedOut
      ? "读取超过 15 秒，已安全取消；上一份结果仍保留。"
      : (failure?.actionHint ?? "网络或服务异常，上一份结果仍保留。");
    message.value = hint;
    state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) activeController = null;
    if (sequence === readSequence) refreshing.value = false;
  }
}
function applyExportSettlement(settlement: ExportSettlement) {
  requestId.value = settlement.requestId;
  if (settlement.kind === "success") {
    exportUnknown.value = false;
    message.value = "受控表格文件已生成，导出原因和记录数已写入平台审计。";
    return;
  }
  exportUnknown.value = settlement.unknown;
  message.value = settlement.message;
}
async function exportCsv() {
  if (
    exporting.value ||
    exportReasonOpen.value ||
    refreshing.value ||
    scopeMismatch.value ||
    exportUnknown.value
  )
    return;
  const exportScope = snapshotScope.value
    ? { ...snapshotScope.value }
    : { entity: entity.value, query: query.value, status: status.value };
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
  let settlement: ExportSettlement;
  try {
    const response = await requestResponse("/platform/management/data/exports", {
      method: "POST",
      headers: { accept: "text/csv" },
      body: {
        entity: exportScope.entity,
        query: exportScope.query,
        status: exportScope.status,
        reason: reason.trim(),
      },
    });
    const responseRequestId = response.headers.get("x-request-id") ?? requestId.value;
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `platform-${exportScope.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    settlement = { kind: "success", requestId: responseRequestId };
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    settlement =
      failure && failure.status > 0
        ? {
            kind: "failure",
            message: failure.actionHint,
            requestId: failure.requestId,
            unknown: false,
          }
        : {
            kind: "failure",
            message:
              "导出结果未知。服务器可能已经生成文件或写入审计；请先核对导出记录，不要重复提交。",
            requestId: failure?.requestId ?? requestId.value,
            unknown: true,
          };
  } finally {
    exporting.value = false;
  }
  if (pageActive) applyExportSettlement(settlement);
  else detachedExport = settlement;
}
function selectEntity(value: Entity) {
  if (operationLocked.value || value === entity.value) return;
  entity.value = value;
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  void load();
}
function applyFilters() {
  if (operationLocked.value) return;
  query.value = queryDraft.value.trim();
  status.value = statusDraft.value;
  page.value = 1;
  void load();
}
function resetFilters() {
  if (operationLocked.value) return;
  query.value = "";
  queryDraft.value = "";
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  void load();
}
function goToPage(nextPage: number) {
  if (
    operationLocked.value ||
    nextPage < 1 ||
    nextPage > pagination.value.total_pages ||
    nextPage === page.value
  )
    return;
  page.value = nextPage;
  void syncRecordsUrl();
}
async function selectTab(value: "records" | "quality") {
  if (value === tab.value || exporting.value || exportReasonOpen.value) return;
  tab.value = value;
  if (value === "quality") {
    qualityVisited.value = true;
    await router.replace({ query: { view: "quality" } });
  } else {
    await syncRecordsUrl();
    if (!snapshotScope.value) void load({ updateUrl: false });
  }
}
onMounted(() => {
  if (tab.value === "records") void load();
});
watch(
  () => [
    route.path,
    route.query.view,
    route.query.entity,
    route.query.q,
    route.query.status,
    route.query.page,
    route.query.evidence,
    route.query.evidence_id,
    route.query.issue_id,
  ],
  ([path]) => {
    if (path !== "/platform-admin/data" || !pageActive) return;
    const nextTab =
      queryValue("view") === "quality" ||
      Boolean(queryValue("evidence") || queryValue("evidence_id") || queryValue("issue_id"))
        ? "quality"
        : "records";
    tab.value = nextTab;
    if (nextTab === "quality") {
      qualityVisited.value = true;
      return;
    }
    if (applyRouteScope()) void load({ updateUrl: false });
  },
);
function suspendRecords(reason: "deactivated" | "unmounted") {
  const interrupted = Boolean(activeController);
  pageActive = false;
  readSequence += 1;
  activeController?.abort(reason);
  activeController = null;
  refreshing.value = false;
  resumeRead ||= reason === "deactivated" && interrupted;
  if (exportReasonOpen.value) cancelExportReason();
}
onBeforeUnmount(() => suspendRecords("unmounted"));
onDeactivated(() => suspendRecords("deactivated"));
onActivated(() => {
  pageActive = true;
  if (route.path !== "/platform-admin/data") return;
  const routeChanged = tab.value === "records" && applyRouteScope();
  if (detachedExport) {
    applyExportSettlement(detachedExport);
    detachedExport = null;
  }
  if (tab.value === "records" && (routeChanged || resumeRead || !snapshotScope.value))
    void load({ updateUrl: false });
  resumeRead = false;
});
</script>

<template>
  <section class="platform-data" aria-labelledby="platform-data-title">
    <header class="platform-data-hero">
      <div>
        <p>平台管理 / 数据中心</p>
        <h2 id="platform-data-title">数据中心</h2>
        <span>业务记录与证据核验分域连续工作，数据范围和处置动作始终分开。</span>
      </div>
      <nav aria-label="平台数据视图">
        <button
          :aria-current="tab === 'records' ? 'page' : undefined"
          :disabled="exporting || exportReasonOpen"
          @click="selectTab('records')"
        >
          近期记录
        </button>
        <button
          :aria-current="tab === 'quality' ? 'page' : undefined"
          :disabled="exporting || exportReasonOpen"
          @click="selectTab('quality')"
        >
          证据与质量
        </button>
      </nav>
    </header>

    <div v-show="tab === 'records'" class="platform-data-layout">
      <aside class="platform-data-rail">
        <p>选择数据类型</p>
        <nav class="platform-data-entities" aria-label="数据类型">
          <button
            v-for="item in entities"
            :key="item.value"
            :aria-current="entity === item.value ? 'page' : undefined"
            :disabled="operationLocked"
            @click="selectEntity(item.value)"
          >
            {{ item.label }}
          </button>
        </nav>
        <span>按筛选读取最近 100 条。这里的数量不是全平台历史总量。</span>
      </aside>

      <div class="platform-data-workspace">
        <header class="platform-data-workspace-header">
          <div>
            <p>数据中心 / 近期记录</p>
            <h3>{{ current.label }}近期记录</h3>
            <span>确认已应用范围，再查看事实、分页或发起受控导出。</span>
          </div>
          <button
            type="button"
            class="platform-data-export platform-data-export--desktop"
            :disabled="exporting || refreshing || scopeMismatch || exportUnknown"
            :aria-describedby="
              scopeMismatch
                ? 'data-snapshot-scope'
                : exportUnknown
                  ? 'data-export-unknown'
                  : undefined
            "
            @click="exportCsv"
          >
            {{ exporting ? "正在导出…" : "导出表格文件" }}
          </button>
        </header>

        <ResponsiveFilterDrawer label="筛选近期数据" :active-count="activeFilterCount">
          <form class="platform-data-filter" @submit.prevent="applyFilters">
            <label
              >搜索名称、组织或工作区
              <input
                v-model="queryDraft"
                placeholder="搜索名称、组织或工作区"
                maxlength="120"
                :disabled="operationLocked"
                @keydown.enter.prevent="applyFilters"
            /></label>
            <label
              >记录状态
              <select v-model="statusDraft" aria-label="记录状态" :disabled="operationLocked">
                <option value="">全部状态</option>
                <option v-for="value in statusOptions" :key="value" :value="value">
                  {{ statusName(value) }}
                </option>
              </select></label
            >
            <button :disabled="operationLocked">{{ refreshing ? "正在筛选…" : "筛选" }}</button>
            <button
              type="button"
              :disabled="operationLocked || (!queryDraft && !statusDraft)"
              @click="resetFilters"
            >
              重置
            </button>
            <button
              type="button"
              class="platform-data-export platform-data-export--mobile"
              :disabled="exporting || refreshing || scopeMismatch || exportUnknown"
              :aria-describedby="
                scopeMismatch
                  ? 'data-snapshot-scope'
                  : exportUnknown
                    ? 'data-export-unknown'
                    : undefined
              "
              @click="exportCsv"
            >
              {{ exporting ? "正在导出…" : "导出表格文件" }}
            </button>
          </form>
        </ResponsiveFilterDrawer>

        <div class="platform-data-feedback" aria-live="polite">
          <p v-show="message" class="platform-data-notice" role="status">{{ message }}</p>
          <p
            v-show="scopeMismatch"
            id="data-snapshot-scope"
            class="platform-data-notice"
            role="status"
          >
            新范围尚未读取成功，仍显示：{{ snapshotLabel }}。重新筛选成功后可导出新范围。
          </p>
          <p
            v-show="exportUnknown"
            id="data-export-unknown"
            class="platform-data-notice platform-data-notice--warning"
          >
            当前快照的导出按钮已暂时停用；读取新范围成功后再发起新的导出。
          </p>
        </div>

        <section
          v-if="state !== 'ready'"
          class="platform-data-state"
          :aria-busy="state === 'loading'"
        >
          <small>{{ current.label }} · 近期记录</small>
          <h3>
            {{
              state === "loading"
                ? "正在读取记录"
                : state === "empty"
                  ? "当前筛选没有记录"
                  : "近期记录暂不可用"
            }}
          </h3>
          <p>
            {{
              state === "empty"
                ? "调整搜索词或状态后可重新筛选。"
                : message || "请保留当前页面，稍后重新加载。"
            }}
          </p>
          <button v-if="state !== 'loading'" :disabled="refreshing" @click="load()">
            重新加载
          </button>
        </section>

        <template v-else>
          <section class="platform-data-summary" aria-label="当前返回集摘要">
            <header>
              <strong>当前快照：{{ snapshotLabel }}</strong>
              <span>本次返回集，不代表全平台历史总量</span>
            </header>
            <div>
              <article v-for="[key, value] in summary" :key="key">
                <small>{{ summaryName(String(key)) }}</small
                ><strong>{{ value }}</strong>
              </article>
            </div>
          </section>

          <section class="platform-data-table" aria-labelledby="platform-data-records-title">
            <header>
              <div>
                <h4 id="platform-data-records-title">{{ current.label }}记录清单</h4>
                <span>当前页 {{ rangeLabel }}；服务端最多返回最近 100 条。</span>
              </div>
            </header>
            <ResponsiveDataView
              :rows="pagedItems"
              :row-key="(item) => item.id"
              :title="`${current.label}记录`"
              :detail-title="(item) => item.title"
            >
              <template #desktop="{ show }">
                <table>
                  <thead>
                    <tr>
                      <th>{{ current.label }}</th>
                      <th>组织 / 工作区</th>
                      <th>{{ current.value === "suppliers" ? "供应商 / 地点" : "分类 / 市场" }}</th>
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
                        <button
                          type="button"
                          class="platform-data-row-action"
                          @click="show(item, $event)"
                        >
                          查看记录
                        </button>
                      </td>
                      <td>
                        {{ item.organization_name }}<small>{{ item.workspace_name }}</small>
                      </td>
                      <td>
                        {{ item.category || "—" }}<small>{{ item.market || "—" }}</small>
                      </td>
                      <td>
                        <b :data-state="item.status">{{
                          statusName(item.status, current.value)
                        }}</b>
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
                  <strong>{{ row.title }} · {{ statusName(row.status, current.value) }}</strong>
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
                    <dt>{{ current.value === "suppliers" ? "供应商 / 地点" : "分类 / 市场" }}</dt>
                    <dd>{{ row.category || "—" }} / {{ row.market || "—" }}</dd>
                  </div>
                  <div>
                    <dt>当前状态</dt>
                    <dd>{{ statusName(row.status, current.value) }}</dd>
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
            <footer class="platform-data-pagination">
              <button
                type="button"
                :disabled="operationLocked || pagination.page <= 1"
                @click="goToPage(pagination.page - 1)"
              >
                上一页
              </button>
              <span
                >{{ rangeLabel }} · 第 {{ pagination.page }} / {{ pagination.total_pages }} 页</span
              >
              <button
                type="button"
                :disabled="operationLocked || pagination.page >= pagination.total_pages"
                @click="goToPage(pagination.page + 1)"
              >
                下一页
              </button>
            </footer>
          </section>
          <footer class="platform-data-footer">
            <TechnicalDetails :request-id="requestId" />
          </footer>
        </template>
      </div>
    </div>

    <div v-if="qualityVisited" v-show="tab === 'quality'" class="platform-data-quality-pane">
      <DataQualityCenter :api-base-url="apiBaseUrl" :active="tab === 'quality'" />
    </div>
    <AuditedReasonDialog
      :open="exportReasonOpen"
      :title="exportReasonRequest?.title || '填写导出原因'"
      :description="exportReasonRequest?.description || ''"
      :initial-value="exportReasonRequest?.initialValue"
      :minimum-length="exportReasonRequest?.minimumLength"
      :maximum-length="300"
      @submit="submitExportReason"
      @cancel="cancelExportReason"
    />
  </section>
</template>

<style scoped>
@import "../design/platform-data-tokens.css";

.platform-data {
  --so-primary: var(--so-data-primary);
  --so-primary-strong: var(--so-data-primary);
  --so-primary-soft: var(--so-data-primary-soft);
  --so-on-primary: var(--so-data-surface);
  --so-bg: var(--so-data-canvas);
  --so-bg-elevated: var(--so-data-surface);
  --so-panel: var(--so-data-surface);
  --so-panel-soft: var(--so-data-surface-soft);
  --so-text: var(--so-data-text);
  --so-text-muted: var(--so-data-text-muted);
  --so-border: var(--so-data-border);
  --so-border-strong: var(--so-data-field-border);
  --so-info-soft: var(--so-data-info-soft);
  --so-info-border: var(--so-data-info-border);
  --so-shadow-color: var(--so-data-shadow);
  --so-focus: var(--so-data-focus);
  display: grid;
  gap: 18px;
  min-width: 0;
  color: var(--so-text);
}
.platform-data-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 26px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
}
.platform-data-hero p {
  margin: 0;
  color: var(--so-text-muted);
  font-size: 13px;
  font-weight: 700;
}
.platform-data-hero h2 {
  margin: 6px 0 5px;
  color: var(--so-text);
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: clamp(26px, 3vw, 34px);
  line-height: 1.25;
}
.platform-data-hero span {
  color: var(--so-text-muted);
  font-size: 14px;
}
.platform-data-hero nav {
  display: flex;
  gap: 8px;
}
.platform-data button,
.platform-data input,
.platform-data select {
  min-height: 44px;
  padding: 9px 14px;
  border: 1px solid var(--so-border);
  border-radius: 7px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
  font-size: 15px;
}
.platform-data button {
  cursor: pointer;
}
.platform-data button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}
.platform-data :is(button, input, select, summary):focus-visible {
  outline: 3px solid var(--so-focus, var(--so-data-focus-fallback));
  outline-offset: 2px;
}
.platform-data-hero button[aria-current="page"],
.platform-data-filter button:first-of-type,
.platform-data-export {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
  border-color: var(--so-primary-strong);
  font-weight: 750;
}
.platform-data-layout {
  display: grid;
  grid-template-columns: minmax(210px, 240px) minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-bg);
}
.platform-data-rail {
  display: flex;
  min-height: 690px;
  flex-direction: column;
  padding: 26px 22px;
  color: var(--so-data-on-rail);
  background: var(--so-data-primary);
}
.platform-data-rail > p {
  margin: 0 0 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--so-data-rail-divider);
  font-size: 13px;
  font-weight: 700;
}
.platform-data-entities {
  display: grid;
  gap: 8px;
}
.platform-data-entities button {
  width: 100%;
  justify-content: flex-start;
  border-color: transparent;
  background: transparent;
  color: var(--so-data-on-rail);
  text-align: left;
  font-weight: 700;
}
.platform-data-entities button[aria-current="page"] {
  border-color: var(--so-data-on-rail);
  background: var(--so-data-on-rail);
  color: var(--so-data-rail-selected-text);
}
.platform-data-rail > span {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--so-data-rail-footer-border);
  color: var(--so-data-rail-muted);
  font-size: 13px;
  line-height: 1.7;
}
.platform-data-workspace {
  display: grid;
  align-content: start;
  gap: 18px;
  min-width: 0;
  padding: 28px;
}
.platform-data-workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.platform-data-workspace-header p,
.platform-data-workspace-header h3,
.platform-data-workspace-header span {
  margin: 0;
}
.platform-data-workspace-header p {
  color: var(--so-primary);
  font-size: 13px;
  font-weight: 750;
}
.platform-data-workspace-header h3 {
  margin-top: 6px;
  color: var(--so-text);
  font-size: 27px;
  line-height: 1.3;
}
.platform-data-workspace-header span {
  display: block;
  margin-top: 6px;
  color: var(--so-text-muted);
  font-size: 14px;
}
.platform-data-export {
  flex: 0 0 auto;
}
.platform-data-export--mobile {
  display: none;
}
.platform-data-filter {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(150px, 210px) auto auto;
  align-items: end;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
}
.platform-data-filter label {
  display: grid;
  gap: 7px;
  color: var(--so-text);
  font-size: 13px;
  font-weight: 750;
}
.platform-data-feedback:empty {
  display: none;
}
.platform-data-notice {
  margin: 0;
  padding: 13px 16px;
  border-left: 3px solid var(--so-primary);
  background: var(--so-info-soft);
  color: var(--so-text);
  font-size: 14px;
  line-height: 1.6;
}
.platform-data-notice + .platform-data-notice {
  margin-top: 8px;
}
.platform-data-notice--warning {
  border-left-color: var(--so-warning);
}
.platform-data-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 30px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
}
.platform-data-state :is(small, h3, p) {
  margin: 0;
}
.platform-data-state small,
.platform-data-state p {
  color: var(--so-text-muted);
}
.platform-data-state h3 {
  font-size: 22px;
}
.platform-data-summary {
  border: 1px solid var(--so-data-feedback-border);
  background: var(--so-data-primary-soft);
}
.platform-data-summary > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 0;
  color: var(--so-data-feedback-title);
  font-size: 13px;
}
.platform-data-summary > header span {
  color: var(--so-data-feedback-text);
}
.platform-data-summary > div {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0;
  padding: 10px 18px 16px;
}
.platform-data-summary article {
  padding: 8px 18px 8px 0;
}
.platform-data-summary small,
.platform-data-summary strong,
.platform-data-table td small {
  display: block;
}
.platform-data-summary small,
.platform-data-table td small {
  color: var(--so-data-feedback-text);
}
.platform-data-summary strong {
  margin-top: 4px;
  color: var(--so-data-feedback-strong);
  font-size: 26px;
}
.platform-data-table {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
}
.platform-data-table > header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.platform-data-table h4 {
  margin: 0;
  color: var(--so-text);
  font-size: 20px;
}
.platform-data-table header span {
  display: block;
  margin-top: 4px;
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-data-table :deep(.responsive-data-view__desktop) {
  overflow: auto;
}
.platform-data table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
}
.platform-data th,
.platform-data td {
  padding: 13px 10px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  font-size: 13px;
  vertical-align: top;
}
.platform-data th {
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  font-weight: 750;
}
.platform-data td small {
  margin-top: 4px;
}
.platform-data-row-action {
  display: block;
  min-height: 36px !important;
  margin-top: 8px;
  padding: 6px 9px !important;
  color: var(--so-primary) !important;
  background: transparent !important;
  font-size: 13px !important;
}
.platform-data-footer {
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-data-pagination {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  text-align: center;
}
.platform-data-pagination span {
  color: var(--so-text-muted);
  font-size: 13px;
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
.platform-data-quality-pane {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-bg);
}
:global([data-theme="deep-ocean"] .platform-data-quality-pane) {
  --so-panel: var(--so-data-surface);
}
:global([data-theme="aurora-purple"] .platform-data-quality-pane) {
  --so-panel: var(--so-data-quality-aurora-panel);
}
:global([data-theme="cloud-white"] .platform-data-quality-pane) {
  --so-panel: var(--so-data-quality-cloud-panel);
}
@media (hover: hover) {
  .platform-data button:not(:disabled):hover {
    border-color: var(--so-primary);
  }
  .platform-data-entities button:not(:disabled):hover {
    border-color: var(--so-data-rail-hover-border);
    background: var(--so-data-rail-hover-surface);
  }
  .platform-data-entities button[aria-current="page"]:hover {
    background: var(--so-data-on-rail);
  }
}
@media (max-width: 760px) {
  .platform-data {
    gap: 12px;
  }
  .platform-data-hero {
    align-items: stretch;
    flex-direction: column;
    padding: 18px 16px;
  }
  .platform-data-hero nav {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .platform-data-hero nav button {
    width: 100%;
  }
  .platform-data-layout {
    display: block;
    border-radius: 10px;
  }
  .platform-data-rail {
    min-height: 0;
    padding: 16px;
  }
  .platform-data-entities {
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .platform-data-entities button {
    justify-content: center;
    padding-inline: 6px;
    text-align: center;
  }
  .platform-data-rail > span {
    margin-top: 12px;
    padding-top: 12px;
  }
  .platform-data-workspace {
    gap: 16px;
    padding: 18px 16px 22px;
  }
  .platform-data-workspace-header {
    display: block;
  }
  .platform-data-workspace-header h3 {
    font-size: 24px;
  }
  .platform-data-export--desktop {
    display: none;
  }
  .platform-data-export--mobile {
    display: block;
  }
  .platform-data-filter {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .platform-data-filter :is(input, select, button) {
    width: 100%;
  }
  .platform-data-summary > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .platform-data-summary > div {
    grid-template-columns: 1fr 1fr;
  }
  .platform-data-table {
    padding: 16px;
  }
  .platform-data-table :deep(.responsive-data-view__mobile) {
    margin-top: 4px;
  }
  .platform-data-pagination {
    grid-template-columns: 1fr 1fr;
  }
  .platform-data-pagination span {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .platform-data-quality-pane {
    padding: 16px;
    border-radius: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .platform-data * {
    scroll-behavior: auto !important;
  }
}
</style>
