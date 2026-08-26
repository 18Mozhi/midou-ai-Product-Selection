<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const props = defineProps<{
  templates: any[];
  approvals: any[];
  summary: Record<string, number>;
  statusText: (value: string) => string;
  summaryText: (value: string) => string;
  formatTime: (value: string) => string;
}>();

type Section = "requests" | "templates";

const route = useRoute(),
  router = useRouter(),
  section = ref<Section>(
    queryChoice("approval_view", ["requests", "templates"], "requests") as Section,
  ),
  requestQuery = ref(queryText("approval_request_query")),
  requestStatus = ref(
    queryChoice(
      "approval_request_status",
      ["all", "pending", "approved", "rejected", "cancelled"],
      "all",
    ),
  ),
  requestWorkspace = ref(queryText("approval_request_workspace") || "all"),
  requestResource = ref(
    queryChoice("approval_request_resource", ["all", "task", "opportunity_decision"], "all"),
  ),
  requestSort = ref(
    queryChoice(
      "approval_request_sort",
      ["created_desc", "created_asc", "title_asc", "status_asc"],
      "created_desc",
    ),
  ),
  requestPage = ref(queryPage("approval_request_page")),
  templateQuery = ref(queryText("approval_template_query")),
  templateStatus = ref(
    queryChoice("approval_template_status", ["all", "published", "draft", "archived"], "all"),
  ),
  templateWorkspace = ref(queryText("approval_template_workspace") || "all"),
  templateResource = ref(
    queryChoice("approval_template_resource", ["all", "task", "opportunity_decision"], "all"),
  ),
  templateSort = ref(
    queryChoice(
      "approval_template_sort",
      ["name_asc", "updated_desc", "nodes_desc", "workspace_asc"],
      "name_asc",
    ),
  ),
  templatePage = ref(queryPage("approval_template_page")),
  selectedTemplateId = ref("");

const requestPageSize = 8,
  templatePageSize = 6,
  templateStatusLabels: Record<string, string> = {
    published: "已发布",
    draft: "草稿",
    archived: "已归档",
  },
  requestStatusLabels: Record<string, string> = {
    pending: "待处理",
    approved: "已通过",
    rejected: "已驳回",
    cancelled: "已取消",
  },
  resourceLabels: Record<string, string> = {
    task: "业务任务",
    opportunity_decision: "机会决策",
  };

const templateById = computed(
    () => new Map(props.templates.map((template) => [String(template.id), template])),
  ),
  workspaces = computed(() =>
    [
      ...new Set(
        props.templates.map((template) => String(template.workspace_name || "未命名工作区")),
      ),
    ].sort((left, right) => left.localeCompare(right, "zh-CN")),
  ),
  requestTotal = computed(() =>
    Object.values(props.summary).reduce((total, value) => total + Number(value || 0), 0),
  ),
  templateMetrics = computed(() => ({
    total: props.templates.length,
    published: props.templates.filter((template) => template.status === "published").length,
    draft: props.templates.filter((template) => template.status === "draft").length,
    archived: props.templates.filter((template) => template.status === "archived").length,
  })),
  filteredRequests = computed(() => {
    const query = requestQuery.value.trim().toLocaleLowerCase("zh-CN");
    return props.approvals
      .filter((approval) => {
        const template = templateById.value.get(String(approval.template_id));
        return (
          (!query ||
            [approval.title, template?.name, template?.workspace_name]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(query))) &&
          (requestStatus.value === "all" || approval.status === requestStatus.value) &&
          (requestWorkspace.value === "all" ||
            template?.workspace_name === requestWorkspace.value) &&
          (requestResource.value === "all" || approval.resource_type === requestResource.value)
        );
      })
      .sort((left, right) => {
        if (requestSort.value === "created_asc")
          return Date.parse(left.created_at) - Date.parse(right.created_at);
        if (requestSort.value === "title_asc")
          return String(left.title).localeCompare(String(right.title), "zh-CN");
        if (requestSort.value === "status_asc")
          return requestLabel(left.status).localeCompare(requestLabel(right.status), "zh-CN");
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }),
  requestPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredRequests.value.length / requestPageSize)),
  ),
  visibleRequests = computed(() =>
    filteredRequests.value.slice(
      (requestPage.value - 1) * requestPageSize,
      requestPage.value * requestPageSize,
    ),
  ),
  filteredTemplates = computed(() => {
    const query = templateQuery.value.trim().toLocaleLowerCase("zh-CN");
    return props.templates
      .filter(
        (template) =>
          (!query ||
            [template.name, template.workspace_name]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(query))) &&
          (templateStatus.value === "all" || template.status === templateStatus.value) &&
          (templateWorkspace.value === "all" ||
            template.workspace_name === templateWorkspace.value) &&
          (templateResource.value === "all" || template.resource_type === templateResource.value),
      )
      .sort((left, right) => {
        if (templateSort.value === "updated_desc")
          return Number(right.current_version) - Number(left.current_version);
        if (templateSort.value === "nodes_desc")
          return Number(right.node_count) - Number(left.node_count);
        if (templateSort.value === "workspace_asc")
          return String(left.workspace_name).localeCompare(String(right.workspace_name), "zh-CN");
        return String(left.name).localeCompare(String(right.name), "zh-CN");
      });
  }),
  templatePageCount = computed(() =>
    Math.max(1, Math.ceil(filteredTemplates.value.length / templatePageSize)),
  ),
  visibleTemplates = computed(() =>
    filteredTemplates.value.slice(
      (templatePage.value - 1) * templatePageSize,
      templatePage.value * templatePageSize,
    ),
  ),
  selectedTemplate = computed(
    () =>
      filteredTemplates.value.find(
        (template) => String(template.id) === selectedTemplateId.value,
      ) ?? filteredTemplates.value[0],
  );

watch(
  [requestQuery, requestStatus, requestWorkspace, requestResource, requestSort],
  () => (requestPage.value = 1),
);
watch(
  [templateQuery, templateStatus, templateWorkspace, templateResource, templateSort],
  () => (templatePage.value = 1),
);
watch(requestPageCount, (count) => {
  if (requestPage.value > count) requestPage.value = count;
});
watch(templatePageCount, (count) => {
  if (templatePage.value > count) templatePage.value = count;
});
watch(
  [
    section,
    requestQuery,
    requestStatus,
    requestWorkspace,
    requestResource,
    requestSort,
    requestPage,
    templateQuery,
    templateStatus,
    templateWorkspace,
    templateResource,
    templateSort,
    templatePage,
  ],
  () => {
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "approval_view", section.value, "requests");
    setQuery(query, "approval_request_query", requestQuery.value, "");
    setQuery(query, "approval_request_status", requestStatus.value, "all");
    setQuery(query, "approval_request_workspace", requestWorkspace.value, "all");
    setQuery(query, "approval_request_resource", requestResource.value, "all");
    setQuery(query, "approval_request_sort", requestSort.value, "created_desc");
    setQuery(query, "approval_request_page", String(requestPage.value), "1");
    setQuery(query, "approval_template_query", templateQuery.value, "");
    setQuery(query, "approval_template_status", templateStatus.value, "all");
    setQuery(query, "approval_template_workspace", templateWorkspace.value, "all");
    setQuery(query, "approval_template_resource", templateResource.value, "all");
    setQuery(query, "approval_template_sort", templateSort.value, "name_asc");
    setQuery(query, "approval_template_page", String(templatePage.value), "1");
    void router.replace({ query });
  },
  { flush: "post" },
);
watch(
  () => props.templates,
  (templates) => {
    if (!templates.some((template) => String(template.id) === selectedTemplateId.value))
      selectedTemplateId.value = String(templates[0]?.id ?? "");
  },
  { immediate: true },
);

function templateLabel(value: string) {
  return templateStatusLabels[value] ?? `未知状态（${value || "空"}）`;
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
function requestLabel(value: string) {
  return requestStatusLabels[value] ?? `未知状态（${value || "空"}）`;
}
function resourceLabel(value: string) {
  return resourceLabels[value] ?? `未知类型（${value || "空"}）`;
}
function templateFor(approval: any) {
  return templateById.value.get(String(approval.template_id));
}
function resetRequests() {
  requestQuery.value = "";
  requestStatus.value = "all";
  requestWorkspace.value = "all";
  requestResource.value = "all";
  requestSort.value = "created_desc";
}
function resetTemplates() {
  templateQuery.value = "";
  templateStatus.value = "all";
  templateWorkspace.value = "all";
  templateResource.value = "all";
  templateSort.value = "name_asc";
}
</script>

<template>
  <section class="org-approval-governance" aria-labelledby="org-approval-title">
    <header class="org-approval-overview">
      <div>
        <p>APPROVAL GOVERNANCE · 只读治理</p>
        <h3 id="org-approval-title">跨工作区审批态势</h3>
        <span>核对模板版本与审批流转，不在组织后台绕过业务工作区作出决策。</span>
      </div>
      <aside aria-label="审批治理边界">
        <b>只读边界</b>
        <span>发布、回退和审批决定继续由原业务审批合同处理。</span>
      </aside>
    </header>

    <div class="org-approval-metrics" aria-label="审批汇总">
      <article>
        <span>审批总量</span><b>{{ requestTotal }}</b
        ><small>服务端全量状态汇总</small>
      </article>
      <article data-tone="pending">
        <span>待处理</span><b>{{ summary.pending ?? 0 }}</b
        ><small>需要业务审批人处理</small>
      </article>
      <article data-tone="approved">
        <span>已通过</span><b>{{ summary.approved ?? 0 }}</b
        ><small>流程已同意</small>
      </article>
      <article data-tone="rejected">
        <span>已驳回</span><b>{{ summary.rejected ?? 0 }}</b
        ><small>流程已拒绝</small>
      </article>
      <article data-tone="cancelled">
        <span>已取消</span><b>{{ summary.cancelled ?? 0 }}</b
        ><small>申请已终止</small>
      </article>
      <article>
        <span>模板覆盖</span><b>{{ templateMetrics.total }}</b
        ><small>{{ templateMetrics.published }} 个已发布</small>
      </article>
    </div>

    <nav class="org-approval-section-tabs" aria-label="审批治理视图">
      <button :aria-pressed="section === 'requests'" @click="section = 'requests'">
        审批记录 <span>{{ approvals.length }}</span>
      </button>
      <button :aria-pressed="section === 'templates'" @click="section = 'templates'">
        模板版本 <span>{{ templates.length }}</span>
      </button>
    </nav>

    <section v-if="section === 'requests'" class="org-approval-section">
      <header class="org-approval-section-heading">
        <div>
          <p>审批记录</p>
          <h4>谁在等待处理，哪些流程已经结束</h4>
        </div>
        <span>当前接口最多返回最近 100 条；汇总数字不等同于当前列表条数。</span>
      </header>
      <div class="org-approval-toolbar">
        <label class="org-approval-search">
          <span>搜索审批</span>
          <input v-model="requestQuery" type="search" placeholder="审批标题、模板或工作区" />
        </label>
        <label>
          <span>状态</span>
          <select v-model="requestStatus">
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="cancelled">已取消</option>
          </select>
        </label>
        <label>
          <span>工作区</span>
          <select v-model="requestWorkspace">
            <option value="all">全部工作区</option>
            <option v-for="workspace in workspaces" :key="workspace" :value="workspace">
              {{ workspace }}
            </option>
          </select>
        </label>
        <label>
          <span>资源类型</span>
          <select v-model="requestResource">
            <option value="all">全部类型</option>
            <option value="task">业务任务</option>
            <option value="opportunity_decision">机会决策</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select v-model="requestSort">
            <option value="created_desc">最新提交优先</option>
            <option value="created_asc">最早提交优先</option>
            <option value="title_asc">标题 A–Z</option>
            <option value="status_asc">状态排序</option>
          </select>
        </label>
        <button type="button" @click="resetRequests">重置</button>
      </div>

      <div v-if="visibleRequests.length" class="org-approval-request-list">
        <article v-for="approval in visibleRequests" :key="approval.id">
          <header>
            <div>
              <span>
                {{ templateFor(approval)?.workspace_name || "未知工作区" }}
                · {{ resourceLabel(approval.resource_type) }}
              </span>
              <h5>{{ approval.title }}</h5>
            </div>
            <i :data-status="approval.status">{{ requestLabel(approval.status) }}</i>
          </header>
          <dl>
            <div>
              <dt>使用模板</dt>
              <dd>{{ templateFor(approval)?.name || "模板已不可见" }}</dd>
            </div>
            <div>
              <dt>当前阶段</dt>
              <dd>第 {{ approval.current_node_ordinal }} 阶段</dd>
            </div>
            <div>
              <dt>提交时间</dt>
              <dd>{{ formatTime(approval.created_at) }}</dd>
            </div>
            <div>
              <dt>完成时间</dt>
              <dd>{{ approval.completed_at ? formatTime(approval.completed_at) : "尚未完成" }}</dd>
            </div>
          </dl>
          <details class="org-approval-technical">
            <summary>技术详情</summary>
            <code>审批记录 ID：{{ approval.id }}</code>
            <code>业务资源 ID：{{ approval.resource_id }}</code>
            <code>模板 ID：{{ approval.template_id }}</code>
          </details>
        </article>
      </div>
      <div v-else class="org-approval-empty" role="status">
        <span>0</span>
        <div>
          <h5>{{ approvals.length ? "没有符合条件的审批" : "暂无组织级审批记录" }}</h5>
          <p>
            {{
              approvals.length
                ? "调整筛选条件或重置后再查看。"
                : "新的业务审批申请出现后会显示在这里，不会用示例记录填充。"
            }}
          </p>
        </div>
      </div>
      <footer v-if="filteredRequests.length" class="org-approval-pagination">
        <span
          >共 {{ filteredRequests.length }} 条，当前第 {{ requestPage }} /
          {{ requestPageCount }} 页</span
        >
        <div>
          <button :disabled="requestPage <= 1" @click="requestPage--">上一页</button>
          <button :disabled="requestPage >= requestPageCount" @click="requestPage++">下一页</button>
        </div>
      </footer>
    </section>

    <section v-else class="org-approval-section">
      <header class="org-approval-section-heading">
        <div>
          <p>审批模板</p>
          <h4>当前版本与最近持久化版本的真实差异</h4>
        </div>
        <span>不按模板名称猜测节点身份；首版和无差异版本会明确说明。</span>
      </header>
      <div class="org-approval-template-summary">
        <span
          ><b>{{ templateMetrics.published }}</b
          >已发布</span
        >
        <span
          ><b>{{ templateMetrics.draft }}</b
          >草稿</span
        >
        <span
          ><b>{{ templateMetrics.archived }}</b
          >已归档</span
        >
      </div>
      <div class="org-approval-toolbar">
        <label class="org-approval-search">
          <span>搜索模板</span>
          <input v-model="templateQuery" type="search" placeholder="模板名称或工作区" />
        </label>
        <label>
          <span>状态</span>
          <select v-model="templateStatus">
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
        </label>
        <label>
          <span>工作区</span>
          <select v-model="templateWorkspace">
            <option value="all">全部工作区</option>
            <option v-for="workspace in workspaces" :key="workspace" :value="workspace">
              {{ workspace }}
            </option>
          </select>
        </label>
        <label>
          <span>资源类型</span>
          <select v-model="templateResource">
            <option value="all">全部类型</option>
            <option value="task">业务任务</option>
            <option value="opportunity_decision">机会决策</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select v-model="templateSort">
            <option value="name_asc">名称 A–Z</option>
            <option value="updated_desc">版本号从高到低</option>
            <option value="nodes_desc">节点数从多到少</option>
            <option value="workspace_asc">工作区排序</option>
          </select>
        </label>
        <button type="button" @click="resetTemplates">重置</button>
      </div>

      <div v-if="filteredTemplates.length" class="org-approval-template-browser">
        <div class="org-approval-template-directory">
          <button
            v-for="template in visibleTemplates"
            :key="template.id"
            type="button"
            :class="{ 'is-selected': selectedTemplate?.id === template.id }"
            :aria-pressed="selectedTemplate?.id === template.id"
            @click="selectedTemplateId = String(template.id)"
          >
            <span>{{ template.workspace_name }}</span>
            <b>{{ template.name }}</b>
            <small
              >{{ resourceLabel(template.resource_type) }} · {{ template.node_count }} 个节点</small
            >
            <i :data-status="template.status">{{ templateLabel(template.status) }}</i>
          </button>
          <footer class="org-approval-pagination">
            <span>第 {{ templatePage }} / {{ templatePageCount }} 页</span>
            <div>
              <button :disabled="templatePage <= 1" @click="templatePage--">上一页</button>
              <button :disabled="templatePage >= templatePageCount" @click="templatePage++">
                下一页
              </button>
            </div>
          </footer>
        </div>

        <article v-if="selectedTemplate" class="org-approval-template-detail">
          <header>
            <div>
              <span>{{ selectedTemplate.workspace_name }}</span>
              <h5>{{ selectedTemplate.name }}</h5>
              <small>{{ resourceLabel(selectedTemplate.resource_type) }}</small>
            </div>
            <i :data-status="selectedTemplate.status">
              {{ templateLabel(selectedTemplate.status) }}
            </i>
          </header>
          <dl>
            <div>
              <dt>当前版本</dt>
              <dd>v{{ selectedTemplate.current_version }}</dd>
            </div>
            <div>
              <dt>模板修订</dt>
              <dd>{{ selectedTemplate.revision }}</dd>
            </div>
            <div>
              <dt>当前节点</dt>
              <dd>{{ selectedTemplate.node_count }} 个</dd>
            </div>
            <div>
              <dt>对比范围</dt>
              <dd v-if="selectedTemplate.version_diff.from_version">
                v{{ selectedTemplate.version_diff.from_version }} → v{{
                  selectedTemplate.version_diff.to_version
                }}
              </dd>
              <dd v-else>首个持久化版本</dd>
            </div>
          </dl>
          <section class="org-approval-version-diff">
            <header>
              <div>
                <span>VERSION DIFF</span>
                <h6>版本变化</h6>
              </div>
              <b>{{ selectedTemplate.version_diff.change_count }} 个节点变化</b>
            </header>
            <div v-if="!selectedTemplate.version_diff.from_version" class="org-approval-diff-empty">
              这是首个版本，没有上一持久化版本可比较。
            </div>
            <div
              v-else-if="!selectedTemplate.version_diff.changes.length"
              class="org-approval-diff-empty"
            >
              节点顺序、审批人、处理时限和超时接收人均未变化。
            </div>
            <template v-else>
              <article
                v-for="change in selectedTemplate.version_diff.changes"
                :key="`${selectedTemplate.id}-${change.ordinal}`"
                :data-kind="change.kind"
              >
                <header>
                  <span>第 {{ change.ordinal }} 节点</span>
                  <b>{{ change.node_name }}</b>
                  <i>{{
                    change.kind === "added" ? "新增" : change.kind === "removed" ? "移除" : "变更"
                  }}</i>
                </header>
                <p v-if="change.kind === 'added'">当前版本新增了这个审批节点。</p>
                <p v-else-if="change.kind === 'removed'">当前版本已移除这个审批节点。</p>
                <dl v-else>
                  <div v-for="field in change.fields" :key="field.field">
                    <dt>{{ field.label }}</dt>
                    <dd>
                      <del>{{ field.before ?? "未设置" }}</del
                      ><span>→</span><ins>{{ field.after ?? "未设置" }}</ins>
                    </dd>
                  </div>
                </dl>
              </article>
            </template>
          </section>
          <details class="org-approval-technical">
            <summary>技术详情</summary>
            <code>模板 ID：{{ selectedTemplate.id }}</code>
          </details>
        </article>
      </div>
      <div v-else class="org-approval-empty" role="status">
        <span>0</span>
        <div>
          <h5>{{ templates.length ? "没有符合条件的模板" : "暂无审批模板" }}</h5>
          <p>
            {{
              templates.length
                ? "调整筛选条件或重置后再查看。"
                : "模板仍由对应工作区审批合同维护，本页不会创建示例模板。"
            }}
          </p>
        </div>
      </div>
    </section>

    <footer class="org-approval-links">
      <div>
        <span>需要处理业务审批？</span>
        <b>组织后台只做治理观察，审批动作回到任务工作台完成。</b>
      </div>
      <RouterLink to="/tasks/approvals">前往审批工作台</RouterLink>
      <RouterLink to="/org-admin/audit">查看组织审计</RouterLink>
    </footer>
  </section>
</template>
