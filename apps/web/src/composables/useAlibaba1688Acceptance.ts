import type { OrganizationMembershipSummary, WorkspaceSummary } from "@scoutops/contracts";
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type {
  AcceptanceRunOutcome,
  AcceptanceSnapshot,
  AcceptanceViewState,
  ScheduledAcceptanceRun,
} from "../components/provider-1688-acceptance-types";

type ReadPurpose = "refresh" | "after-run";

const UNKNOWN_WRITE_STATUSES = new Set([0, 408, 425, 500, 502, 503, 504]);

const isUnknownWriteOutcome = (error: unknown) =>
  !(error instanceof ApiClientError) || UNKNOWN_WRITE_STATUSES.has(error.status);

export function useAlibaba1688Acceptance(apiBaseUrl: string) {
  const request = createApiClient(apiBaseUrl);
  const state = ref<AcceptanceViewState>("loading");
  const data = ref<AcceptanceSnapshot | null>(null);
  const message = ref("");
  const readNotice = ref("");
  const readNoticeTone = ref<"success" | "danger">("success");
  const refreshing = ref(false);
  const lastUpdatedAt = ref<string | null>(null);
  const readRequestId = ref("");
  const readFailureRequestId = ref("");

  const organizations = ref<OrganizationMembershipSummary[]>([]);
  const workspaces = ref<WorkspaceSummary[]>([]);
  const selectedOrganizationId = ref("");
  const selectedWorkspaceId = ref("");
  const acceptanceQuery = ref("");
  const scopeLoading = ref(false);
  const scopeMessage = ref("");
  const scopeRequestId = ref("");
  const scopeRetryable = ref(false);

  const scheduling = ref(false);
  const scheduledTaskId = ref("");
  const runOutcome = ref<AcceptanceRunOutcome | null>(null);

  let pageMounted = false;
  let pageActive = true;
  let wasDeactivated = false;
  let acceptanceReadOperation = 0;
  let membershipReadOperation = 0;
  let workspaceReadOperation = 0;
  let submissionOperation = 0;
  let activeAcceptanceController: AbortController | null = null;
  let activeMembershipController: AbortController | null = null;
  let activeWorkspaceController: AbortController | null = null;

  const currentRunOutcomeUnknown = computed(() => runOutcome.value?.kind === "unknown");
  const canSchedule = computed(
    () =>
      Boolean(
        data.value?.provider_id &&
        selectedOrganizationId.value &&
        selectedWorkspaceId.value &&
        acceptanceQuery.value.trim(),
      ) &&
      !scopeLoading.value &&
      !scheduling.value &&
      !currentRunOutcomeUnknown.value,
  );

  function invalidateAcceptanceRead() {
    acceptanceReadOperation += 1;
    activeAcceptanceController?.abort();
    activeAcceptanceController = null;
    refreshing.value = false;
  }

  function invalidateScopeReads() {
    membershipReadOperation += 1;
    workspaceReadOperation += 1;
    activeMembershipController?.abort();
    activeWorkspaceController?.abort();
    activeMembershipController = null;
    activeWorkspaceController = null;
    scopeLoading.value = false;
  }

  async function load(options: { force?: boolean; purpose?: ReadPurpose } = {}) {
    if (!pageMounted || !pageActive) return false;
    if (refreshing.value && !options.force) return false;
    if (options.force) activeAcceptanceController?.abort();

    const operation = ++acceptanceReadOperation;
    const controller = new AbortController();
    const isCurrent = () => pageMounted && pageActive && operation === acceptanceReadOperation;
    const preserve = data.value !== null;
    activeAcceptanceController = controller;
    if (!preserve) state.value = "loading";
    refreshing.value = true;
    message.value = "";
    readFailureRequestId.value = "";
    readNotice.value = "";
    const timer = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await request<AcceptanceSnapshot>(
        "/platform/provider-sources/1688-acceptance",
        { signal: controller.signal },
      );
      if (!isCurrent()) return false;
      readRequestId.value = response.request_id;
      data.value = response.data;
      state.value = "ready";
      lastUpdatedAt.value = new Date().toISOString();
      if (preserve) {
        readNoticeTone.value = "success";
        readNotice.value =
          options.purpose === "after-run"
            ? "启用条件已重新读取；受控运行是否完成，以最新浏览器运行记录为准。"
            : "启用条件已刷新，页面结论来自最新一次运行记录。";
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      if (error instanceof ApiClientError) {
        readFailureRequestId.value = error.requestId;
        message.value = error.actionHint;
      } else {
        message.value = timedOut ? "读取超过 12 秒，请稍后重试。" : "网络连接异常，请稍后重试。";
      }
      if (preserve) {
        state.value = "ready";
        readNoticeTone.value = "danger";
        readNotice.value =
          options.purpose === "after-run"
            ? "验收运行已确认排队，但最新启用条件暂未能读取；仍显示上一次成功读取的证据。"
            : timedOut
              ? "刷新超过 12 秒，已保留上一次成功读取的启用条件。"
              : `${message.value} 已保留上一次成功读取的启用条件。`;
      } else if (error instanceof ApiClientError) {
        state.value =
          error.kind === "expired" ? "expired" : error.kind === "forbidden" ? "forbidden" : "error";
      } else state.value = "error";
      return false;
    } finally {
      window.clearTimeout(timer);
      if (isCurrent()) {
        if (activeAcceptanceController === controller) activeAcceptanceController = null;
        refreshing.value = false;
      }
    }
  }

  async function loadWorkspaces(organizationId = selectedOrganizationId.value) {
    const operation = ++workspaceReadOperation;
    activeWorkspaceController?.abort();
    const controller = new AbortController();
    activeWorkspaceController = controller;
    const isCurrent = () =>
      pageMounted &&
      pageActive &&
      operation === workspaceReadOperation &&
      selectedOrganizationId.value === organizationId;

    workspaces.value = [];
    selectedWorkspaceId.value = "";
    scopeMessage.value = "";
    scopeRequestId.value = "";
    scopeRetryable.value = false;
    if (!organizationId) {
      scopeLoading.value = false;
      return false;
    }

    scopeLoading.value = true;
    try {
      const response = await request<WorkspaceSummary[]>(`/org/${organizationId}/workspaces`, {
        signal: controller.signal,
      });
      if (!isCurrent()) return false;
      scopeRequestId.value = response.request_id;
      const active = response.data.filter((workspace) => workspace.status === "active");
      workspaces.value = active;
      const organization = organizations.value.find((item) => item.id === organizationId);
      selectedWorkspaceId.value =
        active.find((workspace) => workspace.id === organization?.default_workspace_id)?.id ??
        active[0]?.id ??
        "";
      if (!active.length) scopeMessage.value = "该组织没有可用于验收的活动工作区。";
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      scopeMessage.value =
        error instanceof ApiClientError ? error.actionHint : "工作区读取失败，请稍后重试。";
      scopeRequestId.value = error instanceof ApiClientError ? error.requestId : "";
      scopeRetryable.value = true;
      return false;
    } finally {
      if (isCurrent()) {
        if (activeWorkspaceController === controller) activeWorkspaceController = null;
        scopeLoading.value = false;
      }
    }
  }

  async function loadExecutionScopes() {
    const operation = ++membershipReadOperation;
    activeMembershipController?.abort();
    activeWorkspaceController?.abort();
    workspaceReadOperation += 1;
    const controller = new AbortController();
    activeMembershipController = controller;
    const isCurrent = () => pageMounted && pageActive && operation === membershipReadOperation;

    scopeLoading.value = true;
    scopeMessage.value = "";
    scopeRequestId.value = "";
    scopeRetryable.value = false;
    workspaces.value = [];
    selectedWorkspaceId.value = "";
    try {
      const response = await request<OrganizationMembershipSummary[]>("/org/memberships", {
        signal: controller.signal,
      });
      if (!isCurrent()) return false;
      scopeRequestId.value = response.request_id;
      organizations.value = response.data.filter(
        (organization) =>
          organization.status === "active" && organization.membership_status === "active",
      );
      selectedOrganizationId.value = organizations.value[0]?.id ?? "";
      if (!organizations.value.length) {
        scopeMessage.value = "当前账号没有可用于验收的活动组织。";
        scopeLoading.value = false;
        return true;
      }
      if (activeMembershipController === controller) activeMembershipController = null;
      return await loadWorkspaces(selectedOrganizationId.value);
    } catch (error) {
      if (!isCurrent()) return false;
      scopeMessage.value =
        error instanceof ApiClientError ? error.actionHint : "组织范围读取失败，请稍后重试。";
      scopeRequestId.value = error instanceof ApiClientError ? error.requestId : "";
      scopeRetryable.value = true;
      scopeLoading.value = false;
      return false;
    } finally {
      if (isCurrent() && activeMembershipController === controller)
        activeMembershipController = null;
    }
  }

  function selectOrganization(organizationId: string) {
    selectedOrganizationId.value = organizationId;
    activeWorkspaceController?.abort();
    workspaceReadOperation += 1;
    if (!organizationId) {
      workspaces.value = [];
      selectedWorkspaceId.value = "";
      scopeMessage.value = "";
      scopeRequestId.value = "";
      scopeLoading.value = false;
      return;
    }
    void loadWorkspaces(organizationId);
  }

  async function retryExecutionScopes() {
    if (scopeLoading.value || !scopeRetryable.value) return;
    await loadExecutionScopes();
  }

  async function scheduleAcceptanceRun() {
    const snapshot = data.value;
    if (!canSchedule.value || !snapshot) return;
    const operation = ++submissionOperation;
    const providerId = snapshot.provider_id;
    const organizationId = selectedOrganizationId.value;
    const workspaceId = selectedWorkspaceId.value;
    const query = acceptanceQuery.value.trim();
    const isCurrent = () => pageMounted && operation === submissionOperation;

    scheduling.value = true;
    scheduledTaskId.value = "";
    scopeMessage.value = "";
    runOutcome.value = {
      kind: "submitting",
      message: "正在创建一次受控登录验收任务；不会启用来源或加入自动调度。",
      requestId: "",
      taskId: "",
    };

    try {
      const response = await request<ScheduledAcceptanceRun>(
        `/platform/provider-sources/${providerId}/replays`,
        {
          method: "POST",
          body: {
            organization_id: organizationId,
            workspace_id: workspaceId,
            query,
            acceptance_run: true,
          },
        },
      );
      if (!isCurrent()) return;
      scheduledTaskId.value = response.data.task_id;
      runOutcome.value = {
        kind: "scheduled",
        message: "登录验收运行已确认排队；这不表示浏览器运行已完成，也不会自动启用来源。",
        requestId: response.request_id,
        taskId: response.data.task_id,
      };
      await load({ force: true, purpose: "after-run" });
    } catch (error) {
      if (!isCurrent()) return;
      const requestId = error instanceof ApiClientError ? error.requestId : "";
      if (isUnknownWriteOutcome(error)) {
        runOutcome.value = {
          kind: "unknown",
          message: "提交结果暂时无法确认，任务可能已创建。请先核对最新运行记录，系统不会自动重发。",
          requestId,
          taskId: "",
        };
      } else {
        runOutcome.value = {
          kind: "failed",
          message:
            error instanceof ApiClientError ? error.actionHint : "验收运行提交失败，请稍后重试。",
          requestId,
          taskId: "",
        };
      }
    } finally {
      if (isCurrent()) scheduling.value = false;
    }
  }

  function activatePage() {
    pageActive = true;
    void load();
    void loadExecutionScopes();
  }

  onMounted(() => {
    pageMounted = true;
    pageActive = true;
    void load();
    void loadExecutionScopes();
  });
  onDeactivated(() => {
    wasDeactivated = true;
    pageActive = false;
    invalidateAcceptanceRead();
    invalidateScopeReads();
  });
  onActivated(() => {
    if (!wasDeactivated) return;
    wasDeactivated = false;
    activatePage();
  });
  onBeforeUnmount(() => {
    pageMounted = false;
    pageActive = false;
    submissionOperation += 1;
    invalidateAcceptanceRead();
    invalidateScopeReads();
  });

  return {
    state,
    data,
    message,
    readNotice,
    readNoticeTone,
    refreshing,
    lastUpdatedAt,
    readRequestId,
    readFailureRequestId,
    organizations,
    workspaces,
    selectedOrganizationId,
    selectedWorkspaceId,
    acceptanceQuery,
    scopeLoading,
    scopeMessage,
    scopeRequestId,
    scopeRetryable,
    scheduling,
    scheduledTaskId,
    runOutcome,
    currentRunOutcomeUnknown,
    canSchedule,
    load,
    loadWorkspaces,
    selectOrganization,
    retryExecutionScopes,
    scheduleAcceptanceRun,
  };
}
