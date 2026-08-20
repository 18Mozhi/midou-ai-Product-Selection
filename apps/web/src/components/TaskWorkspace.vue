<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiRequestOptions } from "../api-client";
import "../task-workspace.css";
import "../task-workspace-enhancements.css";
type State = "loading" | "ready" | "empty" | "error" | "forbidden" | "expired" | "rate_limited";
type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
  due_at: string | null;
  sla_status: string;
  source_type: string;
  source_ref_id: string | null;
  collection_task_id: string | null;
  progress_percent: number;
  progress_note: string | null;
  version: number;
  comments?: any[];
  events?: any[];
};
const props = defineProps<{ apiBaseUrl: string; mode: "today" | "all"; taskId?: string }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  tasks = ref<Task[]>([]),
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
    ["todo", "in_progress", "paused", "completed", ""].includes(String(route.query.status ?? ""))
      ? String(route.query.status ?? "")
      : "",
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
  batchAction = ref<"pause" | "resume" | "cancel">("pause"),
  batchReason = ref(""),
  showBatchImpact = ref(false),
  form = ref({ title: "", description: "", priority: "normal", due_at: "" }),
  comment = ref("");
const pageSize = 10,
  visible = computed(() => tasks.value.filter((x) => !status.value || x.status === status.value)),
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
    state.value = "error";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  try {
    const mine = props.mode === "today" ? "&mine=true" : "",
      [list, sum] = await Promise.all([
        api(
          `/tasks?page=${page.value}&page_size=${pageSize}${mine}${status.value ? `&status=${status.value}` : ""}`,
          undefined,
          (meta) => {
            total.value = Number((meta as { total?: number } | undefined)?.total ?? 0);
          },
        ),
        api("/tasks/summary"),
      ]);
    tasks.value = list;
    summary.value = sum;
    state.value = list.length ? "ready" : "empty";
    if (props.taskId) await openById(props.taskId);
  } catch {}
}
async function openById(id: string) {
  try {
    selected.value = await api(`/tasks/${id}`);
    state.value = "ready";
  } catch {}
}
async function open(x: Task) {
  await openById(x.id);
}
async function setStatus(value: string) {
  await router.replace({
    query: { ...route.query, status: value || undefined, page: undefined },
  });
}
async function setPage(value: number) {
  await router.replace({
    query: {
      ...route.query,
      page: value > 1 ? String(Math.min(pageCount.value, Math.max(1, value))) : undefined,
    },
  });
}
async function create() {
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
    showCreate.value = false;
    editing.value = null;
    form.value = { title: "", description: "", priority: "normal", due_at: "" };
    notice.value = wasEditing ? "任务已更新。" : "任务已创建，可以立即开始并持续更新进度。";
    await load();
  } catch {}
}
function editTask() {
  if (!selected.value) return;
  editing.value = selected.value;
  form.value = {
    title: selected.value.title,
    description: selected.value.description,
    priority: selected.value.priority,
    due_at: selected.value.due_at ? new Date(selected.value.due_at).toISOString().slice(0, 16) : "",
  };
  showCreate.value = true;
}
async function updateProgress() {
  if (!selected.value) return;
  const raw = window.prompt(
    "请输入完成进度（0-100）",
    String(selected.value.progress_percent ?? 0),
  );
  if (raw === null) return;
  const progress = Number(raw);
  const note = window.prompt("本次进展说明")?.trim();
  if (!note) return;
  try {
    await api(`/tasks/${selected.value.id}/actions`, {
      method: "POST",
      body: {
        action: "progress",
        expected_version: selected.value.version,
        progress_percent: progress,
        progress_note: note,
      },
    });
    notice.value = "任务进度已更新。";
    await open(selected.value);
    await load();
  } catch {}
}
function askRemove(task: Task) {
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
  } catch {}
}
async function action(name: string) {
  if (!selected.value) return;
  const body: any = { action: name, expected_version: selected.value.version };
  if (["pause", "cancel", "delay", "transfer"].includes(name)) {
    body.reason = window.prompt("请输入原因")?.trim();
    if (!body.reason) return;
  }
  if (name === "delay") {
    const d = window.prompt("新的截止时间（ISO 8601）");
    if (!d) return;
    body.due_at = d;
  }
  if (name === "transfer") {
    body.assignee_id = window.prompt("请输入接收成员的账号编号")?.trim();
    if (!body.assignee_id) return;
  }
  try {
    await api(`/tasks/${selected.value.id}/actions`, {
      method: "POST",
      body,
    });
    notice.value = "任务动作已记录。";
    await open(selected.value);
    await load();
  } catch {}
}
function previewBatch(action: "pause" | "resume" | "cancel") {
  batchAction.value = action;
  batchReason.value = "";
  showBatchImpact.value = true;
}
async function confirmBatch() {
  if (
    !batchEligible.value.length ||
    (["pause", "cancel"].includes(batchAction.value) && !batchReason.value.trim())
  )
    return;
  busy.value = true;
  let completed = 0;
  try {
    for (const task of batchEligible.value) {
      await api(`/tasks/${task.id}/actions`, {
        method: "POST",
        body: {
          action: batchAction.value,
          expected_version: task.version,
          ...(["pause", "cancel"].includes(batchAction.value)
            ? { reason: batchReason.value.trim() }
            : {}),
        },
      });
      completed += 1;
    }
    notice.value = `批量操作已完成 ${completed} 项；每项均保留独立审计记录。`;
    selectedIds.value = [];
    showBatchImpact.value = false;
    await load();
  } finally {
    busy.value = false;
  }
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
  } catch {}
}
onMounted(() => {
  const query = new URLSearchParams(window.location.search);
  showCreate.value = query.get("create") === "1";
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
  () => [route.query.status, route.query.page],
  ([nextStatus, nextPage], previous) => {
    const parsedStatus = ["todo", "in_progress", "paused", "completed"].includes(
      String(nextStatus ?? ""),
    )
      ? String(nextStatus)
      : "";
    const parsedPage = Math.max(1, Number(nextPage) || 1);
    status.value = parsedStatus;
    page.value = parsedPage;
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
      <button @click="showCreate = true">＋ 新建任务</button>
    </div>
    <div v-if="notice" class="task-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
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
    <template v-else
      ><div class="task-metrics">
        <article>
          <span>待处理</span><b>{{ summary.todo }}</b>
        </article>
        <article>
          <span>进行中</span><b>{{ summary.in_progress }}</b>
        </article>
        <article class="danger">
          <span>已逾期</span><b>{{ summary.overdue }}</b>
        </article>
        <article>
          <span>已完成</span><b>{{ summary.completed }}</b>
        </article>
      </div>
      <div class="task-filter">
        <button
          v-for="x in [
            { v: '', t: '全部' },
            { v: 'todo', t: '待处理' },
            { v: 'in_progress', t: '进行中' },
            { v: 'paused', t: '已暂停' },
            { v: 'completed', t: '已完成' },
          ]"
          :key="x.v"
          :aria-pressed="status === x.v"
          @click="setStatus(x.v)"
        >
          {{ x.t }}
        </button>
      </div>
      <div v-if="selectedIds.length" class="task-batch-bar">
        <span>已选 {{ selectedIds.length }} 项</span>
        <button type="button" @click="previewBatch('pause')">批量暂停</button>
        <button type="button" @click="previewBatch('resume')">批量继续</button>
        <button type="button" class="danger" @click="previewBatch('cancel')">批量取消</button>
      </div>
      <section v-if="!visible.length" class="task-state">
        <h3>当前没有任务</h3>
        <p>创建任务后会在此显示；系统不会填充示例业务数据。</p>
      </section>
      <div v-else class="task-list">
        <article v-for="x in visible" :key="x.id">
          <label class="task-row-select"
            ><input v-model="selectedIds" type="checkbox" :value="x.id" /><span class="sr-only"
              >选择任务：{{ x.title }}</span
            ></label
          >
          <RouterLink
            class="task-row-main"
            :to="{ path: `/tasks/${x.id}`, query: { from: route.fullPath } }"
          >
            <i :data-priority="x.priority"></i
            ><span
              ><strong>{{ x.title }}</strong
              ><small>{{ x.description || "无补充说明" }}</small></span
            ><em>{{ label(x.status) }}</em
            ><span class="task-progress"
              ><b>{{ phase(x) }}</b
              ><i><u :style="{ width: `${x.progress_percent || 0}%` }"></u></i></span
            ><span
              ><strong>{{ label(x.sla_status) }}</strong
              ><small>{{ time(x.due_at) }}</small></span
            ><b>查看详情 →</b>
          </RouterLink>
          <details class="task-row-actions">
            <summary :aria-label="`任务操作：${x.title}`">•••</summary>
            <button type="button" @click="askRemove(x)">删除任务</button>
          </details>
        </article>
      </div></template
    >
    <nav v-if="total > pageSize" class="task-pagination" aria-label="任务分页">
      <button :disabled="page <= 1" @click="setPage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ total }} 项</span>
      <button :disabled="page >= pageCount" @click="setPage(page + 1)">下一页</button>
    </nav>
    <dialog :open="showCreate">
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
          <button
            type="button"
            @click="
              showCreate = false;
              editing = null;
            "
          >
            取消</button
          ><button>{{ editing ? "保存修改" : "创建任务" }}</button>
        </div>
      </form>
    </dialog>
    <aside v-if="selected" class="task-detail">
      <RouterLink :to="returnPath" aria-label="关闭任务详情">×</RouterLink>
      <p>
        {{ selected.source_type === "manual" ? "手动创建" : "系统生成" }} · 第
        {{ selected.version }} 版
      </p>
      <h3>{{ selected.title }}</h3>
      <span>{{ selected.description || "无补充说明" }}</span>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>{{ label(selected.status) }}</dd>
        </div>
        <div>
          <dt>当前阶段</dt>
          <dd>{{ phase(selected) }} · {{ selected.progress_note || "尚未记录进展" }}</dd>
        </div>
        <div>
          <dt>处理时限</dt>
          <dd>
            {{ label(selected.sla_status) }} · {{ time(selected.due_at) }}<br />
            <small>{{ slaNext(selected) }}</small>
          </dd>
        </div>
        <div>
          <dt>负责人</dt>
          <dd>已分配负责人</dd>
        </div>
        <div>
          <dt>底层采集任务</dt>
          <dd v-if="selected.collection_task_id">
            <RouterLink :to="`/platform-admin/collection?task=${selected.collection_task_id}`"
              >查看关联采集任务</RouterLink
            >
          </dd>
          <dd v-else>当前业务任务未关联采集任务</dd>
        </div>
      </dl>
      <details class="task-technical">
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>负责人账号编号</dt>
            <dd>{{ selected.assignee_id }}</dd>
          </div>
          <div>
            <dt>任务编号</dt>
            <dd>{{ selected.id }}</dd>
          </div>
        </dl>
      </details>
      <div class="task-actions">
        <button v-if="selected.status === 'todo'" @click="action('start')">开始</button
        ><button v-if="selected.status === 'in_progress'" @click="action('pause')">暂停</button
        ><button v-if="selected.status === 'paused'" @click="action('resume')">继续</button
        ><button
          v-if="['todo', 'in_progress', 'paused'].includes(selected.status)"
          @click="action('complete')"
        >
          完成</button
        ><button
          v-if="!['completed', 'cancelled'].includes(selected.status)"
          @click="action('delay')"
        >
          延期</button
        ><button
          v-if="!['completed', 'cancelled'].includes(selected.status)"
          class="danger"
          @click="action('cancel')"
        >
          取消任务</button
        ><button @click="action('transfer')">转交</button>
        <button @click="updateProgress">更新进度</button><button @click="editTask">编辑</button>
        <details class="task-detail-more">
          <summary>更多任务操作</summary>
          <button class="danger" type="button" @click="askRemove(selected)">删除任务</button>
        </details>
      </div>
      <section class="task-activity">
        <h4>任务活动</h4>
        <article v-for="x in activity" :key="`${x.kind}-${x.id}`" :data-kind="x.kind">
          <b>{{ x.title }}</b>
          <p>{{ x.body }}</p>
          <small>{{ time(x.created_at) }}</small>
        </article>
        <p v-if="!activity.length">暂无任务活动。</p>
        <form @submit.prevent="addComment">
          <textarea
            v-model="comment"
            placeholder="添加可审计评论"
            required
            maxlength="2000"
          ></textarea
          ><button>添加评论</button>
        </form>
      </section>
    </aside>
    <dialog :open="showBatchImpact" class="task-batch-impact">
      <form @submit.prevent="confirmBatch">
        <h3>
          确认批量{{
            batchAction === "pause" ? "暂停" : batchAction === "resume" ? "继续" : "取消"
          }}
        </h3>
        <p>影响范围会在执行前固定；不符合当前状态的任务不会被修改。</p>
        <dl>
          <div>
            <dt>已选择</dt>
            <dd>{{ batchTargets.length }} 项</dd>
          </div>
          <div>
            <dt>可执行</dt>
            <dd>{{ batchEligible.length }} 项</dd>
          </div>
          <div>
            <dt>跳过</dt>
            <dd>{{ batchTargets.length - batchEligible.length }} 项</dd>
          </div>
          <div>
            <dt>关联采集任务</dt>
            <dd>
              {{ batchEligible.filter((item) => item.collection_task_id).length }}
              项（仅展示关联，不联动取消底层任务）
            </dd>
          </div>
        </dl>
        <label v-if="batchAction !== 'resume'"
          >操作原因<textarea v-model="batchReason" required maxlength="500"></textarea>
        </label>
        <div>
          <button type="button" @click="showBatchImpact = false">返回</button
          ><button :disabled="busy || !batchEligible.length">确认执行</button>
        </div>
      </form>
    </dialog>
    <dialog :open="Boolean(deleting)" class="task-delete-dialog">
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
          <button
            type="button"
            @click="
              deleting = null;
              deleteReason = '';
            "
          >
            取消</button
          ><button class="danger" type="submit">确认删除</button>
        </div>
      </form>
    </dialog>
  </section>
</template>
