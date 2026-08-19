<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
type State =
  "loading" | "ready" | "empty" | "error" | "forbidden" | "expired" | "blocked";
interface AuditEvent {
  id: string;
  organization_id: string | null;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: "succeeded" | "failed" | "blocked";
  request_id: string;
  trace_id: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  schema_version: 1;
}
interface Authorization {
  organization_id: string;
  capabilities: string[];
  platform_capabilities?: string[];
}
const state = ref<State>("loading"),
  events = ref<AuditEvent[]>([]),
  selected = ref<AuditEvent | null>(null),
  auth = ref<Authorization | null>(null),
  requestId = ref(""),
  scope = ref<"platform" | "organization">("platform"),
  action = ref(""),
  outcome = ref(""),
  resourceType = ref(""),
  nextCursor = ref<string | null>(null);
const isPlatform = computed(() => scope.value === "platform");
const canPlatform = computed(
  () => auth.value?.platform_capabilities?.includes("audit:read") ?? false,
);
async function request<T>(path: string) {
  const response = await fetch(`${props.apiBaseUrl}${path}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    }),
    body = await response.json().catch(() => null);
  if (!response.ok) {
    requestId.value = body?.request_id ?? "";
    throw new Error(
      response.status === 401
        ? "expired"
        : response.status === 403
          ? "forbidden"
          : response.status === 409
            ? "blocked"
            : "error",
    );
  }
  return body as { data: T };
}
function query(cursor?: string) {
  const q = new URLSearchParams({ limit: "50" });
  if (action.value) q.set("action", action.value);
  if (outcome.value) q.set("outcome", outcome.value);
  if (resourceType.value) q.set("resource_type", resourceType.value);
  if (cursor) q.set("cursor", cursor);
  return q.toString();
}
async function load(cursor?: string) {
  state.value = "loading";
  try {
    if (!auth.value)
      auth.value = (await request<Authorization>("/me/authorization")).data;
    if (scope.value === "platform" && !canPlatform.value)
      scope.value = "organization";
    const path = isPlatform.value
      ? `/platform/audit-events?${query(cursor)}`
      : `/organizations/${auth.value.organization_id}/audit-events?${query(cursor)}`;
    const result = (
      await request<{ items: AuditEvent[]; nextCursor: string | null }>(path)
    ).data;
    events.value = cursor ? [...events.value, ...result.items] : result.items;
    nextCursor.value = result.nextCursor;
    selected.value = events.value[0] ?? null;
    state.value = events.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = (error instanceof Error ? error.message : "error") as State;
  }
}
function switchScope(value: "platform" | "organization") {
  scope.value = value;
  events.value = [];
  void load();
}
const outcomeLabel = (value: string) =>
  ({ succeeded: "成功", failed: "失败", blocked: "已阻止" })[value] ?? value;
onMounted(() => load());
</script>
<template>
  <main class="audit-page" data-testid="audit-security">
    <aside>
      <a href="/" class="brand"><b>选</b>智能选品</a>
      <p>安全与治理</p>
      <nav>
        <a class="active" href="/?view=audit-security">审计日志</a
        ><a href="/security/mfa">安全设置</a><span>平台管理员</span
        ><span>密钥轮换</span>
      </nav>
      <small>只读视图 · 关联编号 / 链路编号</small>
    </aside>
    <section class="main">
      <header>
        <div>
          <p>审计与安全</p>
          <h1>审计与种子管理员</h1>
          <span
            >首次超级管理员只允许由宝塔受限任务创建；浏览器不接触种子密码。</span
          >
        </div>
        <div class="seed-badge">
          <i></i><span>单次种子</span><strong>仅限命令行</strong>
        </div>
      </header>
      <section class="scope-tabs">
        <button
          v-if="canPlatform"
          :class="{ active: isPlatform }"
          @click="switchScope('platform')"
        >
          平台审计</button
        ><button
          :class="{ active: !isPlatform }"
          @click="switchScope('organization')"
        >
          组织审计</button
        ><em>审计员仅可读取，不能重放任务或管理凭证</em>
      </section>
      <form class="filters" @submit.prevent="load()">
        <label
          >动作<input
            v-model="action"
            placeholder="platform_admin.seeded" /></label
        ><label
          >结果<select v-model="outcome">
            <option value="">全部</option>
            <option value="succeeded">成功</option>
            <option value="failed">失败</option>
            <option value="blocked">已阻止</option>
          </select></label
        ><label
          >资源类型<input v-model="resourceType" placeholder="user" /></label
        ><button type="submit">筛选</button>
      </form>
      <div v-if="state === 'loading'" class="state">
        <span class="spinner"></span><strong>正在读取不可变审计记录</strong>
        <p>查询权限与数据范围由服务端再次校验。</p>
      </div>
      <div
        v-else-if="['error', 'forbidden', 'expired', 'blocked'].includes(state)"
        class="state error"
      >
        <b>{{
          state === "forbidden"
            ? "403"
            : state === "expired"
              ? "401"
              : state === "blocked"
                ? "!"
                : "×"
        }}</b
        ><strong>{{
          state === "forbidden"
            ? "无权读取该范围审计"
            : state === "expired"
              ? "登录已过期"
              : state === "blocked"
                ? "审计依赖尚未就绪"
                : "审计服务暂不可用"
        }}</strong>
        <p>
          {{
            state === "blocked"
              ? "先由宝塔发布任务完成数据库迁移，再重启 Node API。"
              : "重新加载；如仍失败，向管理员提供请求标识。"
          }}
        </p>
        <small v-if="requestId">请求标识：{{ requestId }}</small
        ><a v-if="state === 'expired'" href="/login">重新登录</a
        ><button v-else @click="load()">重新加载</button>
      </div>
      <div v-else-if="state === 'empty'" class="state">
        <b>○</b><strong>当前范围暂无审计记录</strong>
        <p>系统不会伪造示例记录；发生受审计行为后再刷新。</p>
        <button @click="load()">刷新</button>
      </div>
      <div v-else class="layout">
        <section class="table">
          <div class="thead">
            <span>时间 / 结果</span><span>动作</span><span>资源</span
            ><span>关联标识</span>
          </div>
          <button
            v-for="event in events"
            :key="event.id"
            :class="{ selected: selected?.id === event.id }"
            @click="selected = event"
          >
            <span
              ><i :data-outcome="event.outcome">{{
                outcomeLabel(event.outcome)
              }}</i
              ><small>{{
                new Date(event.occurred_at).toLocaleString("zh-CN")
              }}</small></span
            ><strong>{{ event.action }}</strong
            ><span
              >{{ event.resource_type
              }}<small>{{
                event.resource_id?.slice(0, 12) || "全局"
              }}</small></span
            ><code>{{ event.request_id.slice(0, 12) }}</code></button
          ><button v-if="nextCursor" class="more" @click="load(nextCursor)">
            加载更多
          </button>
        </section>
        <article v-if="selected" class="detail">
          <p>只读审计详情</p>
          <h2>{{ selected.action }}</h2>
          <dl>
            <div>
              <dt>结果</dt>
              <dd>{{ outcomeLabel(selected.outcome) }}</dd>
            </div>
            <div>
              <dt>操作人</dt>
              <dd>{{ selected.actor_id || "系统" }}</dd>
            </div>
            <div>
              <dt>关联编号</dt>
              <dd>
                <code>{{ selected.request_id }}</code>
              </dd>
            </div>
            <div>
              <dt>链路编号</dt>
              <dd>
                <code>{{ selected.trace_id }}</code>
              </dd>
            </div>
            <div>
              <dt>数据结构版本</dt>
              <dd>v{{ selected.schema_version }}</dd>
            </div>
          </dl>
          <pre>{{ JSON.stringify(selected.metadata, null, 2) }}</pre>
          <small>敏感值只允许保存哈希或脱敏元数据。</small>
        </article>
      </div>
    </section>
  </main>
</template>
<style scoped>
.audit-page {
  min-height: 100vh;
  background: #f4f6f8;
  color: #172033;
  display: grid;
  grid-template-columns: 232px 1fr;
  font-family: Inter, "Microsoft YaHei", sans-serif;
}
.audit-page > aside {
  background: #101927;
  color: #b6c0cf;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  text-decoration: none;
  font-weight: 800;
  font-size: 20px;
}
.brand b {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #ef6c32;
}
.audit-page aside p,
.main header p {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #7f8ca0;
}
.audit-page nav {
  display: grid;
  gap: 6px;
}
.audit-page nav > * {
  padding: 11px 12px;
  border-radius: 8px;
  color: #99a7b9;
  text-decoration: none;
}
.audit-page nav .active {
  background: #203047;
  color: #fff;
  border-left: 3px solid #ef6c32;
}
.audit-page aside small {
  margin-top: auto;
  line-height: 1.6;
}
.main {
  padding: 30px;
  min-width: 0;
}
.main header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}
.main h1 {
  font-size: 30px;
  margin: 6px 0;
}
.main header span {
  color: #667085;
}
.seed-badge {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e7ed;
  padding: 10px 14px;
  border-radius: 10px;
  height: max-content;
}
.seed-badge i {
  width: 8px;
  height: 8px;
  background: #32a071;
  border-radius: 50%;
}
.seed-badge strong {
  font-size: 10px;
  color: #ef6c32;
}
.scope-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 28px 0 14px;
}
.scope-tabs button,
.filters button,
.state button,
.state a {
  border: 1px solid #d7dde5;
  background: #fff;
  padding: 10px 15px;
  border-radius: 7px;
  color: #324155;
  text-decoration: none;
}
.scope-tabs button.active {
  background: #17263b;
  color: #fff;
}
.scope-tabs em {
  margin-left: auto;
  color: #7b8798;
  font-size: 12px;
}
.filters {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr auto;
  gap: 12px;
  background: #fff;
  padding: 14px;
  border: 1px solid #e1e6ec;
  border-radius: 10px;
}
.filters label {
  font-size: 11px;
  color: #687588;
}
.filters input,
.filters select {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 5px;
  padding: 9px;
  border: 1px solid #d9e0e7;
  border-radius: 6px;
}
.filters button {
  align-self: end;
  background: #ef6c32;
  color: #fff;
  border-color: #ef6c32;
}
.state {
  margin-top: 16px;
  min-height: 310px;
  background: #fff;
  border: 1px solid #e2e7ed;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.state > b {
  font-size: 30px;
}
.state.error > b {
  color: #c84444;
}
.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid #e5e9ee;
  border-top-color: #ef6c32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  margin-top: 16px;
}
.table,
.detail {
  background: #fff;
  border: 1px solid #e0e5eb;
  border-radius: 10px;
  overflow: hidden;
}
.thead,
.table > button {
  display: grid;
  grid-template-columns: 1.2fr 1.6fr 1fr 1fr;
  gap: 12px;
  padding: 13px 15px;
  align-items: center;
}
.thead {
  font-size: 11px;
  color: #7a8798;
  background: #f8f9fb;
}
.table > button {
  width: 100%;
  border: 0;
  border-top: 1px solid #edf0f3;
  background: #fff;
  text-align: left;
  color: inherit;
}
.table > button.selected {
  background: #fff7f2;
  box-shadow: inset 3px 0 #ef6c32;
}
.table button span {
  display: grid;
  gap: 4px;
}
.table small {
  color: #7d8998;
}
.table i {
  font-style: normal;
  font-size: 11px;
  color: #23805c;
}
.table i[data-outcome="blocked"],
.table i[data-outcome="failed"] {
  color: #c34d4d;
}
.table code {
  font-size: 11px;
}
.table .more {
  display: block;
  text-align: center;
  color: #ef6c32;
}
.detail {
  padding: 22px;
}
.detail > p {
  font-size: 11px;
  color: #ef6c32;
  letter-spacing: 0.1em;
}
.detail h2 {
  font-size: 20px;
  word-break: break-all;
}
.detail dl {
  display: grid;
  gap: 12px;
}
.detail dl div {
  border-bottom: 1px solid #edf0f2;
  padding-bottom: 8px;
}
.detail dt {
  font-size: 11px;
  color: #7c899a;
}
.detail dd {
  margin: 4px 0;
  word-break: break-all;
}
.detail pre {
  background: #111b2a;
  color: #d5dfeb;
  padding: 12px;
  border-radius: 7px;
  overflow: auto;
  font-size: 11px;
}
.detail > small {
  color: #7d8998;
}
@media (max-width: 700px) {
  .audit-page {
    display: block;
  }
  .audit-page > aside {
    padding: 18px;
  }
  .audit-page nav {
    grid-template-columns: 1fr 1fr;
  }
  .audit-page aside small {
    display: none;
  }
  .main {
    padding: 18px;
  }
  .main header {
    display: block;
  }
  .seed-badge {
    margin-top: 14px;
    width: max-content;
  }
  .scope-tabs {
    flex-wrap: wrap;
  }
  .scope-tabs em {
    width: 100%;
    margin: 4px 0;
  }
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .filters label:first-child {
    grid-column: 1/-1;
  }
  .layout {
    display: block;
  }
  .detail {
    margin-top: 14px;
  }
  .thead {
    display: none;
  }
  .table > button {
    grid-template-columns: 1fr 1fr;
  }
  .table > button code {
    display: none;
  }
}
</style>
