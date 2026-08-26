<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

type DataView = "workspaces" | "exports";

const props = defineProps<{
  data: {
    comparisons?: any[];
    exports?: any[];
    observed_at?: string;
  } | null;
  formatTime: (value: string) => string;
}>();

const route = useRoute(),
  router = useRouter(),
  view = ref<DataView>(
    queryChoice("org_data_view", ["workspaces", "exports"], "workspaces") as DataView,
  ),
  workspaceQuery = ref(queryText("org_data_workspace_query")),
  workspaceStatus = ref(
    queryChoice("org_data_workspace_status", ["all", "active", "archived"], "all"),
  ),
  workspaceSort = ref(
    queryChoice(
      "org_data_workspace_sort",
      ["name_asc", "total_desc", "trends_desc", "opportunities_desc", "tasks_desc", "exports_desc"],
      "total_desc",
    ),
  ),
  workspacePage = ref(queryPage("org_data_workspace_page")),
  exportQuery = ref(queryText("org_data_export_query")),
  exportWorkspace = ref(queryText("org_data_export_workspace") || "all"),
  exportType = ref(
    queryChoice("org_data_export_type", ["all", "opportunity", "trend", "team"], "all"),
  ),
  exportStatus = ref(
    queryChoice(
      "org_data_export_status",
      ["all", "queued", "leased", "retry_scheduled", "succeeded", "dead_letter", "expired"],
      "all",
    ),
  ),
  exportSort = ref(
    queryChoice(
      "org_data_export_sort",
      ["created_desc", "created_asc", "updated_desc", "rows_desc", "workspace_asc"],
      "created_desc",
    ),
  ),
  exportPage = ref(queryPage("org_data_export_page"));

const workspacePageSize = 8,
  exportPageSize = 10,
  statusLabels: Record<string, string> = {
    active: "正常使用",
    archived: "已归档",
    queued: "等待处理",
    leased: "正在生成",
    retry_scheduled: "等待重试",
    succeeded: "已完成",
    dead_letter: "多次失败",
    expired: "已过期",
  },
  typeLabels: Record<string, string> = {
    opportunity: "机会报表",
    trend: "热点报表",
    team: "团队报表",
  };

const comparisons = computed(() => props.data?.comparisons ?? []),
  exports = computed(() => props.data?.exports ?? []),
  workspaceNames = computed(() =>
    [...new Set(exports.value.map((item) => String(item.workspace_name || "未命名工作区")))].sort(
      (left, right) => left.localeCompare(right, "zh-CN"),
    ),
  ),
  totals = computed(() =>
    comparisons.value.reduce(
      (result, item) => {
        result.trends += count(item.trends);
        result.opportunities += count(item.opportunities);
        result.tasks += count(item.tasks);
        result.exports += count(item.exports);
        if (item.status === "active") result.active += 1;
        if (item.status === "archived") result.archived += 1;
        return result;
      },
      {
        workspaces: comparisons.value.length,
        active: 0,
        archived: 0,
        trends: 0,
        opportunities: 0,
        tasks: 0,
        exports: 0,
      },
    ),
  ),
  filteredWorkspaces = computed(() => {
    const query = workspaceQuery.value.trim().toLocaleLowerCase("zh-CN");
    return comparisons.value
      .filter(
        (item) =>
          (!query || String(item.name).toLocaleLowerCase("zh-CN").includes(query)) &&
          (workspaceStatus.value === "all" || item.status === workspaceStatus.value),
      )
      .sort((left, right) => {
        if (workspaceSort.value === "name_asc")
          return String(left.name).localeCompare(String(right.name), "zh-CN");
        const key = workspaceSort.value.replace("_desc", "");
        return (
          workspaceValue(right, key) - workspaceValue(left, key) ||
          String(left.name).localeCompare(String(right.name), "zh-CN")
        );
      });
  }),
  workspacePageCount = computed(() =>
    Math.max(1, Math.ceil(filteredWorkspaces.value.length / workspacePageSize)),
  ),
  visibleWorkspaces = computed(() =>
    filteredWorkspaces.value.slice(
      (workspacePage.value - 1) * workspacePageSize,
      workspacePage.value * workspacePageSize,
    ),
  ),
  filteredExports = computed(() => {
    const query = exportQuery.value.trim().toLocaleLowerCase("zh-CN");
    return exports.value
      .filter(
        (item) =>
          (!query ||
            [item.workspace_name, typeLabel(item.report_type), statusLabel(item.status)]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(query))) &&
          (exportWorkspace.value === "all" || item.workspace_name === exportWorkspace.value) &&
          (exportType.value === "all" || item.report_type === exportType.value) &&
          (exportStatus.value === "all" || item.status === exportStatus.value),
      )
      .sort((left, right) => {
        if (exportSort.value === "created_asc")
          return time(left.created_at) - time(right.created_at);
        if (exportSort.value === "updated_desc")
          return time(right.updated_at) - time(left.updated_at);
        if (exportSort.value === "rows_desc") return count(right.row_count) - count(left.row_count);
        if (exportSort.value === "workspace_asc")
          return String(left.workspace_name).localeCompare(String(right.workspace_name), "zh-CN");
        return time(right.created_at) - time(left.created_at);
      });
  }),
  exportPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredExports.value.length / exportPageSize)),
  ),
  visibleExports = computed(() =>
    filteredExports.value.slice(
      (exportPage.value - 1) * exportPageSize,
      exportPage.value * exportPageSize,
    ),
  );

watch([workspaceQuery, workspaceStatus, workspaceSort], () => (workspacePage.value = 1));
watch(
  [exportQuery, exportWorkspace, exportType, exportStatus, exportSort],
  () => (exportPage.value = 1),
);
watch(workspacePageCount, (pageCount) => {
  if (workspacePage.value > pageCount) workspacePage.value = pageCount;
});
watch(exportPageCount, (pageCount) => {
  if (exportPage.value > pageCount) exportPage.value = pageCount;
});
watch(
  [
    view,
    workspaceQuery,
    workspaceStatus,
    workspaceSort,
    workspacePage,
    exportQuery,
    exportWorkspace,
    exportType,
    exportStatus,
    exportSort,
    exportPage,
  ],
  () => {
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "org_data_view", view.value, "workspaces");
    setQuery(query, "org_data_workspace_query", workspaceQuery.value, "");
    setQuery(query, "org_data_workspace_status", workspaceStatus.value, "all");
    setQuery(query, "org_data_workspace_sort", workspaceSort.value, "total_desc");
    setQuery(query, "org_data_workspace_page", String(workspacePage.value), "1");
    setQuery(query, "org_data_export_query", exportQuery.value, "");
    setQuery(query, "org_data_export_workspace", exportWorkspace.value, "all");
    setQuery(query, "org_data_export_type", exportType.value, "all");
    setQuery(query, "org_data_export_status", exportStatus.value, "all");
    setQuery(query, "org_data_export_sort", exportSort.value, "created_desc");
    setQuery(query, "org_data_export_page", String(exportPage.value), "1");
    void router.replace({ query });
  },
  { flush: "post" },
);

function count(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function time(value: unknown) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function workspaceValue(item: any, key: string) {
  if (key === "total")
    return count(item.trends) + count(item.opportunities) + count(item.tasks) + count(item.exports);
  return count(item[key]);
}
function statusLabel(value: string) {
  return statusLabels[value] ?? `未知状态（${value || "空"}）`;
}
function typeLabel(value: string) {
  return typeLabels[value] ?? `未知类型（${value || "空"}）`;
}
function queryText(key: string) {
  const value = route.query[key];
  return typeof value === "string" ? value.slice(0, 200) : "";
}
function queryChoice(key: string, allowed: string[], fallback: string) {
  const value = queryText(key);
  return allowed.includes(value) ? value : fallback;
}
function queryPage(key: string) {
  const value = Number(queryText(key));
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
function setQuery(
  query: Record<string, string | string[] | null | undefined>,
  key: string,
  value: string,
  fallback: string,
) {
  if (value && value !== fallback) query[key] = value;
  else delete query[key];
}
function resetWorkspaces() {
  workspaceQuery.value = "";
  workspaceStatus.value = "all";
  workspaceSort.value = "total_desc";
}
function resetExports() {
  exportQuery.value = "";
  exportWorkspace.value = "all";
  exportType.value = "all";
  exportStatus.value = "all";
  exportSort.value = "created_desc";
}
</script>

<template>
  <section class="org-data-panel" aria-labelledby="org-data-title">
    <header class="org-data-overview">
      <div>
        <p>DATA LEDGER · 实时只读</p>
        <h3 id="org-data-title">跨工作区数据账本</h3>
        <span>核对当前组织的数据规模与导出履历，所有数字均来自本次接口响应。</span>
      </div>
      <aside aria-label="数据观测时间">
        <b>观测时间</b>
        <time :datetime="data?.observed_at">{{ formatTime(data?.observed_at || "") }}</time>
        <span>刷新页面会重新读取数据库事实</span>
      </aside>
    </header>

    <div class="org-data-metrics" aria-label="组织数据汇总">
      <article>
        <span>工作区</span><b>{{ totals.workspaces }}</b
        ><small>{{ totals.active }} 正常 · {{ totals.archived }} 归档</small>
      </article>
      <article>
        <span>热点事实</span><b>{{ totals.trends }}</b
        ><small>跨当前组织全部工作区</small>
      </article>
      <article>
        <span>机会事实</span><b>{{ totals.opportunities }}</b
        ><small>当前持久化机会记录</small>
      </article>
      <article>
        <span>未删除任务</span><b>{{ totals.tasks }}</b
        ><small>已删除任务不计入</small>
      </article>
      <article>
        <span>导出记录</span><b>{{ totals.exports }}</b
        ><small>工作区全量导出计数</small>
      </article>
      <article data-tone="limited">
        <span>最近导出</span><b>{{ exports.length }}</b
        ><small>接口最多返回 100 条</small>
      </article>
    </div>

    <aside class="org-data-truth" aria-label="数据质量说明">
      <span aria-hidden="true">≠</span>
      <div>
        <b>数量不等于数据质量</b>
        <p>
          当前接口仅返回规模和导出事实，未返回质量规则、缺失率或异常结论；本页不会用数量冒充质量。
        </p>
      </div>
      <RouterLink to="/reports">前往报表工作台</RouterLink>
    </aside>

    <nav class="org-data-tabs" aria-label="组织数据视图">
      <button type="button" :aria-pressed="view === 'workspaces'" @click="view = 'workspaces'">
        工作区比较 <span>{{ comparisons.length }}</span>
      </button>
      <button type="button" :aria-pressed="view === 'exports'" @click="view = 'exports'">
        导出履历 <span>{{ exports.length }}</span>
      </button>
    </nav>

    <section v-if="view === 'workspaces'" class="org-data-section">
      <header class="org-data-section-heading">
        <div>
          <p>工作区比较</p>
          <h4>规模分布与业务记录构成</h4>
        </div>
        <span>“合计”仅用于排序，不代表评分或优先级。</span>
      </header>
      <div class="org-data-toolbar org-data-workspace-toolbar">
        <label class="org-data-search"
          ><span>搜索工作区</span
          ><input v-model="workspaceQuery" type="search" placeholder="输入工作区名称"
        /></label>
        <label
          ><span>工作区状态</span
          ><select v-model="workspaceStatus">
            <option value="all">全部状态</option>
            <option value="active">正常使用</option>
            <option value="archived">已归档</option>
          </select></label
        >
        <label
          ><span>排序</span
          ><select v-model="workspaceSort">
            <option value="total_desc">记录合计从高到低</option>
            <option value="name_asc">名称 A–Z</option>
            <option value="trends_desc">热点从高到低</option>
            <option value="opportunities_desc">机会从高到低</option>
            <option value="tasks_desc">任务从高到低</option>
            <option value="exports_desc">导出从高到低</option>
          </select></label
        >
        <button type="button" class="org-admin-secondary" @click="resetWorkspaces">重置筛选</button>
      </div>
      <div v-if="visibleWorkspaces.length" class="org-data-table-scroll">
        <div class="org-data-table" role="table" aria-label="跨工作区数据比较">
          <div role="row" class="org-data-table-head">
            <b role="columnheader">工作区</b><b role="columnheader">热点</b
            ><b role="columnheader">机会</b><b role="columnheader">任务</b
            ><b role="columnheader">导出</b><b role="columnheader">合计</b>
          </div>
          <div v-for="item in visibleWorkspaces" :key="item.id" role="row">
            <span role="cell"
              ><b>{{ item.name }}</b
              ><small
                ><i :data-status="item.status">{{ statusLabel(item.status) }}</i></small
              ></span
            >
            <span role="cell" data-label="热点">{{ count(item.trends) }}</span>
            <span role="cell" data-label="机会">{{ count(item.opportunities) }}</span>
            <span role="cell" data-label="任务">{{ count(item.tasks) }}</span>
            <span role="cell" data-label="导出">{{ count(item.exports) }}</span>
            <strong role="cell" data-label="合计">{{ workspaceValue(item, "total") }}</strong>
          </div>
        </div>
      </div>
      <div v-else class="org-data-empty" role="status">
        <span>0</span>
        <div>
          <h5>{{ comparisons.length ? "没有匹配的工作区" : "当前组织暂无工作区数据" }}</h5>
          <p>
            {{
              comparisons.length
                ? "调整搜索条件或重置筛选后再试。"
                : "接口返回空数组，本页不会补入示例数字。"
            }}
          </p>
        </div>
      </div>
      <footer v-if="filteredWorkspaces.length" class="org-data-pagination" aria-label="工作区分页">
        <span
          >第 {{ workspacePage }} / {{ workspacePageCount }} 页 · 共
          {{ filteredWorkspaces.length }} 个工作区</span
        >
        <div>
          <button
            type="button"
            class="org-admin-secondary"
            :disabled="workspacePage <= 1"
            @click="workspacePage -= 1"
          >
            上一页</button
          ><button
            type="button"
            class="org-admin-secondary"
            :disabled="workspacePage >= workspacePageCount"
            @click="workspacePage += 1"
          >
            下一页
          </button>
        </div>
      </footer>
    </section>

    <section v-else class="org-data-section">
      <header class="org-data-section-heading">
        <div>
          <p>导出履历</p>
          <h4>生成状态、行数与处理时间</h4>
        </div>
        <span>当前只读接口不返回文件地址；下载与新建导出继续在报表工作台完成。</span>
      </header>
      <div class="org-data-toolbar org-data-export-toolbar">
        <label class="org-data-search"
          ><span>搜索导出</span
          ><input v-model="exportQuery" type="search" placeholder="工作区、类型或状态"
        /></label>
        <label
          ><span>工作区</span
          ><select v-model="exportWorkspace">
            <option value="all">全部工作区</option>
            <option v-for="workspace in workspaceNames" :key="workspace" :value="workspace">
              {{ workspace }}
            </option>
          </select></label
        >
        <label
          ><span>报表类型</span
          ><select v-model="exportType">
            <option value="all">全部类型</option>
            <option value="opportunity">机会报表</option>
            <option value="trend">热点报表</option>
            <option value="team">团队报表</option>
          </select></label
        >
        <label
          ><span>生成状态</span
          ><select v-model="exportStatus">
            <option value="all">全部状态</option>
            <option value="queued">等待处理</option>
            <option value="leased">正在生成</option>
            <option value="retry_scheduled">等待重试</option>
            <option value="succeeded">已完成</option>
            <option value="dead_letter">多次失败</option>
            <option value="expired">已过期</option>
          </select></label
        >
        <label
          ><span>排序</span
          ><select v-model="exportSort">
            <option value="created_desc">创建时间从新到旧</option>
            <option value="created_asc">创建时间从旧到新</option>
            <option value="updated_desc">更新时间从新到旧</option>
            <option value="rows_desc">导出行数从高到低</option>
            <option value="workspace_asc">工作区 A–Z</option>
          </select></label
        >
        <button type="button" class="org-admin-secondary" @click="resetExports">重置筛选</button>
      </div>
      <div v-if="visibleExports.length" class="org-data-export-list" aria-label="最近导出记录">
        <article v-for="item in visibleExports" :key="item.id">
          <header>
            <span>{{ typeLabel(item.report_type) }}</span
            ><i :data-status="item.status">{{ statusLabel(item.status) }}</i>
          </header>
          <h5>{{ item.workspace_name || "未命名工作区" }}</h5>
          <dl>
            <div>
              <dt>导出行数</dt>
              <dd>{{ item.row_count == null ? "尚未生成" : `${count(item.row_count)} 行` }}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ formatTime(item.created_at) }}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{{ formatTime(item.updated_at) }}</dd>
            </div>
          </dl>
          <details>
            <summary>技术详情</summary>
            <code>导出记录 ID：{{ item.id }}</code>
          </details>
        </article>
      </div>
      <div v-else class="org-data-empty" role="status">
        <span>0</span>
        <div>
          <h5>{{ exports.length ? "没有匹配的导出记录" : "当前组织暂无导出记录" }}</h5>
          <p>
            {{
              exports.length ? "调整筛选条件或重置筛选后再试。" : "新建与下载导出请前往报表工作台。"
            }}
          </p>
        </div>
      </div>
      <footer v-if="filteredExports.length" class="org-data-pagination" aria-label="导出记录分页">
        <span
          >第 {{ exportPage }} / {{ exportPageCount }} 页 · 共
          {{ filteredExports.length }} 条导出</span
        >
        <div>
          <button
            type="button"
            class="org-admin-secondary"
            :disabled="exportPage <= 1"
            @click="exportPage -= 1"
          >
            上一页</button
          ><button
            type="button"
            class="org-admin-secondary"
            :disabled="exportPage >= exportPageCount"
            @click="exportPage += 1"
          >
            下一页
          </button>
        </div>
      </footer>
    </section>
  </section>
</template>
