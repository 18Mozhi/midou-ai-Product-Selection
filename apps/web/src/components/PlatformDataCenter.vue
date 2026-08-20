<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DataQualityCenter from "./DataQualityCenter.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";

type Entity = "trends" | "opportunities" | "competitors" | "suppliers";
const props = defineProps<{ apiBaseUrl: string }>();
const tab = ref<"records" | "quality">("records"),
  entity = ref<Entity>("trends"),
  query = ref(""),
  status = ref(""),
  state = ref<"loading" | "ready" | "empty" | "error">("loading"),
  data = ref<any>({ summary: {}, items: [] }),
  message = ref(""),
  requestId = ref(""),
  exporting = ref(false);
const entities: Array<{
  value: Entity;
  label: string;
  primary: string;
  secondary: string;
}> = [
  { value: "trends", label: "热点", primary: "信号", secondary: "来源" },
  { value: "opportunities", label: "机会", primary: "证据", secondary: "来源" },
  { value: "competitors", label: "竞品", primary: "版本", secondary: "变更" },
  {
    value: "suppliers",
    label: "供应商",
    primary: "最小起订量",
    secondary: "报价",
  },
];
const current = computed(() => entities.find((item) => item.value === entity.value)!);
const summary = computed(() => Object.entries(data.value?.summary ?? {}));
const entityStatuses: Record<Entity, string[]> = {
  trends: ["active", "irrelevant", "stale"],
  opportunities: ["draft", "reviewing", "approved", "rejected", "accepted", "archived"],
  competitors: ["watching", "active", "stale"],
  suppliers: ["active", "disabled"],
};
const statusOptions = computed(() => entityStatuses[entity.value]);
const activeFilterCount = computed(
  () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
);
const statusName = (value: unknown) =>
  (
    ({
      active: "展示中",
      irrelevant: "无关",
      stale: "已过期",
      draft: "草稿",
      reviewing: "审核中",
      approved: "已通过",
      rejected: "已拒绝",
      accepted: "已采纳",
      archived: "已归档",
      watching: "监控中",
      disabled: "已停用",
    }) as Record<string, string>
  )[String(value)] ?? "其他状态";
const summaryName = (key: string) =>
  (
    ({
      total: "当前记录",
      active: "展示中",
      irrelevant: "无关",
      stale: "已过期",
      draft: "草稿",
      approved: "已通过",
      rejected: "已拒绝",
    }) as Record<string, string>
  )[key] ?? statusName(key);

async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "data", entity: entity.value });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/management?${params}`, {
        credentials: "include",
        headers: { accept: "application/json" },
      }),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) throw new Error(body?.error?.action_hint ?? "全量数据暂不可用");
    data.value = body.data;
    state.value = body.data.items.length ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "全量数据暂不可用";
    state.value = "error";
  }
}
async function exportCsv() {
  const reason = window.prompt("请输入受控导出原因（2–300 字）", "平台运营数据核对");
  if (reason === null) return;
  if (reason.trim().length < 2) {
    message.value = "导出原因至少需要 2 个字。";
    return;
  }
  exporting.value = true;
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/management/data/exports`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity: entity.value,
        query: query.value.trim(),
        status: status.value,
        reason: reason.trim(),
      }),
    });
    requestId.value = response.headers.get("x-request-id") ?? requestId.value;
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.action_hint ?? "受控导出未完成");
    }
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `platform-${entity.value}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.value = "受控表格文件已生成，导出原因和记录数已写入平台审计。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "受控导出未完成";
  } finally {
    exporting.value = false;
  }
}
function selectEntity(value: Entity) {
  entity.value = value;
  status.value = "";
  void load();
}
onMounted(load);
</script>

<template>
  <section class="platform-data">
    <header class="platform-data-hero">
      <div>
        <p>平台全量数据中心</p>
        <h2>全量业务数据</h2>
        <span>跨组织查看热点、机会、竞品与供应商事实；导出会记录操作人、原因和范围。</span>
      </div>
      <nav aria-label="平台数据视图">
        <button :aria-current="tab === 'records' ? 'page' : undefined" @click="tab = 'records'">
          全量记录
        </button>
        <button :aria-current="tab === 'quality' ? 'page' : undefined" @click="tab = 'quality'">
          证据与质量
        </button>
      </nav>
    </header>

    <DataQualityCenter v-if="tab === 'quality'" :api-base-url="apiBaseUrl" />
    <template v-else>
      <nav class="platform-data-entities" aria-label="数据类型">
        <button
          v-for="item in entities"
          :key="item.value"
          :aria-current="entity === item.value ? 'page' : undefined"
          @click="selectEntity(item.value)"
        >
          {{ item.label }}
        </button>
      </nav>
      <ResponsiveFilterDrawer label="筛选全量数据" :active-count="activeFilterCount">
        <form class="platform-data-filter" @submit.prevent="load">
          <input v-model="query" placeholder="搜索名称、组织或工作区" maxlength="120" />
          <select v-model="status" aria-label="记录状态">
            <option value="">全部状态</option>
            <option v-for="value in statusOptions" :key="value" :value="value">
              {{ statusName(value) }}
            </option>
          </select>
          <button>筛选</button>
          <button type="button" :disabled="exporting" @click="exportCsv">
            {{ exporting ? "正在导出…" : "导出表格文件" }}
          </button>
        </form>
      </ResponsiveFilterDrawer>
      <p v-if="message" class="platform-data-notice">{{ message }}</p>
      <section v-if="state !== 'ready'" class="platform-data-state">
        <h3>
          {{
            state === "loading"
              ? "正在读取全量数据"
              : state === "empty"
                ? "当前筛选没有记录"
                : "全量数据暂不可用"
          }}
        </h3>
        <p v-if="message">{{ message }}</p>
        <button v-if="state !== 'loading'" @click="load">重新加载</button>
      </section>
      <template v-else>
        <div class="platform-data-summary">
          <article v-for="[key, value] in summary" :key="key">
            <small>{{ summaryName(String(key)) }}</small
            ><strong>{{ value }}</strong>
          </article>
        </div>
        <div class="platform-data-table">
          <ResponsiveDataView
            :rows="data.items"
            :row-key="(item) => item.id"
            :title="`${current.label}记录`"
            :detail-title="(item) => item.title"
          >
            <template #desktop>
              <table>
                <thead>
                  <tr>
                    <th>{{ current.label }}</th>
                    <th>组织 / 工作区</th>
                    <th>分类 / 市场</th>
                    <th>状态</th>
                    <th>{{ current.primary }} / {{ current.secondary }}</th>
                    <th>更新时间</th>
                    <th>技术信息</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.items" :key="item.id">
                    <td>
                      <strong>{{ item.title }}</strong>
                    </td>
                    <td>
                      {{ item.organization_name }}<small>{{ item.workspace_name }}</small>
                    </td>
                    <td>
                      {{ item.category || "—" }}<small>{{ item.market || "—" }}</small>
                    </td>
                    <td>
                      <b :data-state="item.status">{{ statusName(item.status) }}</b>
                    </td>
                    <td>{{ item.metric_primary }} / {{ item.metric_secondary }}</td>
                    <td>{{ new Date(item.updated_at).toLocaleString("zh-CN") }}</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <code>{{ item.id }}</code>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row }">
              <span class="responsive-record-summary">
                <strong>{{ row.title }} · {{ statusName(row.status) }}</strong>
                <small>{{ row.organization_name }} · {{ row.workspace_name }}</small>
              </span>
            </template>
            <template #detail="{ row }">
              <dl>
                <div>
                  <dt>所属组织</dt>
                  <dd>{{ row.organization_name }}</dd>
                </div>
                <div>
                  <dt>工作区</dt>
                  <dd>{{ row.workspace_name }}</dd>
                </div>
                <div>
                  <dt>分类 / 市场</dt>
                  <dd>{{ row.category || "—" }} / {{ row.market || "—" }}</dd>
                </div>
                <div>
                  <dt>当前状态</dt>
                  <dd>{{ statusName(row.status) }}</dd>
                </div>
                <div>
                  <dt>{{ current.primary }} / {{ current.secondary }}</dt>
                  <dd>{{ row.metric_primary }} / {{ row.metric_secondary }}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{{ new Date(row.updated_at).toLocaleString("zh-CN") }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <code>{{ row.id }}</code>
              </details>
            </template>
          </ResponsiveDataView>
        </div>
        <footer>
          最多显示当前筛选最近 100 条
          <details v-if="requestId">
            <summary>技术详情</summary>
            <span>请求 ID {{ requestId }}</span>
          </details>
        </footer>
      </template>
    </template>
  </section>
</template>

<style scoped>
.platform-data {
  display: grid;
  gap: 16px;
  color: var(--so-text);
}
.platform-data-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-panel);
}
.platform-data-hero p {
  margin: 0;
  color: var(--so-primary);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.16em;
}
.platform-data-hero h2 {
  margin: 6px 0;
}
.platform-data-hero span,
.platform-data footer {
  color: var(--so-text-muted);
}
.platform-data nav,
.platform-data-filter {
  display: flex;
  gap: 8px;
}
.platform-data button,
.platform-data input,
.platform-data select {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
}
.platform-data button[aria-current="page"],
.platform-data-filter button:first-of-type {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.platform-data-filter input:first-child {
  flex: 1;
}
.platform-data-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}
.platform-data-summary article,
.platform-data-table,
.platform-data-state,
.platform-data-notice {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.platform-data-summary small,
.platform-data-summary strong,
.platform-data-table td small {
  display: block;
}
.platform-data-summary small,
.platform-data-table td small {
  color: var(--so-text-muted);
}
.platform-data-summary strong {
  margin-top: 6px;
  font-size: 24px;
}
.platform-data-table {
  overflow: auto;
}
.platform-data table {
  width: 100%;
  border-collapse: collapse;
}
.platform-data th,
.platform-data td {
  padding: 11px 9px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  font-size: 12px;
}
.platform-data td small {
  margin-top: 4px;
}
.platform-data-state,
.platform-data-notice {
  text-align: center;
}
.platform-data footer {
  text-align: right;
  font-size: 11px;
}
.platform-data-table details summary,
.platform-data footer details summary {
  display: inline-flex;
  min-height: var(--so-touch-target);
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.platform-data-table code,
.platform-data footer span {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .platform-data-hero,
  .platform-data-filter {
    flex-direction: column;
  }
  .platform-data nav {
    flex-wrap: wrap;
  }
  .platform-data-filter input,
  .platform-data-filter select,
  .platform-data-filter button {
    width: 100%;
  }
}
</style>
