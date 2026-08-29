<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type Section =
  "score_rules" | "cost_rules" | "approval_templates" | "automation_rules" | "releases";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
const sectionStatuses: Record<Section, string[]> = {
  score_rules: [
    "draft",
    "pending_approval",
    "approved",
    "active",
    "retired",
    "rejected",
    "rolled_back",
  ],
  cost_rules: [
    "draft",
    "pending_approval",
    "approved",
    "active",
    "retired",
    "rejected",
    "rolled_back",
  ],
  approval_templates: ["draft", "published", "archived"],
  automation_rules: ["active", "paused"],
  releases: ["planned", "preflight_passed", "deploying", "healthy", "failed", "rolled_back"],
};
const route = useRoute(),
  router = useRouter(),
  queryValue = (name: string) => {
    const value = route.query[name];
    return typeof value === "string" ? value : "";
  },
  sectionValues = Object.keys(sectionStatuses) as Section[],
  initialSection = sectionValues.includes(queryValue("section") as Section)
    ? (queryValue("section") as Section)
    : "score_rules",
  initialStatus = sectionStatuses[initialSection].includes(queryValue("status"))
    ? queryValue("status")
    : "",
  pageSize = 20,
  section = ref<Section>(initialSection),
  state = ref<State>("loading"),
  data = ref<any>({ summary: {}, items: [], pagination: null }),
  query = ref(queryValue("q").trim()),
  queryDraft = ref(query.value),
  status = ref(initialStatus),
  statusDraft = ref(initialStatus),
  page = ref(/^\d{1,4}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1),
  message = ref(""),
  requestId = ref(""),
  selected = ref<any>(null),
  refreshing = ref(false);
let activeController: AbortController | null = null;
const { dialogElement: detailDialogElement, handleCancel: handleDetailCancel } = useModalDialog(
  () => Boolean(selected.value),
  () => (selected.value = null),
);
const sections: Array<{
  value: Section;
  label: string;
  action: string;
  href: string;
}> = [
  {
    value: "score_rules",
    label: "评分规则",
    action: "进入评分规则",
    href: "/opportunities/scoring-rules",
  },
  {
    value: "cost_rules",
    label: "费用与风险",
    action: "进入费用规则",
    href: "/sourcing/cost-rules",
  },
  {
    value: "approval_templates",
    label: "审批工作流",
    action: "进入组织审批",
    href: "/org-admin/approvals",
  },
  {
    value: "automation_rules",
    label: "自动化规则",
    action: "进入自动化规则",
    href: "/automations",
  },
  {
    value: "releases",
    label: "灰度与回滚",
    action: "进入发布控制",
    href: "/platform-admin/releases",
  },
];
const current = computed(() => sections.find((item) => item.value === section.value)!);
const rows = computed<any[]>(() => data.value?.items ?? []);
const pagination = computed<Pagination>(
  () => data.value?.pagination ?? { page: 1, page_size: pageSize, total: 0, total_pages: 0 },
);
const statusOptions = computed(() => sectionStatuses[section.value]);
const hasLoadedFacts = computed(() => Boolean(data.value?.observed_at));
const activeFilterCount = computed(
  () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
);
const rangeLabel = computed(() => {
  if (!pagination.value.total) return "0 条";
  const start = (pagination.value.page - 1) * pagination.value.page_size + 1,
    end = Math.min(pagination.value.page * pagination.value.page_size, pagination.value.total);
  return `${start}–${end} / ${pagination.value.total} 条`;
});
const summaryName = (key: string) =>
  (
    ({
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
      provider_versions: "来源配置版本",
    }) as Record<string, string>
  )[key] ?? key;
const statusName = (value: unknown) =>
  (
    ({
      active: "启用",
      paused: "暂停",
      draft: "草稿",
      pending_approval: "待审批",
      published: "已发布",
      approved: "已批准",
      rejected: "已驳回",
      retired: "已退役",
      archived: "已归档",
      planned: "已计划",
      preflight_passed: "预检通过",
      deploying: "发布中",
      healthy: "运行健康",
      failed: "失败",
      rolled_back: "已回滚",
    }) as Record<string, string>
  )[String(value)] ?? String(value ?? "—");
const typeName = (value: unknown) =>
  (
    ({
      "approval.overdue": "审批节点超时",
      "approval.node.rejected": "审批被驳回",
      "competitor.alert.queued": "竞品告警入队",
      "competitor.changed": "竞品发生变化",
      "task.created": "任务创建",
      notify_owner: "通知负责人",
      create_task: "创建人工任务",
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
    }) as Record<string, string>
  )[String(value)] ?? String(value ?? "—");
const editHref = (item: any) =>
  section.value === "automation_rules"
    ? `/automations?rule=${item.id}&action=edit`
    : current.value.href;
const versionText = (item: any) => {
  if (section.value === "releases") return item.name ? `版本 ${item.name}` : "未记录版本";
  if (section.value === "approval_templates")
    return `第 ${item.current_version ?? item.revision} 版`;
  if (section.value === "automation_rules") return `第 ${item.version} 版`;
  return `第 ${item.revision} 版`;
};
const failureState = (error: ApiClientError): State =>
  error.kind === "expired" || error.kind === "forbidden"
    ? error.kind
    : error.kind === "blocked" || error.kind === "rate_limited"
      ? "blocked"
      : "error";
async function syncUrl() {
  const next: Record<string, string> = {};
  if (section.value !== "score_rules") next.section = section.value;
  if (query.value) next.q = query.value;
  if (status.value) next.status = status.value;
  if (page.value > 1) next.page = String(page.value);
  await router.replace({ query: next });
}
async function load(options: { updateUrl?: boolean } = {}) {
  if (refreshing.value) return;
  const hadData = hasLoadedFacts.value;
  refreshing.value = true;
  if (!hadData) state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({
    domain: "governance",
    section: section.value,
    page: String(page.value),
    page_size: String(pageSize),
  });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    if (options.updateUrl !== false) await syncUrl();
    const response = await request<any>(`/platform/management?${params}`, {
      signal: controller.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    page.value = response.data.pagination.page;
    if (options.updateUrl !== false) await syncUrl();
    state.value = response.data.pagination.total ? "ready" : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = controller.signal.aborted
      ? "读取超过 15 秒，已安全取消；上一份治理事实仍保留。"
      : (failure?.actionHint ?? "网络或服务异常，上一份治理事实仍保留。");
    state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) activeController = null;
    refreshing.value = false;
  }
}
function selectSection(value: Section) {
  if (refreshing.value || value === section.value) return;
  section.value = value;
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  selected.value = null;
  void load();
}
function applyFilters() {
  if (refreshing.value) return;
  query.value = queryDraft.value.trim();
  status.value = statusDraft.value;
  page.value = 1;
  void load();
}
function resetFilters() {
  if (refreshing.value) return;
  query.value = "";
  queryDraft.value = "";
  status.value = "";
  statusDraft.value = "";
  page.value = 1;
  void load();
}
function goToPage(nextPage: number) {
  if (
    refreshing.value ||
    nextPage < 1 ||
    nextPage > pagination.value.total_pages ||
    nextPage === page.value
  )
    return;
  page.value = nextPage;
  void load();
}
onMounted(() => void load());
onBeforeUnmount(() => activeController?.abort());
</script>

<template>
  <section class="platform-governance">
    <header>
      <div>
        <p>平台规则中心</p>
        <h2>规则、工作流与自动化</h2>
        <span
          >统一核对跨组织规则版本、审批、自动化和发布回滚；写操作进入对应受权限保护的工作台。</span
        >
      </div>
      <div class="governance-header-actions">
        <button type="button" :disabled="refreshing" @click="load()">
          {{ refreshing ? "刷新中…" : "刷新事实" }}
        </button>
        <RouterLink :to="current.href">{{ current.action }}</RouterLink>
      </div>
    </header>
    <ResponsiveFilterDrawer label="筛选治理记录" :active-count="activeFilterCount">
      <form @submit.prevent="applyFilters">
        <label>
          <span>搜索</span>
          <input v-model="queryDraft" placeholder="搜索规则、版本、组织或工作区" maxlength="120" />
        </label>
        <label>
          <span>状态</span>
          <select v-model="statusDraft" aria-label="治理状态">
            <option value="">全部状态</option>
            <option v-for="value in statusOptions" :key="value" :value="value">
              {{ statusName(value) }}
            </option>
          </select>
        </label>
        <div class="governance-filter-actions">
          <button type="submit" :disabled="refreshing">应用筛选</button>
          <button type="button" :disabled="refreshing || !activeFilterCount" @click="resetFilters">
            重置
          </button>
        </div>
      </form>
    </ResponsiveFilterDrawer>
    <p v-if="message" class="governance-notice">{{ message }}</p>
    <section v-if="!hasLoadedFacts && state !== 'ready'" class="governance-state">
      <h3>
        {{
          state === "loading"
            ? "正在读取治理事实"
            : state === "expired"
              ? "登录状态已失效"
              : state === "forbidden"
                ? "当前账号无平台治理权限"
                : "治理数据暂不可用"
        }}
      </h3>
      <button v-if="state !== 'loading'" @click="load()">重新加载</button>
    </section>
    <template v-else>
      <div class="governance-summary">
        <article v-for="(value, key) in data.summary" :key="key">
          <small>{{ summaryName(String(key)) }}总量</small><strong>{{ value }}</strong>
        </article>
      </div>
      <nav aria-label="治理数据类型">
        <button
          v-for="item in sections"
          :key="item.value"
          :aria-current="section === item.value ? 'page' : undefined"
          :disabled="refreshing"
          @click="selectSection(item.value)"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="governance-table">
        <ResponsiveDataView
          :rows="rows"
          :row-key="(item) => item.id"
          :title="current.label"
          :detail-title="(item) => item.name"
          empty-message="当前分类没有匹配记录。"
        >
          <template #desktop
            ><table>
              <thead>
                <tr>
                  <th>名称 / 版本</th>
                  <th>组织 / 工作区</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>版本</th>
                  <th>更新时间</th>
                  <th>操作</th>
                  <th>技术信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in rows" :key="item.id">
                  <td>
                    <strong>{{ item.name }}</strong>
                  </td>
                  <td>
                    {{ item.organization_name || "平台全局"
                    }}<small>{{ item.workspace_name || item.stage || "—" }}</small>
                  </td>
                  <td>
                    {{
                      typeName(
                        item.trigger_event_type || item.resource_type || item.platform || section,
                      )
                    }}
                  </td>
                  <td>
                    <b>{{ statusName(item.status) }}</b>
                  </td>
                  <td>{{ versionText(item) }}</td>
                  <td>
                    {{ item.updated_at ? new Date(item.updated_at).toLocaleString("zh-CN") : "—" }}
                  </td>
                  <td>
                    <button type="button" @click="selected = item">查看详情</button
                    ><RouterLink :to="editHref(item)">{{
                      section === "automation_rules" ? "编辑规则" : "进入工作台"
                    }}</RouterLink>
                  </td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <code>{{ item.version_code || item.id }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table></template
          >
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ row.name }} · {{ statusName(row.status) }}</strong>
              <small>{{ row.organization_name || "平台全局" }} · {{ versionText(row) }}</small>
            </span>
          </template>
          <template #detail="{ row }">
            <dl>
              <div>
                <dt>所属组织</dt>
                <dd>{{ row.organization_name || "平台全局" }}</dd>
              </div>
              <div>
                <dt>工作区或阶段</dt>
                <dd>{{ row.workspace_name || row.stage || "—" }}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>
                  {{
                    typeName(row.trigger_event_type || row.resource_type || row.platform || section)
                  }}
                </dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{{ statusName(row.status) }}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>{{ versionText(row) }}</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>
                  {{ row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "—" }}
                </dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>记录 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div v-if="row.version_code">
                  <dt>版本代码</dt>
                  <dd>{{ row.version_code }}</dd>
                </div>
              </dl>
            </details>
            <RouterLink :to="editHref(row)">{{
              section === "automation_rules" ? "进入规则编辑" : "进入所属工作台"
            }}</RouterLink>
          </template>
        </ResponsiveDataView>
        <footer class="governance-pagination" aria-label="治理记录分页">
          <span>{{ rangeLabel }}</span>
          <nav v-if="pagination.total_pages > 1" aria-label="治理页码">
            <button
              type="button"
              :disabled="refreshing || pagination.page <= 1"
              @click="goToPage(pagination.page - 1)"
            >
              上一页
            </button>
            <span>第 {{ pagination.page }} / {{ pagination.total_pages }} 页</span>
            <button
              type="button"
              :disabled="refreshing || pagination.page >= pagination.total_pages"
              @click="goToPage(pagination.page + 1)"
            >
              下一页
            </button>
          </nav>
        </footer>
      </div>
      <aside>
        <strong>配置版本</strong
        ><span
          >来源配置历史版本 {{ data.summary.provider_versions }} 个；最近变更
          {{
            data.provider_versions_latest_at
              ? new Date(data.provider_versions_latest_at).toLocaleString("zh-CN")
              : "暂无"
          }}。</span
        ><RouterLink to="/platform-admin/providers">进入来源版本管理</RouterLink>
      </aside>
      <footer>
        跨组织查看不会绕过业务权限；编辑、启停和发布仍使用版本锁并写入审计记录。
        <span v-if="data.observed_at">
          事实时间 {{ new Date(data.observed_at).toLocaleString("zh-CN") }}
        </span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <span>请求 ID {{ requestId }}</span>
        </details>
      </footer>
    </template>
    <dialog
      ref="detailDialogElement"
      class="governance-detail"
      :aria-label="selected ? `${selected.name}详情` : '治理详情'"
      @cancel="handleDetailCancel"
    >
      <section v-if="selected">
        <header>
          <div>
            <small>{{ current.label }}详情</small>
            <h3>{{ selected.name }}</h3>
          </div>
          <button aria-label="关闭" @click="selected = null">×</button>
        </header>
        <dl>
          <div>
            <dt>所属组织</dt>
            <dd>{{ selected.organization_name || "平台全局" }}</dd>
          </div>
          <div>
            <dt>工作区或阶段</dt>
            <dd>{{ selected.workspace_name || selected.stage || "—" }}</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{{ statusName(selected.status) }}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>
              {{ versionText(selected) }}
            </dd>
          </div>
          <div v-if="selected.trigger_event_type">
            <dt>触发条件</dt>
            <dd>
              {{ typeName(selected.trigger_event_type) }}，严重程度
              {{
                selected.condition_severity === "any"
                  ? "不限"
                  : statusName(selected.condition_severity)
              }}
            </dd>
          </div>
          <div v-if="selected.action_type">
            <dt>执行动作</dt>
            <dd>{{ typeName(selected.action_type) }}：{{ selected.action_title }}</dd>
          </div>
          <div v-if="selected.rate_limit_count">
            <dt>执行频率上限</dt>
            <dd>
              {{ selected.rate_limit_count }} 次 / {{ selected.rate_limit_window_minutes }} 分钟
            </dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>
              {{
                selected.updated_at ? new Date(selected.updated_at).toLocaleString("zh-CN") : "—"
              }}
            </dd>
          </div>
        </dl>
        <details>
          <summary>技术详情</summary>
          <dl>
            <div>
              <dt>记录 ID</dt>
              <dd>{{ selected.id }}</dd>
            </div>
            <div v-if="selected.version_code">
              <dt>版本代码</dt>
              <dd>{{ selected.version_code }}</dd>
            </div>
          </dl>
        </details>
        <footer>
          <button @click="selected = null">关闭</button
          ><RouterLink :to="editHref(selected)">{{
            section === "automation_rules" ? "进入规则编辑" : "进入所属工作台"
          }}</RouterLink>
        </footer>
      </section>
    </dialog>
  </section>
</template>

<style scoped>
.platform-governance {
  display: grid;
  gap: 16px;
  color: var(--so-text);
}
.platform-governance > header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 22px;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-panel);
}
.platform-governance p {
  margin: 0;
}
.platform-governance header p {
  color: var(--so-primary);
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.16em;
}
.platform-governance h2 {
  margin: 7px 0;
}
.platform-governance header span,
.platform-governance footer,
.platform-governance small {
  color: var(--so-text-muted);
}
.platform-governance a,
.platform-governance button {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
  text-decoration: none;
}
.governance-header-actions {
  display: flex;
  align-self: flex-start;
  gap: 8px;
}
.governance-header-actions a {
  align-self: flex-start;
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.platform-governance form,
.platform-governance nav {
  display: flex;
  gap: 8px;
}
.platform-governance input,
.platform-governance select {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
}
.platform-governance form input:first-child {
  flex: 1;
}
.platform-governance form label {
  display: grid;
  flex: 1;
  gap: 5px;
  color: var(--so-text-muted);
  font-size: 12px;
}
.platform-governance form label:nth-child(2) {
  max-width: 220px;
}
.governance-filter-actions {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.platform-governance nav {
  flex-wrap: wrap;
}
.platform-governance nav button[aria-current="page"] {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.governance-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 9px;
}
.governance-summary article,
.governance-table,
.platform-governance aside,
.governance-state,
.governance-notice {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.governance-summary small,
.governance-summary strong,
.governance-table small {
  display: block;
}
.governance-summary strong {
  margin-top: 6px;
  font-size: 23px;
}
.governance-table {
  overflow: auto;
}
.governance-table table {
  width: 100%;
  border-collapse: collapse;
}
.governance-table th,
.governance-table td {
  padding: 11px 9px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  font-size: 13px;
}
.governance-table td small {
  margin-top: 4px;
}
.governance-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  text-align: left;
}
.governance-pagination nav {
  align-items: center;
}
.governance-table details summary,
.platform-governance footer details summary,
.governance-detail > section > details summary {
  display: inline-flex;
  min-height: var(--so-touch-target);
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.governance-table code,
.platform-governance footer span,
.governance-detail > section > details dd {
  overflow-wrap: anywhere;
}
.platform-governance aside {
  display: flex;
  align-items: center;
  gap: 12px;
}
.platform-governance aside span {
  flex: 1;
  color: var(--so-text-muted);
}
.platform-governance footer {
  text-align: right;
  font-size: 13px;
}
.governance-detail {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  width: min(620px, calc(100% - 28px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 0;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  z-index: 100;
}
.governance-detail section {
  padding: 22px;
}
.governance-detail header,
.governance-detail footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.governance-detail header h3 {
  margin: 5px 0 0;
}
.governance-detail header button {
  border: 0;
  background: transparent;
  font-size: 24px;
}
.governance-detail dl {
  display: grid;
  gap: 8px;
  margin: 18px 0;
}
.governance-detail dl div {
  display: grid;
  grid-template-columns: 145px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--so-border);
}
.governance-detail dt {
  color: var(--so-text-muted);
}
.governance-detail dd {
  margin: 0;
}
.governance-detail footer {
  justify-content: flex-end;
}
.governance-detail footer a {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
@media (max-width: 760px) {
  .platform-governance > header,
  .platform-governance form,
  .platform-governance aside,
  .governance-pagination {
    flex-direction: column;
  }
  .governance-header-actions,
  .governance-filter-actions,
  .governance-pagination nav {
    width: 100%;
  }
  .governance-header-actions > *,
  .governance-filter-actions > *,
  .governance-pagination nav > button {
    flex: 1;
    text-align: center;
  }
  .platform-governance form label:nth-child(2) {
    max-width: none;
  }
  .platform-governance form input,
  .platform-governance form select,
  .platform-governance form button {
    width: 100%;
  }
}
</style>
