<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";

type State = "loading" | "ready" | "empty" | "error";
interface OperationalLog {
  id: string;
  source: "api" | "worker" | "crawler";
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  occurred_at: string;
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<State>("loading"),
  query = ref(""),
  source = ref(""),
  items = ref<OperationalLog[]>([]),
  summary = ref<Record<string, number>>({}),
  message = ref(""),
  requestId = ref(""),
  observedAt = ref("");
const activeFilterCount = computed(
  () => Number(Boolean(query.value.trim())) + Number(Boolean(source.value)),
);
const sourceName = (value: string) =>
  ({ api: "API", worker: "Worker", crawler: "爬虫" })[value] ?? value;
const when = (value: string) => new Date(value).toLocaleString("zh-CN");

async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "logs" });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (source.value) params.set("status", source.value);
  try {
    const response = await request<any>(`/platform/management?${params}`);
    requestId.value = response.request_id;
    items.value = response.data.items ?? [];
    summary.value = response.data.summary ?? {};
    observedAt.value = response.data.observed_at ?? "";
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = failure?.actionHint ?? "链路日志暂不可用";
    state.value = "error";
  }
}

onMounted(load);
</script>

<template>
  <section class="platform-log-center" aria-live="polite">
    <header>
      <div>
        <p>系统运维</p>
        <h2>链路日志</h2>
        <span>按请求编号、链路编号、任务、事件或错误码检索 API、Worker 与爬虫事件。</span>
      </div>
      <button type="button" @click="load">刷新日志</button>
    </header>

    <ResponsiveFilterDrawer label="筛选链路日志" :active-count="activeFilterCount">
      <form class="platform-log-filter" @submit.prevent="load">
        <label>
          检索条件
          <input
            v-model="query"
            maxlength="120"
            placeholder="请求编号、链路编号、任务、事件或错误码"
          />
        </label>
        <label>
          运行面
          <select v-model="source">
            <option value="">全部运行面</option>
            <option value="api">API</option>
            <option value="worker">Worker</option>
            <option value="crawler">爬虫</option>
          </select>
        </label>
        <button>检索</button>
      </form>
    </ResponsiveFilterDrawer>

    <section v-if="state !== 'ready'" class="platform-log-state">
      <h3>
        {{
          state === "loading"
            ? "正在读取链路日志"
            : state === "empty"
              ? "没有匹配事件"
              : "链路日志暂不可用"
        }}
      </h3>
      <p>{{ message || (state === "empty" ? "调整检索条件或运行面后重试。" : "") }}</p>
      <button v-if="state !== 'loading'" type="button" @click="load">重新加载</button>
    </section>

    <template v-else>
      <div class="platform-log-summary">
        <span
          >当前返回 <strong>{{ summary.total ?? items.length }}</strong> 条</span
        >
        <span>API {{ summary.api ?? 0 }}</span>
        <span>Worker {{ summary.worker ?? 0 }}</span>
        <span>爬虫 {{ summary.crawler ?? 0 }}</span>
      </div>
      <div class="platform-log-table-wrap">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>运行面</th>
              <th>事件</th>
              <th>状态</th>
              <th>资源</th>
              <th>技术详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="`${item.source}:${item.id}`">
              <td>{{ when(item.occurred_at) }}</td>
              <td>
                <i :data-source="item.source">{{ sourceName(item.source) }}</i>
              </td>
              <td>
                <strong>{{ item.event_type }}</strong
                ><small v-if="item.error_code">{{ item.error_code }}</small>
              </td>
              <td>{{ item.status }}</td>
              <td>
                {{ item.resource_type
                }}<small v-if="item.resource_id">{{ item.resource_id }}</small>
              </td>
              <td>
                <details>
                  <summary>查看编号</summary>
                  <code>request {{ item.request_id }}</code
                  ><code>trace {{ item.trace_id }}</code>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer>
        <span>数据更新时间 {{ observedAt ? when(observedAt) : "—" }}</span>
        <details v-if="requestId">
          <summary>本次查询</summary>
          <code>{{ requestId }}</code>
        </details>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.platform-log-center {
  display: grid;
  gap: 16px;
}
.platform-log-center > header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: end;
}
.platform-log-center h2 {
  margin: 4px 0;
}
.platform-log-center header p,
.platform-log-center header span {
  margin: 0;
  color: var(--muted);
}
.platform-log-center button {
  min-height: 40px;
}
.platform-log-filter {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(160px, 220px) auto;
  gap: 12px;
  align-items: end;
}
.platform-log-filter label {
  display: grid;
  gap: 6px;
}
.platform-log-filter input,
.platform-log-filter select {
  min-height: 42px;
}
.platform-log-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.platform-log-summary span {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
}
.platform-log-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
}
.platform-log-table-wrap table {
  width: 100%;
  min-width: 1020px;
  border-collapse: collapse;
}
.platform-log-table-wrap th,
.platform-log-table-wrap td {
  padding: 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--line);
}
.platform-log-table-wrap small,
.platform-log-table-wrap code {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.platform-log-table-wrap i {
  font-style: normal;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-soft);
}
.platform-log-state {
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 14px;
  text-align: center;
}
.platform-log-center > footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--muted);
}
@media (max-width: 768px) {
  .platform-log-center > header {
    align-items: stretch;
    flex-direction: column;
  }
  .platform-log-filter {
    grid-template-columns: 1fr;
  }
  .platform-log-table-wrap {
    border: 0;
    overflow: visible;
  }
  .platform-log-table-wrap table,
  .platform-log-table-wrap tbody {
    display: grid;
    min-width: 0;
    gap: 12px;
  }
  .platform-log-table-wrap thead {
    display: none;
  }
  .platform-log-table-wrap tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
  }
  .platform-log-table-wrap td {
    padding: 0;
    border: 0;
  }
  .platform-log-table-wrap td:nth-child(3),
  .platform-log-table-wrap td:nth-child(5),
  .platform-log-table-wrap td:nth-child(6) {
    grid-column: 1 / -1;
  }
  .platform-log-center > footer {
    flex-direction: column;
  }
}
</style>
