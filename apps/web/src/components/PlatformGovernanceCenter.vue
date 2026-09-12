<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
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
  snapshotScope = ref<{ section: Section; query: string; status: string; page: number } | null>(
    null,
  ),
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
const recordSection = computed(() => snapshotScope.value?.section ?? section.value);
const recordType = computed(() => sections.find((item) => item.value === recordSection.value)!);
const scopeMismatch = computed(() =>
  Boolean(
    snapshotScope.value &&
    (snapshotScope.value.section !== section.value ||
      snapshotScope.value.query !== query.value ||
      snapshotScope.value.status !== status.value ||
      snapshotScope.value.page !== page.value),
  ),
);
const snapshotLabel = computed(() =>
  snapshotScope.value
    ? `${recordType.value.label} · 搜索：${snapshotScope.value.query || "不限"} · 状态：${snapshotScope.value.status ? statusName(snapshotScope.value.status) : "全部"} · 第 ${snapshotScope.value.page} 页`
    : "",
);
const rows = computed<any[]>(() => data.value?.items ?? []);
const pagination = computed<Pagination>(
  () => data.value?.pagination ?? { page: 1, page_size: pageSize, total: 0, total_pages: 0 },
);
const statusOptions = computed(() => sectionStatuses[section.value]);
const hasLoadedFacts = computed(() => Boolean(data.value?.observed_at));
const activeFilterCount = computed(
  () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
);
const sectionDescription = computed(
  () =>
    ({
      score_rules: "核对评分口径、版本与归属，再进入评分规则工作台处理。",
      cost_rules: "核对费用和风险规则的市场范围、版本与责任组织。",
      approval_templates: "核对已发布或归档的审批模板及其业务资源范围。",
      automation_rules: "核对触发条件、执行动作、频率限制与当前版本。",
      releases: "核对发布阶段、构建标识与回滚状态，不在本页执行发布。",
    })[recordSection.value],
);
const searchPlaceholder = computed(
  () =>
    ({
      score_rules: "搜索规则、版本、组织或工作区",
      cost_rules: "搜索名称、版本、市场、平台或组织",
      approval_templates: "搜索名称、资源类型、组织或工作区",
      automation_rules: "搜索名称、触发事件、动作标题或组织",
      releases: "搜索应用版本、构建标识或发布阶段",
    })[section.value],
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
const statusTone = (value: unknown) =>
  (
    ({
      active: "positive",
      approved: "positive",
      published: "positive",
      healthy: "positive",
      preflight_passed: "positive",
      paused: "quiet",
      draft: "quiet",
      planned: "quiet",
      archived: "quiet",
      pending_approval: "attention",
      deploying: "attention",
      failed: "danger",
      rejected: "danger",
      retired: "danger",
      rolled_back: "danger",
    }) as Record<string, string>
  )[String(value)] ?? "quiet";
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
  recordSection.value === "automation_rules"
    ? `/automations?rule=${item.id}&action=edit`
    : recordType.value.href;
const versionText = (item: any) => {
  if (recordSection.value === "releases") return item.name ? `版本 ${item.name}` : "未记录版本";
  if (recordSection.value === "approval_templates")
    return `第 ${item.current_version ?? item.revision} 版`;
  if (recordSection.value === "automation_rules") return `第 ${item.version} 版`;
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
let requestGeneration = 0;
let wasDeactivated = false;
async function load(options: { updateUrl?: boolean } = {}) {
  if (refreshing.value) return;
  const generation = ++requestGeneration;
  const hadData = hasLoadedFacts.value;
  const scope = { section: section.value, query: query.value, status: status.value };
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
    if (generation !== requestGeneration || controller.signal.aborted) return;
    requestId.value = response.request_id;
    data.value = response.data;
    page.value = response.data.pagination.page;
    snapshotScope.value = { ...scope, page: page.value };
    if (options.updateUrl !== false) await syncUrl();
    state.value = response.data.pagination.total ? "ready" : "empty";
  } catch (error) {
    if (generation !== requestGeneration) return;
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = controller.signal.aborted
      ? "读取超过 15 秒，已安全取消；上一份治理事实仍保留。"
      : (failure?.actionHint ?? "网络或服务异常，上一份治理事实仍保留。");
    state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) {
      activeController = null;
      refreshing.value = false;
    }
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
onActivated(() => {
  if (!wasDeactivated) return;
  wasDeactivated = false;
  refreshing.value = false;
  void load({ updateUrl: false });
});
onDeactivated(() => {
  wasDeactivated = true;
  ++requestGeneration;
  activeController?.abort();
  activeController = null;
  refreshing.value = false;
  selected.value = null;
});
onBeforeUnmount(() => {
  ++requestGeneration;
  activeController?.abort();
});
</script>

<template>
  <section class="platform-governance" :aria-busy="refreshing">
    <aside class="governance-directory">
      <div class="governance-directory__intro">
        <p>平台治理</p>
        <h2>治理版本目录</h2>
        <span>跨组织事实 · 不切换当前组织</span>
      </div>
      <nav aria-label="治理数据类型">
        <button
          v-for="item in sections"
          :key="item.value"
          type="button"
          :aria-current="section === item.value ? 'page' : undefined"
          :disabled="refreshing"
          @click="selectSection(item.value)"
        >
          <span>{{ item.label }}</span>
          <b>{{ hasLoadedFacts ? (data.summary[item.value] ?? "—") : "—" }}</b>
        </button>
      </nav>
      <p class="governance-directory__note">
        分类数字是全量统计，不随当前筛选变化。未返回的值显示“—”。
      </p>
      <section class="governance-provider governance-provider--desktop">
        <small>相关事实</small>
        <h3>来源配置历史</h3>
        <p>
          <strong>{{ hasLoadedFacts ? (data.summary.provider_versions ?? "—") : "—" }}</strong>
          个历史版本
        </p>
        <span>
          最近变更：{{
            data.provider_versions_latest_at
              ? new Date(data.provider_versions_latest_at).toLocaleString("zh-CN")
              : "尚未读取"
          }}
        </span>
        <RouterLink to="/platform-admin/providers">进入来源版本管理</RouterLink>
      </section>
    </aside>

    <div class="governance-main">
      <header class="governance-hero">
        <div>
          <p>版本清楚，操作有归属</p>
          <h2>规则、工作流与自动化</h2>
          <span>在这里核对治理事实，在所属工作台处理。</span>
        </div>
        <div class="governance-header-actions">
          <button type="button" :disabled="refreshing" @click="load()">
            {{ refreshing ? "刷新中…" : "刷新事实" }}
          </button>
          <RouterLink class="governance-primary-action" :to="current.href">
            {{ current.action }}
          </RouterLink>
        </div>
      </header>

      <ResponsiveFilterDrawer
        label="筛选治理记录"
        :active-count="activeFilterCount"
        appearance="governance"
      >
        <form class="governance-filter" @submit.prevent="applyFilters">
          <label>
            <span>搜索{{ current.label }}</span>
            <input v-model="queryDraft" :placeholder="searchPlaceholder" maxlength="120" />
            <small>搜索只作用于当前分类的服务端字段。</small>
          </label>
          <label>
            <span>状态</span>
            <select v-model="statusDraft" aria-label="治理状态">
              <option value="">全部状态</option>
              <option v-for="value in statusOptions" :key="value" :value="value">
                {{ statusName(value) }}
              </option>
            </select>
            <small>选项依当前治理类型切换。</small>
          </label>
          <div class="governance-filter-actions">
            <button type="submit" :disabled="refreshing">应用筛选</button>
            <button
              type="button"
              :disabled="refreshing || !activeFilterCount"
              @click="resetFilters"
            >
              重置
            </button>
          </div>
        </form>
      </ResponsiveFilterDrawer>

      <div class="governance-feedback" aria-live="polite">
        <p v-if="message" class="governance-notice">{{ message }}</p>
        <p v-if="scopeMismatch" class="governance-notice" role="status">
          新范围尚未读取成功，仍显示：{{ snapshotLabel }}。记录详情与工作台入口保持原范围。
        </p>
      </div>

      <section v-if="!hasLoadedFacts && state !== 'ready'" class="governance-state" role="status">
        <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
        <p>治理事实</p>
        <h3>
          {{
            state === "loading"
              ? "正在读取治理事实"
              : state === "expired"
                ? "登录状态已失效"
                : state === "forbidden"
                  ? "当前无法查看治理目录"
                  : "治理数据暂不可用"
          }}
        </h3>
        <p>
          {{
            state === "forbidden"
              ? "当前权限还不能读取这些内容。权限调整后，可以重新加载。"
              : state === "loading"
                ? "正在核对版本、组织归属与当前状态。"
                : "请根据上方提示重试；本页不会自动发起写操作。"
          }}
        </p>
        <button v-if="state !== 'loading'" type="button" @click="load()">重新加载</button>
      </section>

      <template v-else>
        <section class="governance-context" aria-labelledby="governance-context-title">
          <div>
            <small>当前成功快照</small>
            <h3 id="governance-context-title">{{ recordType.label }}</h3>
            <p>{{ sectionDescription }}</p>
          </div>
          <dl>
            <div>
              <dt>搜索</dt>
              <dd>{{ snapshotScope?.query || "不限" }}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{{ snapshotScope?.status ? statusName(snapshotScope.status) : "全部" }}</dd>
            </div>
            <div>
              <dt>页码</dt>
              <dd>第 {{ pagination.page }} 页</dd>
            </div>
          </dl>
        </section>

        <section class="governance-table" :aria-label="`${recordType.label}记录`">
          <div class="governance-table__heading">
            <div>
              <strong>{{ rangeLabel }}</strong>
              <span>筛选后的服务端总量 · 每页 20 条</span>
            </div>
          </div>
          <ResponsiveDataView
            :rows="rows"
            :row-key="(item) => item.id"
            :title="recordType.label"
            :detail-title="(item) => item.name"
            appearance="governance"
            empty-message="当前分类没有匹配记录。调整搜索或状态；全局计数仍保留。"
          >
            <template #desktop>
              <table>
                <thead>
                  <tr>
                    <th>记录与版本</th>
                    <th>组织与类型</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!rows.length">
                    <td class="governance-table__empty" colspan="5">
                      <strong>当前分类没有匹配记录</strong>
                      <span>调整搜索或状态；全局计数和来源历史仍保留。</span>
                    </td>
                  </tr>
                  <tr v-for="item in rows" :key="item.id">
                    <td>
                      <strong>{{ item.name }}</strong>
                      <span class="governance-version">{{ versionText(item) }}</span>
                    </td>
                    <td>
                      <strong>{{ item.organization_name || "平台全局" }}</strong>
                      <small>{{ item.workspace_name || item.stage || "—" }}</small>
                      <small>
                        {{
                          typeName(
                            item.trigger_event_type ||
                              item.resource_type ||
                              item.platform ||
                              recordSection,
                          )
                        }}
                      </small>
                    </td>
                    <td>
                      <span class="governance-status" :data-tone="statusTone(item.status)">
                        {{ statusName(item.status) }}
                      </span>
                    </td>
                    <td>
                      {{
                        item.updated_at ? new Date(item.updated_at).toLocaleString("zh-CN") : "—"
                      }}
                    </td>
                    <td>
                      <div class="governance-row-actions">
                        <button type="button" @click="selected = item">查看详情</button>
                        <RouterLink :to="editHref(item)">
                          {{ recordSection === "automation_rules" ? "编辑规则" : "进入工作台" }}
                        </RouterLink>
                      </div>
                      <details>
                        <summary>技术标识</summary>
                        <code>{{ item.version_code || item.id }}</code>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row }">
              <span class="responsive-record-summary">
                <strong>{{ row.name }} · {{ statusName(row.status) }}</strong>
                <small>{{ versionText(row) }} · {{ row.organization_name || "平台全局" }}</small>
              </span>
            </template>
            <template #detail="{ row }">
              <div class="governance-mobile-detail">
                <div class="governance-detail-lead">
                  <small>{{ recordType.label }}</small>
                  <span class="governance-version">{{ versionText(row) }}</span>
                  <span class="governance-status" :data-tone="statusTone(row.status)">
                    {{ statusName(row.status) }}
                  </span>
                </div>
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
                    <dd>{{ typeName(recordSection) }}</dd>
                  </div>
                  <div>
                    <dt>更新时间</dt>
                    <dd>
                      {{ row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "—" }}
                    </dd>
                  </div>
                  <div v-if="row.trigger_event_type">
                    <dt>触发条件</dt>
                    <dd>{{ typeName(row.trigger_event_type) }}</dd>
                  </div>
                  <div v-if="row.condition_severity">
                    <dt>严重程度</dt>
                    <dd>
                      {{
                        row.condition_severity === "any"
                          ? "不限"
                          : statusName(row.condition_severity)
                      }}
                    </dd>
                  </div>
                  <div v-if="row.action_type">
                    <dt>执行动作</dt>
                    <dd>{{ typeName(row.action_type) }}</dd>
                  </div>
                  <div v-if="row.action_title">
                    <dt>动作标题</dt>
                    <dd>{{ row.action_title }}</dd>
                  </div>
                  <div v-if="row.rate_limit_count !== undefined && row.rate_limit_count !== null">
                    <dt>执行频率上限</dt>
                    <dd>
                      {{ row.rate_limit_count }} 次 / {{ row.rate_limit_window_minutes }} 分钟
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
                <RouterLink class="governance-detail-action" :to="editHref(row)">
                  {{ recordSection === "automation_rules" ? "进入规则编辑" : "进入所属工作台" }}
                </RouterLink>
              </div>
            </template>
          </ResponsiveDataView>
          <footer class="governance-pagination" aria-label="治理记录分页">
            <span>按更新时间、ID 倒序</span>
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
        </section>

        <section class="governance-provider governance-provider--mobile">
          <small>相关事实</small>
          <h3>来源配置历史</h3>
          <p>
            <strong>{{ data.summary.provider_versions ?? "—" }}</strong> 个历史版本
          </p>
          <span>
            最近变更：{{
              data.provider_versions_latest_at
                ? new Date(data.provider_versions_latest_at).toLocaleString("zh-CN")
                : "尚未读取"
            }}
          </span>
          <RouterLink to="/platform-admin/providers">进入来源版本管理</RouterLink>
        </section>

        <footer class="governance-footnote">
          <p>跨组织查看不会绕过业务权限；编辑、启停和发布仍使用所属工作台的权限和版本锁。</p>
          <span v-if="data.observed_at">
            事实时间 {{ new Date(data.observed_at).toLocaleString("zh-CN") }}
          </span>
          <TechnicalDetails :request-id="requestId" />
        </footer>
      </template>
    </div>

    <dialog
      ref="detailDialogElement"
      class="governance-detail"
      :aria-label="selected ? `${selected.name}详情` : '治理详情'"
      @cancel="handleDetailCancel"
    >
      <section v-if="selected">
        <header>
          <div>
            <small>{{ recordType.label }}详情</small>
            <h3>{{ selected.name }}</h3>
          </div>
          <button aria-label="关闭" @click="selected = null">×</button>
        </header>
        <div class="governance-detail-lead">
          <span class="governance-version">{{ versionText(selected) }}</span>
          <span class="governance-status" :data-tone="statusTone(selected.status)">
            {{ statusName(selected.status) }}
          </span>
        </div>
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
            <dt>类型</dt>
            <dd>{{ typeName(recordSection) }}</dd>
          </div>
          <div v-if="selected.trigger_event_type">
            <dt>触发条件</dt>
            <dd>{{ typeName(selected.trigger_event_type) }}</dd>
          </div>
          <div v-if="selected.condition_severity">
            <dt>严重程度</dt>
            <dd>
              {{
                selected.condition_severity === "any"
                  ? "不限"
                  : statusName(selected.condition_severity)
              }}
            </dd>
          </div>
          <div v-if="selected.action_type">
            <dt>执行动作</dt>
            <dd>{{ typeName(selected.action_type) }}</dd>
          </div>
          <div v-if="selected.action_title">
            <dt>动作标题</dt>
            <dd>{{ selected.action_title }}</dd>
          </div>
          <div v-if="selected.rate_limit_count !== undefined && selected.rate_limit_count !== null">
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
          ><RouterLink class="governance-detail-action" :to="editHref(selected)">{{
            recordSection === "automation_rules" ? "进入规则编辑" : "进入所属工作台"
          }}</RouterLink>
        </footer>
      </section>
    </dialog>
  </section>
</template>

<style src="../platform-governance.css"></style>
