<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
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
  }>(),
  emit = defineEmits<{ close: [] }>(),
  request = createApiClient(props.apiBaseUrl);
const query = ref(""),
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
  assigneeApplicable = computed(() => ["task", "opportunity"].includes(resourceType.value));
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
watch(
  () => [props.open, props.mode] as const,
  async ([open, mode]) => {
    if (!open) return;
    state.value = "idle";
    requestId.value = "";
    traceId.value = "";
    actionHint.value = "";
    results.value = [];
    actions.value = [];
    await nextTick();
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
async function get<T>(path: string): Promise<T | null> {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<T>(path);
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      state.value = failure(error.kind);
      return null;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    state.value = "blocked";
    return null;
  }
}
async function search() {
  const value = query.value.trim();
  if (value.length < 2) {
    state.value = "error";
    return;
  }
  const params = new URLSearchParams({ q: value, limit: "10" });
  if (resourceType.value) params.set("resource_type", resourceType.value);
  if (status.value) params.set("status", status.value);
  if (assigneeApplicable.value && assignee.value.trim())
    params.set("assignee", assignee.value.trim());
  const data = await get<{ items: Result[] }>(`/me/global-search?${params}`);
  if (!data) return;
  results.value = data.items;
  state.value = results.value.length ? "ready" : "empty";
}
async function loadActions() {
  const data = await get<Action[]>(`/me/quick-actions?shell=${props.shell}`);
  if (!data) return;
  actions.value = [...data].sort((left, right) => {
    const leftRecent = recentActionIds.value.indexOf(left.id),
      rightRecent = recentActionIds.value.indexOf(right.id);
    if (leftRecent === rightRecent) return 0;
    if (leftRecent < 0) return 1;
    if (rightRecent < 0) return -1;
    return leftRecent - rightRecent;
  });
  state.value = actions.value.length ? "ready" : "empty";
}
function rememberAction(id: string) {
  recentActionIds.value = [id, ...recentActionIds.value.filter((item) => item !== id)].slice(0, 5);
}
watch(resourceType, () => {
  status.value = "";
  if (!assigneeApplicable.value) assignee.value = "";
});
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialogElement"
      class="discovery-backdrop"
      :aria-label="mode === 'search' ? '全局搜索' : '快捷创建'"
      @cancel="handleCancel"
      @mousedown.self="emit('close')"
    >
      <section class="discovery-dialog">
        <header>
          <div>
            <p>{{ mode === "search" ? "GLOBAL SEARCH" : "QUICK CREATE" }}</p>
            <h2>
              {{ mode === "search" ? "搜索当前工作区" : "选择已授权入口" }}
            </h2>
          </div>
          <button type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <form v-if="mode === 'search'" class="discovery-search-form" @submit.prevent="search">
          <label class="discovery-query"
            ><span>⌕</span
            ><input
              ref="input"
              v-model="query"
              minlength="2"
              maxlength="100"
              autocomplete="off"
              placeholder="输入至少 2 个字符"
              @keydown.enter.prevent="search"
            /><kbd>Enter</kbd></label
          >
          <div class="discovery-filters" aria-label="搜索筛选">
            <label
              >对象类型<select v-model="resourceType" aria-label="对象类型">
                <option value="">全部对象</option>
                <option value="task">任务</option>
                <option value="opportunity">机会</option>
                <option value="evidence">证据</option>
                <option value="collection_task">采集任务</option>
              </select></label
            >
            <label
              >状态<select v-model="status" aria-label="状态" :disabled="!resourceType">
                <option value="">{{ resourceType ? "全部状态" : "先选对象类型" }}</option>
                <option v-for="item in statusOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select></label
            >
            <label
              >负责人<input
                v-model="assignee"
                aria-label="负责人"
                maxlength="120"
                :disabled="!assigneeApplicable"
                :placeholder="assigneeApplicable ? '姓名或账号' : '仅任务和机会可用'"
            /></label>
          </div>
        </form>
        <div v-if="state === 'idle'" class="discovery-hint">
          <b>只搜索真实索引</b>
          <p>范围固定为当前组织与工作区，结果会按当前角色权限再次过滤。</p>
        </div>
        <UiStatePanel
          v-else-if="
            ['loading', 'empty', 'error', 'expired', 'forbidden', 'blocked'].includes(state)
          "
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
          @primary="mode === 'search' ? search() : loadActions()"
        />
        <div v-else class="discovery-results">
          <RouterLink v-for="item in results" :key="item.id" :to="item.route"
            ><i>⌕</i
            ><span
              ><strong>{{ item.title }}</strong
              ><small
                >{{ resourceLabel(item.resource_type) }} · {{ statusLabel(item.status)
                }}<template v-if="item.assignee_name"> · 负责人 {{ item.assignee_name }}</template>
                · {{ item.subtitle || "无补充说明" }} ·
                {{ new Date(item.updated_at).toLocaleString("zh-CN") }}</small
              ></span
            ><b>↗</b></RouterLink
          ><RouterLink
            v-for="item in actions"
            :key="item.id"
            :to="item.route"
            @click="rememberAction(item.id)"
            ><i>＋</i
            ><span
              ><strong>{{ item.label }}</strong
              ><small
                >{{ item.description
                }}<template v-if="recentActionIds.includes(item.id)"> · 最近使用</template></small
              ></span
            ><b>→</b></RouterLink
          >
        </div>
        <footer>
          <span>{{
            mode === "search" ? "搜索不跨组织或工作区" : "这里只提供入口，不提前创建业务对象"
          }}</span
          ><RouterLink v-if="shell === 'member'" to="/notifications">打开通知中心</RouterLink>
        </footer>
      </section>
    </dialog></Teleport
  >
</template>
