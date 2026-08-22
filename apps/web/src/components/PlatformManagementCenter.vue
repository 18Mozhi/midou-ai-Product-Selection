<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import {
  readRealtimeClientMetrics,
  realtimeMetricsEvent,
  realtimeReconnectRateBasisPoints,
  type RealtimeClientMetrics,
} from "../realtime-client-metrics";
import { useAuditedReason } from "../use-audited-reason";
import { useModalDialog } from "../use-modal-dialog";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import PlatformMessageEditor from "./PlatformMessageEditor.vue";
import PlatformMessageWorkbench from "./PlatformMessageWorkbench.vue";
import PlatformManagementRecordList from "./PlatformManagementRecordList.vue";
import PlatformNotificationOperations from "./PlatformNotificationOperations.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
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

const props = defineProps<{ apiBaseUrl: string; domain: string }>();
const request = createApiClient(props.apiBaseUrl);
const domain = computed<Domain>(
  () =>
    (["content", "notifications", "email", "status"].includes(props.domain)
      ? props.domain
      : "status") as Domain,
);
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const data = ref<any>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  requestId = ref(""),
  busy = ref("");
const reviewItem = ref<any>(null),
  reviewStatus = ref<"active" | "irrelevant" | "stale">("active"),
  reviewReason = ref("");
const { dialogElement: reviewDialogElement, handleCancel: handleReviewCancel } = useModalDialog(
  () => Boolean(reviewItem.value),
  () => (reviewItem.value = null),
);
const {
  request: actionReasonRequest,
  open: actionReasonOpen,
  ask: askActionReason,
  submit: submitActionReason,
  cancel: cancelActionReason,
} = useAuditedReason();
const messageEditor = ref<any>(null),
  messageSaving = ref(false),
  messageForm = ref({
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
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    throw new Error(failure?.actionHint ?? "请求未完成");
  }
}
async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: domain.value });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    data.value = await api<any>(`/platform/management?${params}`);
    const count =
      domain.value === "status"
        ? (data.value?.collections?.length ?? 0) + (data.value?.sources?.length ?? 0)
        : ["notifications", "email"].includes(domain.value)
          ? (data.value?.items?.length ?? 0) + (data.value?.messages?.length ?? 0)
          : (data.value?.items?.length ?? 0);
    state.value = count || domain.value === "status" ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "管理数据暂不可用";
    state.value = "error";
  }
}
function beginReview(item: any, statusValue: "active" | "irrelevant" | "stale") {
  reviewItem.value = item;
  reviewStatus.value = statusValue;
  reviewReason.value = "";
}
async function submitReview() {
  if (!reviewItem.value || reviewReason.value.trim().length < 2) return;
  busy.value = reviewItem.value.id;
  message.value = "";
  try {
    await api(`/platform/management/content/${reviewItem.value.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: reviewStatus.value,
        expected_version: reviewItem.value.version,
        reason: reviewReason.value.trim(),
      }),
    });
    reviewItem.value = null;
    await load();
    message.value = "内容状态已更新并写入审计记录。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "内容审核未完成";
  } finally {
    busy.value = "";
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
  reviewItem.value = null;
  messageEditor.value = null;
  load();
});
onMounted(() => {
  syncRealtimeMetrics();
  window.addEventListener(realtimeMetricsEvent, syncRealtimeMetrics);
  void load();
});
onUnmounted(() => window.removeEventListener(realtimeMetricsEvent, syncRealtimeMetrics));
</script>

<template>
  <section class="platform-management" aria-live="polite">
    <header class="platform-management-hero">
      <div>
        <p>平台运营中心</p>
        <h2>{{ titles[domain][0] }}</h2>
        <span>{{ titles[domain][1] }}</span>
      </div>
      <div class="hero-actions">
        <button v-if="domain === 'notifications'" type="button" @click="openMessage()">
          发布通知
        </button>
        <button v-if="domain === 'email'" type="button" @click="openMessage()">发送邮件</button>
        <button type="button" @click="load">刷新数据</button>
      </div>
    </header>
    <ResponsiveFilterDrawer
      v-if="domain !== 'status'"
      :label="`筛选${titles[domain][0]}`"
      :active-count="activeFilterCount"
    >
      <form class="platform-management-filter" @submit.prevent="load">
        <input
          v-model="query"
          :placeholder="domain === 'content' ? '搜索主题、分类或市场' : '搜索标题、邮箱或组织'"
        /><select
          v-model="status"
          :aria-label="
            domain === 'content' ? '内容状态' : domain === 'notifications' ? '通知类型' : '邮件状态'
          "
        >
          <option value="">全部状态</option>
          <template v-if="domain === 'content'"
            ><option value="active">展示中</option>
            <option value="irrelevant">无关</option>
            <option value="stale">已过期</option></template
          ><template v-else-if="domain === 'notifications'"
            ><option value="task">任务</option>
            <option value="approval">审批</option>
            <option value="competitor">竞品</option>
            <option value="system">系统</option></template
          ><template v-else
            ><option value="succeeded">已送达</option>
            <option value="blocked_provider">服务商受阻</option>
            <option value="dead_letter">死信</option>
            <option value="failed">失败</option></template
          ></select
        ><button>筛选</button>
      </form>
    </ResponsiveFilterDrawer>
    <p v-if="message" class="platform-management-message">{{ message }}</p>
    <section v-if="state !== 'ready'" class="platform-management-state">
      <h3>
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
    <template v-else-if="data"
      ><div class="platform-management-kpis">
        <article v-for="[key, value] in summaryEntries" :key="key">
          <small>{{ summaryName(key) }}</small
          ><strong :data-state="value">{{ stateName(value) }}</strong>
        </article>
      </div>
      <PlatformMessageWorkbench
        v-if="['notifications', 'email'].includes(domain)"
        :domain="domain"
        :messages="data.messages"
        :state-name="stateName"
        :when="when"
        @create="openMessage()"
        @edit="openMessage"
        @action="messageAction"
      />
      <PlatformManagementRecordList
        v-if="domain === 'content'"
        domain="content"
        :items="data.items"
        :busy="busy"
        :state-name="stateName"
        :when="when"
        @review="beginReview"
        @email-action="manageEmail"
      />
      <PlatformNotificationOperations
        v-else-if="domain === 'notifications'"
        :data="data"
        :state-name="stateName"
        :when="when"
      />
      <PlatformManagementRecordList
        v-else-if="domain === 'email'"
        domain="email"
        :items="data.items"
        :busy="busy"
        :state-name="stateName"
        :when="when"
        @review="beginReview"
        @email-action="manageEmail"
      />
      <div v-else class="platform-status-grid">
        <section class="platform-service-topology">
          <header class="platform-topology-header">
            <div>
              <h3>依赖拓扑与故障传播</h3>
              <span>状态来自最新运行观测；5 分钟外的观测标记为已过期。</span>
            </div>
            <RouterLink to="/platform-admin/topology">查看实时拓扑</RouterLink>
          </header>
          <div class="platform-topology-lanes">
            <section v-for="lane in statusTopologyLanes" :key="lane.code">
              <h4>
                <span>{{ lane.name }}</span
                ><small>{{ lane.description }}</small>
              </h4>
              <RouterLink
                v-for="node in lane.nodes"
                :key="node.code"
                class="platform-topology-node"
                :data-state="node.status"
                :to="node.href"
              >
                <span class="platform-topology-node__title"
                  ><b>{{ node.name }}</b
                  ><i :data-state="node.status">{{ stateName(node.status) }}</i></span
                >
                <small>{{ node.detail }} · {{ when(node.observedAt) }}</small>
                <dl>
                  <div>
                    <dt>依赖</dt>
                    <dd>{{ node.dependencyNames.join("、") || "基础资源" }}</dd>
                  </div>
                  <div>
                    <dt>异常影响</dt>
                    <dd>{{ node.impact }}</dd>
                  </div>
                </dl>
              </RouterLink>
            </section>
          </div>
          <div class="platform-propagation" aria-live="polite">
            <h4>当前需核查的传播范围</h4>
            <article
              v-for="node in propagationWarnings"
              :key="node.code"
              class="platform-propagation-alert"
              :data-state="node.status"
            >
              <div>
                <b>{{ node.name }}当前{{ stateName(node.status) }}</b
                ><RouterLink :to="node.href">进入处理</RouterLink>
              </div>
              <p>
                如异常持续，优先核查{{ node.impact
                }}<template v-if="node.affectedNames.length"
                  >；关联服务：{{ node.affectedNames.join("、") }}</template
                >。
              </p>
            </article>
            <p v-if="!propagationWarnings.length" class="platform-propagation-empty">
              当前未观测到需要核查的异常传播链。
            </p>
          </div>
          <section class="platform-realtime-degradation" aria-label="实时连接退化统计">
            <header>
              <div>
                <h4>实时连接退化</h4>
                <span>仅统计当前浏览器标签页会话，不代表全站或其他用户。</span>
              </div>
              <i :data-state="realtimeMetrics.reconnecting ? 'warning' : 'ready'">
                {{ realtimeMetrics.reconnecting ? "正在自动重连" : "当前未处于重连" }}
              </i>
            </header>
            <div>
              <article>
                <small>SSE 重连率</small>
                <strong>{{ realtimeReconnectRate }}</strong>
                <span
                  >{{ realtimeMetrics.reconnect_count }} 次重连 /
                  {{ realtimeMetrics.connection_open_count + realtimeMetrics.reconnect_count }}
                  次连接事件</span
                >
              </article>
              <article>
                <small>降级轮询次数</small>
                <strong>{{ realtimeMetrics.fallback_poll_count }}</strong>
                <span>连接异常时刷新一次通知事实</span>
              </article>
            </div>
            <small
              >会话开始 {{ when(realtimeMetrics.session_started_at) }} · 最近重连
              {{ when(realtimeMetrics.last_reconnect_at) }} · 最近降级轮询
              {{ when(realtimeMetrics.last_fallback_poll_at) }}</small
            >
          </section>
        </section>
        <section>
          <h3>采集任务状态</h3>
          <div v-for="item in data.collections" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <RouterLink to="/platform-admin/collection/overview">查看任务详情</RouterLink>
        </section>
        <section>
          <h3>来源状态</h3>
          <div v-for="item in data.sources" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <RouterLink to="/platform-admin/providers/sources">管理来源配置</RouterLink>
        </section>
      </div>
      <footer>
        <span>数据更新时间 {{ when(data.observed_at) }}</span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <span>关联编号 {{ requestId }}</span>
        </details>
      </footer></template
    >
    <dialog ref="reviewDialogElement" aria-label="审核热点内容" @cancel="handleReviewCancel">
      <form @submit.prevent="submitReview">
        <h3>审核热点内容</h3>
        <p>{{ reviewItem?.title }}</p>
        <label
          >目标状态<select v-model="reviewStatus">
            <option value="active">展示中</option>
            <option value="irrelevant">无关</option>
            <option value="stale">已过期</option>
          </select></label
        ><label
          >审核原因<textarea
            v-model="reviewReason"
            required
            minlength="2"
            maxlength="300"
            rows="4"
            placeholder="说明判断依据，操作会写入审计记录"
          ></textarea>
        </label>
        <footer>
          <button type="button" @click="reviewItem = null">取消</button
          ><button :disabled="reviewReason.trim().length < 2 || Boolean(busy)">确认更新</button>
        </footer>
      </form>
    </dialog>
    <PlatformMessageEditor
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
