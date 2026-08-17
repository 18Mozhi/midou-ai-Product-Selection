<script setup lang="ts">
import { onMounted, ref } from "vue";
import "../automation-rules.css";
type Rule = {
  id: string;
  name: string;
  trigger_event_type: string;
  condition_severity: string;
  action_type: string;
  owner_id: string;
  action_assignee_id: string | null;
  action_title: string;
  rate_limit_count: number;
  rate_limit_window_minutes: number;
  status: string;
  version: number;
  updated_at: string;
};
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref("loading"),
  rules = ref<Rule[]>([]),
  selected = ref<any>(null),
  notice = ref(""),
  requestId = ref(""),
  showCreate = ref(false),
  busy = ref(false),
  form = ref({
    name: "",
    trigger_event_type: "approval.overdue",
    condition_severity: "any",
    action_type: "notify_owner",
    owner_id: "",
    action_assignee_id: "",
    action_title: "",
    rate_limit_count: 20,
    rate_limit_window_minutes: 60,
  });
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
    rules.value = await api("/automations");
    state.value = rules.value.length ? "ready" : "empty";
  } catch {}
}
async function open(rule: Rule) {
  try {
    selected.value = await api(`/automations/${rule.id}`);
  } catch {}
}
async function create() {
  busy.value = true;
  try {
    await api("/automations", {
      method: "POST",
      body: JSON.stringify({
        ...form.value,
        action_assignee_id:
          form.value.action_type === "create_task"
            ? form.value.action_assignee_id
            : null,
      }),
    });
    showCreate.value = false;
    notice.value = "自动化规则已启用；动作仍需人工处理。";
    await load();
  } catch {
  } finally {
    busy.value = false;
  }
}
async function status(rule: Rule) {
  busy.value = true;
  try {
    await api(`/automations/${rule.id}/actions`, {
      method: "POST",
      body: JSON.stringify({
        action: rule.status === "active" ? "pause" : "resume",
        expected_version: rule.version,
        reason:
          rule.status === "active"
            ? "由规则管理页人工暂停"
            : "由规则管理页人工恢复",
      }),
    });
    notice.value =
      rule.status === "active" ? "规则已人工暂停。" : "规则已恢复。";
    selected.value = null;
    await load();
  } catch {
  } finally {
    busy.value = false;
  }
}
const trigger = (v: string) =>
    (
      ({
        "approval.overdue": "审批节点超时",
        "approval.node.rejected": "审批被驳回",
        "competitor.alert.queued": "竞品告警入队",
        "task.created": "任务创建",
      }) as any
    )[v] ?? v,
  action = (v: string) =>
    v === "notify_owner" ? "通知负责人" : "创建人工任务";
onMounted(load);
</script>
<template>
  <section class="automation-center">
    <header>
      <div>
        <p>COLLABORATION</p>
        <h2>自动化规则</h2>
        <span
          >以已落库事务事件触发安全动作；不会自动审批、推荐或变更业务事实。</span
        >
      </div>
      <button @click="showCreate = true">创建规则</button>
    </header>
    <div v-if="notice" class="automation-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section v-if="state === 'loading'" class="automation-state">
      正在读取规则…
    </section>
    <section
      v-else-if="
        [
          'error',
          'expired',
          'forbidden',
          'rate_limited',
          'version_conflict',
        ].includes(state)
      "
      class="automation-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权管理自动化"
              : state === "rate_limited"
                ? "请求过于频繁"
                : state === "version_conflict"
                  ? "规则版本已变化"
                  : "规则服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">重新加载</button>
    </section>
    <section v-else-if="!rules.length" class="automation-state">
      <h3>尚未创建规则</h3>
      <p>系统不会预置会改变业务结果的自动动作。</p>
    </section>
    <div v-else class="automation-grid">
      <article v-for="rule in rules" :key="rule.id" :data-status="rule.status">
        <div>
          <i>{{ rule.status === "active" ? "运行中" : "已暂停" }}</i
          ><small>v{{ rule.version }}</small>
        </div>
        <h3>{{ rule.name }}</h3>
        <p>
          {{ trigger(rule.trigger_event_type) }} →
          {{ action(rule.action_type) }}
        </p>
        <dl>
          <div>
            <dt>条件</dt>
            <dd>{{ rule.condition_severity }}</dd>
          </div>
          <div>
            <dt>限流</dt>
            <dd>
              {{ rule.rate_limit_count }} /
              {{ rule.rate_limit_window_minutes }} 分钟
            </dd>
          </div>
        </dl>
        <footer>
          <button class="secondary" @click="open(rule)">执行记录</button
          ><button :disabled="busy" @click="status(rule)">
            {{ rule.status === "active" ? "暂停" : "恢复" }}
          </button>
        </footer>
      </article>
    </div>
    <aside v-if="selected" class="automation-detail">
      <button aria-label="关闭执行记录" @click="selected = null">×</button>
      <p>AUTOMATION HISTORY</p>
      <h3>{{ selected.name }}</h3>
      <ul v-if="selected.executions?.length">
        <li v-for="x in selected.executions" :key="x.id">
          <b>{{ x.status }}</b
          ><span
            >规则 v{{ x.rule_version }} · 尝试 {{ x.attempt_count }} 次</span
          ><small
            >{{ x.action_resource_type || "无动作资源" }}
            {{ x.action_resource_id || x.last_error_code || "" }}</small
          >
        </li>
      </ul>
      <p v-else>尚无匹配事件，未执行任何动作。</p>
    </aside>
    <dialog :open="showCreate">
      <form @submit.prevent="create">
        <h3>创建自动化规则</h3>
        <label
          >规则名称<input v-model="form.name" required maxlength="200" /></label
        ><label
          >触发事件<select v-model="form.trigger_event_type">
            <option value="approval.overdue">审批节点超时</option>
            <option value="approval.node.rejected">审批被驳回</option>
            <option value="competitor.alert.queued">竞品告警入队</option>
            <option value="task.created">任务创建</option>
          </select></label
        ><label
          >严重程度<select v-model="form.condition_severity">
            <option value="any">任意</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select></label
        ><label
          >动作<select v-model="form.action_type">
            <option value="notify_owner">通知负责人</option>
            <option
              v-if="!form.trigger_event_type.startsWith('task.')"
              value="create_task"
            >
              创建人工任务
            </option>
          </select></label
        ><label
          >规则负责人 UUID<input
            v-model="form.owner_id"
            required
            pattern="[0-9a-fA-F-]{36}" /></label
        ><label v-if="form.action_type === 'create_task'"
          >任务负责人 UUID<input
            v-model="form.action_assignee_id"
            required
            pattern="[0-9a-fA-F-]{36}" /></label
        ><label
          >动作标题<input v-model="form.action_title" required maxlength="200"
        /></label>
        <div class="automation-pair">
          <label
            >最多执行次数<input
              v-model.number="form.rate_limit_count"
              type="number"
              min="1"
              max="1000" /></label
          ><label
            >时间窗（分钟）<input
              v-model.number="form.rate_limit_window_minutes"
              type="number"
              min="1"
              max="1440"
          /></label>
        </div>
        <p>
          规则只消费真实通知投影；任务动作会标记 automation 来源并留存审计。
        </p>
        <footer>
          <button type="button" class="secondary" @click="showCreate = false">
            取消</button
          ><button :disabled="busy">创建并启用</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
