<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, createApiResponseClient } from "../api-client";
import { useAuditedReason } from "../use-audited-reason";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";

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
  task_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const requestResponse = createApiResponseClient(props.apiBaseUrl);
const state = ref<State>("loading"),
  query = ref(""),
  source = ref(""),
  items = ref<OperationalLog[]>([]),
  summary = ref<Record<string, number>>({}),
  message = ref(""),
  requestId = ref(""),
  observedAt = ref(""),
  exporting = ref(false);
const {
  request: exportReasonRequest,
  open: exportReasonOpen,
  ask: askExportReason,
  submit: submitExportReason,
  cancel: cancelExportReason,
} = useAuditedReason();
const activeFilterCount = computed(
  () => Number(Boolean(query.value.trim())) + Number(Boolean(source.value)),
);
const traceChains = computed(() => {
  const groups = new Map<string, OperationalLog[]>();
  for (const item of items.value) {
    const traceId = item.trace_id || `missing:${item.source}:${item.id}`;
    groups.set(traceId, [...(groups.get(traceId) ?? []), item]);
  }
  return [...groups.entries()].map(([traceId, chainItems]) => {
    const chronological = [...chainItems].sort(
      (left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
    );
    return {
      traceId,
      items: chronological,
      sources: [...new Set(chainItems.map((item) => item.source))],
      exceptionCount: chainItems.filter(isException).length,
      startedAt: chronological[0]?.occurred_at ?? "",
      endedAt: chronological.at(-1)?.occurred_at ?? "",
    };
  });
});
const sourceName = (value: string) =>
  ({ api: "API", worker: "Worker", crawler: "爬虫" })[value] ?? value;
const when = (value: string) => new Date(value).toLocaleString("zh-CN");
const shortId = (value: string) => (value.length > 16 ? `${value.slice(0, 12)}…` : value);
function isException(item: OperationalLog) {
  return (
    Boolean(item.error_code) ||
    ["blocked", "failed", "timed_out", "dead_letter", "degraded", "denied"].some((status) =>
      item.status.includes(status),
    )
  );
}
const taskLink = (item: OperationalLog) =>
  item.task_id
    ? `/platform-admin/collection?task=${encodeURIComponent(item.task_id)}&from=${encodeURIComponent("/platform-admin/logs")}`
    : "";
const providerLink = (item: OperationalLog) =>
  item.provider_id
    ? `/platform-admin/providers/sources?provider_id=${encodeURIComponent(item.provider_id)}&from=${encodeURIComponent("/platform-admin/logs")}`
    : "";

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

async function exportCsv() {
  const reason = await askExportReason({
    title: "填写日志导出原因",
    description: "当前检索条件、运行面、记录数和导出原因会写入平台审计。",
    initialValue: "导出当前链路日志用于故障排查",
  });
  if (reason === null) return;
  exporting.value = true;
  message.value = "";
  try {
    const response = await requestResponse("/platform/management/logs/exports", {
      method: "POST",
      headers: { accept: "text/csv" },
      body: {
        query: query.value.trim(),
        ...(source.value ? { source: source.value } : {}),
        reason,
      },
    });
    requestId.value = response.headers.get("x-request-id") ?? requestId.value;
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `platform-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.value = "当前筛选日志已导出，检索范围、原因和记录数已写入平台审计。";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = failure?.actionHint ?? "链路日志导出未完成";
  } finally {
    exporting.value = false;
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
      <div class="platform-log-header-actions">
        <button type="button" :disabled="exporting" @click="exportCsv">
          {{ exporting ? "正在导出…" : "导出当前筛选" }}
        </button>
        <button type="button" @click="load">刷新日志</button>
      </div>
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

    <p v-if="message && state === 'ready'" class="platform-log-message" role="status">
      {{ message }}
    </p>

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
        <span>调用链 {{ traceChains.length }} 条</span>
        <span>API {{ summary.api ?? 0 }}</span>
        <span>Worker {{ summary.worker ?? 0 }}</span>
        <span>爬虫 {{ summary.crawler ?? 0 }}</span>
      </div>
      <section
        v-for="chain in traceChains"
        :key="chain.traceId"
        class="platform-log-chain"
        :data-exception="chain.exceptionCount > 0"
      >
        <header>
          <div>
            <p>调用链 {{ shortId(chain.traceId) }}</p>
            <h3>{{ chain.items.length }} 个事件 · {{ chain.exceptionCount }} 个异常</h3>
            <span
              >{{ when(chain.startedAt)
              }}<template v-if="chain.startedAt !== chain.endedAt">
                → {{ when(chain.endedAt) }}</template
              ></span
            >
          </div>
          <div class="platform-log-chain__sources">
            <i v-for="chainSource in chain.sources" :key="chainSource" :data-source="chainSource">
              {{ sourceName(chainSource) }}
            </i>
            <details>
              <summary>完整 trace_id</summary>
              <code>{{ chain.traceId }}</code>
            </details>
          </div>
        </header>
        <ResponsiveDataView
          class="platform-log-table-wrap"
          :rows="chain.items"
          :row-key="(item) => `${item.source}:${item.id}`"
          :title="`调用链 ${shortId(chain.traceId)}`"
          :detail-title="(item) => `${sourceName(item.source)} · ${item.event_type}`"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>运行面</th>
                  <th>事件</th>
                  <th>状态</th>
                  <th>资源</th>
                  <th>异常处理</th>
                  <th>技术详情</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in chain.items"
                  :key="`${item.source}:${item.id}`"
                  :data-exception="isException(item)"
                >
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
                    }}<small v-if="item.provider_name">{{ item.provider_name }}</small>
                  </td>
                  <td class="platform-log-actions">
                    <template v-if="isException(item)">
                      <RouterLink v-if="taskLink(item)" :to="taskLink(item)"
                        >查看关联任务</RouterLink
                      >
                      <RouterLink v-if="providerLink(item)" :to="providerLink(item)"
                        >查看关联来源</RouterLink
                      >
                      <small v-if="!taskLink(item) && !providerLink(item)">暂无可定位对象</small>
                    </template>
                    <span v-else>—</span>
                  </td>
                  <td>
                    <details>
                      <summary>查看编号</summary>
                      <code v-if="item.resource_id">resource {{ item.resource_id }}</code
                      ><code>request {{ item.request_id }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <strong>{{ row.event_type }}</strong>
            <small
              >{{ sourceName(row.source) }} · {{ row.status }} · {{ when(row.occurred_at) }}</small
            >
          </template>
          <template #detail="{ row }">
            <dl>
              <div>
                <dt>时间</dt>
                <dd>{{ when(row.occurred_at) }}</dd>
              </div>
              <div>
                <dt>运行面</dt>
                <dd>{{ sourceName(row.source) }}</dd>
              </div>
              <div>
                <dt>事件</dt>
                <dd>
                  {{ row.event_type }}<small v-if="row.error_code"> · {{ row.error_code }}</small>
                </dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{{ row.status }}</dd>
              </div>
              <div>
                <dt>资源</dt>
                <dd>
                  {{ row.resource_type
                  }}<small v-if="row.provider_name"> · {{ row.provider_name }}</small>
                </dd>
              </div>
            </dl>
            <div v-if="isException(row)" class="platform-log-actions">
              <RouterLink v-if="taskLink(row)" :to="taskLink(row)">查看关联任务</RouterLink>
              <RouterLink v-if="providerLink(row)" :to="providerLink(row)">查看关联来源</RouterLink>
              <small v-if="!taskLink(row) && !providerLink(row)">暂无可定位对象</small>
            </div>
            <details>
              <summary>技术详情</summary>
              <code v-if="row.resource_id">resource {{ row.resource_id }}</code>
              <code>request {{ row.request_id }}</code>
            </details>
          </template>
        </ResponsiveDataView>
      </section>
      <footer>
        <span>数据更新时间 {{ observedAt ? when(observedAt) : "—" }}</span>
        <details v-if="requestId">
          <summary>本次查询</summary>
          <code>{{ requestId }}</code>
        </details>
      </footer>
    </template>
    <AuditedReasonDialog
      :open="exportReasonOpen"
      :title="exportReasonRequest?.title || '填写日志导出原因'"
      :description="exportReasonRequest?.description || ''"
      :initial-value="exportReasonRequest?.initialValue"
      @submit="submitExportReason"
      @cancel="cancelExportReason"
    />
  </section>
</template>

<style scoped>
.platform-log-center {
  display: grid;
  gap: 16px;
}
.platform-log-message {
  margin: 0;
  color: var(--so-success);
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
.platform-log-header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
.platform-log-chain {
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}
.platform-log-chain[data-exception="true"] {
  border-left: 3px solid var(--so-warning);
}
.platform-log-chain > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 14px;
  background: var(--surface-soft);
}
.platform-log-chain > header p,
.platform-log-chain > header h3,
.platform-log-chain > header span {
  margin: 0;
}
.platform-log-chain > header h3 {
  margin-top: 4px;
  font-size: 15px;
}
.platform-log-chain > header span,
.platform-log-chain__sources code {
  color: var(--muted);
  font-size: 12px;
}
.platform-log-chain__sources {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.platform-log-chain__sources details {
  flex-basis: 100%;
  text-align: right;
}
.platform-log-table-wrap {
  overflow-x: auto;
}
.platform-log-table-wrap table {
  width: 100%;
  min-width: 1120px;
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
.platform-log-table-wrap i,
.platform-log-chain__sources i {
  font-style: normal;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-soft);
}
.platform-log-table-wrap tr[data-exception="true"] {
  background: color-mix(in srgb, var(--so-warning-soft) 45%, transparent);
}
.platform-log-actions {
  min-width: 124px;
}
.platform-log-actions a {
  display: block;
  width: fit-content;
  margin-top: 5px;
  color: var(--so-primary);
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
  .platform-log-header-actions button {
    flex: 1 1 140px;
  }
  .platform-log-filter {
    grid-template-columns: 1fr;
  }
  .platform-log-chain > header {
    flex-direction: column;
  }
  .platform-log-chain__sources {
    justify-content: flex-start;
  }
  .platform-log-chain__sources details {
    text-align: left;
  }
  .platform-log-center > footer {
    flex-direction: column;
  }
}
</style>
