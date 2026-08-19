<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import "../task-workspace.css";
type State =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "expired"
  | "rate_limited";
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
  version: number;
  comments?: any[];
  events?: any[];
};
const props = defineProps<{ apiBaseUrl: string; mode: "today" | "all" }>(),
  state = ref<State>("loading"),
  tasks = ref<Task[]>([]),
  summary = ref<any>({
    todo: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  }),
  selected = ref<Task | null>(null),
  status = ref(""),
  notice = ref(""),
  requestId = ref(""),
  showCreate = ref(false),
  form = ref({ title: "", description: "", priority: "normal", due_at: "" }),
  comment = ref("");
const visible = computed(() =>
    tasks.value.filter((x) => !status.value || x.status === status.value),
  ),
  label = (v: string) =>
    (
      ({
        todo: "待处理",
        in_progress: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        overdue: "已逾期",
        due_soon: "24 小时内到期",
        on_track: "按期",
        not_set: "未设置期限",
      }) as any
    )[v] ?? v,
  time = (v: string | null) =>
    v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未设置";
async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${props.apiBaseUrl}${path}`, {
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init?.method && init.method !== "GET"
          ? { "idempotency-key": crypto.randomUUID() }
          : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    }),
    b = await r.json().catch(() => null);
  requestId.value = b?.request_id ?? "";
  if (!r.ok) {
    state.value =
      r.status === 401
        ? "expired"
        : r.status === 403
          ? "forbidden"
          : r.status === 429
            ? "rate_limited"
            : "error";
    notice.value = b?.error?.action_hint ?? "稍后重试。";
    throw new Error("request_failed");
  }
  return b.data;
}
async function load() {
  state.value = "loading";
  try {
    const mine = props.mode === "today" ? "&mine=true" : "",
      [list, sum] = await Promise.all([
        api(`/tasks?page=1&page_size=50${mine}`),
        api("/tasks/summary"),
      ]);
    tasks.value = list;
    summary.value = sum;
    state.value = list.length ? "ready" : "empty";
  } catch {}
}
async function open(x: Task) {
  try {
    selected.value = await api(`/tasks/${x.id}`);
    state.value = "ready";
  } catch {}
}
async function create() {
  try {
    await api("/tasks", {
      method: "POST",
      body: JSON.stringify({
        ...form.value,
        due_at: form.value.due_at
          ? new Date(form.value.due_at).toISOString()
          : null,
      }),
    });
    showCreate.value = false;
    form.value = { title: "", description: "", priority: "normal", due_at: "" };
    notice.value = "任务已创建并写入审计与事件队列。";
    await load();
  } catch {}
}
async function action(name: string) {
  if (!selected.value) return;
  const body: any = { action: name, expected_version: selected.value.version };
  if (["cancel", "delay", "transfer"].includes(name)) {
    body.reason = window.prompt("请输入原因")?.trim();
    if (!body.reason) return;
  }
  if (name === "delay") {
    const d = window.prompt("新的截止时间（ISO 8601）");
    if (!d) return;
    body.due_at = d;
  }
  if (name === "transfer") {
    body.assignee_id = window.prompt("接收成员 UUID")?.trim();
    if (!body.assignee_id) return;
  }
  try {
    await api(`/tasks/${selected.value.id}/actions`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    notice.value = "任务动作已记录。";
    await open(selected.value);
    await load();
  } catch {}
}
async function addComment() {
  if (!selected.value || !comment.value.trim()) return;
  try {
    await api(`/tasks/${selected.value.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: comment.value }),
    });
    comment.value = "";
    await open(selected.value);
  } catch {}
}
onMounted(() => {
  showCreate.value =
    new URLSearchParams(window.location.search).get("create") === "1";
  void load();
});
</script>
<template>
  <section class="task-workspace">
    <div class="task-title">
      <div>
        <p>工作管理</p>
        <h2>{{ mode === "today" ? "今日工作" : "任务中心" }}</h2>
        <span>任务事实、负责人、期限、评论与转交均来自当前工作区后端。</span>
      </div>
      <button @click="showCreate = true">＋ 新建任务</button>
    </div>
    <div v-if="notice" class="task-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section v-if="state === 'loading'" class="task-state">
      正在读取任务…
    </section>
    <section
      v-else-if="
        ['error', 'forbidden', 'expired', 'rate_limited'].includes(state)
      "
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
            { v: 'completed', t: '已完成' },
          ]"
          :key="x.v"
          :aria-pressed="status === x.v"
          @click="status = x.v"
        >
          {{ x.t }}
        </button>
      </div>
      <section v-if="!visible.length" class="task-state">
        <h3>当前没有任务</h3>
        <p>创建任务后会在此显示；系统不会填充示例业务数据。</p>
      </section>
      <div v-else class="task-list">
        <button v-for="x in visible" :key="x.id" @click="open(x)">
          <i :data-priority="x.priority"></i
          ><span
            ><strong>{{ x.title }}</strong
            ><small>{{ x.description || "无补充说明" }}</small></span
          ><em>{{ label(x.status) }}</em
          ><span
            ><strong>{{ label(x.sla_status) }}</strong
            ><small>{{ time(x.due_at) }}</small></span
          ><b>查看 →</b>
        </button>
      </div></template
    >
    <dialog :open="showCreate">
      <form @submit.prevent="create">
        <h3>新建任务</h3>
        <label
          >标题<input v-model="form.title" required maxlength="200" /></label
        ><label
          >说明<textarea
            v-model="form.description"
            maxlength="5000"
          ></textarea></label
        ><label
          >优先级<select v-model="form.priority">
            <option value="low">低</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="critical">紧急</option>
          </select></label
        ><label
          >截止时间（可选）<input v-model="form.due_at" type="datetime-local"
        /></label>
        <p>未指定负责人时分配给当前用户；期限为空时明确显示“未设置”。</p>
        <div>
          <button type="button" @click="showCreate = false">取消</button
          ><button>创建</button>
        </div>
      </form>
    </dialog>
    <aside v-if="selected" class="task-detail">
      <button aria-label="关闭任务详情" @click="selected = null">×</button>
      <p>{{ selected.source_type }} · v{{ selected.version }}</p>
      <h3>{{ selected.title }}</h3>
      <span>{{ selected.description || "无补充说明" }}</span>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>{{ label(selected.status) }}</dd>
        </div>
        <div>
          <dt>处理时限</dt>
          <dd>
            {{ label(selected.sla_status) }} · {{ time(selected.due_at) }}
          </dd>
        </div>
        <div>
          <dt>负责人</dt>
          <dd>{{ selected.assignee_id }}</dd>
        </div>
      </dl>
      <div class="task-actions">
        <button v-if="selected.status === 'todo'" @click="action('start')">
          开始</button
        ><button
          v-if="['todo', 'in_progress'].includes(selected.status)"
          @click="action('complete')"
        >
          完成</button
        ><button
          v-if="!['completed', 'cancelled'].includes(selected.status)"
          @click="action('delay')"
        >
          延期</button
        ><button @click="action('transfer')">转交</button>
      </div>
      <section>
        <h4>评论</h4>
        <article v-for="x in selected.comments" :key="x.id">
          <b>{{ x.created_by }}</b>
          <p>{{ x.body }}</p>
          <small>{{ time(x.created_at) }}</small>
        </article>
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
  </section>
</template>
