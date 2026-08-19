<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
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
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  items = ref<Item[]>([]),
  summary = ref<any>({
    total: 0,
    unread: 0,
    task: 0,
    approval: 0,
    competitor: 0,
    system: 0,
    open: 0,
    in_progress: 0,
    closed: 0,
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
  );
let stream: EventSource | null = null;
const label = (v: string) =>
    (
      ({
        task: "任务",
        approval: "审批",
        competitor: "竞品",
        system: "系统",
      }) as any
    )[v] ?? "其他",
  resourceLabel = (v: string | null) =>
    (
      ({
        task: "任务",
        approval: "审批",
        approval_request: "审批",
        competitor: "竞品",
        opportunity: "机会",
        collection_task: "采集任务",
      }) as Record<string, string>
    )[v ?? ""] ?? "系统记录",
  severityLabel = (v: string) =>
    (
      ({ info: "一般", warning: "需关注", critical: "紧急" }) as Record<
        string,
        string
      >
    )[v] ?? "待确认",
  displayBody = (item: Item) =>
    /^[a-z][a-z0-9_.-]* 已产生新的可审计事件。$/i.test(item.body)
      ? ({
          approval: "审批状态已变化，请查看关联记录。",
          competitor: "竞品监控状态已变化，请查看关联记录。",
          system: "系统状态已变化，请查看关联记录。",
          task: "任务状态已变化，请查看关联记录。",
        }[item.category] ?? "业务状态已变化，请查看关联记录。")
      : item.body,
  time = (v: string) =>
    new Date(v).toLocaleString("zh-CN", { hour12: false });
async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  affectPageState = true,
) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    if (affectPageState)
      state.value =
        failure?.kind === "conflict"
          ? "version_conflict"
          : failure?.kind === "blocked"
            ? "error"
            : (failure?.kind ?? "error");
    notice.value = failure?.actionHint ?? "稍后重试。";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  try {
    const q = new URLSearchParams({ page: "1", page_size: "100" });
    if (category.value) q.set("category", category.value);
    if (unread.value) q.set("unread", "true");
    if (workflowStatus.value)
      q.set("workflow_status", workflowStatus.value);
    const [list, sum, pref] = await Promise.all([
      api<Item[]>(`/notifications?${q}`),
      api<any>("/notifications/summary"),
      api<any>("/me/notification-preferences"),
    ]);
    items.value = list;
    summary.value = sum;
    preferences.value = { ...pref, email_enabled: false };
    state.value = list.length ? "ready" : "empty";
  } catch {}
}
async function open(item: Item) {
  try {
    const detail = await api<Item>(`/notifications/${item.id}`, {}, false);
    selected.value = detail;
    if (!detail.read_at) {
      const result = await api<Partial<Item>>(
        `/notifications/${item.id}/actions`,
        {
          method: "POST",
          body: {
            action: "read",
            expected_version: detail.version,
          },
        },
        false,
      );
      selected.value = {
        ...detail,
        ...result,
      };
      await load();
    }
  } catch {}
}
async function markAll() {
  try {
    await api("/notifications/actions", { method: "POST" }, false);
    notice.value = "当前工作区通知已全部标记已读。";
    await load();
  } catch {}
}
async function updateWorkflow(action: "start" | "close" | "reopen") {
  if (!selected.value) return;
  try {
    const result = await api<Partial<Item>>(
      `/notifications/${selected.value.id}/actions`,
      {
        method: "POST",
        body: { action, expected_version: selected.value.version },
      },
      false,
    );
    selected.value = { ...selected.value, ...result };
    notice.value =
      action === "start"
        ? "通知已进入处理中。"
        : action === "close"
          ? "通知已关闭。"
          : "通知已重新打开。";
    await load();
  } catch {}
}
async function savePreferences() {
  busy.value = true;
  try {
    await api(
      "/me/notification-preferences",
      {
        method: "PUT",
        body: {
          ...preferences.value,
          email_enabled: false,
          expected_version: preferences.value.version,
        },
      },
      false,
    );
    notice.value = "通知偏好已保存；邮件服务接通前仅使用站内通知。";
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
    <div v-if="notice" class="notification-notice" aria-live="polite">
      {{ notice }}
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>{{ requestId }}</code>
      </details>
    </div>
    <section class="notification-summary">
      <article>
        <span>未读</span><b>{{ summary.unread }}</b>
      </article>
      <article>
        <span>未处理</span><b>{{ summary.open }}</b>
      </article>
      <article>
        <span>处理中</span><b>{{ summary.in_progress }}</b>
      </article>
      <article>
        <span>已关闭</span><b>{{ summary.closed }}</b>
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
      <button
        v-for="item in [
          { v: '', t: '全部状态' },
          { v: 'open', t: '未处理' },
          { v: 'in_progress', t: '处理中' },
          { v: 'closed', t: '已关闭' },
        ]"
        :key="item.v"
        :aria-pressed="workflowStatus === item.v"
        @click="
          workflowStatus = item.v;
          load();
        "
        >{{ item.t }}</button
      >
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
    <section v-else-if="!items.length" class="notification-state">
      <h3>当前没有通知</h3>
      <p>事务消息尚未投影出面向你的真实事件，系统不会填充示例消息。</p>
    </section>
    <div v-else class="notification-list">
      <button
        v-for="item in items"
        :key="item.id"
        :class="{ unread: !item.read_at }"
        @click="open(item)"
      >
        <i :data-category="item.category">{{
          label(item.category).slice(0, 1)
        }}</i
        ><span
          ><strong>{{ item.title }}</strong
          ><small>{{ displayBody(item) }}</small></span
        ><em>{{ time(item.created_at) }}</em
        ><b
          >{{ statusLabel(item.workflow_status)
          }}<small v-if="item.group_count > 1">
            · 同根因 {{ item.group_count }} 条</small
          ></b
        >
      </button>
    </div>
    <aside v-if="selected" class="notification-detail">
      <button @click="selected = null" aria-label="关闭消息详情">×</button>
      <p>{{ label(selected.category) }} · {{ time(selected.created_at) }}</p>
      <h3>{{ selected.title }}</h3>
      <article>{{ displayBody(selected) }}</article>
      <p v-if="selected.group_count > 1">
        同一根因的 {{ selected.group_count }} 条通知已自动合并展示。
      </p>
      <dl>
        <div>
          <dt>关联记录</dt>
          <dd>{{ resourceLabel(selected.resource_type) }}</dd>
        </div>
        <div>
          <dt>严重程度</dt>
          <dd>{{ severityLabel(selected.severity) }}</dd>
        </div>
      </dl>
      <small
        >站内消息来自事务消息；页面不显示队列、浏览器凭证或邮件地址。</small
      >
      <footer class="notification-workflow-actions">
        <a :href="selected.action_route">定位异常记录</a>
        <button
          v-if="selected.workflow_status === 'open'"
          type="button"
          @click="updateWorkflow('start')"
          >开始处理</button
        >
        <button
          v-if="selected.workflow_status !== 'closed'"
          type="button"
          @click="updateWorkflow('close')"
          >关闭</button
        >
        <button v-else type="button" @click="updateWorkflow('reopen')"
          >重新打开</button
        >
      </footer>
      <details
        v-if="
          selected.resource_id ||
          selected.resource_type ||
          selected.root_cause_key
        "
        class="notification-technical"
      >
        <summary>技术详情</summary>
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
            <dt>根因键</dt>
            <dd>{{ selected.root_cause_key || "未提供" }}</dd>
          </div>
        </dl>
      </details>
    </aside>
    <dialog :open="showPreferences">
      <form @submit.prevent="savePreferences">
        <h3>通知偏好</h3>
        <label
          ><input v-model="preferences.in_app_enabled" type="checkbox" />
          站内通知</label
        ><label
          ><input
            v-model="preferences.email_enabled"
            type="checkbox"
            disabled
          />
          邮件通知（服务未接入，暂不可用）</label
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
