<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import "../notification-center.css";
import { statusLabel } from "../ui/status-labels";
type State =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "version_conflict";
type Item = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  resource_type: string | null;
  resource_id: string | null;
  root_cause_key: string | null;
  workflow_status: "open" | "in_progress" | "closed";
  action_route: string;
  group_count: number;
  read_at: string | null;
  version: number;
  created_at: string;
};
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref<State>("loading"),
  items = ref<Item[]>([]),
  summary = ref<any>({
    total: 0,
    unread: 0,
    task: 0,
    approval: 0,
    competitor: 0,
    system: 0,
  }),
  selected = ref<Item | null>(null),
  category = ref(""),
  workflowStatus = ref(""),
  unread = ref(false),
  notice = ref(""),
  requestId = ref(""),
  showPreferences = ref(false),
  preferences = ref<any>({
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: true,
    version: 1,
  }),
  busy = ref(false),
  realtimeState = ref<"connecting" | "connected" | "reconnecting">(
    "connecting",
  ),
  visible = computed(() => items.value.filter((item) => !workflowStatus.value || item.workflow_status === workflowStatus.value));
let stream: EventSource | null = null;
const label = (v: string) =>
    (
      ({
        task: "任务",
        approval: "审批",
        competitor: "竞品",
        system: "系统",
      }) as any
    )[v] ?? v,
  time = (v: string) => new Date(v).toLocaleString("zh-CN", { hour12: false });
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
            : r.status === 409
              ? "version_conflict"
              : "error";
    notice.value = b?.error?.action_hint ?? "稍后重试。";
    throw new Error("request_failed");
  }
  return b.data;
}
async function load() {
  state.value = "loading";
  try {
    const q = new URLSearchParams({ page: "1", page_size: "100" });
    if (category.value) q.set("category", category.value);
    if (unread.value) q.set("unread", "true");
    const [list, sum, pref] = await Promise.all([
      api(`/notifications?${q}`),
      api("/notifications/summary"),
      api("/me/notification-preferences"),
    ]);
    items.value = list;
    summary.value = sum;
    preferences.value = pref;
    state.value = list.length ? "ready" : "empty";
  } catch {}
}
async function open(item: Item) {
  try {
    selected.value = await api(`/notifications/${item.id}`);
    if (!item.read_at) {
      await api(`/notifications/${item.id}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action: "read",
          expected_version: item.version,
        }),
      });
      selected.value = {
        ...item,
        read_at: new Date().toISOString(),
        version: item.version + 1,
      };
      await load();
    }
  } catch {}
}
async function markAll() {
  try {
    await api("/notifications/actions", {
      method: "POST",
      body: JSON.stringify({ action: "read_all" }),
    });
    notice.value = "当前工作区通知已全部标记已读。";
    await load();
  } catch {}
}
async function updateWorkflow(action: "start" | "close" | "reopen") {
  if (!selected.value) return;
  try {
    const result = await api(`/notifications/${selected.value.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, expected_version: selected.value.version }),
    });
    selected.value = { ...selected.value, ...result };
    notice.value = action === "start" ? "通知已进入处理中。" : action === "close" ? "通知已关闭。" : "通知已重新打开。";
    await load();
  } catch {}
}
async function savePreferences() {
  busy.value = true;
  try {
    await api("/me/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({
        ...preferences.value,
        expected_version: preferences.value.version,
      }),
    });
    notice.value = "通知偏好已保存；邮件仍为占位投递，不会对外发送。";
    showPreferences.value = false;
    await load();
  } catch {
  } finally {
    busy.value = false;
  }
}
function connectRealtime() {
  const cursor = sessionStorage.getItem("scoutops:last-event-id") ?? "0";
  stream = new EventSource(
    `${props.apiBaseUrl}/realtime/events?last_event_id=${cursor}`,
    { withCredentials: true },
  );
  stream.onopen = () => {
    realtimeState.value = "connected";
  };
  stream.onerror = () => {
    realtimeState.value = "reconnecting";
  };
  stream.addEventListener("notification.changed", (event) => {
    const message = event as MessageEvent;
    if (message.lastEventId)
      sessionStorage.setItem("scoutops:last-event-id", message.lastEventId);
    void load();
  });
}
onMounted(() => {
  void load();
  connectRealtime();
});
onUnmounted(() => stream?.close());
</script>
<template>
  <section class="notification-center">
    <header>
      <div>
        <p>协作中心</p>
        <h2>通知中心</h2>
        <span>只显示当前组织、工作区和当前用户的事务事件投影。</span>
      </div>
      <div>
        <span class="realtime-badge" :data-state="realtimeState">{{
          realtimeState === "connected"
            ? "实时已连接"
            : realtimeState === "connecting"
              ? "实时连接中"
              : "实时重连中"
        }}</span>
        <button class="secondary" @click="showPreferences = true">
          通知偏好</button
        ><button @click="markAll">全部已读</button>
      </div>
    </header>
    <div v-if="notice" class="notification-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section class="notification-summary">
      <article>
        <span>未读</span><b>{{ summary.unread }}</b>
      </article>
      <article>
        <span>任务</span><b>{{ summary.task }}</b>
      </article>
      <article>
        <span>审批</span><b>{{ summary.approval }}</b>
      </article>
      <article>
        <span>竞品</span><b>{{ summary.competitor }}</b>
      </article>
    </section>
    <nav>
      <button
        v-for="x in [
          { v: '', t: '全部' },
          { v: 'task', t: '任务' },
          { v: 'approval', t: '审批' },
          { v: 'competitor', t: '竞品' },
        ]"
        :key="x.v"
        :aria-pressed="category === x.v"
        @click="
          category = x.v;
          load();
        "
      >
        {{ x.t }}</button
      ><label
        ><input v-model="unread" type="checkbox" @change="load" /> 仅未读</label
      >
    </nav>
    <nav aria-label="处理状态筛选">
      <button v-for="item in [{v:'',t:'全部状态'},{v:'open',t:'未处理'},{v:'in_progress',t:'处理中'},{v:'closed',t:'已关闭'}]" :key="item.v" :aria-pressed="workflowStatus === item.v" @click="workflowStatus = item.v">{{ item.t }}</button>
    </nav>
    <section v-if="state === 'loading'" class="notification-state">
      正在读取通知…
    </section>
    <section
      v-else-if="
        [
          'error',
          'forbidden',
          'expired',
          'rate_limited',
          'version_conflict',
        ].includes(state)
      "
      class="notification-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权读取通知"
              : state === "rate_limited"
                ? "请求过于频繁"
                : state === "version_conflict"
                  ? "通知版本已变化"
                  : "通知服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">重新加载</button>
    </section>
    <section v-else-if="!visible.length" class="notification-state">
      <h3>当前没有通知</h3>
      <p>事务消息尚未投影出面向你的真实事件，系统不会填充示例消息。</p>
    </section>
    <div v-else class="notification-list">
      <button
        v-for="item in visible"
        :key="item.id"
        :class="{ unread: !item.read_at }"
        @click="open(item)"
      >
        <i :data-category="item.category">{{
          label(item.category).slice(0, 1)
        }}</i
        ><span
          ><strong>{{ item.title }}</strong
          ><small>{{ item.body }}</small></span
        ><em>{{ time(item.created_at) }}</em
        ><b>{{ statusLabel(item.workflow_status) }}<small v-if="item.group_count > 1"> · 同根因 {{ item.group_count }} 条</small></b>
      </button>
    </div>
    <aside v-if="selected" class="notification-detail">
      <button @click="selected = null" aria-label="关闭消息详情">×</button>
      <p>{{ label(selected.category) }} · {{ time(selected.created_at) }}</p>
      <h3>{{ selected.title }}</h3>
      <article>{{ selected.body }}</article>
      <p v-if="selected.group_count > 1">同一根因的 {{ selected.group_count }} 条通知已自动合并展示。</p>
      <dl>
        <div>
          <dt>来源类型</dt>
          <dd>{{ selected.resource_type || "未提供" }}</dd>
        </div>
        <div>
          <dt>来源标识</dt>
          <dd>{{ selected.resource_id || "未提供" }}</dd>
        </div>
        <div>
          <dt>严重程度</dt>
          <dd>{{ selected.severity }}</dd>
        </div>
      </dl>
      <small
        >站内消息来自事务消息；页面不显示队列、浏览器凭证或邮件地址。</small
      >
      <footer class="notification-workflow-actions">
        <a :href="selected.action_route">定位异常记录</a>
        <button v-if="selected.workflow_status === 'open'" type="button" @click="updateWorkflow('start')">开始处理</button>
        <button v-if="selected.workflow_status !== 'closed'" type="button" @click="updateWorkflow('close')">关闭</button>
        <button v-else type="button" @click="updateWorkflow('reopen')">重新打开</button>
      </footer>
    </aside>
    <dialog :open="showPreferences">
      <form @submit.prevent="savePreferences">
        <h3>通知偏好</h3>
        <label
          ><input v-model="preferences.in_app_enabled" type="checkbox" />
          站内通知</label
        ><label
          ><input v-model="preferences.email_enabled" type="checkbox" />
          邮件占位（当前不会发送）</label
        ><label
          ><input v-model="preferences.task_enabled" type="checkbox" />
          任务事件</label
        ><label
          ><input v-model="preferences.approval_enabled" type="checkbox" />
          审批事件</label
        ><label
          ><input v-model="preferences.competitor_enabled" type="checkbox" />
          竞品事件</label
        >
        <p>
          启用邮件只产生 pending_placeholder 记录，接入真实 Provider
          前不会向外部发送。
        </p>
        <div>
          <button
            type="button"
            class="secondary"
            @click="showPreferences = false"
          >
            取消</button
          ><button :disabled="busy">保存</button>
        </div>
      </form>
    </dialog>
  </section>
</template>
