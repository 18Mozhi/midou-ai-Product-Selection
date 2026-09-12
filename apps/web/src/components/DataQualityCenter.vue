<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
import "../data-quality.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type QualityTab = "evidence" | "issues" | "runs";
type BatchAction = "attribute" | "assign" | "close";
type DetailState = "idle" | "loading" | "ready" | "error";
type FeedbackTone = "info" | "success" | "warning" | "danger";
interface Evidence {
  id: string;
  organization_id: string;
  workspace_id: string;
  collection_task_id: string;
  provider_name: string;
  canonical_url: string;
  content_sha256: string;
  content_type: string;
  size_bytes: number;
  captured_at: string;
  parser_version: string;
  retention_until: string;
  status: string;
  request_id: string;
  trace_id: string;
}
interface Issue {
  id: string;
  organization_id: string;
  reconciliation_run_id: string | null;
  raw_evidence_id: string | null;
  parser_version: string | null;
  provider_name: string;
  metric_code: string;
  field_path: string | null;
  severity: "warning" | "critical";
  status: "open" | "resolved";
  actual_value: number | null;
  threshold_value: number | null;
  assigned_membership_id: string | null;
  assigned_member_label: string | null;
  attribution_reason: string | null;
  resolution_reason: string | null;
  version: number;
  updated_at: string;
}
interface Run {
  id: string;
  provider_name: string;
  parser_version: string;
  market: string;
  sample_count: number;
  metrics: Array<{
    code: string;
    value: number;
    threshold: number;
    status: string;
    numerator?: number;
    denominator?: number;
  }>;
  status: string;
  window_ended_at: string;
}
interface BatchPreview {
  action: BatchAction;
  actionLabel: string;
  assigneeId: string | null;
  assigneeLabel: string | null;
  impact: string;
  items: Array<{ id: string; expected_version: number }>;
  reason: string;
}
const props = withDefaults(defineProps<{ apiBaseUrl: string; active?: boolean }>(), {
    active: true,
  }),
  request = createApiClient(props.apiBaseUrl),
  route = useRoute(),
  router = useRouter(),
  queryValue = (name: string) => {
    const value = route.query[name];
    return typeof value === "string" ? value : "";
  },
  pageSize = 20,
  initialPage = /^\d{1,3}$/.test(queryValue("quality_page"))
    ? Math.max(1, Number(queryValue("quality_page")))
    : 1,
  initialTab = (["evidence", "issues", "runs"] as const).includes(
    queryValue("quality_tab") as QualityTab,
  )
    ? (queryValue("quality_tab") as QualityTab)
    : "evidence",
  state = ref<State>("loading"),
  evidence = ref<Evidence[]>([]),
  issues = ref<Issue[]>([]),
  runs = ref<Run[]>([]),
  totalEvidence = ref(0),
  totalIssues = ref(0),
  totalOpenIssues = ref(0),
  totalCriticalIssues = ref(0),
  observedAt = ref(""),
  requestId = ref(""),
  tab = ref<QualityTab>(initialTab),
  selectedRunId = ref(queryValue("quality_run")),
  query = ref(queryValue("quality_q")),
  detail = ref<any>(null),
  detailTargetId = ref(""),
  detailState = ref<DetailState>("idle"),
  detailMessage = ref(""),
  detailOpen = ref(false),
  resolutionOpen = ref(false),
  readNotice = ref(""),
  actionNotice = ref(""),
  actionTone = ref<FeedbackTone>("info"),
  confirmMessage = ref(""),
  resolving = ref<Issue | null>(null),
  reason = ref(""),
  confirming = ref(false),
  saving = ref(false),
  refreshing = ref(false),
  page = ref(initialPage);
let activeController: AbortController | null = null,
  detailController: AbortController | null = null,
  loadGeneration = 0,
  detailGeneration = 0,
  componentActive = props.active;
const memberOptions = ref<Array<{ id: string; organization_id: string; label: string }>>([]),
  selectedIssueIds = ref<string[]>([]),
  batchAction = ref<BatchAction>("attribute"),
  batchReason = ref(""),
  batchAssignee = ref(""),
  batchConfirming = ref(false),
  batchPreview = ref<BatchPreview | null>(null),
  downloadInFlightId = ref(""),
  blockedOperation = ref<{ kind: "download" | "resolve" | "batch"; key: string } | null>(null);
const filteredEvidence = computed(() =>
    evidence.value.filter(
      (item) =>
        !query.value ||
        [item.id, item.provider_name, item.canonical_url, item.content_sha256].some((value) =>
          value.toLowerCase().includes(query.value.toLowerCase()),
        ),
    ),
  ),
  filteredIssues = computed(() =>
    issues.value.filter(
      (item) =>
        (!selectedRunId.value || item.reconciliation_run_id === selectedRunId.value) &&
        (!query.value ||
          [item.id, item.metric_code, item.provider_name, item.field_path].some((value) =>
            value?.toLowerCase().includes(query.value.toLowerCase()),
          )),
    ),
  ),
  metrics = computed(() => ({
    open: totalOpenIssues.value,
    critical: totalCriticalIssues.value,
    passed: runs.value.filter((item) => item.status === "passed").length,
  })),
  retentionRisks = computed(() => {
    const observed = Date.parse(observedAt.value);
    if (!Number.isFinite(observed)) return { expiring: 0, expired: 0 };
    return evidence.value.reduce(
      (result, item) => {
        const expiry = Date.parse(item.retention_until);
        if (!Number.isFinite(expiry)) return result;
        if (expiry <= observed) result.expired += 1;
        else if (expiry - observed <= 7 * 86400000) result.expiring += 1;
        return result;
      },
      { expiring: 0, expired: 0 },
    );
  }),
  qualityHighlightCodes = [
    "title_accuracy",
    "price_accuracy",
    "currency_accuracy",
    "external_id_accuracy",
    "canonical_url_accuracy",
    "duplicate_ratio",
    "source_freshness",
  ],
  qualityHighlights = computed(() => {
    const latest = new Map<
      string,
      Run["metrics"][number] & {
        provider_name: string;
        window_ended_at: string;
        sample_count: number;
      }
    >();
    for (const run of runs.value)
      for (const metric of run.metrics)
        if (qualityHighlightCodes.includes(metric.code) && !latest.has(metric.code))
          latest.set(metric.code, {
            ...metric,
            provider_name: run.provider_name,
            window_ended_at: run.window_ended_at,
            sample_count: run.sample_count,
          });
    return qualityHighlightCodes.map((code) => ({ code, metric: latest.get(code) ?? null }));
  }),
  selectedIssues = computed(() =>
    issues.value.filter(
      (item) => selectedIssueIds.value.includes(item.id) && item.status === "open",
    ),
  ),
  batchMembers = computed(() => {
    const organizations = new Set(selectedIssues.value.map((item) => item.organization_id));
    if (organizations.size !== 1) return [];
    const organizationId = selectedIssues.value[0]?.organization_id;
    return memberOptions.value.filter((item) => item.organization_id === organizationId);
  }),
  batchImpact = computed(() => {
    const providers = [...new Set(selectedIssues.value.map((item) => item.provider_name))];
    return `将处理 ${selectedIssues.value.length} 个开放问题，涉及 ${providers.length} 个来源：${providers.join("、") || "无"}。历史证据与核对运行不会被删除。`;
  }),
  batchActionLabel = computed(
    () => ({ attribute: "记录归因", assign: "指派成员", close: "关闭问题" })[batchAction.value],
  ),
  pageTotal = computed(() => (tab.value === "evidence" ? totalEvidence.value : totalIssues.value)),
  totalPages = computed(() => Math.max(1, Math.ceil(pageTotal.value / pageSize))),
  rangeLabel = computed(() => {
    if (!pageTotal.value) return "0 条";
    const start = (page.value - 1) * pageSize + 1,
      end = Math.min(page.value * pageSize, pageTotal.value);
    return `${start}–${end} / ${pageTotal.value} 条`;
  }),
  activeFeedback = computed(() => actionNotice.value || readNotice.value),
  operationLocked = computed(() => Boolean(blockedOperation.value)),
  tabTitle = computed(
    () => ({ evidence: "原始证据", issues: "质量问题", runs: "核对记录" })[tab.value],
  ),
  tabDescription = computed(
    () =>
      ({
        evidence: "查看来源、版本与保留期限，再进入完整字段溯源。",
        issues: "定位未通过门槛的字段，明确责任后再记录处置。",
        runs: "按真实核对运行查看样本、Parser 版本和已加载问题。",
      })[tab.value],
  ),
  searchPlaceholder = computed(() =>
    tab.value === "evidence" ? "来源 / URL / 哈希 / 证据 ID" : "来源 / 指标代码 / 字段 / 问题 ID",
  );
const failure = (code: number): State =>
    code === 401
      ? "expired"
      : code === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(code)
          ? "blocked"
          : "error",
  time = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value)),
  size = (value: number) =>
    value < 1024
      ? `${value} B`
      : value < 1048576
        ? `${(value / 1024).toFixed(1)} KB`
        : `${(value / 1048576).toFixed(1)} MB`,
  metricLabel = (value: string) =>
    ({
      title_accuracy: "标题准确率",
      price_accuracy: "价格准确率",
      currency_accuracy: "币种准确率",
      external_id_accuracy: "商品 ID 准确率",
      canonical_url_accuracy: "URL 规范化",
      duplicate_ratio: "重复比例",
      supplier_mismatch_ratio: "供应商误匹配",
      ai_classification_approval: "AI 分类抽检",
      source_freshness: "来源新鲜度",
      source_success_rate: "来源成功率",
    })[value] ?? value,
  qualityStatusLabel = (value: string) =>
    ({ passed: "通过", failed: "未通过", insufficient_sample: "样本不足" })[value] ?? "状态未知";
const retentionStatus = (value: string) => {
  const observed = Date.parse(observedAt.value),
    expiry = Date.parse(value);
  if (!Number.isFinite(observed) || !Number.isFinite(expiry)) return "到期风险未知";
  if (expiry <= observed) return "已到期，等待受控治理";
  const days = Math.ceil((expiry - observed) / 86400000);
  return days <= 7 ? `${days} 天内到期` : `剩余 ${days} 天`;
};
const isUnknownWrite = (error: unknown) => !(error instanceof ApiClientError) || error.status === 0;
const actionErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error instanceof ApiClientError ? error : null;
  requestId.value = apiError?.requestId ?? requestId.value;
  return apiError?.actionHint ?? fallback;
};
async function syncUrl() {
  if (!componentActive || !props.active || route.path !== "/platform-admin/data") return;
  const next: Record<string, string> = { view: "quality" };
  if (tab.value !== "evidence") next.quality_tab = tab.value;
  if (tab.value !== "runs" && page.value > 1) next.quality_page = String(page.value);
  if (query.value) next.quality_q = query.value;
  if (selectedRunId.value) next.quality_run = selectedRunId.value;
  if (detailOpen.value && detailTargetId.value) next.evidence = detailTargetId.value;
  await router.replace({ query: next });
}
async function load(
  options: { updateUrl?: boolean; clearActionNotice?: boolean } = {},
): Promise<boolean> {
  if (refreshing.value || !componentActive) return false;
  const hadData = Boolean(evidence.value.length || issues.value.length || runs.value.length),
    generation = ++loadGeneration;
  refreshing.value = true;
  if (!hadData) state.value = "loading";
  readNotice.value = "";
  if (options.clearActionNotice) actionNotice.value = "";
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    if (options.updateUrl !== false) await syncUrl();
    const response = await request<any>(
      `/platform/data-quality?page=${page.value}&page_size=${pageSize}&status=all`,
      { signal: controller.signal },
    );
    if (generation !== loadGeneration || !componentActive) return false;
    requestId.value = response.request_id;
    evidence.value = response.data.evidence ?? [];
    issues.value = response.data.issues ?? [];
    runs.value = response.data.reconciliationRuns ?? [];
    memberOptions.value = response.data.memberOptions ?? [];
    selectedIssueIds.value = [];
    batchPreview.value = null;
    totalEvidence.value = response.data.totalEvidence ?? 0;
    totalIssues.value = response.data.totalIssues ?? 0;
    totalOpenIssues.value =
      response.data.openIssues ??
      issues.value.filter((item: Issue) => item.status === "open").length;
    totalCriticalIssues.value =
      response.data.criticalIssues ??
      issues.value.filter((item: Issue) => item.status === "open" && item.severity === "critical")
        .length;
    observedAt.value = response.data.observedAt ?? "";
    state.value =
      evidence.value.length || issues.value.length || runs.value.length ? "ready" : "empty";
    blockedOperation.value = null;
    return true;
  } catch (error) {
    if (generation !== loadGeneration || !componentActive) return false;
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    readNotice.value = controller.signal.aborted
      ? "读取超过 15 秒，已安全取消；上一份质量数据仍保留。"
      : (apiError?.actionHint ?? "网络或服务异常，上一份质量数据仍保留。");
    state.value = hadData ? "ready" : apiError ? failure(apiError.status) : "blocked";
    return false;
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) activeController = null;
    if (generation === loadGeneration) refreshing.value = false;
  }
}
function switchTab(value: QualityTab) {
  if (value === tab.value || refreshing.value || saving.value) return;
  tab.value = value;
  page.value = 1;
  selectedIssueIds.value = [];
  batchPreview.value = null;
  if (value !== "issues") selectedRunId.value = "";
  if (value === "runs") void syncUrl();
  else void load();
}
function goToPage(value: number) {
  if (refreshing.value || value < 1 || value > totalPages.value || value === page.value) return;
  page.value = value;
  void load();
}
function closeEvidenceDetail() {
  if (detailState.value === "loading") detailController?.abort();
  detailGeneration += 1;
  detailOpen.value = false;
  detailState.value = "idle";
  detailTargetId.value = "";
  detail.value = null;
  void syncUrl();
}
const { dialogElement: detailDialogElement, handleCancel: handleDetailCancel } = useModalDialog(
  () => detailOpen.value,
  closeEvidenceDetail,
);
async function openEvidence(id: string) {
  const generation = ++detailGeneration;
  detailController?.abort();
  detailTargetId.value = id;
  detail.value = null;
  detailMessage.value = "";
  detailState.value = "loading";
  detailOpen.value = true;
  await nextTick();
  void syncUrl();
  const controller = new AbortController();
  detailController = controller;
  try {
    const response = await request<any>(`/platform/data/evidence/${id}`, {
      signal: controller.signal,
    });
    if (generation !== detailGeneration || !detailOpen.value || !componentActive) return;
    requestId.value = response.request_id;
    detail.value = response.data;
    detailState.value = "ready";
  } catch (error) {
    if (generation !== detailGeneration || !detailOpen.value || !componentActive) return;
    detailMessage.value = actionErrorMessage(error, "证据详情依赖暂不可用");
    detailState.value = "error";
  } finally {
    if (detailController === controller) detailController = null;
  }
}
async function openEvidenceFromMobile(close: () => void, id: string) {
  close();
  await nextTick();
  await openEvidence(id);
}
async function grantDownload(item: Evidence) {
  if (
    downloadInFlightId.value ||
    (blockedOperation.value?.kind === "download" && blockedOperation.value.key === item.id)
  )
    return;
  downloadInFlightId.value = item.id;
  actionNotice.value = "";
  try {
    const response = await request<any>(`/platform/data/evidence/${item.id}/download-grant`, {
      method: "POST",
      body: {},
    });
    requestId.value = response.request_id;
    actionTone.value = "success";
    actionNotice.value = `短时下载授权已签发，${time(response.data.expires_at)} 前有效。浏览器将开始受控下载；授权签发不代表文件完整性已经验证。`;
    window.location.assign(
      `${props.apiBaseUrl}/platform/data/evidence/${item.id}/download?grant=${encodeURIComponent(response.data.grant)}`,
    );
  } catch (error) {
    if (isUnknownWrite(error)) {
      blockedOperation.value = { kind: "download", key: item.id };
      actionTone.value = "warning";
      actionNotice.value =
        "下载授权结果未知。服务器可能已经签发授权；请先刷新读取，再决定是否重新申请。";
    } else {
      actionTone.value = "danger";
      actionNotice.value = actionErrorMessage(error, "下载依赖暂不可用");
    }
  } finally {
    downloadInFlightId.value = "";
  }
}
function closeResolution() {
  if (saving.value) return;
  resolutionOpen.value = false;
  resolving.value = null;
  reason.value = "";
}
const { dialogElement: resolutionDialogElement, handleCancel: handleResolutionCancel } =
  useModalDialog(() => resolutionOpen.value, closeResolution);
function beginResolve(item: Issue) {
  if (blockedOperation.value?.kind === "resolve" && blockedOperation.value.key === item.id) {
    actionTone.value = "warning";
    actionNotice.value = "上一次解决结果未知，请先刷新读取后再继续。";
    return;
  }
  resolving.value = { ...item };
  reason.value = "";
  confirmMessage.value = "";
  resolutionOpen.value = true;
}
async function beginResolveFromMobile(close: () => void, item: Issue) {
  close();
  await nextTick();
  beginResolve(item);
}
function previewResolve() {
  if (!resolving.value || reason.value.trim().length < 2 || saving.value) return;
  resolutionOpen.value = false;
  confirming.value = true;
  confirmMessage.value = "";
}
async function cancelResolveConfirmation() {
  if (saving.value) return;
  confirming.value = false;
  await nextTick();
  if (resolving.value) resolutionOpen.value = true;
}
function drillIntoRun(run: Run) {
  selectedRunId.value = run.id;
  query.value = "";
  tab.value = "issues";
  page.value = 1;
  readNotice.value = `${run.provider_name} · ${run.parser_version}：只在当前已加载页定位本次核对关联的问题。`;
  void syncUrl();
}
function clearRunDrilldown() {
  selectedRunId.value = "";
  readNotice.value = "已返回当前加载页的全部质量问题。";
  void syncUrl();
}
async function resolveIssue() {
  const target = resolving.value ? { ...resolving.value } : null,
    trimmedReason = reason.value.trim();
  if (!target || saving.value || trimmedReason.length < 2) return;
  saving.value = true;
  confirmMessage.value = "";
  actionNotice.value = "";
  try {
    const response = await request<any>(`/platform/data-quality/issues/${target.id}/resolve`, {
      method: "POST",
      body: { reason: trimmedReason, expected_version: target.version },
    });
    requestId.value = response.request_id;
    confirming.value = false;
    resolving.value = null;
    reason.value = "";
    actionTone.value = "success";
    actionNotice.value = `质量问题 ${response.data.id.slice(0, 8)}… 已记录解决原因。原始证据和历史核对未被改写。`;
    await load({ updateUrl: false });
  } catch (error) {
    if (isUnknownWrite(error)) {
      blockedOperation.value = { kind: "resolve", key: target.id };
      confirming.value = false;
      resolving.value = null;
      reason.value = "";
      actionTone.value = "warning";
      actionNotice.value = "解决结果未知。服务器可能已经完成处理；为避免重复提交，请先刷新读取。";
    } else {
      confirmMessage.value = actionErrorMessage(error, "依赖不可用，质量问题未更新");
    }
  } finally {
    saving.value = false;
  }
}
function toggleIssue(id: string, checked: boolean) {
  const selected = new Set(selectedIssueIds.value);
  if (checked) selected.add(id);
  else selected.delete(id);
  selectedIssueIds.value = [...selected];
  batchPreview.value = null;
}
function clearSelectedIssues() {
  selectedIssueIds.value = [];
  batchPreview.value = null;
}
function previewBatch() {
  const chosen = selectedIssues.value,
    trimmedReason = batchReason.value.trim();
  if (!chosen.length) {
    actionTone.value = "warning";
    actionNotice.value = "先选择 1–50 个开放问题。";
    return;
  }
  if (trimmedReason.length < 2) {
    actionTone.value = "warning";
    actionNotice.value = "填写至少 2 个字符的处理原因。";
    return;
  }
  if (batchAction.value === "assign" && !batchAssignee.value) {
    actionTone.value = "warning";
    actionNotice.value = batchMembers.value.length
      ? "选择所选问题所属组织的活动成员。"
      : "批量指派只能选择同一组织的问题。";
    return;
  }
  const assignee = memberOptions.value.find((item) => item.id === batchAssignee.value);
  batchPreview.value = {
    action: batchAction.value,
    actionLabel: batchActionLabel.value,
    assigneeId: batchAction.value === "assign" ? batchAssignee.value : null,
    assigneeLabel: batchAction.value === "assign" ? (assignee?.label ?? null) : null,
    impact: batchImpact.value,
    items: chosen.map((item) => ({ id: item.id, expected_version: item.version })),
    reason: trimmedReason,
  };
  batchConfirming.value = true;
  confirmMessage.value = "";
}
function cancelBatchConfirmation() {
  if (saving.value) return;
  batchConfirming.value = false;
  batchPreview.value = null;
}
async function executeBatch() {
  const preview = batchPreview.value;
  if (!preview || saving.value) return;
  saving.value = true;
  confirmMessage.value = "";
  actionNotice.value = "";
  try {
    const response = await request<Issue[]>("/platform/data-quality/issues/batch", {
      method: "POST",
      body: {
        items: preview.items,
        action: preview.action,
        reason: preview.reason,
        assignee_membership_id: preview.assigneeId,
      },
    });
    requestId.value = response.request_id;
    const count = response.data.length;
    batchConfirming.value = false;
    batchPreview.value = null;
    batchReason.value = "";
    batchAssignee.value = "";
    actionTone.value = "success";
    actionNotice.value = `已批量${preview.actionLabel} ${count} 个质量问题；每个问题均已增加独立事件和审计事实。`;
    await load({ updateUrl: false });
  } catch (error) {
    if (isUnknownWrite(error)) {
      blockedOperation.value = {
        kind: "batch",
        key: preview.items.map((item) => item.id).join(","),
      };
      batchConfirming.value = false;
      batchPreview.value = null;
      actionTone.value = "warning";
      actionNotice.value =
        "批量处理结果未知。服务器可能已经完成整批操作；为避免重复提交，请先刷新读取。";
    } else {
      confirmMessage.value = actionErrorMessage(error, "依赖不可用，批量处理未生效");
    }
  } finally {
    saving.value = false;
  }
}
async function refreshQuality() {
  await load({ clearActionNotice: true });
}
function applyRouteState() {
  const nextTab = (["evidence", "issues", "runs"] as const).includes(
    queryValue("quality_tab") as QualityTab,
  )
    ? (queryValue("quality_tab") as QualityTab)
    : "evidence";
  const nextPage = /^\d{1,3}$/.test(queryValue("quality_page"))
    ? Math.max(1, Number(queryValue("quality_page")))
    : 1;
  const nextQuery = queryValue("quality_q");
  const nextRun = queryValue("quality_run");
  const changed =
    tab.value !== nextTab ||
    page.value !== nextPage ||
    query.value !== nextQuery ||
    selectedRunId.value !== nextRun;
  tab.value = nextTab;
  page.value = nextTab === "runs" ? 1 : nextPage;
  query.value = nextQuery;
  selectedRunId.value = nextRun;
  return changed;
}
let mounted = false,
  resumeRead = false;
async function openInitialDeepLink() {
  const evidenceId = queryValue("evidence") || queryValue("evidence_id"),
    issueId = queryValue("issue_id");
  if (evidenceId && /^[0-9a-f-]{36}$/i.test(evidenceId)) await openEvidence(evidenceId);
  if (issueId && /^[0-9a-f-]{36}$/i.test(issueId)) {
    tab.value = "issues";
    query.value = issueId;
    readNotice.value = filteredIssues.value.length
      ? "已定位从业务页面进入的数据质量问题。"
      : "当前加载页未包含该质量问题，请继续分页定位。";
  }
}
function suspendQuality() {
  componentActive = false;
  resumeRead = Boolean(activeController);
  loadGeneration += 1;
  detailGeneration += 1;
  activeController?.abort();
  detailController?.abort();
  activeController = null;
  detailController = null;
  refreshing.value = false;
  if (detailOpen.value) closeEvidenceDetail();
}
onMounted(async () => {
  mounted = true;
  componentActive = props.active;
  if (!componentActive) return;
  await load({ updateUrl: false });
  await openInitialDeepLink();
});
watch(
  () => props.active,
  (active) => {
    if (!active) {
      suspendQuality();
      return;
    }
    componentActive = true;
    if (mounted && (resumeRead || state.value === "loading")) void load({ updateUrl: false });
    else if (mounted) void syncUrl();
    resumeRead = false;
  },
);
watch(
  () => [
    route.path,
    route.query.view,
    route.query.quality_tab,
    route.query.quality_page,
    route.query.quality_q,
    route.query.quality_run,
  ],
  ([path]) => {
    const qualityRoute =
      queryValue("view") === "quality" ||
      Boolean(queryValue("evidence") || queryValue("evidence_id") || queryValue("issue_id"));
    if (!mounted || !componentActive || !qualityRoute || path !== "/platform-admin/data") return;
    if (applyRouteState() && tab.value !== "runs") void load({ updateUrl: false });
  },
);
onActivated(() => {
  if (!mounted || !props.active) return;
  componentActive = true;
  if (resumeRead || state.value === "loading") void load({ updateUrl: false });
  resumeRead = false;
});
onDeactivated(suspendQuality);
onBeforeUnmount(() => {
  mounted = false;
  suspendQuality();
});
</script>
<template>
  <section class="quality-center" aria-labelledby="quality-title">
    <header class="quality-title">
      <div>
        <p>数据中心 / EVIDENCE LEDGER</p>
        <h2 id="quality-title">从证据，核对每个结论</h2>
        <span>查看来源与版本，确认问题范围，再记录受控处置。</span>
      </div>
      <b>中国境内 · 受控存储</b>
    </header>
    <div class="quality-layout">
      <aside class="quality-rail" aria-label="证据与质量核对路径">
        <div>
          <p>核对路径</p>
          <strong>事实先于结论</strong>
        </div>
        <ol>
          <li><span>01</span>原始证据</li>
          <li><span>02</span>规范版本</li>
          <li><span>03</span>字段来源</li>
          <li><span>04</span>质量问题</li>
        </ol>
        <p>平台范围读取，不随当前成员组织自动过滤。</p>
      </aside>
      <div class="quality-workspace">
        <UiStatePanel
          v-if="state !== 'ready'"
          :kind="state"
          :request-id="requestId"
          @primary="refreshQuality"
        /><template v-else
          ><div class="quality-metrics">
            <article>
              <small>原始证据</small><strong>{{ totalEvidence }}</strong
              ><span>内容哈希校验</span>
            </article>
            <article>
              <small>开放问题</small><strong>{{ metrics.open }}</strong
              ><span>不可静默覆盖</span>
            </article>
            <article>
              <small>严重问题</small><strong>{{ metrics.critical }}</strong
              ><span>阻断不可靠数据</span>
            </article>
            <article>
              <small>近期通过核对</small><strong>{{ metrics.passed }}</strong
              ><span>按来源与解析器</span>
            </article>
            <article>
              <small>当前页即将到期</small><strong>{{ retentionRisks.expiring }}</strong
              ><span>{{ retentionRisks.expired }} 条已到期</span>
            </article>
          </div>
          <div class="quality-scope-meta">
            <span>观测时间：{{ observedAt ? `${time(observedAt)}（北京时间）` : "未提供" }}</span>
            <span>证据与问题分别分页；核对记录固定为最近 20 次</span>
          </div>
          <section
            class="quality-card quality-highlights"
            aria-labelledby="quality-highlight-title"
          >
            <header>
              <div>
                <h3 id="quality-highlight-title">采集质量指标</h3>
                <span>每项取最近一次已持久化核对，不合成无依据的总分。</span>
              </div>
            </header>
            <div class="quality-run-grid">
              <article v-for="item in qualityHighlights" :key="item.code">
                <header>
                  <strong>{{ metricLabel(item.code) }}</strong>
                  <b v-if="item.metric" :data-status="item.metric.status">
                    {{ qualityStatusLabel(item.metric.status) }}
                  </b>
                </header>
                <template v-if="item.metric">
                  <p>
                    <strong>{{ (item.metric.value * 100).toFixed(1) }}%</strong>
                    · 门槛 {{ (item.metric.threshold * 100).toFixed(1) }}%
                  </p>
                  <small>
                    {{ item.metric.provider_name }} ·
                    {{ item.metric.denominator ?? item.metric.sample_count }} 个样本 ·
                    {{ time(item.metric.window_ended_at) }}
                  </small>
                </template>
                <p v-else>暂无核对数据</p>
              </article>
            </div>
          </section>
          <section class="quality-card quality-task">
            <header class="quality-task-header">
              <div>
                <p>当前任务</p>
                <h3>{{ tabTitle }}</h3>
                <span>{{ tabDescription }}</span>
              </div>
              <button
                type="button"
                class="secondary"
                :disabled="refreshing || saving"
                @click="refreshQuality"
              >
                {{ refreshing ? "读取中…" : "刷新读取" }}
              </button>
            </header>
            <nav class="quality-task-nav" aria-label="数据质量视图">
              <button
                :aria-current="tab === 'evidence' ? 'page' : undefined"
                :disabled="refreshing || saving"
                @click="switchTab('evidence')"
              >
                证据</button
              ><button
                :aria-current="tab === 'issues' ? 'page' : undefined"
                :disabled="refreshing || saving"
                @click="switchTab('issues')"
              >
                质量问题</button
              ><button
                :aria-current="tab === 'runs' ? 'page' : undefined"
                :disabled="refreshing || saving"
                @click="switchTab('runs')"
              >
                核对运行
              </button>
            </nav>
            <div class="quality-feedback" aria-live="polite" aria-atomic="true">
              <article
                v-if="actionNotice"
                :id="operationLocked ? 'quality-operation-lock' : undefined"
                :data-tone="actionTone"
                role="status"
              >
                <strong>{{ actionTone === "success" ? "操作结果" : "操作提示" }}</strong>
                <span>{{ actionNotice }}</span>
              </article>
              <article v-if="readNotice" data-tone="warning" role="status">
                <strong>读取状态</strong><span>{{ readNotice }}</span>
              </article>
              <p v-if="!activeFeedback">原文下载需要短时授权，并分别记录签发与访问审计。</p>
            </div>
            <div v-if="tab !== 'runs'" class="quality-search-row">
              <label>
                搜索当前页
                <input
                  v-model="query"
                  aria-label="搜索证据与质量"
                  :placeholder="searchPlaceholder"
                  @change="syncUrl"
                />
              </label>
              <button
                type="button"
                class="secondary"
                :disabled="!query"
                @click="
                  query = '';
                  syncUrl();
                "
              >
                清除搜索
              </button>
            </div>
            <ResponsiveDataView
              v-if="tab === 'evidence'"
              :rows="filteredEvidence"
              :row-key="(item) => item.id"
              title="采集证据"
              :detail-title="(item) => `${item.provider_name} · ${time(item.captured_at)}`"
            >
              <template #desktop>
                <table>
                  <thead>
                    <tr>
                      <th>证据</th>
                      <th>来源</th>
                      <th>范围</th>
                      <th>格式 / 大小</th>
                      <th>捕获 / 保留</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in filteredEvidence" :key="item.id">
                      <td><strong>采集证据</strong><small>哈希已校验</small></td>
                      <td>
                        <span>{{ item.provider_name }}</span
                        ><small>{{ item.canonical_url }}</small>
                      </td>
                      <td>已绑定组织与工作区</td>
                      <td>
                        {{ item.content_type }}<small>{{ size(item.size_bytes) }}</small>
                      </td>
                      <td>
                        {{ time(item.captured_at)
                        }}<small
                          >保留至 {{ time(item.retention_until) }} ·
                          {{ retentionStatus(item.retention_until) }}</small
                        >
                      </td>
                      <td>
                        <button type="button" aria-label="详情" @click="openEvidence(item.id)">
                          完整溯源</button
                        ><button
                          type="button"
                          class="secondary"
                          :disabled="
                            Boolean(downloadInFlightId) ||
                            (blockedOperation?.kind === 'download' &&
                              blockedOperation.key === item.id)
                          "
                          :aria-describedby="
                            blockedOperation?.kind === 'download' &&
                            blockedOperation.key === item.id
                              ? 'quality-operation-lock'
                              : undefined
                          "
                          @click="grantDownload(item)"
                        >
                          {{ downloadInFlightId === item.id ? "申请中…" : "受控下载" }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <template #summary="{ row }">
                <span class="responsive-record-summary">
                  <strong>{{ row.provider_name }} · {{ size(row.size_bytes) }}</strong>
                  <small>{{ row.content_type }} · {{ time(row.captured_at) }}</small>
                </span>
              </template>
              <template #detail="{ row, close }">
                <dl>
                  <div>
                    <dt>来源</dt>
                    <dd>{{ row.provider_name }}</dd>
                  </div>
                  <div>
                    <dt>规范 URL</dt>
                    <dd>{{ row.canonical_url }}</dd>
                  </div>
                  <div>
                    <dt>格式 / 大小</dt>
                    <dd>{{ row.content_type }} · {{ size(row.size_bytes) }}</dd>
                  </div>
                  <div>
                    <dt>捕获时间</dt>
                    <dd>{{ time(row.captured_at) }}</dd>
                  </div>
                  <div>
                    <dt>保留期限</dt>
                    <dd>
                      {{ time(row.retention_until) }} · {{ retentionStatus(row.retention_until) }}
                    </dd>
                  </div>
                </dl>
                <div class="quality-mobile-actions">
                  <button type="button" @click="openEvidenceFromMobile(close, row.id)">
                    读取完整溯源
                  </button>
                  <button
                    type="button"
                    class="secondary"
                    :disabled="
                      Boolean(downloadInFlightId) ||
                      (blockedOperation?.kind === 'download' && blockedOperation.key === row.id)
                    "
                    @click="grantDownload(row)"
                  >
                    {{ downloadInFlightId === row.id ? "申请中…" : "受控下载" }}
                  </button>
                </div>
                <details>
                  <summary>技术详情</summary>
                  <dl>
                    <div>
                      <dt>证据 ID</dt>
                      <dd>{{ row.id }}</dd>
                    </div>
                    <div>
                      <dt>组织 ID</dt>
                      <dd>{{ row.organization_id }}</dd>
                    </div>
                    <div>
                      <dt>工作区 ID</dt>
                      <dd>{{ row.workspace_id }}</dd>
                    </div>
                    <div>
                      <dt>内容哈希</dt>
                      <dd>{{ row.content_sha256 }}</dd>
                    </div>
                    <div>
                      <dt>解析版本</dt>
                      <dd>{{ row.parser_version }}</dd>
                    </div>
                    <div>
                      <dt>请求 ID</dt>
                      <dd>{{ row.request_id }}</dd>
                    </div>
                    <div>
                      <dt>链路 ID</dt>
                      <dd>{{ row.trace_id }}</dd>
                    </div>
                  </dl>
                </details>
              </template>
            </ResponsiveDataView>
            <section
              v-if="tab === 'issues' && selectedRunId"
              class="quality-drilldown"
              role="status"
            >
              <div>
                <strong>异常样本下钻</strong>
                <span>仅显示当前核对运行关联的问题；可继续打开证据查看字段溯源。</span>
              </div>
              <button type="button" class="secondary" @click="clearRunDrilldown">
                返回全部问题
              </button>
            </section>
            <section
              v-if="tab === 'issues'"
              class="quality-batch-toolbar"
              aria-label="质量问题批量处理"
            >
              <div>
                <strong>批量处理开放问题</strong>
                <span
                  >已选择 {{ selectedIssues.length }} 个；批量指派仅允许同一组织的活动成员。</span
                >
                <button
                  type="button"
                  class="secondary"
                  :disabled="!selectedIssueIds.length || saving"
                  @click="clearSelectedIssues"
                >
                  清除选择
                </button>
              </div>
              <label
                >操作<select v-model="batchAction">
                  <option value="attribute">记录归因</option>
                  <option value="assign">指派成员</option>
                  <option value="close">关闭问题</option>
                </select></label
              >
              <label v-if="batchAction === 'assign'"
                >接收成员<select v-model="batchAssignee">
                  <option value="">请选择</option>
                  <option v-for="member in batchMembers" :key="member.id" :value="member.id">
                    {{ member.label }}
                  </option>
                </select></label
              >
              <label class="wide"
                >处理原因<input
                  v-model="batchReason"
                  maxlength="500"
                  placeholder="说明归因、指派或关闭依据"
              /></label>
              <button
                type="button"
                :disabled="saving || !selectedIssues.length || blockedOperation?.kind === 'batch'"
                :aria-describedby="
                  blockedOperation?.kind === 'batch' ? 'quality-operation-lock' : undefined
                "
                @click="previewBatch"
              >
                预览影响范围
              </button>
            </section>
            <ResponsiveDataView
              v-if="tab === 'issues'"
              :rows="filteredIssues"
              :row-key="(item) => item.id"
              title="数据质量问题"
              :detail-title="(item) => metricLabel(item.metric_code)"
            >
              <template #desktop>
                <table>
                  <thead>
                    <tr>
                      <th>选择</th>
                      <th>问题</th>
                      <th>来源</th>
                      <th>状态</th>
                      <th>实际 / 门槛</th>
                      <th>更新时间</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in filteredIssues" :key="item.id">
                      <td>
                        <label class="quality-checkbox">
                          <input
                            type="checkbox"
                            :aria-label="`选择 ${metricLabel(item.metric_code)}`"
                            :checked="selectedIssueIds.includes(item.id)"
                            :disabled="item.status !== 'open'"
                            @change="
                              toggleIssue(item.id, ($event.target as HTMLInputElement).checked)
                            "
                          />
                        </label>
                      </td>
                      <td>
                        <strong>{{ metricLabel(item.metric_code) }}</strong
                        ><small
                          >{{ item.field_path || "来源级指标" }} · 解析
                          {{ item.parser_version || "未关联" }}</small
                        >
                      </td>
                      <td>{{ item.provider_name }}</td>
                      <td>
                        <b :data-severity="item.severity"
                          >{{ item.severity === "critical" ? "严重" : "警告" }} ·
                          {{ item.status === "open" ? "待处理" : "已解决" }}</b
                        >
                      </td>
                      <td>
                        {{
                          item.actual_value === null
                            ? "—"
                            : `${(item.actual_value * 100).toFixed(1)}%`
                        }}<small>{{
                          item.threshold_value === null
                            ? "—"
                            : `${(item.threshold_value * 100).toFixed(1)}%`
                        }}</small>
                      </td>
                      <td>{{ time(item.updated_at) }}</td>
                      <td>
                        <button
                          v-if="item.raw_evidence_id"
                          type="button"
                          class="secondary"
                          @click="openEvidence(item.raw_evidence_id)"
                        >
                          查看证据
                        </button>
                        <button
                          v-if="item.status === 'open'"
                          type="button"
                          :disabled="
                            blockedOperation?.kind === 'resolve' && blockedOperation.key === item.id
                          "
                          :aria-describedby="
                            blockedOperation?.kind === 'resolve' && blockedOperation.key === item.id
                              ? 'quality-operation-lock'
                              : undefined
                          "
                          @click="beginResolve(item)"
                        >
                          记录解决
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <template #summary="{ row }">
                <span class="responsive-record-summary">
                  <strong
                    >{{ metricLabel(row.metric_code) }} ·
                    {{ row.status === "open" ? "待处理" : "已解决" }}</strong
                  >
                  <small
                    >{{ row.provider_name }} ·
                    {{ row.severity === "critical" ? "严重" : "警告" }}</small
                  >
                </span>
              </template>
              <template #detail="{ row, close }">
                <label v-if="row.status === 'open'" class="quality-mobile-select">
                  <input
                    type="checkbox"
                    :checked="selectedIssueIds.includes(row.id)"
                    @change="toggleIssue(row.id, ($event.target as HTMLInputElement).checked)"
                  />
                  选择此问题用于批量处理
                </label>
                <dl>
                  <div>
                    <dt>来源</dt>
                    <dd>{{ row.provider_name }}</dd>
                  </div>
                  <div>
                    <dt>字段</dt>
                    <dd>{{ row.field_path || "来源级指标" }}</dd>
                  </div>
                  <div>
                    <dt>解析版本</dt>
                    <dd>{{ row.parser_version || "未关联" }}</dd>
                  </div>
                  <div>
                    <dt>负责人</dt>
                    <dd>{{ row.assigned_member_label || "未指派" }}</dd>
                  </div>
                  <div v-if="row.attribution_reason">
                    <dt>归因</dt>
                    <dd>{{ row.attribution_reason }}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>
                      {{ row.severity === "critical" ? "严重" : "警告" }} ·
                      {{ row.status === "open" ? "待处理" : "已解决" }}
                    </dd>
                  </div>
                  <div>
                    <dt>实际 / 门槛</dt>
                    <dd>
                      {{
                        row.actual_value === null ? "—" : `${(row.actual_value * 100).toFixed(1)}%`
                      }}
                      /
                      {{
                        row.threshold_value === null
                          ? "—"
                          : `${(row.threshold_value * 100).toFixed(1)}%`
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>更新时间</dt>
                    <dd>{{ time(row.updated_at) }}</dd>
                  </div>
                  <div v-if="row.resolution_reason">
                    <dt>解决原因</dt>
                    <dd>{{ row.resolution_reason }}</dd>
                  </div>
                </dl>
                <button
                  v-if="row.raw_evidence_id"
                  type="button"
                  class="secondary"
                  @click="openEvidenceFromMobile(close, row.raw_evidence_id)"
                >
                  查看关联证据
                </button>
                <button
                  v-if="row.status === 'open'"
                  type="button"
                  :disabled="
                    blockedOperation?.kind === 'resolve' && blockedOperation.key === row.id
                  "
                  @click="beginResolveFromMobile(close, row)"
                >
                  记录解决
                </button>
                <details>
                  <summary>技术详情</summary>
                  <dl>
                    <div>
                      <dt>问题 ID</dt>
                      <dd>{{ row.id }}</dd>
                    </div>
                  </dl>
                </details>
              </template>
            </ResponsiveDataView>
            <div v-else-if="tab === 'runs'" class="quality-run-grid">
              <article v-for="run in runs" :key="run.id">
                <header>
                  <div>
                    <strong>{{ run.provider_name }}</strong
                    ><small>{{ run.market }} · {{ run.parser_version }}</small>
                  </div>
                  <b :data-status="run.status">{{ qualityStatusLabel(run.status) }}</b>
                </header>
                <p>{{ run.sample_count }} 个样本 · {{ time(run.window_ended_at) }}</p>
                <ul>
                  <li v-for="metric in run.metrics" :key="metric.code">
                    <span>{{ metricLabel(metric.code) }}</span
                    ><strong>{{ (metric.value * 100).toFixed(1) }}%</strong
                    ><small
                      >门槛 {{ (metric.threshold * 100).toFixed(1) }}% ·
                      {{ qualityStatusLabel(metric.status) }}</small
                    >
                  </li>
                </ul>
                <button type="button" class="secondary" @click="drillIntoRun(run)">
                  查看异常字段与样本
                </button>
              </article>
            </div>
            <nav
              v-if="tab !== 'runs' && pageTotal"
              class="quality-pagination"
              aria-label="证据与质量分页"
            >
              <button type="button" :disabled="refreshing || page <= 1" @click="goToPage(page - 1)">
                上一页
              </button>
              <span>{{ rangeLabel }} · 第 {{ page }} / {{ totalPages }} 页</span>
              <button
                type="button"
                :disabled="refreshing || page >= totalPages"
                @click="goToPage(page + 1)"
              >
                下一页
              </button>
            </nav>
          </section>
          <dialog
            v-if="detailOpen"
            ref="detailDialogElement"
            class="quality-modal quality-detail"
            aria-labelledby="quality-detail-title"
            @cancel="handleDetailCancel"
          >
            <header>
              <div>
                <p>完整证据链</p>
                <h3 id="quality-detail-title">证据完整溯源</h3>
                <span>{{ detailTargetId }}</span>
              </div>
              <button type="button" aria-label="关闭证据详情" @click="closeEvidenceDetail">
                ×
              </button>
            </header>
            <div v-if="detailState === 'loading'" class="quality-modal-state" role="status">
              <strong>正在读取证据链…</strong>
              <span>原始证据、规范版本和字段来源将按同一证据编号关联。</span>
            </div>
            <div v-else-if="detailState === 'error'" class="quality-modal-state" data-tone="danger">
              <strong>暂时无法读取完整溯源</strong>
              <span>{{ detailMessage }}</span>
              <button type="button" @click="openEvidence(detailTargetId)">重新读取</button>
            </div>
            <template v-else-if="detailState === 'ready' && detail">
              <section class="quality-lineage-intro">
                <strong>原始证据 → 规范版本 → 字段来源 → 质量问题</strong>
                <span>以下内容来自同一详情响应，不补造未保存的样本关系。</span>
              </section>
              <section class="quality-lineage-section">
                <h4>01 · 原始证据</h4>
                <dl>
                  <div>
                    <dt>来源</dt>
                    <dd>{{ detail.evidence.provider_name }}</dd>
                  </div>
                  <div>
                    <dt>规范 URL</dt>
                    <dd>{{ detail.evidence.canonical_url }}</dd>
                  </div>
                  <div>
                    <dt>解析器 / 适配器</dt>
                    <dd>
                      {{ detail.evidence.parser_version }} /
                      {{ detail.evidence.adapter_version }}
                    </dd>
                  </div>
                  <div>
                    <dt>捕获 / 保留</dt>
                    <dd>
                      {{ time(detail.evidence.captured_at) }} /
                      {{ time(detail.evidence.retention_until) }}
                    </dd>
                  </div>
                </dl>
              </section>
              <section class="quality-lineage-section">
                <h4>02 · 规范记录版本</h4>
                <article v-for="item in detail.normalized_records" :key="item.id">
                  <strong>{{ item.record_key }} · v{{ item.record_version }}</strong>
                  <span>{{ item.schema_version }} · {{ item.status }}</span>
                </article>
                <p v-if="!detail.normalized_records?.length">当前详情没有规范记录版本。</p>
              </section>
              <section class="quality-lineage-section">
                <h4>03 · 字段来源</h4>
                <article v-for="item in detail.field_provenance" :key="item.id">
                  <strong>{{ item.field_path }}</strong>
                  <span>{{ item.source_path }} · {{ item.transform_version }}</span>
                  <small>{{ item.source_value_sha256 }}</small>
                </article>
                <p v-if="!detail.field_provenance?.length">当前详情没有字段溯源记录。</p>
              </section>
              <section class="quality-lineage-section">
                <h4>04 · 关联质量问题</h4>
                <article v-for="item in detail.quality_issues" :key="item.id">
                  <strong>{{ metricLabel(item.metric_code) }}</strong>
                  <span>{{ item.field_path || "来源级指标" }} · {{ item.status }}</span>
                </article>
                <p v-if="!detail.quality_issues?.length">当前详情没有关联质量问题。</p>
              </section>
              <details class="quality-technical">
                <summary>技术标识</summary>
                <dl>
                  <div>
                    <dt>证据 ID</dt>
                    <dd>{{ detail.evidence.id }}</dd>
                  </div>
                  <div>
                    <dt>请求 ID</dt>
                    <dd>{{ detail.evidence.request_id }}</dd>
                  </div>
                  <div>
                    <dt>链路 ID</dt>
                    <dd>{{ detail.evidence.trace_id }}</dd>
                  </div>
                  <div>
                    <dt>内容哈希</dt>
                    <dd>{{ detail.evidence.content_sha256 }}</dd>
                  </div>
                </dl>
              </details>
            </template>
          </dialog>
          <dialog
            v-if="resolutionOpen && resolving"
            ref="resolutionDialogElement"
            class="quality-modal quality-resolution"
            aria-labelledby="quality-resolution-title"
            @cancel="handleResolutionCancel"
          >
            <header>
              <div>
                <p>受控处置</p>
                <h3 id="quality-resolution-title">{{ metricLabel(resolving.metric_code) }}</h3>
                <span>{{ resolving.provider_name }} · 版本 {{ resolving.version }}</span>
              </div>
              <button type="button" aria-label="关闭解决表单" @click="closeResolution">×</button>
            </header>
            <section class="quality-resolution-context">
              <div>
                <span>字段</span><strong>{{ resolving.field_path || "来源级指标" }}</strong>
              </div>
              <div>
                <span>实际 / 门槛</span
                ><strong
                  >{{
                    resolving.actual_value === null
                      ? "—"
                      : `${(resolving.actual_value * 100).toFixed(1)}%`
                  }}
                  /
                  {{
                    resolving.threshold_value === null
                      ? "—"
                      : `${(resolving.threshold_value * 100).toFixed(1)}%`
                  }}</strong
                >
              </div>
            </section>
            <p>解决只追加原因和审计，不修改或删除原始证据与历史核对。</p>
            <label>
              解决原因
              <textarea
                v-model="reason"
                autofocus
                rows="5"
                maxlength="500"
                placeholder="说明修复方式与验证依据（2–500 字）"
              ></textarea>
              <small>{{ reason.trim().length }} / 500；至少 2 个字符</small>
            </label>
            <footer>
              <button type="button" class="secondary" @click="closeResolution">取消</button>
              <button
                type="button"
                :disabled="reason.trim().length < 2 || saving"
                @click="previewResolve"
              >
                确认前检查
              </button>
            </footer>
          </dialog></template
        >
        <footer class="quality-footer">
          <TechnicalDetails :request-id="requestId" />
        </footer>
      </div>
    </div>
    <ConfirmDialog
      :open="confirming"
      title="将此质量问题标记为已解决？"
      description="系统会用 expected_version 防止覆盖他人更新，并保存原因、操作人和关联标识。"
      impact="原始证据、规范记录、字段溯源和核对历史不会被删除或改写。"
      confirm-label="确认解决"
      confirmation-text="确认解决"
      :busy="saving"
      busy-label="正在记录…"
      :status-message="confirmMessage"
      :status-request-id="confirmMessage ? requestId : ''"
      @cancel="cancelResolveConfirmation"
      @confirm="resolveIssue"
    />
    <ConfirmDialog
      :open="batchConfirming"
      :title="`确认${batchPreview?.actionLabel || '批量处理'}质量问题？`"
      :description="`系统会按预览时固定的 ${batchPreview?.items.length || 0} 个问题逐条校验版本和开放状态${batchPreview?.assigneeLabel ? `，并指派给 ${batchPreview.assigneeLabel}` : ''}；任一问题已变化时整批失败。`"
      :impact="batchPreview?.impact || batchImpact"
      confirm-label="确认批量处理"
      confirmation-text="确认处理"
      :busy="saving"
      busy-label="正在处理…"
      :status-message="confirmMessage"
      :status-request-id="confirmMessage ? requestId : ''"
      @cancel="cancelBatchConfirmation"
      @confirm="executeBatch"
    />
  </section>
</template>
