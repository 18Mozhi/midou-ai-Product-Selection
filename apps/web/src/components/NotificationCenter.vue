<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import "../notification-center.css";
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
  visible = computed(() => items.value);
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
onMounted(load);
</script>
<template>
  <section class="notification-center">
    <header>
      <div>
        <p>COLLABORATION / M05-03</p>
        <h2>通知中心</h2>
        <span>只显示当前组织、工作区和当前用户的事务事件投影。</span>
      </div>
      <div>
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
      <p>Outbox 尚未投影出面向你的真实事件，系统不会填充示例消息。</p>
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
        ><b>{{ item.read_at ? "已读" : "未读" }}</b>
      </button>
    </div>
    <aside v-if="selected" class="notification-detail">
      <button @click="selected = null" aria-label="关闭消息详情">×</button>
      <p>{{ label(selected.category) }} · {{ time(selected.created_at) }}</p>
      <h3>{{ selected.title }}</h3>
      <article>{{ selected.body }}</article>
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
        >站内消息来自事务 Outbox；页面不显示队列、Cookie 或邮件地址。</small
      >
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
