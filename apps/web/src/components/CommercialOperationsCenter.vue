<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiRequestOptions } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import "../platform-polish.css";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type PageState = "loading" | "ready" | "empty" | "error" | "rate_limited" | "blocked";
const emptyData = () => ({
  summary: { total: 0, draft: 0, active: 0, retired: 0 },
  pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
  adjustment_pagination: { page: 1, page_size: 10, total: 0, total_pages: 1 },
  plans: [],
  organization: null,
  assignment: null,
  adjustments: [],
  usage: {},
  effective_quotas: {},
  observed_at: null,
  scope: { organization_id: null },
});
const state = ref<PageState>("loading"),
  data = ref<any>(emptyData()),
  loadedOnce = ref(false),
  refreshing = ref(false),
  mutating = ref(false),
  query = ref(""),
  status = ref(""),
  page = ref(1),
  adjustmentPage = ref(1);
const initialParameters = new URLSearchParams(location.search),
  organizationId = ref(initialParameters.get("organization_id") ?? ""),
  organizationInput = ref(organizationId.value);
const notice = ref("");
const noticeKind = ref<"info" | "success" | "error">("info");
const requestId = ref("");
const pending = ref<any>(null);
const editingPlan = ref<any>(null);
const creatingPlan = ref(false);
let loadController: AbortController | null = null,
  loadSequence = 0,
  createPlanIdempotencyKey = crypto.randomUUID();
const { dialogElement: planDialogElement, handleCancel: handlePlanCancel } = useModalDialog(
  () => Boolean(editingPlan.value),
  () => (editingPlan.value = null),
);
const { dialogElement: createDialogElement, handleCancel: handleCreateCancel } = useModalDialog(
  () => creatingPlan.value,
  () => (creatingPlan.value = false),
);
const { dialogElement: confirmDialogElement, handleCancel: handleConfirmCancel } = useModalDialog(
  () => Boolean(pending.value),
  () => (pending.value = null),
);
const plan = ref({
  code: "",
  name: "",
  description: "",
  collection_tasks: 100,
  open_api_requests: 1000,
  report_exports: 20,
  reason: "商业配置变更",
});
const assignment = ref({
  plan_id: "",
  period_start: "",
  period_end: "",
  expected_version: null as number | null,
  reason: "分配或调整配额方案",
});
const adjustment = ref({
  quota_key: "collection_tasks",
  delta_value: 0,
  effective_at: "",
  expires_at: "",
  reason: "人工配额调整",
});
const quotaNames: Record<string, string> = {
  collection_tasks: "采集任务",
  open_api_requests: "外部接口请求",
  report_exports: "报表导出",
};
const quotaKeys = Object.keys(quotaNames);
const selectablePlans = computed(() => {
  const active = data.value.plans.filter((item: any) => item.status === "active");
  if (
    data.value.assignment &&
    !active.some((item: any) => item.id === data.value.assignment.plan_id)
  )
    active.unshift({
      id: data.value.assignment.plan_id,
      name: data.value.assignment.plan_name,
      code: data.value.assignment.plan_code,
      status: "active",
      quotas: data.value.assignment.quotas,
    });
  return active;
});

const localDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
const displayDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN") : "未设置";
const statusText = (value: string) =>
  (
    ({
      draft: "草稿",
      active: "启用",
      retired: "已退役",
      suspended: "已暂停",
      ended: "已结束",
      unassigned: "未分配",
      revoked: "已撤销",
    }) as Record<string, string>
  )[value] ?? value;
function normalizedData(next: any) {
  const fallback = emptyData();
  return {
    ...fallback,
    ...next,
    summary: { ...fallback.summary, ...(next?.summary ?? {}) },
    pagination: { ...fallback.pagination, ...(next?.pagination ?? {}) },
    adjustment_pagination: {
      ...fallback.adjustment_pagination,
      ...(next?.adjustment_pagination ?? {}),
    },
  };
}
function setNotice(message: string, kind: "info" | "success" | "error" = "info") {
  notice.value = message;
  noticeKind.value = kind;
}
function readLocation() {
  const parameters = new URLSearchParams(location.search),
    requestedPage = Number(parameters.get("page") ?? 1),
    requestedAdjustmentPage = Number(parameters.get("adjustment_page") ?? 1),
    requestedStatus = parameters.get("status") ?? "";
  organizationId.value = parameters.get("organization_id") ?? "";
  organizationInput.value = organizationId.value;
  query.value = (parameters.get("query") ?? "").slice(0, 120);
  status.value = ["draft", "active", "retired"].includes(requestedStatus) ? requestedStatus : "";
  page.value = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  adjustmentPage.value =
    Number.isSafeInteger(requestedAdjustmentPage) && requestedAdjustmentPage > 0
      ? requestedAdjustmentPage
      : 1;
}
function syncLocation(mode: "push" | "replace" = "replace") {
  const parameters = new URLSearchParams();
  if (organizationId.value) parameters.set("organization_id", organizationId.value);
  if (query.value.trim()) parameters.set("query", query.value.trim());
  if (status.value) parameters.set("status", status.value);
  if (page.value > 1) parameters.set("page", String(page.value));
  if (adjustmentPage.value > 1) parameters.set("adjustment_page", String(adjustmentPage.value));
  const suffix = parameters.toString(),
    nextUrl = `${location.pathname}${suffix ? `?${suffix}` : ""}`;
  history[mode === "push" ? "pushState" : "replaceState"](history.state, "", nextUrl);
}
async function call(path: string, method = "GET", body?: any, options: ApiRequestOptions = {}) {
  try {
    const response = await request<any>(path, {
      ...options,
      method,
      ...(body === undefined ? {} : { body }),
    });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    throw error;
  }
}
async function load(options: { preserveNotice?: boolean } = {}) {
  if (refreshing.value) return;
  const currentSequence = ++loadSequence;
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  if (!loadedOnce.value) state.value = "loading";
  refreshing.value = true;
  if (!options.preserveNotice) setNotice("");
  const parameters = new URLSearchParams({
    page: String(page.value),
    page_size: "20",
    adjustment_page: String(adjustmentPage.value),
    adjustment_page_size: "10",
  });
  if (organizationId.value) parameters.set("organization_id", organizationId.value);
  if (query.value.trim()) parameters.set("query", query.value.trim());
  if (status.value) parameters.set("status", status.value);
  try {
    const next = await call(`/platform/commercial?${parameters}`, "GET", undefined, {
      signal: controller.signal,
    });
    if (currentSequence !== loadSequence) return;
    data.value = normalizedData(next);
    page.value = data.value.pagination.page;
    adjustmentPage.value = data.value.adjustment_pagination.page;
    if (data.value.assignment) {
      assignment.value.plan_id = data.value.assignment.plan_id;
      assignment.value.period_start = localDate(data.value.assignment.period_start);
      assignment.value.period_end = localDate(data.value.assignment.period_end);
      assignment.value.expected_version = Number(data.value.assignment.version);
    } else {
      assignment.value.plan_id = "";
      assignment.value.period_start = "";
      assignment.value.period_end = "";
      assignment.value.expected_version = null;
    }
    loadedOnce.value = true;
    state.value =
      data.value.summary.total ||
      data.value.plans.length ||
      data.value.organization ||
      data.value.assignment
        ? "ready"
        : "empty";
    syncLocation();
  } catch (error) {
    if (
      currentSequence !== loadSequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    const failure = error instanceof ApiClientError ? error : null;
    setNotice(
      timedOut
        ? "读取超时，已保留上次成功数据，请稍后重试。"
        : `${failure?.actionHint ?? "读取失败"}${loadedOnce.value ? "；已保留上次成功数据。" : ""}`,
      "error",
    );
    if (!loadedOnce.value)
      state.value =
        failure?.status === 429
          ? "rate_limited"
          : (failure?.status ?? 0) >= 500
            ? "blocked"
            : "error";
  } finally {
    window.clearTimeout(timeout);
    if (currentSequence === loadSequence) refreshing.value = false;
  }
}
async function createPlan() {
  if (mutating.value) return;
  mutating.value = true;
  try {
    await call(
      "/platform/commercial/plans",
      "POST",
      {
        code: plan.value.code,
        name: plan.value.name,
        description: plan.value.description,
        quotas: {
          collection_tasks: Number(plan.value.collection_tasks),
          open_api_requests: Number(plan.value.open_api_requests),
          report_exports: Number(plan.value.report_exports),
        },
        reason: plan.value.reason,
      },
      {
        idempotencyKey: createPlanIdempotencyKey,
      },
    );
    const mutationRequestId = requestId.value;
    creatingPlan.value = false;
    query.value = plan.value.code.trim();
    status.value = "draft";
    page.value = 1;
    syncLocation("push");
    await load({ preserveNotice: true });
    requestId.value = mutationRequestId;
    setNotice("配额方案草稿已创建；启用前不影响任何组织。", "success");
    plan.value = {
      code: "",
      name: "",
      description: "",
      collection_tasks: 100,
      open_api_requests: 1000,
      report_exports: 20,
      reason: "商业配置变更",
    };
    createPlanIdempotencyKey = crypto.randomUUID();
  } catch (error) {
    setNotice(error instanceof ApiClientError ? error.actionHint : "创建失败", "error");
  } finally {
    mutating.value = false;
  }
}
function beginEditPlan(item: any) {
  editingPlan.value = {
    id: item.id,
    expected_version: item.version,
    name: item.name,
    description: item.description ?? "",
    status: item.status,
    collection_tasks: Number(item.quotas.collection_tasks ?? 0),
    open_api_requests: Number(item.quotas.open_api_requests ?? 0),
    report_exports: Number(item.quotas.report_exports ?? 0),
    reason: "编辑配额方案",
  };
}
function prepare(
  title: string,
  path: string,
  method: string,
  body: any,
  success = "变更已写入审计。",
) {
  pending.value = {
    title,
    path,
    method,
    body,
    success,
    impact: buildImpact(path, body),
    idempotencyKey: crypto.randomUUID(),
  };
}
function buildImpact(path: string, body: any) {
  const rows: Array<{ label: string; before: string; after: string; note?: string }> = [];
  if (path.startsWith("/platform/commercial/plans/")) {
    const planId = path.split("/").at(-1),
      current = data.value.plans.find((item: any) => item.id === planId);
    if (current)
      for (const key of quotaKeys) {
        const before = Number(current.quotas[key] ?? 0),
          after = Number(body.quotas?.[key] ?? before);
        if (before !== after)
          rows.push({ label: quotaNames[key]!, before: String(before), after: String(after) });
      }
    if (current?.status !== body.status)
      rows.push({
        label: "方案状态",
        before: statusText(current?.status),
        after: statusText(body.status),
      });
    return {
      scope: `${current?.assignment_count ?? 0} 个当前仍分配该方案的组织；方案 ${current?.name ?? "未找到"}`,
      rows,
      note:
        current?.assignment_count > 0
          ? "保存后这些组织的基础配额会随方案新版本变化；人工调整仍单独叠加。"
          : "当前没有活动或暂停组织分配该方案。",
    };
  }
  if (path === "/platform/commercial/assignments") {
    const target = data.value.plans.find((item: any) => item.id === body.plan_id),
      current = data.value.assignment,
      periodChanged =
        Boolean(current) &&
        (localDate(current.period_start) !== body.period_start ||
          localDate(current.period_end) !== body.period_end);
    rows.push({
      label: "配额方案",
      before: current?.plan_name ?? "未分配",
      after: target?.name ?? "未选择",
    });
    rows.push({
      label: "统计周期",
      before: current
        ? `${localDate(current.period_start)} 至 ${localDate(current.period_end)}`
        : "未设置",
      after: `${body.period_start || "未设置"} 至 ${body.period_end || "未设置"}`,
    });
    for (const key of quotaKeys) {
      const before = Number(data.value.effective_quotas[key] ?? 0),
        baseBefore = Number(current?.quotas?.[key] ?? 0),
        activeAdjustment = before - baseBefore,
        after = Math.max(0, Number(target?.quotas?.[key] ?? 0) + activeAdjustment),
        used = Number(data.value.usage[key] ?? 0);
      rows.push({
        label: quotaNames[key]!,
        before: `${before}（当前余量 ${Math.max(0, before - used)}）`,
        after: periodChanged
          ? `${after}（新周期用量将在变更后重新统计）`
          : `${after}（预计余量 ${Math.max(0, after - used)}）`,
      });
    }
    return {
      scope: `组织 ${body.organization_id || "未填写"}`,
      rows,
      note: "基础配额来自目标方案；当前有效人工调整按原记录继续叠加，不在此操作中删除。",
    };
  }
  if (path === "/platform/commercial/adjustments") {
    const key = String(body.quota_key),
      before = Number(data.value.effective_quotas[key] ?? 0),
      after = Math.max(0, before + Number(body.delta_value ?? 0)),
      used = Number(data.value.usage[key] ?? 0);
    rows.push({
      label: quotaNames[key] ?? key,
      before: `${before}（余量 ${Math.max(0, before - used)}）`,
      after: `${after}（余量 ${Math.max(0, after - used)}）`,
    });
    return {
      scope: `组织 ${body.organization_id || "未填写"} · 当前统计周期`,
      rows,
      note: "调整只改变选中的计量项，并按填写的生效与失效时间参与有效配额。",
    };
  }
  if (path.endsWith("/revoke")) {
    const adjustmentId = path.split("/").at(-2),
      item = data.value.adjustments.find((entry: any) => entry.id === adjustmentId),
      key = String(item?.quota_key ?? ""),
      before = Number(data.value.effective_quotas[key] ?? 0),
      after = Math.max(0, before - Number(item?.delta_value ?? 0)),
      used = Number(data.value.usage[key] ?? 0);
    if (item)
      rows.push({
        label: quotaNames[key] ?? key,
        before: `${before}（余量 ${Math.max(0, before - used)}）`,
        after: `${after}（余量 ${Math.max(0, after - used)}）`,
      });
    return {
      scope: `组织 ${organizationId.value || "未填写"} · 当前统计周期`,
      rows,
      note: "撤销只移除这一条仍有效的人工调整，其他方案和调整保持不变。",
    };
  }
  return {
    scope: organizationId.value ? `组织 ${organizationId.value}` : "平台配额配置",
    rows,
    note: "该操作会保留版本、原因和审计记录。",
  };
}
function savePlan() {
  const item = editingPlan.value;
  if (!item) return;
  prepare(
    "保存配额方案修改",
    `/platform/commercial/plans/${item.id}`,
    "PATCH",
    {
      name: item.name,
      description: item.description,
      quotas: {
        collection_tasks: Number(item.collection_tasks),
        open_api_requests: Number(item.open_api_requests),
        report_exports: Number(item.report_exports),
      },
      status: item.status,
      expected_version: item.expected_version,
      reason: item.reason,
    },
    "配额方案版本已更新。",
  );
  editingPlan.value = null;
}
function assignOrRenew() {
  prepare(
    data.value.assignment ? "调整组织配额方案" : "分配组织配额方案",
    "/platform/commercial/assignments",
    "POST",
    { organization_id: organizationId.value, ...assignment.value },
    data.value.assignment ? "组织配额方案已调整并保留审计事件。" : "组织配额方案已分配。",
  );
}
async function confirm() {
  if (!pending.value || mutating.value) return;
  const operation = pending.value;
  mutating.value = true;
  try {
    await call(operation.path, operation.method, operation.body, {
      idempotencyKey: operation.idempotencyKey,
    });
    const mutationRequestId = requestId.value;
    pending.value = null;
    await load({ preserveNotice: true });
    requestId.value = mutationRequestId;
    setNotice(operation.success, "success");
  } catch (error) {
    setNotice(error instanceof ApiClientError ? error.actionHint : "变更未完成", "error");
  } finally {
    mutating.value = false;
  }
}
function submitAdjustment() {
  if (Number(adjustment.value.delta_value) === 0) {
    setNotice("调整量必须是非零整数。", "error");
    return;
  }
  prepare("人工调整配额", "/platform/commercial/adjustments", "POST", {
    organization_id: organizationId.value,
    assignment_id: data.value.assignment.id,
    ...adjustment.value,
  });
}
function applyFilters() {
  if (refreshing.value) return;
  page.value = 1;
  syncLocation("push");
  void load();
}
function resetFilters() {
  if (refreshing.value) return;
  query.value = "";
  status.value = "";
  page.value = 1;
  syncLocation("push");
  void load();
}
function changePage(nextPage: number) {
  if (
    refreshing.value ||
    nextPage < 1 ||
    nextPage > data.value.pagination.total_pages ||
    nextPage === page.value
  )
    return;
  page.value = nextPage;
  syncLocation("push");
  void load();
}
function changeAdjustmentPage(nextPage: number) {
  if (
    refreshing.value ||
    nextPage < 1 ||
    nextPage > data.value.adjustment_pagination.total_pages ||
    nextPage === adjustmentPage.value
  )
    return;
  adjustmentPage.value = nextPage;
  syncLocation("push");
  void load();
}
function readOrganization() {
  if (refreshing.value) return;
  organizationId.value = organizationInput.value.trim();
  adjustmentPage.value = 1;
  syncLocation("push");
  void load();
}
function clearOrganization() {
  if (refreshing.value) return;
  organizationId.value = "";
  organizationInput.value = "";
  adjustmentPage.value = 1;
  syncLocation("push");
  void load();
}
function handlePopState() {
  if (refreshing.value) loadController?.abort();
  refreshing.value = false;
  readLocation();
  void load();
}
onMounted(() => {
  readLocation();
  window.addEventListener("popstate", handlePopState);
  void load();
});
onBeforeUnmount(() => {
  loadController?.abort();
  window.removeEventListener("popstate", handlePopState);
});
</script>

<template>
  <section class="commercial" :aria-busy="refreshing">
    <header class="commercial-hero">
      <div class="commercial-hero-copy">
        <p>配额管理</p>
        <h2>组织配额与用量</h2>
        <span
          >创建配额方案、设置使用额度、分配给组织并处理有效期、暂停和临时额度调整。当前不包含计费、价格或支付。</span
        >
      </div>
      <div class="commercial-hero-actions">
        <button type="button" :disabled="refreshing" @click="load()">
          {{ refreshing ? "读取中…" : "刷新数据" }}
        </button>
        <button type="button" class="primary" @click="creatingPlan = true">新建配额方案</button>
      </div>
      <form class="commercial-organization-lookup" @submit.prevent="readOrganization">
        <label
          >组织编号<input
            v-model="organizationInput"
            placeholder="输入组织 UUID"
            required
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
        /></label>
        <button :disabled="refreshing">读取组织</button>
        <button
          v-if="organizationId"
          type="button"
          :disabled="refreshing"
          @click="clearOrganization"
        >
          清除组织
        </button>
      </form>
    </header>
    <p v-if="notice" class="notice" :data-kind="noticeKind" aria-live="polite">
      {{ notice }} <code v-if="requestId">关联编号：{{ requestId }}</code>
    </p>
    <section v-if="state === 'loading'" class="state commercial-loading" aria-live="polite">
      <strong>正在读取真实配额方案与用量…</strong>
      <span>正在核对方案、组织分配、当前账期用量和有效人工调整。</span>
    </section>
    <section v-else-if="['error', 'rate_limited', 'blocked'].includes(state)" class="state">
      <strong>{{
        state === "rate_limited"
          ? "请求过于频繁"
          : state === "blocked"
            ? "配额管理依赖受阻"
            : "请求字段或组织范围无效"
      }}</strong
      ><span>{{ notice || "当前没有可展示的旧数据。" }}</span
      ><button :disabled="refreshing" @click="load()">重新读取</button>
    </section>
    <template v-else>
      <section class="commercial-summary" aria-label="配额方案概览">
        <article>
          <span>全部方案</span><strong>{{ data.summary.total }}</strong>
        </article>
        <article data-status="active">
          <span>已启用</span><strong>{{ data.summary.active }}</strong>
        </article>
        <article data-status="draft">
          <span>草稿</span><strong>{{ data.summary.draft }}</strong>
        </article>
        <article data-status="retired">
          <span>已退役</span><strong>{{ data.summary.retired }}</strong>
        </article>
      </section>
      <section v-if="organizationId" class="membership">
        <header>
          <div>
            <h3>组织配额与本周期用量</h3>
            <strong>{{ data.organization?.name || "组织" }}</strong>
            <small>{{ organizationId }} · {{ data.organization?.status || "状态未知" }}</small>
          </div>
          <b :data-status="data.assignment?.status || 'unassigned'">{{
            statusText(data.assignment?.status || "unassigned")
          }}</b>
        </header>
        <div v-if="data.assignment" class="assignment">
          <div>
            <strong>{{ data.assignment.plan_name }}</strong
            ><small>{{ data.assignment.period_start }} — {{ data.assignment.period_end }}</small>
          </div>
          <nav>
            <button
              v-if="data.assignment.status === 'active'"
              :disabled="mutating"
              @click="
                prepare(
                  '暂停组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'suspend',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              暂停</button
            ><button
              v-if="data.assignment.status === 'suspended'"
              :disabled="mutating"
              @click="
                prepare(
                  '恢复组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'resume',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              恢复</button
            ><button
              v-if="data.assignment.status !== 'ended'"
              :disabled="mutating"
              @click="
                prepare(
                  '结束组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'end',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              结束
            </button>
          </nav>
        </div>
        <form class="renew" @submit.prevent="assignOrRenew">
          <h4>{{ data.assignment ? "调整配额方案" : "首次分配配额方案" }}</h4>
          <label
            >配额方案<select v-model="assignment.plan_id" required>
              <option value="">选择当前筛选结果中的启用方案</option>
              <option v-for="item in selectablePlans" :key="item.id" :value="item.id">
                {{ item.name }} · {{ item.code }}
              </option>
            </select></label
          ><label
            >开始<input v-model="assignment.period_start" type="datetime-local" required /></label
          ><label
            >结束<input v-model="assignment.period_end" type="datetime-local" required /></label
          ><label
            >原因<input v-model="assignment.reason" required minlength="2" maxlength="500" /></label
          ><button :disabled="mutating">{{ data.assignment ? "确认调整" : "确认分配" }}</button>
        </form>
        <p v-if="!selectablePlans.length" class="commercial-inline-help">
          当前列表没有启用方案。请在下方按名称或内部标识搜索，并筛选“已启用”后再选择。
        </p>
        <template v-if="data.assignment"
          ><div class="usage">
            <article v-for="(limit, key) in data.effective_quotas" :key="key">
              <span>{{ quotaNames[String(key)] || key }}</span
              ><strong>{{ data.usage[key] || 0 }} / {{ limit }}</strong
              ><b
                ><i
                  :style="{
                    width: `${Math.min(100, Number(limit) ? ((data.usage[key] || 0) / Number(limit)) * 100 : 100)}%`,
                  }"
                ></i
              ></b>
            </article>
          </div>
          <form class="adjust" @submit.prevent="submitAdjustment">
            <label
              >计量项<select v-model="adjustment.quota_key">
                <option v-for="(_, key) in data.effective_quotas" :key="key" :value="key">
                  {{ quotaNames[String(key)] || key }}
                </option>
              </select></label
            ><label
              >调整量<input
                v-model.number="adjustment.delta_value"
                type="number"
                min="-1000000000"
                max="1000000000"
                step="1"
                required /></label
            ><label
              >生效时间<input v-model="adjustment.effective_at" type="datetime-local"
            /></label>
            <label
              >失效时间（可选）<input v-model="adjustment.expires_at" type="datetime-local"
            /></label>
            <label class="wide"
              >原因<input v-model="adjustment.reason" required maxlength="500" /></label
            ><button :disabled="mutating">提交调整</button>
          </form>
          <div class="commercial-adjustment-heading">
            <h4>人工调整记录</h4>
            <span>共 {{ data.adjustment_pagination.total }} 条</span>
          </div>
          <ul v-if="data.adjustments.length">
            <li v-for="item in data.adjustments" :key="item.id">
              <strong
                >{{ quotaNames[item.quota_key] }} {{ item.delta_value > 0 ? "+" : ""
                }}{{ item.delta_value }}</strong
              ><span>{{ item.reason }} · {{ statusText(item.status) }}</span>
              <small
                >生效 {{ displayDate(item.effective_at) }} · 失效
                {{ item.expires_at ? displayDate(item.expires_at) : "长期有效" }}</small
              ><button
                v-if="item.status === 'active'"
                :disabled="mutating"
                @click="
                  prepare(
                    '撤销人工调整',
                    `/platform/commercial/adjustments/${item.id}/revoke`,
                    'POST',
                    { expected_version: item.version, reason: '撤销人工调整' },
                  )
                "
              >
                撤销
              </button>
            </li>
          </ul>
          <p v-else class="commercial-inline-help">当前组织还没有人工配额调整。</p>
          <nav
            v-if="data.adjustment_pagination.total_pages > 1"
            class="commercial-pagination"
            aria-label="人工调整分页"
          >
            <button
              :disabled="refreshing || adjustmentPage <= 1"
              @click="changeAdjustmentPage(adjustmentPage - 1)"
            >
              上一页
            </button>
            <span>第 {{ adjustmentPage }} / {{ data.adjustment_pagination.total_pages }} 页</span>
            <button
              :disabled="refreshing || adjustmentPage >= data.adjustment_pagination.total_pages"
              @click="changeAdjustmentPage(adjustmentPage + 1)"
            >
              下一页
            </button>
          </nav></template
        >
      </section>
      <aside class="commercial-guide">
        <strong>操作顺序</strong>
        <span>创建草稿并核对额度 → 启用方案 → 读取组织并分配 → 按实际需要调整额度。</span>
      </aside>
      <section class="commercial-catalog">
        <header>
          <div>
            <p>方案目录</p>
            <h3>配额方案</h3>
            <span>真实返回 {{ data.pagination.total }} 条，当前第 {{ page }} 页。</span>
          </div>
          <button type="button" class="primary" @click="creatingPlan = true">新建方案</button>
        </header>
        <form class="commercial-filters" @submit.prevent="applyFilters">
          <label
            >搜索<input v-model="query" maxlength="120" placeholder="方案名称、内部标识或说明"
          /></label>
          <label
            >状态<select v-model="status">
              <option value="">全部状态</option>
              <option value="active">已启用</option>
              <option value="draft">草稿</option>
              <option value="retired">已退役</option>
            </select></label
          >
          <button :disabled="refreshing">查询</button>
          <button type="button" :disabled="refreshing" @click="resetFilters">重置</button>
        </form>
        <div v-if="data.plans.length" class="commercial-plan-table-wrap">
          <table class="commercial-plan-table">
            <thead>
              <tr>
                <th>状态与方案</th>
                <th>配额</th>
                <th>使用组织</th>
                <th>版本 / 更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.plans" :key="item.id" :data-status="item.status">
                <td data-label="状态与方案">
                  <span class="commercial-status" :data-status="item.status">{{
                    statusText(item.status)
                  }}</span>
                  <strong>{{ item.name }}</strong>
                  <code>{{ item.code }}</code>
                  <small>{{ item.description || "未填写说明" }}</small>
                </td>
                <td data-label="配额">
                  <dl>
                    <div v-for="key in quotaKeys" :key="key">
                      <dt>{{ quotaNames[key] }}</dt>
                      <dd>{{ item.quotas[key] ?? 0 }}</dd>
                    </div>
                  </dl>
                </td>
                <td data-label="使用组织">{{ item.assignment_count }} 个</td>
                <td data-label="版本 / 更新">
                  <strong>第 {{ item.version }} 版</strong>
                  <small>{{ displayDate(item.updated_at) }}</small>
                </td>
                <td data-label="操作">
                  <div class="commercial-row-actions">
                    <button :disabled="mutating" @click="beginEditPlan(item)">编辑</button>
                    <button
                      v-if="item.status === 'draft'"
                      :disabled="mutating"
                      @click="
                        prepare('启用配额方案', `/platform/commercial/plans/${item.id}`, 'PATCH', {
                          name: item.name,
                          description: item.description,
                          quotas: item.quotas,
                          status: 'active',
                          expected_version: item.version,
                          reason: plan.reason,
                        })
                      "
                    >
                      启用
                    </button>
                    <button
                      v-else-if="item.status === 'active'"
                      class="danger"
                      :disabled="mutating"
                      @click="
                        prepare('退役配额方案', `/platform/commercial/plans/${item.id}`, 'PATCH', {
                          name: item.name,
                          description: item.description,
                          quotas: item.quotas,
                          status: 'retired',
                          expected_version: item.version,
                          reason: plan.reason,
                        })
                      "
                    >
                      退役
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="state">
          {{
            data.summary.total
              ? "当前筛选条件没有匹配的配额方案，请调整搜索或状态。"
              : "暂无配额方案。系统不会自动编造默认额度，也不会展示价格或计费结论。"
          }}
        </p>
        <nav
          v-if="data.pagination.total_pages > 1"
          class="commercial-pagination"
          aria-label="配额方案分页"
        >
          <button :disabled="refreshing || page <= 1" @click="changePage(page - 1)">上一页</button>
          <span>第 {{ page }} / {{ data.pagination.total_pages }} 页</span>
          <button
            :disabled="refreshing || page >= data.pagination.total_pages"
            @click="changePage(page + 1)"
          >
            下一页
          </button>
        </nav>
      </section>
    </template>
    <Teleport to="body"
      ><dialog ref="createDialogElement" aria-label="新建配额方案" @cancel="handleCreateCancel">
        <form class="commercial-dialog-form" @submit.prevent="createPlan">
          <header>
            <div>
              <p>新建配额方案</p>
              <h3>创建配额方案草稿</h3>
            </div>
            <button type="button" aria-label="关闭新建配额方案" @click="creatingPlan = false">
              关闭
            </button>
          </header>
          <label
            >内部标识<input
              v-model="plan.code"
              placeholder="例如 basic_2026"
              required
              maxlength="80"
              pattern="[a-z0-9][a-z0-9_-]{0,79}" /></label
          ><label>方案名称<input v-model="plan.name" required maxlength="120" /></label
          ><label
            >方案说明<textarea
              v-model="plan.description"
              maxlength="500"
              placeholder="适用对象、包含内容和使用限制"
            ></textarea>
          </label>
          <fieldset>
            <legend>基础配额</legend>
            <label
              >采集任务<input
                v-model.number="plan.collection_tasks"
                type="number"
                min="0"
                max="1000000000"
                required
            /></label>
            <label
              >外部接口请求<input
                v-model.number="plan.open_api_requests"
                type="number"
                min="0"
                max="1000000000"
                required
            /></label>
            <label
              >报表导出<input
                v-model.number="plan.report_exports"
                type="number"
                min="0"
                max="1000000000"
                required
            /></label>
          </fieldset>
          <label>创建原因<input v-model="plan.reason" required maxlength="500" /></label>
          <footer>
            <button type="button" :disabled="mutating" @click="creatingPlan = false">取消</button>
            <button class="primary" :disabled="mutating">
              {{ mutating ? "创建中…" : "创建草稿" }}
            </button>
          </footer>
        </form>
      </dialog></Teleport
    >
    <Teleport to="body"
      ><dialog ref="planDialogElement" aria-label="编辑配额方案" @cancel="handlePlanCancel">
        <form v-if="editingPlan" class="commercial-dialog-form" @submit.prevent="savePlan">
          <header><h3>编辑配额方案</h3></header>
          <label>名称<input v-model="editingPlan.name" required maxlength="120" /></label
          ><label>说明<textarea v-model="editingPlan.description" maxlength="500"></textarea></label
          ><label
            >采集任务<input
              v-model.number="editingPlan.collection_tasks"
              type="number"
              min="0"
              max="1000000000"
              required /></label
          ><label
            >外部接口请求<input
              v-model.number="editingPlan.open_api_requests"
              type="number"
              min="0"
              max="1000000000"
              required /></label
          ><label
            >报表导出<input
              v-model.number="editingPlan.report_exports"
              type="number"
              min="0"
              max="1000000000"
              required /></label
          ><label
            >状态<select v-model="editingPlan.status">
              <option value="draft">草稿</option>
              <option value="active">启用</option>
              <option value="retired">退役</option>
            </select></label
          ><label
            >原因<input v-model="editingPlan.reason" required minlength="2" maxlength="500"
          /></label>
          <footer>
            <button type="button" :disabled="mutating" @click="editingPlan = null">取消</button
            ><button class="primary" :disabled="mutating">保存新版本</button>
          </footer>
        </form>
      </dialog></Teleport
    >
    <Teleport to="body"
      ><dialog ref="confirmDialogElement" aria-label="确认配额变更" @cancel="handleConfirmCancel">
        <form v-if="pending" class="commercial-dialog-form" @submit.prevent="confirm">
          <header>
            <h3>确认{{ pending.title }}？</h3>
          </header>
          <p>该操作会改变配额方案版本、分配状态或组织额度，并写入平台审计。</p>
          <section class="commercial-impact-preview" aria-label="配额变更影响范围">
            <h4>影响范围</h4>
            <p>{{ pending.impact.scope }}</p>
            <dl v-if="pending.impact.rows.length">
              <div v-for="row in pending.impact.rows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>
                  <span>{{ row.before }}</span
                  ><em>→</em><strong>{{ row.after }}</strong>
                </dd>
              </div>
            </dl>
            <p>{{ pending.impact.note }}</p>
          </section>
          <footer>
            <button type="button" :disabled="mutating" @click="pending = null">取消</button>
            <button class="primary" :disabled="mutating">
              {{ mutating ? "执行中…" : "确认执行" }}
            </button>
          </footer>
        </form>
      </dialog></Teleport
    >
  </section>
</template>

<style scoped>
.commercial {
  display: grid;
  gap: 18px;
  color: var(--so-text);
}
.commercial-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 17px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
}
.commercial-hero p {
  margin: 0;
  color: var(--so-primary);
  font: 700 11px monospace;
}
.commercial-hero h2 {
  margin: 6px 0;
}
.commercial-hero span,
small {
  color: var(--so-text-muted);
}
.commercial form {
  display: grid;
  gap: 10px;
}
.commercial label {
  display: grid;
  gap: 5px;
  font-size: 13px;
}
.commercial button,
.commercial input,
.commercial select,
.commercial textarea {
  box-sizing: border-box;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  background: var(--so-panel);
  color: var(--so-text);
  padding: 9px 12px;
}
.commercial button {
  cursor: pointer;
  font-weight: 700;
}
.notice,
.confirm,
.state,
.create,
.membership,
.plans article {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.confirm {
  border-color: var(--so-border-strong);
}
.commercial-impact-preview {
  display: grid;
  gap: 10px;
  margin: 12px 0;
  padding: 14px;
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.commercial-impact-preview h4,
.commercial-impact-preview p,
.commercial-impact-preview dl {
  margin: 0;
}
.commercial-impact-preview dl,
.commercial-impact-preview dl > div {
  display: grid;
  gap: 8px;
}
.commercial-impact-preview dl > div {
  grid-template-columns: minmax(120px, 0.6fr) 1fr;
  padding-top: 8px;
  border-top: 1px solid var(--so-border);
}
.commercial-impact-preview dt {
  color: var(--so-text-muted);
}
.commercial-impact-preview dd {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  margin: 0;
  overflow-wrap: anywhere;
}
.commercial-impact-preview em {
  color: var(--so-text-muted);
  font-style: normal;
}
.create {
  display: grid;
  grid-template-columns: repeat(6, minmax(100px, 1fr));
  gap: 10px;
  align-items: end;
}
.create h3 {
  grid-column: 1/-1;
  margin: 0;
}
.plans {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.plans article header span,
.membership > b {
  color: var(--so-primary);
}
.plans article dl {
  display: grid;
  gap: 6px;
}
.plans article dl div {
  display: flex;
  justify-content: space-between;
}
.plans footer,
.assignment nav,
dialog footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.membership {
  display: grid;
  gap: 16px;
}
.membership > header,
.assignment {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}
.assignment div {
  display: grid;
  gap: 5px;
}
.renew {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
}
.renew h4 {
  grid-column: 1/-1;
  margin: 0;
}
.usage {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.usage article {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--so-panel);
  border-radius: 10px;
}
.usage article > b {
  height: 6px;
  background: var(--so-panel-muted);
  border-radius: 5px;
  overflow: hidden;
}
.usage i {
  display: block;
  height: 100%;
  background: var(--so-primary);
}
.adjust {
  grid-template-columns: repeat(4, 1fr);
  align-items: end;
}
.membership ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 8px;
}
.membership li {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--so-border);
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(480px, calc(100% - 28px));
  border: 1px solid var(--so-border-strong);
  border-radius: 14px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  z-index: 20;
}
dialog form {
  padding: 10px;
}
dialog textarea {
  min-height: 80px;
}
@media (max-width: 800px) {
  .commercial {
    padding-bottom: 78px;
  }
  .commercial-hero {
    display: grid;
  }
  .create,
  .renew,
  .adjust {
    grid-template-columns: 1fr 1fr;
  }
  .plans {
    grid-template-columns: 1fr;
  }
  .usage {
    grid-template-columns: 1fr;
  }
  .membership > header,
  .assignment {
    align-items: flex-start;
    display: grid;
  }
  .membership li {
    grid-template-columns: 1fr;
  }
  .create h3,
  .renew h4 {
    grid-column: 1/-1;
  }
}
@media (max-width: 480px) {
  .create,
  .renew,
  .adjust {
    grid-template-columns: 1fr;
  }
  .commercial-impact-preview dl > div,
  .commercial-impact-preview dd {
    grid-template-columns: 1fr;
  }
}
dialog {
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  max-height: calc(100vh - 28px);
  overflow: auto;
  z-index: 100;
}
</style>
<style scoped src="./commercial-operations.css"></style>
