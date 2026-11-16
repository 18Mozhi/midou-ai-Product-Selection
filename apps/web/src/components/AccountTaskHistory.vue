<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assignee_id: string;
  source_type: string;
  source_ref_id: string | null;
  due_at: string | null;
  progress_percent: number;
}
interface TaskDetail extends TaskRow {
  version: number;
  priority: "low" | "normal" | "high" | "critical";
  description: string;
  progress_note: string | null;
  collection_task_id: string | null;
  comments: { id: string; body: string; created_by: string; created_at: string | null }[];
  events: { id: string; event_type: string; actor_id: string; created_at: string | null }[];
}
const props = defineProps<{ apiBaseUrl: string }>();
const route = useRoute();
const request = createApiClient(props.apiBaseUrl);
const pageSize = 20;
const rows = ref<TaskRow[]>([]);
const total = ref(0);
const detail = ref<TaskDetail | null>(null);
const listState = ref<"loading" | "ready" | "error">("loading");
const detailState = ref<"loading" | "ready" | "error">("loading");
const listMessage = ref("");
const detailMessage = ref("");
const listRetry = ref(0);
const detailRetry = ref(0);
const actionLabels = {
  start: "开始",
  pause: "暂停",
  resume: "继续",
  complete: "完成",
  cancel: "取消",
  delay: "延期",
  progress: "更新进度",
} as const;
type TaskAction = keyof typeof actionLabels;
const action = ref<TaskAction | "">("");
const reason = ref("");
const dueAt = ref("");
const progress = ref<number | string>("");
const progressNote = ref("");
const comment = ref("");
const writing = ref(false);
const writeError = ref("");
const writeNotice = ref("");
const needsRefresh = ref(false);
const attempt = ref<{ path: string; signature: string; key: string } | null>(null);
const editor = ref<"" | "edit" | "remove">("");
const edit = ref({
  title: "",
  description: "",
  priority: "normal" as TaskDetail["priority"],
  due: "",
  reason: "",
});
const deleteReason = ref("");
const removed = ref(false);
const localDue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Date(date.valueOf() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : "";
};
let viewGeneration = 0;
onBeforeUnmount(() => {
  viewGeneration++;
});
const page = computed(() => {
  const value = Number(route.query.page);
  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= Math.floor(Number.MAX_SAFE_INTEGER / pageSize)
    ? value
    : 1;
});
const taskId = computed(() => (typeof route.query.task === "string" ? route.query.task : ""));
const availableActions = computed<TaskAction[]>(() => {
  if (!detail.value) return [];
  const status = detail.value.status;
  const transition = ({ todo: "start", in_progress: "pause", paused: "resume" } as const)[
    status as "todo" | "in_progress" | "paused"
  ];
  return transition ? [transition, "complete", "cancel", "delay", "progress"] : [];
});
const needsReason = computed(() => ["pause", "cancel", "delay"].includes(action.value));
const taskPath = (n: number, task?: string) => ({
  path: "/tasks/approvals",
  query: {
    view: "account-tasks",
    ...(n > 1 ? { page: String(n) } : {}),
    ...(task ? { task } : {}),
  },
});
const statusText = (status: string) =>
  ({
    todo: "待处理",
    in_progress: "进行中",
    paused: "已暂停",
    completed: "已完成",
    cancelled: "已取消",
  })[status] ?? status;
const timeText = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN") : "未设置";

watch(
  taskId,
  () => {
    viewGeneration++;
    action.value = "";
    reason.value = "";
    dueAt.value = "";
    progress.value = "";
    progressNote.value = "";
    comment.value = "";
    writing.value = false;
    writeError.value = "";
    writeNotice.value = "";
    needsRefresh.value = false;
    attempt.value = null;
    editor.value = "";
    deleteReason.value = "";
    removed.value = false;
  },
  { flush: "sync" },
);

async function submitMutation(
  kind: "actions" | "comments" | "edit" | "remove",
  body: Record<string, unknown>,
) {
  const current = detail.value;
  if (
    !current ||
    current.id.toLowerCase() !== taskId.value.toLowerCase() ||
    writing.value ||
    needsRefresh.value
  )
    return;
  const generation = viewGeneration;
  const method = kind === "edit" ? "PATCH" : kind === "remove" ? "DELETE" : "POST";
  const basePath = `/tasks/${encodeURIComponent(current.id)}`;
  const path = method === "POST" ? `${basePath}/${kind}` : basePath;
  const signature = JSON.stringify([method, body]);
  if (attempt.value && (attempt.value.path !== path || attempt.value.signature !== signature)) {
    writeError.value = "上一次提交结果未确认。请恢复原输入并重试同一操作，避免重复写入。";
    return;
  }
  attempt.value ??= { path, signature, key: crypto.randomUUID() };
  writing.value = true;
  writeError.value = "";
  writeNotice.value = "";
  try {
    await request(path, { method, body, idempotencyKey: attempt.value.key });
    if (generation !== viewGeneration) return;
    attempt.value = null;
    if (kind === "remove") {
      editor.value = "";
      removed.value = true;
      detail.value = null;
      listRetry.value++;
      return;
    }
    if (kind === "edit") editor.value = "";
    if (kind === "comments") comment.value = "";
    else {
      action.value = "";
      reason.value = "";
      dueAt.value = "";
      progress.value = "";
      progressNote.value = "";
      listRetry.value++;
    }
    writeNotice.value =
      kind === "comments" ? "评论已追加。" : kind === "edit" ? "任务已保存。" : "任务动作已保存。";
    detailRetry.value++;
  } catch (error) {
    if (generation !== viewGeneration) return;
    if (
      error instanceof ApiClientError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 425, 429].includes(error.status)
    ) {
      attempt.value = null;
      needsRefresh.value = error.code === "task_version_conflict" || error.status === 404;
      writeError.value = needsRefresh.value
        ? "任务已变化或不可访问。请刷新详情后重新确认。"
        : error.actionHint || error.userMessage;
    } else {
      writeError.value = "提交结果未确认。请保持输入不变并重试；系统会复用同一次提交。";
    }
  } finally {
    if (generation === viewGeneration) writing.value = false;
  }
}

function openEditor(mode: "edit" | "remove") {
  const current = detail.value;
  if (!current || writing.value || needsRefresh.value || attempt.value) return;
  edit.value = {
    title: current.title,
    description: current.description,
    priority: current.priority,
    due: localDue(current.due_at),
    reason: "",
  };
  deleteReason.value = "";
  editor.value = mode;
}
function submitEdit() {
  const current = detail.value,
    draft = edit.value;
  if (!current || !draft.title.trim() || !draft.reason.trim()) return;
  const changedDue = draft.due ? new Date(draft.due) : null;
  if (changedDue && !Number.isFinite(changedDue.valueOf())) {
    writeError.value = "请选择有效截止时间。";
    return;
  }
  void submitMutation("edit", {
    title: draft.title.trim(),
    description: draft.description,
    priority: draft.priority,
    reason: draft.reason.trim(),
    expected_version: current.version,
    due_at:
      draft.due === localDue(current.due_at) ? current.due_at : (changedDue?.toISOString() ?? null),
  });
}
function submitRemove() {
  if (detail.value && deleteReason.value.trim())
    void submitMutation("remove", {
      reason: deleteReason.value.trim(),
      expected_version: detail.value.version,
    });
}

function submitAction() {
  const selected = action.value,
    current = detail.value;
  if (!selected || !current || !availableActions.value.includes(selected)) return;
  const body: Record<string, unknown> = { action: selected, expected_version: current.version };
  if (needsReason.value) {
    if (!reason.value.trim()) {
      writeError.value = "请填写原因。";
      return;
    }
    body.reason = reason.value.trim();
  }
  if (selected === "delay") {
    const date = new Date(dueAt.value);
    if (!Number.isFinite(date.valueOf())) {
      writeError.value = "请选择有效截止时间。";
      return;
    }
    body.due_at = date.toISOString();
  }
  if (selected === "progress") {
    if (
      typeof progress.value !== "number" ||
      !Number.isInteger(progress.value) ||
      progress.value < 0 ||
      progress.value > 100 ||
      !progressNote.value.trim()
    ) {
      writeError.value = "请填写 0–100 的整数进度及进展说明。";
      return;
    }
    body.progress_percent = progress.value;
    body.progress_note = progressNote.value.trim();
  }
  void submitMutation("actions", body);
}
function submitComment() {
  if (comment.value.trim()) void submitMutation("comments", { body: comment.value.trim() });
}
function reloadForReview() {
  needsRefresh.value = false;
  writeError.value = "";
  action.value = "";
  editor.value = "";
  detailRetry.value++;
}

watch(
  [page, listRetry],
  async ([currentPage], _previous, cleanup) => {
    const controller = new AbortController();
    cleanup(() => controller.abort());
    listState.value = "loading";
    rows.value = [];
    total.value = 0;
    try {
      const response = await request<TaskRow[]>(
        `/tasks?page=${currentPage}&page_size=${pageSize}`,
        {
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      rows.value = response.data;
      total.value = (response.meta as { total?: number } | undefined)?.total ?? 0;
      listState.value = "ready";
    } catch (error) {
      if (controller.signal.aborted) return;
      listMessage.value =
        error instanceof ApiClientError ? error.userMessage : "任务列表暂不可用。";
      listState.value = "error";
    }
  },
  { immediate: true },
);

watch(
  [taskId, detailRetry],
  async ([id], _previous, cleanup) => {
    detail.value = null;
    if (!id) return;
    detailState.value = "loading";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      detailMessage.value = "任务编号无效。";
      detailState.value = "error";
      return;
    }
    const controller = new AbortController();
    cleanup(() => controller.abort());
    try {
      const response = await request<TaskDetail>(`/tasks/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      detail.value = response.data;
      detailState.value = "ready";
    } catch (error) {
      if (controller.signal.aborted) return;
      detailMessage.value =
        error instanceof ApiClientError && error.status === 404
          ? "任务不存在或不属于当前账号。"
          : error instanceof ApiClientError
            ? error.userMessage
            : "任务详情暂不可用。";
      detailState.value = "error";
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="account-task-history" aria-labelledby="account-task-heading">
    <h2 id="account-task-heading">已归属的业务任务</h2>
    <p>仅处理当前账号的任务，保留原负责人和历史记录。</p>
    <p v-if="listState === 'loading'" role="status">正在读取任务…</p>
    <div v-else-if="listState === 'error'">
      <p role="alert">{{ listMessage }}</p>
      <button type="button" @click="listRetry++">重试列表</button>
    </div>
    <template v-else>
      <ul v-if="rows.length">
        <li v-for="task in rows" :key="task.id">
          <RouterLink
            :to="taskPath(page, task.id)"
            :aria-current="task.id === taskId ? 'true' : undefined"
          >
            {{ task.title }}
          </RouterLink>
          <span> · {{ statusText(task.status) }} · {{ task.progress_percent }}%</span>
        </li>
      </ul>
      <p v-else>本页没有任务记录。</p>
      <nav aria-label="业务任务分页">
        <RouterLink v-if="page > 1" :to="taskPath(page - 1)">上一页</RouterLink>
        <span>第 {{ page }} 页，共 {{ total }} 条</span>
        <RouterLink v-if="page * pageSize < total" :to="taskPath(page + 1)">下一页</RouterLink>
      </nav>
    </template>

    <section v-if="taskId" aria-label="任务详情">
      <RouterLink :to="taskPath(page)">关闭任务详情</RouterLink>
      <p v-if="removed" role="status">任务已从列表移除，历史记录保留。</p>
      <p v-else-if="detailState === 'loading'" role="status">正在读取任务详情…</p>
      <template v-else-if="detailState === 'error'">
        <p role="alert">{{ detailMessage }}</p>
        <button type="button" @click="detailRetry++">重试详情</button>
      </template>
      <template v-else-if="detail">
        <h3>{{ detail.title }}</h3>
        <p v-if="detail.description">{{ detail.description }}</p>
        <dl>
          <dt>原负责人</dt>
          <dd>
            <code>{{ detail.assignee_id }}</code>
          </dd>
          <dt>截止时间</dt>
          <dd>{{ timeText(detail.due_at) }}</dd>
          <dt>状态</dt>
          <dd>{{ statusText(detail.status) }} · {{ detail.progress_percent }}%</dd>
          <dt v-if="detail.progress_note">进展说明</dt>
          <dd v-if="detail.progress_note">{{ detail.progress_note }}</dd>
          <dt>来源</dt>
          <dd>
            {{ detail.source_type }} <code>{{ detail.source_ref_id }}</code>
          </dd>
          <dt v-if="detail.collection_task_id">关联采集任务</dt>
          <dd v-if="detail.collection_task_id">
            <code>{{ detail.collection_task_id }}</code>
          </dd>
        </dl>
        <h4>历史评论</h4>
        <ul v-if="detail.comments.length">
          <li v-for="comment in detail.comments" :key="comment.id">
            <p>{{ comment.body }}</p>
            <small
              >{{ timeText(comment.created_at) }} · <code>{{ comment.created_by }}</code></small
            >
          </li>
        </ul>
        <p v-else>无历史评论。</p>
        <h4>操作记录</h4>
        <ul v-if="detail.events.length">
          <li v-for="event in detail.events" :key="event.id">
            {{ event.event_type }} · {{ timeText(event.created_at) }} ·
            <code>{{ event.actor_id }}</code>
          </li>
        </ul>
        <p v-else>无操作记录。</p>
        <div v-if="!editor">
          <button
            type="button"
            :disabled="writing || needsRefresh || !!attempt"
            @click="openEditor('edit')"
          >
            编辑任务
          </button>
          <button
            type="button"
            :disabled="writing || needsRefresh || !!attempt"
            @click="openEditor('remove')"
          >
            删除任务
          </button>
        </div>
        <form v-if="editor === 'edit'" @submit.prevent="submitEdit">
          <fieldset :disabled="writing || needsRefresh">
            <legend>编辑任务</legend>
            <label>任务标题 <input v-model="edit.title" required maxlength="200" /></label>
            <label>任务说明 <textarea v-model="edit.description" maxlength="5000" /></label>
            <label
              >优先级
              <select v-model="edit.priority" required>
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
                <option value="critical">紧急</option>
              </select>
            </label>
            <label>截止时间 <input v-model="edit.due" type="datetime-local" /></label>
            <label>编辑原因 <textarea v-model="edit.reason" required maxlength="500" /></label>
            <button type="submit">保存任务</button>
            <button type="button" :disabled="!!attempt" @click="editor = ''">取消编辑</button>
          </fieldset>
        </form>
        <form v-if="editor === 'remove'" @submit.prevent="submitRemove">
          <fieldset :disabled="writing || needsRefresh">
            <legend>删除当前任务</legend>
            <p>仅从任务列表移除，保留原任务、评论和操作记录。</p>
            <label>删除原因 <textarea v-model="deleteReason" required maxlength="500" /></label>
            <button type="submit">确认删除</button>
            <button type="button" :disabled="!!attempt" @click="editor = ''">取消删除</button>
          </fieldset>
        </form>
        <form v-if="availableActions.length" @submit.prevent="submitAction">
          <fieldset :disabled="writing || needsRefresh">
            <legend>任务动作</legend>
            <label
              >选择动作
              <select v-model="action" required>
                <option value="">请选择</option>
                <option v-for="entry in availableActions" :key="entry" :value="entry">
                  {{ actionLabels[entry] }}
                </option>
              </select>
            </label>
            <label v-if="needsReason"
              >原因 <textarea v-model="reason" required maxlength="500" />
            </label>
            <label v-if="action === 'delay'"
              >新的截止时间 <input v-model="dueAt" type="datetime-local" required
            /></label>
            <template v-if="action === 'progress'">
              <label
                >进度百分比
                <input v-model.number="progress" type="number" min="0" max="100" step="1" required
              /></label>
              <label>进展说明 <textarea v-model="progressNote" required maxlength="500" /></label>
            </template>
            <button type="submit" :disabled="!action">确认任务动作</button>
          </fieldset>
        </form>
        <form @submit.prevent="submitComment">
          <fieldset :disabled="writing || needsRefresh">
            <legend>追加评论</legend>
            <label>评论内容 <textarea v-model="comment" required maxlength="2000" /></label>
            <button type="submit" :disabled="!comment.trim()">提交评论</button>
          </fieldset>
        </form>
        <p v-if="writing" role="status">正在提交…</p>
        <p v-if="writeError" role="alert">{{ writeError }}</p>
        <p v-if="writeNotice" role="status">{{ writeNotice }}</p>
        <button v-if="needsRefresh" type="button" @click="reloadForReview">刷新任务详情</button>
      </template>
    </section>
  </section>
</template>

<style scoped>
.account-task-history {
  padding: 1rem;
  overflow-wrap: anywhere;
}
nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
section > section {
  margin-top: 1.5rem;
  border-top: 1px solid currentColor;
  padding-top: 1rem;
}
dd {
  margin: 0 0 0.5rem;
}
li {
  margin-block: 0.5rem;
}
fieldset {
  margin-block: 1rem;
}
label {
  display: grid;
  gap: 0.25rem;
  max-width: 28rem;
  margin-block: 0.5rem;
}
</style>
