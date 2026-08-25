<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ApiClientError,
  createApiClient,
  rethrowUnexpectedError,
  type ApiRequestOptions,
} from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import TaskBatchActions from "./TaskBatchActions.vue";
import TaskDetailPanel from "./TaskDetailPanel.vue";
import TaskListPanel from "./TaskListPanel.vue";
import type { BatchTaskAction, MemberOption, Task, TaskActionEditor } from "./task-workspace-types";
import "../task-workspace.css";
import "../task-workspace-enhancements.css";
type State = "loading" | "ready" | "empty" | "error" | "forbidden" | "expired" | "rate_limited";
type ExportTask = {
  id: string;
  report_type: "opportunity" | "trend" | "team";
  status: string;
  attempt_count: number;
  row_count: number | null;
  last_error_code: string | null;
  queue_position: number | null;
  estimated_completion_at: string | null;
  estimate_sample_size: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
};
const props = defineProps<{
    apiBaseUrl: string;
    mode: "today" | "all";
    taskId?: string;
    capabilities?: string[];
  }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  tasks = ref<Task[]>([]),
  memberOptions = ref<MemberOption[]>([]),
  exportTasks = ref<ExportTask[]>([]),
  activeView = ref<"business" | "exports">(
    props.mode === "all" && route.query.view === "exports" ? "exports" : "business",
  ),
  summary = ref<any>({
    todo: 0,
    in_progress: 0,
    paused: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  }),
  selected = ref<Task | null>(null),
  status = ref(
    ["todo", "in_progress", "paused", "completed", "cancelled", ""].includes(
      String(route.query.status ?? ""),
    )
      ? String(route.query.status ?? "")
      : "",
  ),
  query = ref(String(route.query.query ?? "").slice(0, 200)),
  sort = ref(
    ["priority_due", "due_asc", "updated_desc", "created_desc"].includes(
      String(route.query.sort ?? ""),
    )
      ? String(route.query.sort)
      : "priority_due",
  ),
  page = ref(Math.max(1, Number(route.query.page) || 1)),
  total = ref(0),
  notice = ref(""),
  requestId = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  deleting = ref<Task | null>(null),
  deleteReason = ref(""),
  editing = ref<Task | null>(null),
  selectedIds = ref<string[]>([]),
  batchAction = ref<BatchTaskAction>("pause"),
  batchReason = ref(""),
  batchDueAt = ref(""),
  batchAssigneeId = ref(""),
  showBatchImpact = ref(false),
  form = ref({ title: "", description: "", priority: "normal", due_at: "" }),
  comment = ref("");
const taskActionEditor = ref<TaskActionEditor | null>(null),
  taskActionForm = ref({
    reason: "",
    due_at: "",
    assignee_id: "",
    progress_percent: 0,
    progress_note: "",
  });
const closeTaskEditor = () => {
    showCreate.value = false;
    editing.value = null;
    void clearQuickCreate();
  },
  closeDeleteDialog = () => {
    deleting.value = null;
    deleteReason.value = "";
  },
  { dialogElement: createDialogElement, handleCancel: handleCreateCancel } = useModalDialog(
    () => showCreate.value,
    closeTaskEditor,
  ),
  { dialogElement: deleteDialogElement, handleCancel: handleDeleteCancel } = useModalDialog(
    () => Boolean(deleting.value),
    closeDeleteDialog,
  );
const pageSize = 10,
  canCreate = computed(() => props.capabilities?.includes("task:create") ?? false),
  canUpdate = computed(() => props.capabilities?.includes("task:update") ?? false),
  canAssign = computed(() => props.capabilities?.includes("task:assign") ?? false),
  canReadExports = computed(() => props.capabilities?.includes("report:read") ?? false),
  visible = computed(() => tasks.value),
  label = (v: string) =>
    (
      ({
        todo: "待处理",
        in_progress: "进行中",
        completed: "已完成",
        paused: "已暂停",
        cancelled: "已取消",
        overdue: "已逾期",
        due_soon: "24 小时内到期",
        on_track: "按期",
        not_set: "未设置期限",
      }) as any
    )[v] ?? v,
  batchTargets = computed(() => tasks.value.filter((task) => selectedIds.value.includes(task.id))),
  batchEligible = computed(() =>
    batchTargets.value.filter((task) =>
      batchAction.value === "pause"
        ? task.status === "in_progress"
        : batchAction.value === "resume"
          ? task.status === "paused"
          : !["completed", "cancelled"].includes(task.status),
    ),
  ),
  blockingContext = computed(() => {
    if (!selected.value) return null;
    const events = selected.value.events ?? [],
      pause = [...events].reverse().find((item) => item.event_type === "task.pause"),
      member = memberOptions.value.find((item) => item.id === selected.value?.assignee_id);
    return {
      reason:
        selected.value.status === "paused"
          ? String(pause?.payload?.reason ?? "暂停事件未记录可展示原因")
          : "当前任务未处于阻塞状态",
      nextOwner: member?.label ?? "已分配负责人（成员目录暂不可用）",
    };
  }),
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize))),
  returnPath = computed(() => {
    const value = typeof route.query.from === "string" ? route.query.from : "";
    return value === "/work" ||
      value.startsWith("/work?") ||
      value === "/tasks" ||
      value.startsWith("/tasks?") ||
      value.startsWith("/tasks/")
      ? value
      : "/tasks";
  }),
  time = (v: string | null) =>
    v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未设置",
  toLocalDateTime = (v: string | null) => {
    if (!v) return "";
    const date = new Date(v),
      local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  },
  phase = (task: Task) =>
    task.status === "todo"
      ? "待开始"
      : task.status === "in_progress"
        ? "执行中"
        : task.status === "paused"
          ? "已暂停"
          : task.status === "completed"
            ? "已完成"
            : "已结束",
  slaNext = (task: Task) =>
    task.sla_status === "overdue"
      ? "下一步：立即处理或调整期限"
      : task.sla_status === "due_soon"
        ? "下一步：在期限前完成当前阶段"
        : task.sla_status === "not_set"
          ? "下一步：按需要补充期限"
          : "下一步：继续当前阶段",
  activity = computed(() => {
    if (!selected.value) return [];
    return [
      ...(selected.value.events ?? []).map((item) => ({
        ...item,
        kind: "event" as const,
        body: item.payload?.progress_note || item.payload?.reason || "任务状态已更新",
        title: label(String(item.event_type).replace("task.", "")),
      })),
      ...(selected.value.comments ?? []).map((item) => ({
        ...item,
        kind: "comment" as const,
        body: item.body,
        title: "评论",
      })),
    ].sort((a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf());
  });
const exportStatusLabel = (value: string) =>
    (
      ({
        queued: "排队中",
        leased: "生成中",
        retry_scheduled: "等待重试",
        succeeded: "已完成",
        dead_letter: "生成失败",
        expired: "已过期",
      }) as Record<string, string>
    )[value] ?? "状态待确认",
  exportTypeLabel = (value: ExportTask["report_type"]) =>
    ({ opportunity: "机会分析", trend: "趋势分析", team: "团队绩效" })[value],
  exportNextStep = (item: ExportTask) =>
    item.status === "succeeded"
      ? "前往报表页下载文件"
      : ["dead_letter", "expired"].includes(item.status)
        ? "前往报表页重新生成"
        : item.queue_position == null
          ? "系统正在异步处理，无需停留等待"
          : item.estimated_completion_at
            ? `队列第 ${item.queue_position} 位 · 预计 ${time(item.estimated_completion_at)} 完成`
            : `队列第 ${item.queue_position} 位 · 暂无历史样本可估算`;
async function api<T = any>(
  path: string,
  options?: ApiRequestOptions,
  captureMeta?: (meta: unknown) => void,
): Promise<T> {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    captureMeta?.(response.meta);
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
      if (state.value === "loading")
        state.value =
          error.kind === "expired"
            ? "expired"
            : error.kind === "forbidden"
              ? "forbidden"
              : error.kind === "rate_limited"
                ? "rate_limited"
                : "error";
      throw error;
    }
    notice.value = "网络连接异常，请稍后重试。";
    if (state.value === "loading") state.value = "error";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  try {
    if (activeView.value === "exports") {
      if (!canReadExports.value) {
        activeView.value = "business";
        await setView("business");
        return;
      }
      exportTasks.value = await api<ExportTask[]>("/report-exports");
      state.value = exportTasks.value.length ? "ready" : "empty";
      return;
    }
    const params = new URLSearchParams({ page: String(page.value), page_size: String(pageSize) });
    if (props.mode === "today") params.set("mine", "true");
    if (status.value) params.set("status", status.value);
    if (query.value) params.set("query", query.value);
    if (sort.value !== "priority_due") params.set("sort", sort.value);
    const [list, sum] = await Promise.all([
      api(`/tasks?${params.toString()}`, undefined, (meta) => {
        total.value = Number((meta as { total?: number } | undefined)?.total ?? 0);
      }),
      api("/tasks/summary"),
    ]);
    tasks.value = list;
    summary.value = sum;
    try {
      memberOptions.value = await api<MemberOption[]>("/tasks/member-options");
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
      memberOptions.value = [];
      notice.value = "任务已加载；组织成员选项暂不可用，转交与指派需稍后重试。";
    }
    state.value = list.length ? "ready" : "empty";
    if (page.value > pageCount.value) {
      await setPage(pageCount.value);
      return;
    }
    if (props.taskId) await openById(props.taskId);
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
async function setView(value: "business" | "exports") {
  if (value === "exports" && !canReadExports.value) return;
  await router.replace({
    query: {
      ...route.query,
      view: value === "exports" ? "exports" : undefined,
      status: undefined,
      page: undefined,
    },
  });
}
async function openById(id: string) {
  try {
    selected.value = await api(`/tasks/${id}`);
    state.value = "ready";
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
async function open(x: Task) {
  await openById(x.id);
}
async function setStatus(value: string) {
  selectedIds.value = [];
  await router.replace({
    query: { ...route.query, status: value || undefined, page: undefined },
  });
}
async function applyFilters(value: { query: string; sort: string }) {
  selectedIds.value = [];
  await router.replace({
    query: {
      ...route.query,
      query: value.query || undefined,
      sort: value.sort === "priority_due" ? undefined : value.sort,
      page: undefined,
    },
  });
}
async function resetFilters() {
  selectedIds.value = [];
  await router.replace({
    query: {
      ...route.query,
      status: undefined,
      query: undefined,
      sort: undefined,
      page: undefined,
    },
  });
}
async function setPage(value: number) {
  selectedIds.value = [];
  await router.replace({
    query: {
      ...route.query,
      page: value > 1 ? String(Math.min(pageCount.value, Math.max(1, value))) : undefined,
    },
  });
}
async function create() {
  if (busy.value || (!editing.value && !canCreate.value) || (editing.value && !canUpdate.value))
    return;
  busy.value = true;
  try {
    const wasEditing = Boolean(editing.value);
    await api(editing.value ? `/tasks/${editing.value.id}` : "/tasks", {
      method: editing.value ? "PATCH" : "POST",
      body: {
        ...form.value,
        ...(editing.value
          ? {
              assignee_id: editing.value.assignee_id,
              expected_version: editing.value.version,
              reason: "更新任务内容",
            }
          : {}),
        due_at: form.value.due_at ? new Date(form.value.due_at).toISOString() : null,
      },
    });
    closeTaskEditor();
    form.value = { title: "", description: "", priority: "normal", due_at: "" };
    notice.value = wasEditing ? "任务已更新。" : "任务已创建，可以立即开始并持续更新进度。";
    await clearQuickCreate();
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
function editTask() {
  if (!selected.value) return;
  editing.value = selected.value;
  form.value = {
    title: selected.value.title,
    description: selected.value.description,
    priority: selected.value.priority,
    due_at: toLocalDateTime(selected.value.due_at),
  };
  showCreate.value = true;
}
function openActionEditor(name: TaskActionEditor) {
  if (!selected.value) return;
  taskActionEditor.value = name;
  taskActionForm.value = {
    reason: "",
    due_at: toLocalDateTime(selected.value.due_at),
    assignee_id: selected.value.assignee_id,
    progress_percent: selected.value.progress_percent ?? 0,
    progress_note: selected.value.progress_note ?? "",
  };
}
function askRemove(task: Task) {
  if (!canUpdate.value) return;
  deleting.value = task;
  deleteReason.value = "";
}
async function removeTask() {
  if (!deleting.value || !deleteReason.value.trim()) return;
  try {
    await api(`/tasks/${deleting.value.id}`, {
      method: "DELETE",
      body: { expected_version: deleting.value.version, reason: deleteReason.value.trim() },
    });
    notice.value = "任务已删除，历史审计记录仍然保留。";
    if (selected.value?.id === deleting.value.id) selected.value = null;
    deleting.value = null;
    deleteReason.value = "";
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
async function action(name: string) {
  if (!selected.value) return;
  if (["pause", "cancel", "delay", "transfer", "progress"].includes(name)) {
    openActionEditor(name as TaskActionEditor);
    return;
  }
  try {
    const result = await api<any>(`/tasks/${selected.value.id}/actions`, {
      method: "POST",
      body: { action: name, expected_version: selected.value.version },
    });
    notice.value =
      name === "complete" && result.auto_score_status === "queued"
        ? "任务已完成，机会重新评分已自动入队。"
        : name === "complete" && result.auto_score_status === "waiting_for_active_rule"
          ? "任务已完成；当前没有活动评分规则，暂未生成评分任务。"
          : "任务动作已记录。";
    await open(selected.value);
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
async function submitTaskAction() {
  if (!selected.value || !taskActionEditor.value) return;
  const actionName = taskActionEditor.value,
    body: Record<string, unknown> = {
      action: actionName,
      expected_version: selected.value.version,
    };
  if (["pause", "cancel", "delay", "transfer"].includes(actionName))
    body.reason = taskActionForm.value.reason.trim();
  if (actionName === "delay") body.due_at = new Date(taskActionForm.value.due_at).toISOString();
  if (actionName === "transfer") body.assignee_id = taskActionForm.value.assignee_id;
  if (actionName === "progress") {
    body.progress_percent = Number(taskActionForm.value.progress_percent);
    body.progress_note = taskActionForm.value.progress_note.trim();
  }
  try {
    await api(`/tasks/${selected.value.id}/actions`, { method: "POST", body });
    notice.value = actionName === "progress" ? "任务进度已更新。" : "任务动作已记录。";
    taskActionEditor.value = null;
    await openById(selected.value.id);
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
function previewBatch(action: BatchTaskAction) {
  if (!canUpdate.value || (action === "transfer" && !canAssign.value)) return;
  batchAction.value = action;
  batchReason.value = "";
  batchDueAt.value = "";
  batchAssigneeId.value = "";
  showBatchImpact.value = true;
}
async function confirmBatch() {
  if (
    !batchEligible.value.length ||
    (["pause", "cancel", "delay", "transfer"].includes(batchAction.value) &&
      !batchReason.value.trim()) ||
    (batchAction.value === "delay" && !batchDueAt.value) ||
    (batchAction.value === "transfer" && !batchAssigneeId.value)
  )
    return;
  busy.value = true;
  let completed = 0,
    failed = 0;
  try {
    for (const task of batchEligible.value) {
      try {
        await api(`/tasks/${task.id}/actions`, {
          method: "POST",
          body: {
            action: batchAction.value,
            expected_version: task.version,
            ...(["pause", "cancel"].includes(batchAction.value)
              ? { reason: batchReason.value.trim() }
              : {}),
            ...(batchAction.value === "delay"
              ? {
                  reason: batchReason.value.trim(),
                  due_at: new Date(batchDueAt.value).toISOString(),
                }
              : {}),
            ...(batchAction.value === "transfer"
              ? { reason: batchReason.value.trim(), assignee_id: batchAssigneeId.value }
              : {}),
          },
        });
        completed += 1;
      } catch (error) {
        if (!(error instanceof ApiClientError)) throw error;
        failed += 1;
      }
    }
    notice.value = `批量操作完成 ${completed} 项，失败 ${failed} 项，跳过 ${batchTargets.value.length - batchEligible.value.length} 项；成功项均保留独立审计记录。`;
    selectedIds.value = [];
    showBatchImpact.value = false;
    await load();
  } finally {
    busy.value = false;
  }
}
async function clearQuickCreate() {
  if (!("create" in route.query) && !("title" in route.query) && !("description" in route.query))
    return;
  await router.replace({
    query: { ...route.query, create: undefined, title: undefined, description: undefined },
  });
}
async function addComment() {
  if (!selected.value || !comment.value.trim()) return;
  try {
    await api(`/tasks/${selected.value.id}/comments`, {
      method: "POST",
      body: { body: comment.value },
    });
    comment.value = "";
    await open(selected.value);
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
onMounted(() => {
  const query = new URLSearchParams(window.location.search);
  showCreate.value = canCreate.value && query.get("create") === "1";
  if (showCreate.value) {
    form.value.title = query.get("title")?.slice(0, 200) ?? "";
    form.value.description = query.get("description")?.slice(0, 5000) ?? "";
  }
  void load();
});

watch(
  () => props.taskId,
  (taskId) => {
    if (taskId) {
      void openById(taskId);
      return;
    }
    selected.value = null;
  },
);
watch(
  () => [
    route.query.status,
    route.query.page,
    route.query.view,
    route.query.query,
    route.query.sort,
  ],
  ([nextStatus, nextPage, nextView, nextQuery, nextSort], previous) => {
    const parsedStatus = ["todo", "in_progress", "paused", "completed", "cancelled"].includes(
      String(nextStatus ?? ""),
    )
      ? String(nextStatus)
      : "";
    const parsedPage = Math.max(1, Number(nextPage) || 1);
    status.value = parsedStatus;
    page.value = parsedPage;
    query.value = String(nextQuery ?? "").slice(0, 200);
    sort.value = ["priority_due", "due_asc", "updated_desc", "created_desc"].includes(
      String(nextSort ?? ""),
    )
      ? String(nextSort)
      : "priority_due";
    activeView.value = props.mode === "all" && nextView === "exports" ? "exports" : "business";
    selectedIds.value = [];
    if (previous) void load();
  },
);
</script>
<template>
  <section class="task-workspace" :class="{ 'task-detail-route': Boolean(taskId) }">
    <div class="task-title">
      <div>
        <p>工作管理</p>
        <h2>{{ mode === "today" ? "今日工作" : "任务中心" }}</h2>
        <span
          >把选品调查、竞品复核、找货和利润确认拆成可运行任务；开始后可更新进度、编辑、删除和查看全过程。</span
        >
      </div>
      <button v-if="canCreate" @click="showCreate = true">＋ 新建任务</button>
    </div>
    <div v-if="notice" class="task-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <nav v-if="mode === 'all'" class="task-view-tabs" aria-label="任务类型">
      <button :aria-pressed="activeView === 'business'" @click="setView('business')">
        业务任务
      </button>
      <button
        v-if="canReadExports"
        :aria-pressed="activeView === 'exports'"
        @click="setView('exports')"
      >
        导出任务
      </button>
    </nav>
    <section v-if="state === 'loading'" class="task-state">正在读取任务…</section>
    <section
      v-else-if="['error', 'forbidden', 'expired', 'rate_limited'].includes(state)"
      class="task-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权访问任务"
              : state === "rate_limited"
                ? "请求过于频繁"
                : "任务服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">重新加载</button>
    </section>
    <template v-else-if="activeView === 'business'"
      ><div class="task-metrics">
        <article>
          <span>我的待处理</span><b>{{ summary.todo }}</b>
        </article>
        <article>
          <span>我的进行中</span><b>{{ summary.in_progress }}</b>
        </article>
        <article>
          <span>我的已暂停</span><b>{{ summary.paused }}</b>
        </article>
        <article class="danger">
          <span>我的已逾期</span><b>{{ summary.overdue }}</b>
        </article>
        <article>
          <span>我的已完成</span><b>{{ summary.completed }}</b>
        </article>
      </div>
      <p v-if="!canUpdate" class="task-readonly-note">
        当前角色可查看工作区任务；新建、选择、批量操作和删除入口按权限隐藏。
      </p>
      <TaskBatchActions
        v-if="canUpdate"
        :open="showBatchImpact"
        :action="batchAction"
        :targets="batchTargets"
        :eligible="batchEligible"
        :members="memberOptions"
        :reason="batchReason"
        :due-at="batchDueAt"
        :assignee-id="batchAssigneeId"
        :busy="busy"
        :can-assign="canAssign"
        @start="previewBatch"
        @close="showBatchImpact = false"
        @confirm="confirmBatch"
        @update:reason="batchReason = $event"
        @update:due-at="batchDueAt = $event"
        @update:assignee-id="batchAssigneeId = $event" />
      <TaskListPanel
        :tasks="visible"
        :selected-ids="selectedIds"
        :status="status"
        :query="query"
        :sort="sort"
        :can-create="canCreate"
        :can-update="canUpdate"
        :route-full-path="route.fullPath"
        :label="label"
        :phase="phase"
        :time="time"
        @update:selected-ids="selectedIds = $event"
        @status="setStatus"
        @apply-filters="applyFilters"
        @reset-filters="resetFilters"
        @create="showCreate = true"
        @remove="askRemove"
    /></template>
    <section v-else class="task-export-jobs">
      <header>
        <div>
          <span>异步工作</span>
          <h3>导出任务</h3>
        </div>
        <RouterLink to="/reports">创建或管理导出</RouterLink>
      </header>
      <div v-if="exportTasks.length">
        <article v-for="item in exportTasks" :key="item.id">
          <i :data-status="item.status">{{ exportStatusLabel(item.status) }}</i>
          <span
            ><strong>{{ exportTypeLabel(item.report_type) }} · CSV</strong
            ><small>{{ exportNextStep(item) }}</small></span
          >
          <span
            ><strong>{{ time(item.updated_at) }}</strong
            ><small>最近更新</small></span
          >
          <RouterLink :to="{ path: '/reports', query: { report: item.report_type } }"
            >查看任务</RouterLink
          >
        </article>
      </div>
      <div v-else class="task-state">
        <h3>尚无导出任务</h3>
        <p>从报表页提交 CSV 导出后，会在这里统一显示处理状态。</p>
      </div>
    </section>
    <nav
      v-if="activeView === 'business' && total > pageSize"
      class="task-pagination"
      aria-label="任务分页"
    >
      <button :disabled="page <= 1" @click="setPage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ total }} 项</span>
      <button :disabled="page >= pageCount" @click="setPage(page + 1)">下一页</button>
    </nav>
    <dialog
      ref="createDialogElement"
      :aria-label="editing ? '编辑任务' : '新建任务'"
      @cancel="handleCreateCancel"
    >
      <form @submit.prevent="create">
        <h3>{{ editing ? "编辑任务" : "新建任务" }}</h3>
        <div class="task-kind-guide">
          <b>这是什么任务？</b
          ><span
            >可以创建“复核热点”“分析亚马逊竞品”“查找货源”“确认利润”等具体工作。创建后点击任务详情，再点击开始运行。</span
          >
        </div>
        <label>标题<input v-model="form.title" required maxlength="200" /></label
        ><label>说明<textarea v-model="form.description" maxlength="5000"></textarea></label
        ><label
          >优先级<select v-model="form.priority">
            <option value="low">低</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="critical">紧急</option>
          </select></label
        ><label>截止时间（可选）<input v-model="form.due_at" type="datetime-local" /></label>
        <p>未指定负责人时分配给当前用户；期限为空时明确显示“未设置”。</p>
        <div>
          <button type="button" :disabled="busy" @click="closeTaskEditor">取消</button
          ><button :disabled="busy">
            {{ busy ? "正在提交…" : editing ? "保存修改" : "创建任务" }}
          </button>
        </div>
      </form>
    </dialog>
    <TaskDetailPanel
      v-if="selected"
      :task="selected"
      :return-path="returnPath"
      :blocking-context="blockingContext"
      :activity="activity"
      :action-editor="taskActionEditor"
      :action-form="taskActionForm"
      :members="memberOptions"
      :comment="comment"
      :label="label"
      :phase="phase"
      :time="time"
      :sla-next="slaNext"
      @action="action"
      @edit="editTask"
      @remove="askRemove"
      @submit-action="submitTaskAction"
      @close-action="taskActionEditor = null"
      @add-comment="addComment"
      @update:comment="comment = $event"
      @update:action-form="taskActionForm = $event"
    />
    <dialog
      ref="deleteDialogElement"
      class="task-delete-dialog"
      aria-label="删除任务"
      @cancel="handleDeleteCancel"
    >
      <form @submit.prevent="removeTask">
        <h3>删除任务</h3>
        <p>将删除“{{ deleting?.title }}”。任务列表不再显示，但审计记录会保留。</p>
        <label
          >删除原因<textarea
            v-model="deleteReason"
            maxlength="500"
            required
            placeholder="请填写删除原因"
          ></textarea>
        </label>
        <div>
          <button type="button" @click="closeDeleteDialog">取消</button
          ><button class="danger" type="submit">确认删除</button>
        </div>
      </form>
    </dialog>
  </section>
</template>
