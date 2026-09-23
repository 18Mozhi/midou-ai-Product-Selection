<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import {
  readRealtimeClientMetrics,
  realtimeMetricsEvent,
  realtimeReconnectRateBasisPoints,
  type RealtimeClientMetrics,
} from "../realtime-client-metrics";
import { useAuditedReason } from "../use-audited-reason";
const AuditedReasonDialog = defineAsyncComponent(() => import("./AuditedReasonDialog.vue"));
const ApiCoverageDashboard = defineAsyncComponent(() => import("./ApiCoverageDashboard.vue"));
const PlatformContentCenter = defineAsyncComponent(() => import("./PlatformContentCenter.vue"));
const PlatformContentReviewDialog = defineAsyncComponent(
  () => import("./PlatformContentReviewDialog.vue"),
);
const PlatformMessageEditor = defineAsyncComponent(() => import("./PlatformMessageEditor.vue"));
const PlatformMessageWorkbench = defineAsyncComponent(
  () => import("./PlatformMessageWorkbench.vue"),
);
const PlatformManagementRecordList = defineAsyncComponent(
  () => import("./PlatformManagementRecordList.vue"),
);
const PlatformManagementFilter = defineAsyncComponent(
  () => import("./PlatformManagementFilter.vue"),
);
const PlatformNotificationCenter = defineAsyncComponent(
  () => import("./PlatformNotificationCenter.vue"),
);
const PlatformStatusCenterView = defineAsyncComponent(
  () => import("./PlatformStatusCenterView.vue"),
);
import type { PlatformNotificationForm } from "./platform-notification-types";
import {
  formatPlatformManagementTime as when,
  platformManagementStateName as stateName,
  platformManagementSummaryName as summaryName,
  platformManagementTitles as titles,
  type PlatformManagementDomain as Domain,
} from "./platform-management-presentation";
import {
  statusTopologyDefinitions,
  statusTopologyLaneMeta,
  type StatusService,
  type StatusServiceCode,
} from "./platform-status-topology";
import { usePlatformContentList } from "./use-platform-content-list";
import { usePlatformContentReview } from "./use-platform-content-review";
import { usePlatformStatus } from "./use-platform-status";

const props = defineProps<{ apiBaseUrl: string; domain: string }>();
const request = createApiClient(props.apiBaseUrl);
const domain = computed<Domain>(
  () =>
    (["content", "notifications", "email", "status", "api-coverage"].includes(props.domain)
      ? props.domain
      : "status") as Domain,
);
const apiDomain = computed(() => (domain.value === "api-coverage" ? "api_coverage" : domain.value));
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const data = ref<any>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  requestId = ref(""),
  busy = ref(""),
  refreshing = ref(false);
const {
  request: actionReasonRequest,
  open: actionReasonOpen,
  ask: askActionReason,
  submit: submitActionReason,
  cancel: cancelActionReason,
} = useAuditedReason();
const messageEditor = ref<any>(null),
  messageSaving = ref(false),
  messageForm = ref<PlatformNotificationForm>({
    kind: "notification" as "notification" | "email",
    title: "",
    body: "",
    category: "system",
    severity: "info",
    audience_type: "all_users",
    organization_id: "",
    user_id: "",
    in_app_enabled: true,
    email_enabled: false,
    reason: "编辑平台消息",
    expected_version: 1,
  });
const summaryEntries = computed(() => Object.entries(data.value?.summary ?? {}));
const statusServices = computed<StatusService[]>(() => data.value?.services ?? []);
const statusServiceByCode = computed(
  () => new Map(statusServices.value.map((service) => [service.code, service])),
);
const affectedServiceCodes = (code: StatusServiceCode) => {
  const affected = new Set<StatusServiceCode>();
  const pending = [code];
  while (pending.length) {
    const current = pending.shift();
    if (!current) continue;
    for (const candidate of statusTopologyDefinitions) {
      if (affected.has(candidate.code) || !candidate.dependencies.includes(current)) continue;
      affected.add(candidate.code);
      pending.push(candidate.code);
    }
  }
  return [...affected];
};
const statusTopologyNodes = computed(() =>
  statusTopologyDefinitions.map((definition) => {
    const service = statusServiceByCode.value.get(definition.code);
    return {
      ...definition,
      name: service?.name ?? definition.fallbackName,
      status: service?.status ?? "unknown",
      detail: service?.detail ?? "尚无运行观测",
      observedAt: service?.observed_at ?? null,
      href: service?.href ?? definition.href,
      dependencyNames: definition.dependencies.map(
        (code) =>
          statusServiceByCode.value.get(code)?.name ??
          statusTopologyDefinitions.find((item) => item.code === code)?.fallbackName ??
          code,
      ),
      affectedNames: affectedServiceCodes(definition.code).map(
        (code) =>
          statusServiceByCode.value.get(code)?.name ??
          statusTopologyDefinitions.find((item) => item.code === code)?.fallbackName ??
          code,
      ),
    };
  }),
);
const statusTopologyLanes = computed(() =>
  (Object.keys(statusTopologyLaneMeta) as Array<keyof typeof statusTopologyLaneMeta>).map(
    (lane) => ({
      code: lane,
      name: statusTopologyLaneMeta[lane][0],
      description: statusTopologyLaneMeta[lane][1],
      nodes: statusTopologyNodes.value.filter((node) => node.lane === lane),
    }),
  ),
);
const propagationWarnings = computed(() =>
  statusTopologyNodes.value.filter((node) => !["healthy", "ready"].includes(node.status)),
);
const realtimeMetrics = ref(readRealtimeClientMetrics());
const realtimeReconnectRate = computed(
  () => `${(realtimeReconnectRateBasisPoints(realtimeMetrics.value) / 100).toFixed(2)}%`,
);
const syncRealtimeMetrics = (event?: Event) => {
  const detail = (event as CustomEvent<RealtimeClientMetrics> | undefined)?.detail;
  realtimeMetrics.value = detail ?? readRealtimeClientMetrics();
};
const activeFilterCount = computed(
  () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
);
async function api<T>(path: string, options: RequestInit = {}) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    throw new Error(failure?.actionHint ?? "请求未完成", { cause: failure ?? error });
  }
}
const {
  page: contentPage,
  appliedQuery: contentAppliedQuery,
  appliedStatus: contentAppliedStatus,
  snapshotQuery: contentSnapshotQuery,
  snapshotStatus: contentSnapshotStatus,
  lastLoadOutcome: contentLoadOutcome,
  readLocation: readContentLocation,
  load: loadContent,
  applyFilters: applyContentFilters,
  resetFilters: resetContentFilters,
  changePage: changeContentPage,
  stop: stopContentLoad,
} = usePlatformContentList({
  domain,
  query,
  status,
  data,
  state,
  message,
  refreshing,
  request: api,
  reload: () => void load(),
});
const {
  item: reviewItem,
  status: reviewStatus,
  reason: reviewReason,
  error: reviewError,
  submitting: reviewSubmitting,
  begin: beginReview,
  cancel: cancelReview,
  submit: submitReview,
} = usePlatformContentReview({
  request: api,
  reload: async () => {
    await load();
    return contentLoadOutcome.value === "success";
  },
  message,
  busy,
});
const { load: loadStatus, stop: stopStatusLoad } = usePlatformStatus({
  domain,
  data,
  state,
  message,
  refreshing,
  request: api,
});
async function load() {
  if (domain.value === "notifications") return;
  if (await loadContent()) return;
  if (await loadStatus()) return;
  state.value = "loading";
  refreshing.value = true;
  message.value = "";
  const params = new URLSearchParams({ domain: apiDomain.value });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    data.value = await api<any>(`/platform/management?${params}`);
    const count =
      domain.value === "status"
        ? (data.value?.collections?.length ?? 0) + (data.value?.sources?.length ?? 0)
        : domain.value === "api-coverage"
          ? (data.value?.operations?.length ?? 0)
          : ["notifications", "email"].includes(domain.value)
            ? (data.value?.items?.length ?? 0) + (data.value?.messages?.length ?? 0)
            : (data.value?.items?.length ?? 0);
    state.value = count || ["status", "api-coverage"].includes(domain.value) ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "管理数据暂不可用";
    state.value = "error";
  } finally {
    refreshing.value = false;
  }
}
async function manageEmail(item: any, action: "retry" | "suppress") {
  const actionName = action === "retry" ? "重新投递" : "抑制投递";
  const reason = await askActionReason({
    title: `填写${actionName}原因`,
    description: "原因会与邮件队列记录、操作者和执行结果一起保存。",
    initialValue: "人工处理邮件队列",
  });
  if (reason === null) return;
  if (reason.trim().length < 2) {
    message.value = "操作原因至少需要 2 个字。";
    return;
  }
  busy.value = item.id;
  message.value = "";
  try {
    await api(`/platform/management/email/${item.source_type}/${item.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason: reason.trim() }),
    });
    await load();
    message.value = `${actionName}已完成并写入审计记录。`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : `${actionName}未完成`;
  } finally {
    busy.value = "";
  }
}
function openMessage(item?: any) {
  const kind = domain.value === "email" ? "email" : "notification";
  messageEditor.value = item ?? { id: "" };
  messageForm.value = item
    ? {
        kind: item.kind,
        title: item.title,
        body: item.body,
        category: item.category,
        severity: item.severity,
        audience_type: item.audience_type,
        organization_id: item.organization_id ?? "",
        user_id: item.user_id ?? "",
        in_app_enabled: Boolean(item.in_app_enabled),
        email_enabled: false,
        reason: "编辑平台消息",
        expected_version: item.version,
      }
    : {
        kind,
        title: "",
        body: "",
        category: "system",
        severity: "info",
        audience_type: "all_users",
        organization_id: "",
        user_id: "",
        in_app_enabled: kind === "notification",
        email_enabled: kind === "email",
        reason: "创建平台消息草稿",
        expected_version: 1,
      };
}
async function saveMessage() {
  if (!messageEditor.value) return;
  messageSaving.value = true;
  try {
    const editing = Boolean(messageEditor.value.id);
    await api(`/platform/management/messages${editing ? `/${messageEditor.value.id}` : ""}`, {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(messageForm.value),
    });
    messageEditor.value = null;
    await load();
    message.value = editing ? "草稿已更新。" : "草稿已创建，可继续编辑或发布。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "草稿未保存";
  } finally {
    messageSaving.value = false;
  }
}
function resetGenericFilters() {
  query.value = "";
  status.value = "";
  void load();
}
async function messageAction(item: any, action: "publish" | "cancel") {
  const actionName = action === "publish" ? (item.kind === "email" ? "发送" : "发布") : "取消";
  const reason = await askActionReason({
    title: `填写${actionName}原因`,
    description: "原因会与消息版本、受众范围、操作者和执行结果一起保存。",
    initialValue: `${actionName}平台消息`,
  });
  if (reason === null) return;
  if (reason.trim().length < 2) {
    message.value = "操作原因至少需要 2 个字。";
    return;
  }
  busy.value = item.id;
  try {
    const result = await api<any>(`/platform/management/messages/${item.id}/actions`, {
      method: "POST",
      body: JSON.stringify({
        action,
        expected_version: item.version,
        reason: reason.trim(),
      }),
    });
    await load();
    message.value =
      action === "publish"
        ? `${actionName}完成：覆盖 ${result.recipient_count} 人，站内 ${result.in_app_count} 条，邮件队列 ${result.email_count} 条。`
        : "草稿已取消。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : `${actionName}未完成`;
  } finally {
    busy.value = "";
  }
}
watch(domain, () => {
  query.value = "";
  status.value = "";
  contentPage.value = 1;
  readContentLocation();
  cancelReview();
  messageEditor.value = null;
  load();
});
let contentWasDeactivated = false;
onActivated(() => {
  if (domain.value !== "content" || !contentWasDeactivated) return;
  contentWasDeactivated = false;
  void load();
});
onDeactivated(() => {
  if (domain.value !== "content") return;
  contentWasDeactivated = true;
  stopContentLoad();
  cancelReview();
});
onMounted(() => {
  readContentLocation();
  syncRealtimeMetrics();
  window.addEventListener(realtimeMetricsEvent, syncRealtimeMetrics);
  void load();
});
onUnmounted(() => {
  stopStatusLoad();
  stopContentLoad();
  window.removeEventListener(realtimeMetricsEvent, syncRealtimeMetrics);
});
</script>

<template>
  <section
    class="platform-management"
    :class="{
      'platform-management--status-c': domain === 'status',
      'platform-management--content': domain === 'content',
      'platform-management--notifications': domain === 'notifications',
    }"
    aria-live="polite"
    :aria-busy="refreshing"
  >
    <PlatformContentCenter
      v-if="domain === 'content'"
      v-model:query="query"
      v-model:status="status"
      :state="state"
      :data="data"
      :message="message"
      :request-id="requestId"
      :refreshing="refreshing"
      :busy="busy"
      :active-filter-count="activeFilterCount"
      :applied-query="contentAppliedQuery"
      :applied-status="contentAppliedStatus"
      :snapshot-query="contentSnapshotQuery"
      :snapshot-status="contentSnapshotStatus"
      :state-name="stateName"
      :when="when"
      @refresh="load"
      @apply="applyContentFilters"
      @reset="resetContentFilters"
      @change-page="changeContentPage"
      @review="beginReview"
    />
    <PlatformNotificationCenter v-else-if="domain === 'notifications'" :request="request" />
    <header
      v-if="domain !== 'content' && domain !== 'notifications'"
      class="platform-management-hero"
    >
      <div>
        <p v-if="domain === 'status'">P61 / 运行观测</p>
        <p v-else>平台运营中心</p>
        <h1 v-if="domain === 'status'">系统状态</h1>
        <h2 v-else>{{ titles[domain][0] }}</h2>
        <span>{{ titles[domain][1] }}</span>
      </div>
      <div class="hero-actions">
        <button v-if="domain === 'email'" type="button" @click="openMessage()">发送邮件</button>
        <button type="button" :disabled="refreshing" @click="load">
          {{ refreshing ? "刷新中…" : "刷新数据" }}
        </button>
      </div>
    </header>
    <PlatformManagementFilter
      v-if="domain !== 'status' && domain !== 'content' && domain !== 'notifications'"
      v-model:query="query"
      v-model:status="status"
      :domain="domain"
      :label="titles[domain][0]"
      :active-count="activeFilterCount"
      @apply="load"
      @reset="resetGenericFilters"
    />
    <p
      v-if="
        message &&
        domain !== 'content' &&
        domain !== 'notifications' &&
        (domain !== 'status' || state === 'ready')
      "
      class="platform-management-message"
      role="status"
    >
      {{ message }}
    </p>
    <section
      v-if="state !== 'ready' && domain !== 'content' && domain !== 'notifications'"
      class="platform-management-state"
      :aria-busy="domain === 'status' ? refreshing : undefined"
      :aria-labelledby="domain === 'status' ? 'platform-status-read-title' : undefined"
    >
      <h2 v-if="domain === 'status'" id="platform-status-read-title">
        {{ state === "loading" ? "正在读取系统状态" : "系统状态暂不可用" }}
      </h2>
      <h3 v-else>
        {{
          state === "loading"
            ? "正在读取管理数据"
            : state === "empty"
              ? "当前筛选没有记录"
              : "管理数据暂不可用"
        }}
      </h3>
      <p v-if="message">{{ message }}</p>
      <button v-if="state !== 'loading'" @click="load">重新加载</button>
    </section>
    <template v-else-if="data && domain !== 'content' && domain !== 'notifications'"
      ><div
        v-if="domain !== 'api-coverage' && domain !== 'status'"
        class="platform-management-kpis"
      >
        <article v-for="[key, value] in summaryEntries" :key="key">
          <small>{{ summaryName(key) }}</small
          ><strong :data-state="value">{{ stateName(value) }}</strong>
        </article>
      </div>
      <PlatformMessageWorkbench
        v-if="domain === 'email'"
        :domain="domain"
        :messages="data.messages"
        :state-name="stateName"
        :when="when"
        @edit="openMessage"
        @action="messageAction"
      />
      <PlatformManagementRecordList
        v-if="domain === 'email'"
        domain="email"
        :items="data.items"
        :busy="busy"
        :state-name="stateName"
        :when="when"
        @review="beginReview"
        @email-action="manageEmail"
      />
      <ApiCoverageDashboard v-if="domain === 'api-coverage'" :data="data" />
      <PlatformStatusCenterView
        v-if="domain === 'status'"
        :data="data"
        :warning-count="propagationWarnings.length"
        :observed-at="when(data.observed_at)"
        :topology-lanes="statusTopologyLanes"
        :propagation-warnings="propagationWarnings"
        :realtime-metrics="realtimeMetrics"
        :realtime-reconnect-rate="realtimeReconnectRate"
        :summary-entries="summaryEntries"
        :state-name="stateName"
        :summary-name="summaryName"
        :when="when"
      />
      <footer>
        <span>数据更新时间 {{ when(data.observed_at) }}</span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <span>关联编号 {{ requestId }}</span>
        </details>
      </footer></template
    >
    <PlatformContentReviewDialog
      v-model:status="reviewStatus"
      v-model:reason="reviewReason"
      :open="Boolean(reviewItem)"
      :item="reviewItem"
      :error="reviewError"
      :submitting="reviewSubmitting"
      @cancel="cancelReview"
      @submit="submitReview"
    />
    <PlatformMessageEditor
      v-if="domain === 'email'"
      :open="Boolean(messageEditor)"
      :editor="messageEditor"
      :form="messageForm"
      :saving="messageSaving"
      :audience-options="data?.audience_options"
      @close="messageEditor = null"
      @save="saveMessage"
    />
    <AuditedReasonDialog
      :open="actionReasonOpen"
      :title="actionReasonRequest?.title || '填写操作原因'"
      :description="actionReasonRequest?.description || ''"
      :initial-value="actionReasonRequest?.initialValue"
      :minimum-length="actionReasonRequest?.minimumLength"
      @submit="submitActionReason"
      @cancel="cancelActionReason"
    />
  </section>
</template>

<style scoped>
.platform-management {
  min-width: 0;
  display: grid;
  gap: 18px;
  color: var(--so-text);
}
.platform-management-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 17px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
}
.platform-management-hero p {
  margin: 0;
  color: var(--so-primary);
  font: 700 11px monospace;
  letter-spacing: 0.14em;
}
.platform-management-hero h2 {
  margin: 6px 0;
  font-size: 28px;
}
.platform-management-hero span {
  color: var(--so-text-muted);
}
.hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hero-actions button:first-child {
  border-color: var(--so-primary);
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 800;
}
.platform-management button,
.platform-management select,
.platform-management input,
.platform-management textarea {
  box-sizing: border-box;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  background: var(--so-panel);
  color: var(--so-text);
  padding: 9px 12px;
  font: inherit;
}
.platform-management button {
  cursor: pointer;
}
.platform-management button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.platform-management-hero button,
.platform-management-filter button,
dialog footer button:last-child {
  border-color: var(--so-primary);
  background: var(--so-primary);
  color: var(--so-on-primary);
  font-weight: 800;
}
.platform-management-filter {
  display: flex;
  gap: 9px;
}
.platform-management-filter input {
  flex: 1;
}
.platform-management-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.platform-management-kpis article,
.platform-status-grid section {
  padding: 17px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
}
.platform-management-kpis small {
  display: block;
  color: var(--so-text-muted);
}
.platform-management-kpis strong {
  display: block;
  margin-top: 8px;
  font-size: 23px;
}
.platform-management-state,
.platform-management-message {
  padding: 24px;
  text-align: center;
  border: 1px dashed var(--so-border-strong);
  border-radius: 14px;
  background: var(--so-panel);
}
.platform-management-message {
  padding: 12px;
  border-style: solid;
  color: var(--so-text);
}
.platform-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.platform-service-topology {
  grid-column: 1 / -1;
}
.platform-topology-header,
.platform-topology-node__title,
.platform-propagation-alert > div {
  display: flex;
  align-items: center;
}
.platform-topology-header,
.platform-topology-node__title,
.platform-propagation-alert > div {
  justify-content: space-between;
  gap: 16px;
}
.platform-topology-header > div {
  display: grid;
  gap: 4px;
}
.platform-topology-header h3,
.platform-topology-lanes h4,
.platform-propagation h4 {
  margin: 0;
}
.platform-topology-header span,
.platform-topology-node small,
.platform-topology-lanes h4 small {
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-topology-header > a,
.platform-propagation-alert a {
  flex: none;
  color: var(--so-primary);
  text-decoration: none;
}
.platform-topology-lanes {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 1.2fr;
  gap: 12px;
  margin-top: 14px;
}
.platform-topology-lanes > section {
  min-width: 0;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  padding: 10px;
  background: var(--so-panel-soft);
}
.platform-topology-lanes h4 {
  display: grid;
  gap: 3px;
  padding: 2px 2px 9px;
}
.platform-topology-node {
  display: grid;
  gap: 7px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel);
  text-decoration: none;
  color: var(--so-text);
}
.platform-topology-node[data-state="warning"],
.platform-topology-node[data-state="degraded"],
.platform-topology-node[data-state="stale"] {
  border-color: color-mix(in srgb, var(--so-warning) 42%, var(--so-border));
}
.platform-topology-node[data-state="blocked"],
.platform-topology-node[data-state="stopped"] {
  border-color: color-mix(in srgb, var(--so-danger) 46%, var(--so-border));
}
.platform-topology-node i {
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  font-style: normal;
  font-size: 13px;
}
.platform-topology-node i[data-state="healthy"],
.platform-topology-node i[data-state="ready"] {
  background: var(--so-success-soft);
  color: var(--so-success);
}
.platform-topology-node i[data-state="warning"],
.platform-topology-node i[data-state="degraded"],
.platform-topology-node i[data-state="stale"] {
  background: var(--so-warning-soft);
  color: var(--so-warning);
}
.platform-topology-node i[data-state="blocked"],
.platform-topology-node i[data-state="stopped"] {
  background: var(--so-danger-soft);
  color: var(--so-danger);
}
.platform-topology-node dl {
  display: grid;
  gap: 6px;
  margin: 0;
}
.platform-topology-node dl > div {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}
.platform-topology-node dt,
.platform-topology-node dd {
  margin: 0;
  font-size: 13px;
}
.platform-topology-node dt {
  color: var(--so-text-muted);
}
.platform-topology-node dd {
  overflow-wrap: anywhere;
}
.platform-propagation {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel-soft);
}
.platform-realtime-degradation {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel-soft);
}
.platform-realtime-degradation > header,
.platform-realtime-degradation > header > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.platform-realtime-degradation > header > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
}
.platform-realtime-degradation h4 {
  margin: 0;
}
.platform-realtime-degradation header span,
.platform-realtime-degradation > small,
.platform-realtime-degradation article span {
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-realtime-degradation header i {
  flex: none;
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--so-success-soft);
  color: var(--so-success);
  font-style: normal;
  font-size: 13px;
}
.platform-realtime-degradation header i[data-state="warning"] {
  background: var(--so-warning-soft);
  color: var(--so-warning);
}
.platform-realtime-degradation > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.platform-realtime-degradation article {
  display: grid;
  gap: 5px;
  padding: 10px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel);
}
.platform-realtime-degradation article strong {
  font-size: 21px;
}
.platform-propagation-alert {
  margin-top: 9px;
  padding: 10px;
  border-left: 3px solid var(--so-warning);
  border-radius: 8px;
  background: var(--so-panel);
}
.platform-propagation-alert[data-state="blocked"],
.platform-propagation-alert[data-state="stopped"] {
  border-left-color: var(--so-danger);
}
.platform-propagation-alert p,
.platform-propagation-empty {
  margin: 6px 0 0;
  color: var(--so-text-muted);
  font-size: 13px;
}
.platform-status-empty {
  margin: 0;
  color: var(--so-text-muted);
  line-height: 1.65;
}
.platform-status-grid h3 {
  margin-top: 0;
}
.platform-status-grid > section:not(.platform-service-topology) > div {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid var(--so-border);
}
.platform-status-grid > section:not(.platform-service-topology) > a {
  display: inline-block;
  margin-top: 14px;
  color: var(--so-primary);
}
.platform-management > template + footer,
.platform-management > footer {
  color: var(--so-text-muted);
  text-align: right;
  font-size: 13px;
}
.platform-management > footer details {
  margin-top: 6px;
}
.platform-management > footer summary {
  min-height: var(--so-touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 1px solid var(--so-border-strong);
  border-radius: 16px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  box-shadow: 0 24px 80px color-mix(in srgb, var(--so-shadow-color) 60%, transparent);
}
dialog form {
  display: grid;
  gap: 14px;
  min-width: min(430px, 80vw);
  padding: 10px;
}
dialog label {
  display: grid;
  gap: 6px;
}
dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 700px) {
  .platform-management-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .platform-management-filter {
    flex-direction: column;
  }
  .platform-status-grid {
    grid-template-columns: 1fr;
  }
  .platform-topology-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .platform-topology-lanes {
    grid-template-columns: 1fr;
  }
  .platform-realtime-degradation > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .platform-realtime-degradation > div {
    grid-template-columns: 1fr;
  }
}
</style>
<style src="../platform-status-center-c.css"></style>
