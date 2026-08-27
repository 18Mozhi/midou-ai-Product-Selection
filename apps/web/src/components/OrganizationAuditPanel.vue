<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../organization-audit.css";

type AuditFilters = {
  action: string;
  outcome: string;
  resource_type: string;
  request_id: string;
  trace_id: string;
  occurred_from: string;
  occurred_to: string;
};

const props = defineProps<{
    events: any[];
    nextCursor: string | null;
    filters: AuditFilters;
    busy: boolean;
    formatTime: (value: string) => string;
    applyFilters: (filters: AuditFilters) => Promise<void>;
    loadMore: () => Promise<void>;
  }>(),
  route = useRoute(),
  router = useRouter(),
  loadedQuery = ref(queryText("org_audit_query", 160)),
  selectedId = ref(queryText("org_audit_selected", 36)),
  form = ref(formFromFilters(props.filters)),
  validationMessage = ref(""),
  copyState = ref("");

const actionLabels: Record<string, string> = {
    "organization.profile.updated": "组织资料已更新",
    "organization.member.invited": "成员邀请已创建",
    "organization.member.role_assigned": "成员角色已调整",
    "organization.workspace.created": "工作区已创建",
    "organization.team.member_assigned": "团队成员已分配",
    "organization.token.created": "组织令牌已创建",
    "approval.request.approved": "审批请求已通过",
    "report.export.created": "报表导出已创建",
    "business_task.updated": "业务任务已更新",
    "automation.rule.updated": "自动化规则已更新",
    "organization.collection.run.completed": "组织采集已完成",
    "organization.collection.run.failed": "组织采集执行失败",
    "organization.collection.run.blocked": "组织采集被阻止",
    "organization.erp.import.completed": "ERP 导入已完成",
  },
  resourceLabels: Record<string, string> = {
    organization: "组织",
    membership: "成员关系",
    workspace: "工作区",
    team: "团队",
    organization_api_token: "组织令牌",
    approval_request: "审批请求",
    report_export: "报表导出",
    task: "业务任务",
    automation_rule: "自动化规则",
    collection_run: "采集运行",
    erp_import: "ERP 导入",
  },
  outcomeLabels: Record<string, string> = {
    succeeded: "成功",
    failed: "失败",
    blocked: "已阻止",
  };

const visibleEvents = computed(() => {
    const query = loadedQuery.value.trim().toLocaleLowerCase("zh-CN");
    if (!query) return props.events;
    return props.events.filter((event) =>
      [
        actionLabel(event.action),
        event.action,
        resourceLabel(event.resource_type),
        event.resource_type,
        outcomeLabel(event.outcome),
        event.request_id,
        event.trace_id,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("zh-CN")
          .includes(query),
      ),
    );
  }),
  selectedEvent = computed(
    () =>
      visibleEvents.value.find((event) => event.id === selectedId.value) ??
      visibleEvents.value[0] ??
      null,
  ),
  loadedCounts = computed(() =>
    props.events.reduce(
      (counts, event) => {
        if (event.outcome === "succeeded") counts.succeeded += 1;
        if (event.outcome === "failed") counts.failed += 1;
        if (event.outcome === "blocked") counts.blocked += 1;
        return counts;
      },
      { succeeded: 0, failed: 0, blocked: 0 },
    ),
  ),
  sanitizedMetadata = computed(() => sanitizeMetadata(selectedEvent.value?.metadata));

watch(
  () => props.filters,
  (filters) => (form.value = formFromFilters(filters)),
  { deep: true },
);
watch(
  [loadedQuery, selectedId],
  () => {
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "org_audit_query", loadedQuery.value);
    setQuery(query, "org_audit_selected", selectedId.value);
    void router.replace({ query });
  },
  { flush: "post" },
);
watch(visibleEvents, (events) => {
  if (!events.length) selectedId.value = "";
  else if (!events.some((event) => event.id === selectedId.value)) selectedId.value = events[0].id;
});

function queryText(key: string, maximum: number) {
  const value = route.query[key];
  return typeof value === "string" ? value.slice(0, maximum) : "";
}
function setQuery(
  query: Record<string, string | string[] | null | undefined>,
  key: string,
  value: string,
) {
  if (value) query[key] = value;
  else delete query[key];
}
function formFromFilters(filters: AuditFilters) {
  return {
    ...filters,
    occurred_from: localDateTime(filters.occurred_from),
    occurred_to: localDateTime(filters.occurred_to),
  };
}
function localDateTime(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function toIso(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
function normalizedFilters(): AuditFilters {
  return {
    action: form.value.action.trim(),
    outcome: form.value.outcome,
    resource_type: form.value.resource_type.trim(),
    request_id: form.value.request_id.trim(),
    trace_id: form.value.trace_id.trim(),
    occurred_from: toIso(form.value.occurred_from),
    occurred_to: toIso(form.value.occurred_to),
  };
}
async function syncServerQuery(filters: AuditFilters) {
  const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
  setQuery(query, "org_audit_query", loadedQuery.value);
  for (const [key, value] of [
    ["org_audit_action", filters.action],
    ["org_audit_outcome", filters.outcome],
    ["org_audit_resource", filters.resource_type],
    ["org_audit_request", filters.request_id],
    ["org_audit_trace", filters.trace_id],
    ["org_audit_from", filters.occurred_from],
    ["org_audit_to", filters.occurred_to],
  ] as const)
    setQuery(query, key, value);
  delete query.org_audit_selected;
  await router.replace({ query });
  selectedId.value = "";
}
async function submitFilters() {
  validationMessage.value = "";
  const filters = normalizedFilters();
  if (filters.occurred_from && filters.occurred_to) {
    if (new Date(filters.occurred_from) > new Date(filters.occurred_to)) {
      validationMessage.value = "开始时间不能晚于结束时间。";
      return;
    }
  }
  await syncServerQuery(filters);
  await props.applyFilters(filters);
}
async function resetFilters() {
  loadedQuery.value = "";
  form.value = formFromFilters({
    action: "",
    outcome: "",
    resource_type: "",
    request_id: "",
    trace_id: "",
    occurred_from: "",
    occurred_to: "",
  });
  validationMessage.value = "";
  await submitFilters();
}
function choose(event: any) {
  selectedId.value = event.id;
  copyState.value = "";
}
function actionLabel(value: string) {
  return actionLabels[value] ?? "组织审计操作";
}
function resourceLabel(value: string) {
  return resourceLabels[value] ?? `其他对象（${value || "未标识"}）`;
}
function outcomeLabel(value: string) {
  return outcomeLabels[value] ?? `未知结果（${value || "未标识"}）`;
}
function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[层级过深]";
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== "object") return value ?? {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /(password|secret|token|cookie|authorization|credential|private.?key)/i.test(key)
        ? "[已脱敏]"
        : sanitizeMetadata(item, depth + 1),
    ]),
  );
}
async function copy(value: string, field: string) {
  try {
    await navigator.clipboard.writeText(value);
    copyState.value = `${field}:copied`;
  } catch {
    copyState.value = `${field}:failed`;
  }
}
</script>

<template>
  <section class="org-audit-panel" aria-labelledby="org-audit-title">
    <header class="org-audit-overview">
      <div>
        <p>AUDIT LEDGER · 当前组织</p>
        <h3 id="org-audit-title">组织审计账本</h3>
        <span>统一查看组织治理写入与后台执行结果；记录只读，不提供编辑、删除或任务重放。</span>
      </div>
      <aside aria-label="审计数据边界">
        <b>数据边界</b>
        <strong>仅当前组织</strong>
        <span>服务端权限校验 · 最新事件优先</span>
      </aside>
    </header>

    <div class="org-audit-metrics" aria-label="当前已加载审计汇总">
      <article>
        <span>当前已加载</span><b>{{ events.length }}</b
        ><small>不是全库总数</small>
      </article>
      <article data-tone="success">
        <span>成功</span><b>{{ loadedCounts.succeeded }}</b
        ><small>已加载范围</small>
      </article>
      <article data-tone="danger">
        <span>失败</span><b>{{ loadedCounts.failed }}</b
        ><small>已加载范围</small>
      </article>
      <article data-tone="warning">
        <span>已阻止</span><b>{{ loadedCounts.blocked }}</b
        ><small>已加载范围</small>
      </article>
    </div>

    <form
      class="org-audit-filters"
      aria-label="组织审计筛选"
      novalidate
      @submit.prevent="submitFilters"
    >
      <header>
        <div>
          <h3>筛选审计事实</h3>
          <span>服务端字段采用精确匹配；页内搜索只检索当前已经加载的记录。</span>
        </div>
        <small>固定排序：发生时间从新到旧</small>
      </header>
      <div class="org-audit-filter-grid">
        <label
          >页内搜索
          <input
            v-model="loadedQuery"
            type="search"
            maxlength="160"
            placeholder="搜索已加载的操作、对象或追踪号"
          />
        </label>
        <label
          >操作代码（精确）
          <input v-model="form.action" maxlength="128" placeholder="organization.member.invited" />
        </label>
        <label
          >执行结果
          <select v-model="form.outcome">
            <option value="">全部结果</option>
            <option value="succeeded">成功</option>
            <option value="failed">失败</option>
            <option value="blocked">已阻止</option>
          </select>
        </label>
        <label
          >对象类型（精确）
          <input v-model="form.resource_type" maxlength="80" placeholder="membership" />
        </label>
      </div>
      <details
        class="org-audit-advanced"
        :open="Boolean(form.request_id || form.trace_id || form.occurred_from || form.occurred_to)"
      >
        <summary>高级追踪与时间筛选</summary>
        <div>
          <label
            >请求 ID（精确）
            <input v-model="form.request_id" maxlength="128" placeholder="输入完整 request_id" />
          </label>
          <label
            >追踪 ID（精确）
            <input v-model="form.trace_id" maxlength="128" placeholder="输入完整 trace_id" />
          </label>
          <label
            >开始时间
            <input v-model="form.occurred_from" type="datetime-local" :max="form.occurred_to" />
          </label>
          <label
            >结束时间
            <input v-model="form.occurred_to" type="datetime-local" :min="form.occurred_from" />
          </label>
        </div>
      </details>
      <p v-if="validationMessage" class="org-audit-validation" role="alert">
        {{ validationMessage }}
      </p>
      <footer>
        <button type="submit" :disabled="busy">{{ busy ? "正在查询…" : "应用筛选" }}</button>
        <button type="button" class="org-admin-secondary" :disabled="busy" @click="resetFilters">
          重置筛选
        </button>
      </footer>
    </form>

    <section class="org-audit-ledger" aria-label="组织审计记录">
      <header>
        <div>
          <h3>审计时间线</h3>
          <span v-if="loadedQuery"
            >页内匹配 {{ visibleEvents.length }} / {{ events.length }} 条</span
          >
          <span v-else>已加载 {{ events.length }} 条</span>
        </div>
        <small>{{ nextCursor ? "仍有后续记录" : "已到当前结果末尾" }}</small>
      </header>
      <div class="org-audit-browser">
        <div class="org-audit-list" role="list" aria-label="组织审计列表">
          <button
            v-for="event in visibleEvents"
            :key="event.id"
            type="button"
            role="listitem"
            class="org-audit-row"
            :class="{ selected: selectedEvent?.id === event.id }"
            :aria-pressed="selectedEvent?.id === event.id"
            @click="choose(event)"
          >
            <span class="org-audit-row-icon" aria-hidden="true">{{
              outcomeLabel(event.outcome)[0]
            }}</span>
            <span>
              <strong>{{ actionLabel(event.action) }}</strong>
              <small
                >{{ resourceLabel(event.resource_type) }} ·
                {{ formatTime(event.occurred_at) }}</small
              >
              <code>{{ event.action }}</code>
            </span>
            <em :data-outcome="event.outcome">{{ outcomeLabel(event.outcome) }}</em>
          </button>
          <div v-if="!visibleEvents.length" class="org-audit-empty">
            <b>{{ events.length ? "当前已加载记录中无匹配" : "当前组织暂无审计记录" }}</b>
            <span>{{
              events.length ? "清空页内搜索，或调整服务端筛选条件。" : "不会用示例数据补齐。"
            }}</span>
          </div>
          <button
            v-if="nextCursor && !loadedQuery"
            type="button"
            class="org-audit-load-more"
            :disabled="busy"
            @click="loadMore"
          >
            {{ busy ? "正在加载…" : "加载更多记录" }}
          </button>
        </div>

        <aside v-if="selectedEvent" class="org-audit-detail" aria-label="审计记录详情">
          <header>
            <div>
              <span>记录详情</span>
              <h3>{{ actionLabel(selectedEvent.action) }}</h3>
            </div>
            <em :data-outcome="selectedEvent.outcome">{{ outcomeLabel(selectedEvent.outcome) }}</em>
          </header>
          <p>
            {{ resourceLabel(selectedEvent.resource_type) }} ·
            {{ formatTime(selectedEvent.occurred_at) }}
          </p>
          <dl>
            <div>
              <dt>操作代码</dt>
              <dd>
                <code>{{ selectedEvent.action }}</code>
              </dd>
            </div>
            <div>
              <dt>对象类型</dt>
              <dd>{{ resourceLabel(selectedEvent.resource_type) }}</dd>
            </div>
          </dl>
          <section>
            <h4>脱敏上下文</h4>
            <pre>{{ JSON.stringify(sanitizedMetadata, null, 2) }}</pre>
          </section>
          <section class="org-audit-correlation">
            <h4>请求关联</h4>
            <div>
              <span>请求 ID</span><code>{{ selectedEvent.request_id }}</code>
              <button type="button" @click="copy(selectedEvent.request_id, 'request')">
                {{
                  copyState === "request:copied"
                    ? "已复制"
                    : copyState === "request:failed"
                      ? "复制失败"
                      : "复制"
                }}
              </button>
            </div>
            <div>
              <span>追踪 ID</span><code>{{ selectedEvent.trace_id }}</code>
              <button type="button" @click="copy(selectedEvent.trace_id, 'trace')">
                {{
                  copyState === "trace:copied"
                    ? "已复制"
                    : copyState === "trace:failed"
                      ? "复制失败"
                      : "复制"
                }}
              </button>
            </div>
          </section>
          <details class="org-admin-technical">
            <summary>技术详情</summary>
            <code>事件 ID：{{ selectedEvent.id }}</code>
            <code>对象 ID：{{ selectedEvent.resource_id || "未记录" }}</code>
            <code>操作者 ID：{{ selectedEvent.actor_id || "系统" }}</code>
            <code>工作区 ID：{{ selectedEvent.workspace_id || "组织级" }}</code>
            <code>Schema 版本：{{ selectedEvent.schema_version }}</code>
          </details>
        </aside>
        <aside v-else class="org-audit-detail org-audit-detail--empty">
          <b>选择一条记录查看详情</b>
          <span>请求追踪、对象标识和脱敏上下文会显示在这里。</span>
        </aside>
      </div>
    </section>
  </section>
</template>
