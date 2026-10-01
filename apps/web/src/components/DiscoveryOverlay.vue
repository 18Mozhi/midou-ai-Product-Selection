<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import "../styles/navigation-discovery-c.css";
import UiStatePanel from "./UiStatePanel.vue";
type Mode = "search" | "create";
type Shell = "member" | "organization_admin" | "platform_admin";
type State = "idle" | "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Result {
  id: string;
  resource_type: string;
  resource_id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  route: string;
  updated_at: string;
}
interface Action {
  id: string;
  label: string;
  description: string;
  route: string;
  required_capability: string;
}
const resourceLabel = (value: string) =>
  ({
    task: "任务",
    opportunity: "机会",
    evidence: "证据",
    collection_task: "采集任务",
  })[value] ?? value;
const statusLabel = (value: string | null) =>
  value
    ? ((
        {
          todo: "待处理",
          in_progress: "进行中",
          paused: "已暂停",
          completed: "已完成",
          cancelled: "已取消",
          candidate: "候选",
          validating: "验证中",
          ready: "待决策",
          adopted: "已采纳",
          observing: "观察中",
          rejected: "已拒绝",
          active: "有效",
          quarantined: "已隔离",
          expired: "已过期",
          queued: "排队中",
          running: "运行中",
          retry_scheduled: "等待重试",
          succeeded: "已成功",
          succeeded_empty: "成功但无结果",
          failed_terminal: "最终失败",
          dead_letter: "死信",
        } as Record<string, string>
      )[value] ?? value)
    : "未提供状态";
const STATUS_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  task: ["todo", "in_progress", "paused", "completed", "cancelled"].map((value) => ({
    value,
    label: statusLabel(value),
  })),
  opportunity: ["candidate", "validating", "ready", "adopted", "observing", "rejected"].map(
    (value) => ({ value, label: statusLabel(value) }),
  ),
  evidence: ["active", "quarantined", "expired"].map((value) => ({
    value,
    label: statusLabel(value),
  })),
  collection_task: [
    "queued",
    "running",
    "retry_scheduled",
    "succeeded",
    "succeeded_empty",
    "failed_terminal",
    "dead_letter",
  ].map((value) => ({ value, label: statusLabel(value) })),
};
const props = defineProps<{
    open: boolean;
    mode: Mode;
    shell: Shell;
    apiBaseUrl: string;
    organizationName: string | null;
    workspaceName: string | null;
  }>(),
  emit = defineEmits<{ close: [] }>(),
  request = createApiClient(props.apiBaseUrl);
const query = ref(""),
  queryError = ref(""),
  resourceType = ref(""),
  status = ref(""),
  assignee = ref(""),
  state = ref<State>("idle"),
  results = ref<Result[]>([]),
  actions = ref<Action[]>([]),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref(""),
  input = ref<HTMLInputElement | null>(null),
  recentActionIds = ref<string[]>([]),
  statusOptions = computed(() => STATUS_OPTIONS[resourceType.value] ?? []),
  assigneeApplicable = computed(() => ["task", "opportunity"].includes(resourceType.value)),
  organizationLabel = computed(() => props.organizationName?.trim() || "当前组织"),
  workspaceLabel = computed(() => props.workspaceName?.trim() || "当前工作区");
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
let readSequence = 0;
let activeRead: AbortController | null = null;
function invalidateRead() {
  activeRead?.abort();
  activeRead = null;
  return ++readSequence;
}
onUnmounted(invalidateRead);
watch(
  () => [props.open, props.mode, props.shell] as const,
  async ([open, mode]) => {
    const opening = invalidateRead();
    if (!open) return;
    state.value = "idle";
    requestId.value = "";
    traceId.value = "";
    actionHint.value = "";
    queryError.value = "";
    results.value = [];
    actions.value = [];
    await nextTick();
    if (opening !== readSequence || !props.open) return;
    if (mode === "search") input.value?.focus();
    else await loadActions();
  },
  { immediate: true },
);
const failure = (kind: ApiFailureKind): State =>
  kind === "expired"
    ? "expired"
    : kind === "forbidden"
      ? "forbidden"
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
async function get<T>(path: string, apply: (data: T) => void): Promise<void> {
  const current = invalidateRead();
  const controller = new AbortController();
  activeRead = controller;
  state.value = "loading";
  actionHint.value = "";
  requestId.value = "";
  traceId.value = "";
  try {
    const response = await request<T>(path, { signal: controller.signal });
    if (current !== readSequence || controller.signal.aborted || !props.open) return;
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    apply(response.data);
  } catch (error) {
    if (current !== readSequence || controller.signal.aborted || !props.open) return;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      state.value = failure(error.kind);
      return;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    state.value = "blocked";
  } finally {
    if (activeRead === controller) activeRead = null;
  }
}
async function search() {
  const value = query.value.trim();
  if (value.length < 2) {
    invalidateRead();
    state.value = "idle";
    requestId.value = "";
    traceId.value = "";
    actionHint.value = "";
    queryError.value = "请输入至少 2 个字符后搜索。";
    input.value?.focus();
    return;
  }
  queryError.value = "";
  const params = new URLSearchParams({ q: value, limit: "10" });
  if (resourceType.value) params.set("resource_type", resourceType.value);
  if (status.value) params.set("status", status.value);
  if (assigneeApplicable.value && assignee.value.trim())
    params.set("assignee", assignee.value.trim());
  await get<{ items: Result[] }>(`/me/global-search?${params}`, (data) => {
    results.value = data.items;
    state.value = results.value.length ? "ready" : "empty";
  });
}
async function loadActions() {
  await get<Action[]>(`/me/quick-actions?shell=${props.shell}`, (data) => {
    actions.value = [...data].sort((left, right) => {
      const leftRecent = recentActionIds.value.indexOf(left.id),
        rightRecent = recentActionIds.value.indexOf(right.id);
      if (leftRecent === rightRecent) return 0;
      if (leftRecent < 0) return 1;
      if (rightRecent < 0) return -1;
      return leftRecent - rightRecent;
    });
    state.value = actions.value.length ? "ready" : "empty";
  });
}
function rememberAction(id: string) {
  recentActionIds.value = [id, ...recentActionIds.value.filter((item) => item !== id)].slice(0, 5);
}
function navigateAway(event: MouseEvent, actionId?: string) {
  if (actionId) rememberAction(actionId);
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return;
  emit("close");
}
function handleTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || !props.open || !dialogElement.value) return;
  const focusable = [
    ...dialogElement.value.querySelectorAll<HTMLElement>(
      "button,a[href],input,select,textarea,[tabindex]",
    ),
  ].filter(
    (element) =>
      element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0,
  );
  const first = focusable[0],
    last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
watch(resourceType, () => {
  status.value = "";
  if (!assigneeApplicable.value) assignee.value = "";
});
</script>
<template>
  <Teleport to="body">
    <dialog
      v-if="open"
      ref="dialogElement"
      class="discovery-c-backdrop"
      :aria-label="mode === 'search' ? '全局搜索' : '快捷创建'"
      @cancel="handleCancel"
      @mousedown.self.prevent="emit('close')"
      @keydown="handleTab"
    >
      <section class="discovery-c-dialog">
        <header class="discovery-c-header">
          <div>
            <p>{{ mode === "search" ? "GLOBAL SEARCH" : "QUICK CREATE" }}</p>
            <h2>{{ mode === "search" ? "搜索当前工作区" : "选择已授权入口" }}</h2>
          </div>
          <button type="button" aria-label="关闭" @click="emit('close')">
            关闭 <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="discovery-c-scroll">
          <div class="discovery-c-layout">
            <aside class="discovery-c-scope" aria-label="当前范围与搜索条件">
              <p class="discovery-c-kicker">当前范围</p>
              <h3>{{ organizationLabel }}</h3>
              <p class="discovery-c-workspace-label">{{ workspaceLabel }}</p>
              <p class="discovery-c-scope-note">范围由当前会话决定，不跨组织或工作区。</p>
              <form
                v-if="mode === 'search'"
                class="discovery-c-form"
                novalidate
                @submit.prevent="search"
              >
                <label for="discovery-c-query">搜索关键词</label>
                <input
                  id="discovery-c-query"
                  ref="input"
                  v-model="query"
                  type="text"
                  minlength="2"
                  maxlength="100"
                  autocomplete="off"
                  aria-label="搜索关键词"
                  :aria-invalid="queryError ? 'true' : undefined"
                  :aria-describedby="queryError ? 'discovery-query-error' : undefined"
                  placeholder="输入至少 2 个字符"
                />
                <p v-if="queryError" id="discovery-query-error" role="alert">{{ queryError }}</p>
                <label for="discovery-c-resource-type">对象类型</label>
                <select id="discovery-c-resource-type" v-model="resourceType" aria-label="对象类型">
                  <option value="">全部对象</option>
                  <option value="task">任务</option>
                  <option value="opportunity">机会</option>
                  <option value="evidence">证据</option>
                  <option value="collection_task">采集任务</option>
                </select>
                <label for="discovery-c-status">状态</label>
                <select
                  id="discovery-c-status"
                  v-model="status"
                  aria-label="状态"
                  :disabled="!resourceType"
                >
                  <option value="">{{ resourceType ? "全部状态" : "先选对象类型" }}</option>
                  <option v-for="item in statusOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </option>
                </select>
                <label for="discovery-c-assignee">负责人</label>
                <input
                  id="discovery-c-assignee"
                  v-model="assignee"
                  aria-label="负责人"
                  maxlength="120"
                  :disabled="!assigneeApplicable"
                  :placeholder="assigneeApplicable ? '姓名或账号' : '仅任务和机会可用'"
                />
                <button class="discovery-c-submit" type="submit">搜索</button>
              </form>
              <div v-else class="discovery-c-create-note">
                <p><strong>先选择入口</strong><br />再完成目标表单</p>
                <p>仅展示服务端返回的已授权入口；最近使用仅保留在当前弹窗内。</p>
              </div>
            </aside>
            <section class="discovery-c-results-pane" aria-label="结果区">
              <header class="discovery-c-surface-heading">
                <h3>{{ mode === "search" ? "搜索结果" : "可用入口" }}</h3>
                <span>{{ mode === "search" ? "最多显示 10 项" : "由服务端返回" }}</span>
              </header>
              <div class="discovery-c-content" aria-live="polite">
                <p v-if="state === 'idle'" class="discovery-c-idle">
                  输入关键词并选择筛选条件后，查看当前范围内有权访问的结果。
                </p>
                <UiStatePanel
                  v-else-if="
                    ['loading', 'empty', 'error', 'expired', 'forbidden', 'blocked'].includes(state)
                  "
                  class="discovery-c-state"
                  compact
                  :kind="
                    state === 'loading'
                      ? 'loading'
                      : state === 'empty'
                        ? 'empty'
                        : state === 'expired'
                          ? 'expired'
                          : state === 'forbidden'
                            ? 'forbidden'
                            : state === 'blocked'
                              ? 'blocked'
                              : 'error'
                  "
                  :request-id="requestId"
                  :trace-id="traceId"
                  :action-hint="actionHint"
                  primary-label="重新加载"
                  secondary-label="关闭"
                  @primary="mode === 'search' ? search() : loadActions()"
                  @secondary="emit('close')"
                />
                <div v-else class="discovery-c-results">
                  <RouterLink
                    v-for="item in results"
                    :key="item.id"
                    class="discovery-c-result"
                    :to="item.route"
                    @click="navigateAway"
                  >
                    <span class="discovery-c-result-main">
                      <strong>{{ item.title }}</strong>
                      <span class="discovery-c-tags">
                        <span>{{ resourceLabel(item.resource_type) }}</span>
                        <span>{{ statusLabel(item.status) }}</span>
                      </span>
                      <small v-if="item.subtitle">{{ item.subtitle }}</small>
                      <small class="discovery-c-result-meta">
                        <template v-if="item.assignee_name"
                          >负责人 {{ item.assignee_name }} ·
                        </template>
                        更新于 {{ new Date(item.updated_at).toLocaleString("zh-CN") }}
                      </small>
                    </span>
                    <span class="discovery-c-result-arrow" aria-hidden="true">→</span>
                  </RouterLink>
                  <RouterLink
                    v-for="(item, index) in actions"
                    :key="item.id"
                    class="discovery-c-action"
                    :to="item.route"
                    @click="navigateAway($event, item.id)"
                  >
                    <span class="discovery-c-action-index">{{
                      String(index + 1).padStart(2, "0")
                    }}</span>
                    <span class="discovery-c-action-main">
                      <strong>{{ item.label }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                    <span v-if="recentActionIds.includes(item.id)" class="discovery-c-recent"
                      >最近</span
                    >
                    <span class="discovery-c-result-arrow" aria-hidden="true">→</span>
                  </RouterLink>
                </div>
              </div>
            </section>
          </div>
        </div>
        <footer class="discovery-c-footer">
          <span>{{
            mode === "search" ? "搜索不跨组织或工作区" : "这里只提供入口，不提前创建业务对象"
          }}</span>
          <RouterLink v-if="shell === 'member'" to="/notifications" @click="navigateAway"
            >查看通知 <span aria-hidden="true">→</span></RouterLink
          >
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>
