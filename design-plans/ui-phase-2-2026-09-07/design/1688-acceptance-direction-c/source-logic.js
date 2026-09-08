// Actual Vue script in an inert bridge; not mounted Vue.
window.ACCEPTANCE_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    onMounted,
    onBeforeUnmount,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    AbortController,
    DOMException,
  } = bridge;
  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
  const state = ref("loading");
  const data = ref(null);
  const message = ref("");
  const requestId = ref("");
  const refreshing = ref(false);
  const lastUpdatedAt = ref(null);
  const notice = ref("");
  const noticeTone = ref("success");
  const organizations = ref([]);
  const workspaces = ref([]);
  const selectedOrganizationId = ref("");
  const selectedWorkspaceId = ref("");
  const acceptanceQuery = ref("");
  const scopeLoading = ref(false);
  const scheduling = ref(false);
  const scopeMessage = ref("");
  const scheduledTaskId = ref("");
  let activeController = null;
  const gateName = { login: "登录态", captcha: "验证码", parser: "字段解析" };
  const gateState = { passed: "已通过", blocked: "已阻断", pending: "待验收" };
  const gateAction = {
    login: "配置有效登录档案，并完成一次真实登录态运行。",
    captcha: "由同一次真实登录运行自动确认未被验证码阻断。",
    parser: "固定真实样本，完成当前解析器回放和第二人审批。",
  };
  const matrixName = { search: "搜索结果", detail: "商品详情", pagination: "翻页覆盖" };
  const matrixState = {
    covered: "已覆盖",
    not_observed: "未观测",
    not_exercised: "未演练",
    invalid: "合同异常",
  };
  const sourceState = { draft: "草稿", disabled: "已停用", enabled: "已启用" };
  const overallState = {
    setup_required: "尚未满足启用条件",
    ready_for_enable: "门禁已通过，等待负责人启用",
    production_ready: "来源已启用",
  };
  const runState = {
    scheduled: "等待执行",
    leased: "已领取",
    running: "执行中",
    succeeded: "运行成功",
    succeeded_empty: "运行成功但无结果",
    failed: "运行失败",
    blocked: "运行受阻",
    cancelled: "已取消",
    dead_letter: "进入死信",
  };
  const passedGateCount = computed(
    () => data.value?.gates.filter((gate) => gate.state === "passed").length ?? 0,
  );
  const title = computed(() => (data.value ? overallState[data.value.overall] : "1688 启用条件"));
  const conclusion = computed(() => {
    if (data.value?.overall === "production_ready")
      return "来源已经启用，仍应持续关注登录有效期、验证码和解析合同漂移。";
    if (data.value?.overall === "ready_for_enable")
      return "三道验收门均已通过；仍需由来源负责人显式启用，系统不会自动放行。";
    return "登录、验证码和字段解析必须全部通过；任一待验收或阻断都会保持来源停用。";
  });
  const stateTitle = computed(
    () =>
      ({
        loading: "正在读取启用条件",
        error: "启用检查服务暂不可用",
        forbidden: "当前账号无权读取启用条件",
        expired: "登录已失效",
        ready: "",
      })[state.value],
  );
  const lastUpdatedLabel = computed(() =>
    lastUpdatedAt.value
      ? new Date(lastUpdatedAt.value).toLocaleTimeString("zh-CN", { hour12: false })
      : "尚未完成读取",
  );
  const credentialsLink = computed(() =>
    data.value
      ? `/platform-admin/credentials?provider_id=${data.value.provider_id}&mode=login`
      : "/platform-admin/credentials",
  );
  const sampleLink = computed(() =>
    data.value
      ? `/platform-admin/providers/sources?provider_id=${data.value.provider_id}`
      : "/platform-admin/providers/sources",
  );
  const currentRunState = computed(() => {
    const status = data.value?.latest_run?.status;
    return status ? (runState[status] ?? status) : "尚无运行";
  });
  const canSchedule = computed(
    () =>
      Boolean(
        data.value?.provider_id &&
        selectedOrganizationId.value &&
        selectedWorkspaceId.value &&
        acceptanceQuery.value.trim(),
      ) &&
      !scopeLoading.value &&
      !scheduling.value,
  );
  const time = (value) =>
    value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无证据";
  async function loadWorkspaces() {
    workspaces.value = [];
    selectedWorkspaceId.value = "";
    if (!selectedOrganizationId.value) return;
    scopeLoading.value = true;
    scopeMessage.value = "";
    try {
      const response = await request(`/org/${selectedOrganizationId.value}/workspaces`);
      const active = response.data.filter((workspace) => workspace.status === "active");
      workspaces.value = active;
      const organization = organizations.value.find(
        (item) => item.id === selectedOrganizationId.value,
      );
      selectedWorkspaceId.value =
        active.find((workspace) => workspace.id === organization?.default_workspace_id)?.id ??
        active[0]?.id ??
        "";
      if (!active.length) scopeMessage.value = "该组织没有可用于验收的活动工作区。";
    } catch (error) {
      scopeMessage.value =
        error instanceof ApiClientError ? error.actionHint : "工作区读取失败，请稍后重试。";
    } finally {
      scopeLoading.value = false;
    }
  }
  async function loadExecutionScopes() {
    scopeLoading.value = true;
    scopeMessage.value = "";
    try {
      const response = await request("/org/memberships");
      organizations.value = response.data.filter(
        (organization) =>
          organization.status === "active" && organization.membership_status === "active",
      );
      selectedOrganizationId.value = organizations.value[0]?.id ?? "";
      if (!organizations.value.length) {
        scopeMessage.value = "当前账号没有可用于验收的活动组织。";
        scopeLoading.value = false;
        return;
      }
    } catch (error) {
      scopeMessage.value =
        error instanceof ApiClientError ? error.actionHint : "组织范围读取失败，请稍后重试。";
      scopeLoading.value = false;
      return;
    }
    scopeLoading.value = false;
    await loadWorkspaces();
  }
  async function scheduleAcceptanceRun() {
    if (!canSchedule.value || !data.value) return;
    scheduling.value = true;
    notice.value = "";
    scopeMessage.value = "";
    try {
      const response = await request(
        `/platform/provider-sources/${data.value.provider_id}/replays`,
        {
          method: "POST",
          body: {
            organization_id: selectedOrganizationId.value,
            workspace_id: selectedWorkspaceId.value,
            query: acceptanceQuery.value.trim(),
            acceptance_run: true,
          },
        },
      );
      requestId.value = response.request_id;
      scheduledTaskId.value = response.data.task_id;
      await load();
      noticeTone.value = "success";
      notice.value = "登录验收运行已提交；刷新检查结果可查看真实浏览器运行结论。";
    } catch (error) {
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        scopeMessage.value = error.actionHint;
      } else scopeMessage.value = "验收运行提交失败，请稍后重试。";
    } finally {
      scheduling.value = false;
    }
  }
  async function load() {
    if (refreshing.value) return;
    const preserve = data.value !== null;
    if (!preserve) state.value = "loading";
    refreshing.value = true;
    message.value = "";
    notice.value = "";
    activeController = new AbortController();
    const timer = window.setTimeout(() => activeController?.abort(), 12_000);
    try {
      const response = await request("/platform/provider-sources/1688-acceptance", {
        signal: activeController.signal,
      });
      requestId.value = response.request_id;
      data.value = response.data;
      state.value = "ready";
      lastUpdatedAt.value = new Date().toISOString();
      if (preserve) {
        noticeTone.value = "success";
        notice.value = "启用条件已刷新，页面结论来自最新一次运行记录。";
      }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        message.value = error.actionHint;
      } else {
        message.value = timedOut ? "读取超过 12 秒，请稍后重试。" : "网络连接异常，请稍后重试。";
      }
      if (preserve) {
        state.value = "ready";
        noticeTone.value = "danger";
        notice.value = timedOut
          ? "刷新超过 12 秒，已保留上一次成功读取的启用条件。"
          : `${message.value} 已保留上一次成功读取的启用条件。`;
      } else if (error instanceof ApiClientError) {
        state.value =
          error.kind === "expired" ? "expired" : error.kind === "forbidden" ? "forbidden" : "error";
      } else state.value = "error";
    } finally {
      window.clearTimeout(timer);
      activeController = null;
      refreshing.value = false;
    }
  }
  onMounted(() => {
    void load();
    void loadExecutionScopes();
  });
  onBeforeUnmount(() => activeController?.abort());

  return {
    state,
    data,
    message,
    requestId,
    refreshing,
    lastUpdatedAt,
    notice,
    noticeTone,
    organizations,
    workspaces,
    selectedOrganizationId,
    selectedWorkspaceId,
    acceptanceQuery,
    scopeLoading,
    scheduling,
    scopeMessage,
    scheduledTaskId,
    gateName,
    gateState,
    gateAction,
    matrixName,
    matrixState,
    sourceState,
    overallState,
    runState,
    passedGateCount,
    title,
    conclusion,
    stateTitle,
    lastUpdatedLabel,
    credentialsLink,
    sampleLink,
    currentRunState,
    canSchedule,
    time,
    loadWorkspaces,
    loadExecutionScopes,
    scheduleAcceptanceRun,
    load,
  };
};
