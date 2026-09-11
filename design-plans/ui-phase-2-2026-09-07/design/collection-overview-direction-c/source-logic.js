// Actual Vue script and status labels; inert bridge, not a Vue mount.
window.OVERVIEW_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    nextTick,
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    onMounted,
    watch,
    useRoute,
    useRouter,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    AbortController,
    URLSearchParams,
    crypto,
  } = bridge;
  const labels = {
    accepted: "已受理",
    active: "正常",
    adopted: "已采纳",
    blocked: "已受阻",
    blocked_captcha: "验证码受阻",
    blocked_login: "登录已失效",
    blocked_robots: "站点规则受阻",
    cancelled: "已取消",
    closed: "已关闭",
    completed: "已完成",
    completed_with_warnings: "完成但有缺失",
    dead_letter: "失败待处理",
    enabled: "已启用",
    failed: "失败",
    failed_terminal: "终止失败",
    in_progress: "处理中",
    insufficient: "证据不足",
    insufficient_data: "数据不足",
    leased: "已领取",
    observing: "持续观察",
    open: "未处理",
    paused: "已暂停",
    parsing: "解析中",
    pending: "待处理",
    persisted: "已持久化",
    queued: "排队中",
    rate_limited: "限速等待",
    rejected: "已驳回",
    retry_scheduled: "等待重试",
    running: "执行中",
    scheduled: "已排队",
    stale: "数据已过期",
    succeeded: "成功",
    succeeded_empty: "成功但无结果",
    todo: "待处理",
    validating: "校验中",
  };
  const statusLabel = (value) => (value ? (labels[value] ?? "待确认") : "未提供");
  const technicalStatus = (value) => value ?? "unknown";
  const durationLabel = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0),
      days = Math.floor(safe / 86400),
      hours = Math.floor((safe % 86400) / 3600),
      minutes = Math.floor((safe % 3600) / 60);
    if (days) return `${days} 天 ${hours} 小时`;
    if (hours) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  };

  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
  const route = useRoute(),
    router = useRouter(),
    queryText = (value) => (typeof value === "string" ? value : ""),
    queryPage = (value) => {
      const text = queryText(value);
      return /^\d{1,6}$/.test(text) && Number(text) > 0 ? Number(text) : 1;
    },
    queryWindow = (value) => {
      const text = queryText(value);
      return ["24h", "7d", "30d", "all"].includes(text) ? text : "24h";
    },
    routeScope = () => ({
      organizationId: queryText(route.query.organization_id),
      workspaceId: queryText(route.query.workspace_id),
      providerId: queryText(route.query.provider_id),
      window: queryWindow(route.query.window),
      errorCode: queryText(route.query.error_code),
      attemptPage: queryPage(route.query.attempt_page),
      deadLetterPage: queryPage(route.query.dead_letter_page),
    }),
    initialScope = routeScope();
  const state = ref("loading"),
    data = ref(null),
    org = ref(initialScope.organizationId),
    workspace = ref(initialScope.workspaceId),
    provider = ref(initialScope.providerId),
    timeWindow = ref(initialScope.window),
    errorCode = ref(initialScope.errorCode),
    attemptPage = ref(initialScope.attemptPage),
    deadLetterPage = ref(initialScope.deadLetterPage),
    requestId = ref(""),
    hint = ref(""),
    refreshNotice = ref(""),
    refreshing = ref(false),
    selectedDeadLetterIds = ref([]),
    batchReason = ref(""),
    batchReasonIssue = ref(""),
    batchReasonField = ref(null),
    batchPreview = ref(false),
    batchSnapshot = ref(null),
    batchBusy = ref(false),
    batchUnknown = ref(false),
    batchNotice = ref(""),
    batchFailures = ref([]),
    sourcesExpanded = ref(false),
    rootCauseSection = ref(null);
  let activeController = null,
    readSequence = 0,
    pageActive = true,
    resumeRead = false,
    detachedBatchSettlement = null;
  const sourceDisplayLimit = 8;
  const batchReasonValidationMessage = "重放原因需要 2–500 字符。";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const selectedDeadLetters = computed(() =>
      (data.value?.dead_letters ?? []).filter(
        (item) => item.status === "open" && selectedDeadLetterIds.value.includes(item.id),
      ),
    ),
    batchImpact = computed(() => {
      const items = selectedDeadLetters.value,
        roots = new Map();
      for (const item of items) roots.set(item.error_code, (roots.get(item.error_code) ?? 0) + 1);
      const rootSummary = [...roots.entries()]
          .map(([code, total]) => `${errorLabel(code)} ${total} 条`)
          .join("、"),
        organizationCount = new Set(items.map((item) => item.organization_id)).size,
        workspaceCount = new Set(items.map((item) => item.workspace_id)).size;
      return `${items.length} 条开放死信；${organizationCount} 个组织；${workspaceCount} 个工作区；根因：${rootSummary || "无"}。`;
    }),
    batchConfirmationImpact = computed(() => batchSnapshot.value?.impact ?? batchImpact.value),
    scopeFilterCount = computed(
      () =>
        [org.value, workspace.value, provider.value, errorCode.value].filter(Boolean).length +
        (timeWindow.value === "24h" ? 0 : 1),
    ),
    orderedSources = computed(() =>
      [...(data.value?.sources ?? [])].sort((left, right) => {
        const priority = (item) =>
          ["blocked", "critical", "degraded", "warning"].includes(item.health_status) ||
          Number(item.consecutive_failures) > 0
            ? 0
            : ["ready", "healthy"].includes(item.health_status)
              ? 1
              : 2;
        return priority(left) - priority(right);
      }),
    ),
    visibleSources = computed(() =>
      sourcesExpanded.value
        ? orderedSources.value
        : orderedSources.value.slice(0, sourceDisplayLimit),
    ),
    hiddenSourceCount = computed(() =>
      Math.max(0, orderedSources.value.length - visibleSources.value.length),
    );
  function scopeValidation() {
    if (org.value && !uuidPattern.test(org.value.trim())) return "请输入有效的组织 ID。";
    if (workspace.value && !uuidPattern.test(workspace.value.trim()))
      return "请输入有效的工作区 ID。";
    if (provider.value && !uuidPattern.test(provider.value)) return "请选择有效的采集来源。";
    return "";
  }
  const readScope = () => ({
    organizationId: org.value.trim(),
    workspaceId: workspace.value.trim(),
    providerId: provider.value,
    window: timeWindow.value,
    errorCode: errorCode.value,
    attemptPage: attemptPage.value,
    deadLetterPage: deadLetterPage.value,
  });
  function applyRouteScope() {
    const next = routeScope();
    const changed =
      org.value !== next.organizationId ||
      workspace.value !== next.workspaceId ||
      provider.value !== next.providerId ||
      timeWindow.value !== next.window ||
      errorCode.value !== next.errorCode ||
      attemptPage.value !== next.attemptPage ||
      deadLetterPage.value !== next.deadLetterPage;
    if (!changed) return false;
    org.value = next.organizationId;
    workspace.value = next.workspaceId;
    provider.value = next.providerId;
    timeWindow.value = next.window;
    errorCode.value = next.errorCode;
    attemptPage.value = next.attemptPage;
    deadLetterPage.value = next.deadLetterPage;
    return true;
  }
  async function syncUrl(scope = readScope()) {
    const query = {};
    if (scope.organizationId) query.organization_id = scope.organizationId;
    if (scope.workspaceId) query.workspace_id = scope.workspaceId;
    if (scope.providerId) query.provider_id = scope.providerId;
    if (scope.window !== "24h") query.window = scope.window;
    if (scope.errorCode) query.error_code = scope.errorCode;
    if (scope.attemptPage > 1) query.attempt_page = String(scope.attemptPage);
    if (scope.deadLetterPage > 1) query.dead_letter_page = String(scope.deadLetterPage);
    if (route.query.root_cause === "1") query.root_cause = "1";
    await router.replace({ query });
  }
  async function load(options = {}) {
    if (batchBusy.value) {
      resumeRead = true;
      return;
    }
    const sequence = ++readSequence;
    activeController?.abort("superseded");
    activeController = null;
    const validation = scopeValidation();
    if (validation) {
      refreshNotice.value = validation;
      if (!data.value) {
        hint.value = validation;
        state.value = "blocked";
      }
      refreshing.value = false;
      return;
    }
    const scope = readScope();
    const hadData = Boolean(data.value);
    refreshing.value = true;
    refreshNotice.value = "";
    hint.value = "";
    if (!hadData) state.value = "loading";
    const q = new URLSearchParams();
    if (scope.organizationId) q.set("organization_id", scope.organizationId);
    if (scope.workspaceId) q.set("workspace_id", scope.workspaceId);
    if (scope.providerId) q.set("provider_id", scope.providerId);
    q.set("window", scope.window);
    if (scope.errorCode) q.set("error_code", scope.errorCode);
    q.set("attempt_page", String(scope.attemptPage));
    q.set("dead_letter_page", String(scope.deadLetterPage));
    activeController = new AbortController();
    const controller = activeController;
    const timer = window.setTimeout(() => controller.abort("request_timeout"), 15_000);
    try {
      if (options.updateUrl !== false) await syncUrl(scope);
      if (sequence !== readSequence || !pageActive) return;
      const response = await request(`/platform/collection/console?${q}`, {
        signal: controller.signal,
      });
      if (sequence !== readSequence || !pageActive) return;
      requestId.value = response.request_id;
      data.value = response.data;
      const openIds = new Set(
        response.data.dead_letters.filter((item) => item.status === "open").map((item) => item.id),
      );
      selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => openIds.has(id));
      state.value =
        response.data.sources.length +
        response.data.task_states.length +
        response.data.dead_letters.length +
        response.data.quality.length +
        response.data.attempts.length
          ? "ready"
          : "empty";
    } catch (error) {
      if (sequence !== readSequence || !pageActive) return;
      const failure = error instanceof ApiClientError ? error : null;
      const timedOut = controller.signal.aborted && controller.signal.reason === "request_timeout";
      if (controller.signal.aborted && !timedOut) return;
      const message = timedOut
        ? "读取超过 15 秒，已安全取消；当前已验证数据仍保留。"
        : (failure?.actionHint ?? "网络或服务异常，当前已验证数据仍保留。");
      if (hadData) {
        refreshNotice.value = message.includes("当前已验证数据仍保留")
          ? message
          : `${message} 当前已验证数据仍保留。`;
        state.value = "ready";
      } else {
        requestId.value = failure?.requestId ?? "";
        hint.value = message;
        state.value = failure?.kind ?? "blocked";
      }
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      if (sequence === readSequence) refreshing.value = false;
    }
  }
  async function focusRootCause() {
    await nextTick();
    rootCauseSection.value?.scrollIntoView({ block: "start" });
    rootCauseSection.value?.focus();
  }
  function suspendPage(reason) {
    const interrupted = Boolean(activeController);
    pageActive = false;
    readSequence += 1;
    activeController?.abort(reason);
    activeController = null;
    refreshing.value = false;
    resumeRead ||= reason === "deactivated" && interrupted;
    if (!batchBusy.value) cancelBatchPreview();
  }
  onMounted(async () => {
    await load();
    if (route.query.root_cause === "1") await focusRootCause();
  });
  watch(
    () => [
      route.path,
      route.query.organization_id,
      route.query.workspace_id,
      route.query.provider_id,
      route.query.window,
      route.query.error_code,
      route.query.attempt_page,
      route.query.dead_letter_page,
      route.query.root_cause,
    ],
    async ([path, , , , , , , , rootCause], previous) => {
      if (path !== "/platform-admin/collection/overview" || !pageActive) return;
      if (applyRouteScope()) await load({ updateUrl: false });
      if (rootCause === "1" && previous?.[8] !== "1") await focusRootCause();
    },
  );
  onBeforeUnmount(() => suspendPage("unmounted"));
  onDeactivated(() => suspendPage("deactivated"));
  onActivated(() => {
    pageActive = true;
    if (route.path !== "/platform-admin/collection/overview") return;
    const routeChanged = applyRouteScope();
    if (detachedBatchSettlement) {
      const settlement = detachedBatchSettlement;
      detachedBatchSettlement = null;
      resumeRead = false;
      void applyBatchSettlement(settlement);
      return;
    }
    if (routeChanged || resumeRead) {
      resumeRead = false;
      void load({ updateUrl: false });
    }
  });
  const when = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未检查"),
    linkLabels = {
      provider_registry: "来源配置",
      adapter_health: "适配器健康",
      source_catalog: "来源目录",
      task_monitor: "采集任务",
      browser_runtime: "浏览器运行",
      data_quality: "数据质量",
    },
    healthLabel = (value) =>
      ({
        ready: "正常",
        healthy: "正常",
        warning: "需要关注",
        degraded: "性能下降",
        blocked: "采集受阻",
        critical: "严重异常",
        unknown: "尚未检查",
      })[value] ?? "状态待确认",
    errorLabel = (value) =>
      value
        ? ({
            network_error: "网络异常",
            dns_error: "域名解析失败",
            timeout: "请求超时",
            rate_limited: "来源限速",
            login_required: "需要登录",
            session_expired: "登录已失效",
            blocked_login: "登录已失效",
            captcha: "验证码受阻",
            blocked_captcha: "验证码受阻",
            robots_disallowed: "站点规则阻止",
            parser_error: "页面解析失败",
            parser_failed: "页面解析失败",
            parse_failed: "页面解析失败",
            source_changed: "页面结构已变化",
            validation_failed: "数据校验失败",
            permission_denied: "权限受阻",
          }[value] ?? "其他采集错误")
        : "无错误",
    errorCategory = (value) =>
      ({
        network_error: "网络",
        dns_error: "网络",
        timeout: "网络",
        login_required: "登录",
        session_expired: "登录",
        blocked_login: "登录",
        captcha: "验证码",
        blocked_captcha: "验证码",
        parser_error: "解析",
        parser_failed: "解析",
        parse_failed: "解析",
        source_changed: "解析",
      })[value] ?? "其他",
    sourceRowKey = (item) => item.id,
    sourceDetailTitle = (item) => `${item.name}详情`,
    attemptRowKey = (item) => item.id,
    attemptDetailTitle = (item) => `第 ${item.attempt_number} 次尝试详情`,
    drillRootCause = async (value) => {
      if (refreshing.value || batchBusy.value) return;
      errorCode.value = errorCode.value === value ? "" : value;
      attemptPage.value = 1;
      deadLetterPage.value = 1;
      await load();
    };
  function applyScope() {
    if (batchBusy.value) return;
    attemptPage.value = 1;
    deadLetterPage.value = 1;
    void load();
  }
  function resetScope() {
    if (batchBusy.value) return;
    org.value = "";
    workspace.value = "";
    provider.value = "";
    timeWindow.value = "24h";
    errorCode.value = "";
    attemptPage.value = 1;
    deadLetterPage.value = 1;
    void load();
  }
  function goToPage(kind, page) {
    if (refreshing.value || batchBusy.value || page < 1) return;
    if (kind === "attempts") attemptPage.value = page;
    else deadLetterPage.value = page;
    void load();
  }
  function rangeLabel(meta) {
    if (!meta?.total) return "0 条";
    const start = (meta.page - 1) * meta.page_size + 1;
    const end = Math.min(meta.page * meta.page_size, meta.total);
    return `${start}–${end} / ${meta.total} 条`;
  }
  function toggleDeadLetter(id, event) {
    const target = event.target;
    const checked = target.checked;
    if (!checked) {
      selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((value) => value !== id);
      return;
    }
    if (selectedDeadLetterIds.value.length >= 20) {
      target.checked = false;
      batchNotice.value = "每批最多选择 20 条开放死信。";
      return;
    }
    selectedDeadLetterIds.value = [...selectedDeadLetterIds.value, id];
  }
  function clearBatchReasonIssue() {
    batchReasonIssue.value = "";
    if (batchNotice.value === batchReasonValidationMessage) batchNotice.value = "";
  }
  function previewBatchReplay() {
    batchNotice.value = "";
    batchReasonIssue.value = "";
    batchFailures.value = [];
    if (batchUnknown.value) {
      batchNotice.value = "已有结果未知，请先到对应任务核查；当前页面不会自动重发。";
      return;
    }
    if (!selectedDeadLetters.value.length) {
      batchNotice.value = "请先选择要重放的开放死信。";
      return;
    }
    if (batchReason.value.trim().length < 2 || batchReason.value.length > 500) {
      batchNotice.value = batchReasonValidationMessage;
      batchReasonIssue.value = batchReasonValidationMessage;
      void nextTick(() => batchReasonField.value?.focus());
      return;
    }
    batchSnapshot.value = {
      id: crypto.randomUUID(),
      items: selectedDeadLetters.value.map((item) => ({
        id: item.id,
        task_id: item.task_id,
        organization_id: item.organization_id,
        workspace_id: item.workspace_id,
        error_code: item.error_code,
      })),
      reason: batchReason.value.trim(),
      impact: batchImpact.value,
    };
    batchPreview.value = true;
  }
  function cancelBatchPreview() {
    if (batchBusy.value) return;
    batchPreview.value = false;
    batchSnapshot.value = null;
  }
  const unknownWriteStatuses = new Set([0, 408, 425, 429, 502, 503, 504]);
  function batchFailure(error, item) {
    const failure = error instanceof ApiClientError ? error : null;
    const unknown = !failure || unknownWriteStatuses.has(failure.status);
    return {
      deadLetterId: item.id,
      taskId: item.task_id,
      unknown,
      reason: unknown
        ? "结果暂时无法确认。请先进入对应任务核对，不要立即重复提交。"
        : failure.actionHint || "重放请求未完成，请查看任务详情与服务端日志。",
    };
  }
  async function applyBatchSettlement(settlement) {
    if (!pageActive) {
      detachedBatchSettlement = settlement;
      return;
    }
    const succeeded = new Set(settlement.succeededIds);
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => !succeeded.has(id));
    batchFailures.value = settlement.failures;
    const unknownCount = settlement.failures.filter((failure) => failure.unknown).length;
    const explicitFailureCount = settlement.failures.length - unknownCount;
    batchUnknown.value ||= unknownCount > 0;
    batchNotice.value = `本批请求已结束：创建新任务 ${succeeded.size} 条，明确失败 ${explicitFailureCount} 条，结果未知 ${unknownCount} 条。不是采集执行成功。`;
    if (settlement.requestId) requestId.value = settlement.requestId;
    resumeRead = false;
    await load({ updateUrl: false });
  }
  async function confirmBatchReplay() {
    const snapshot = batchSnapshot.value;
    if (batchBusy.value || !snapshot) return;
    batchBusy.value = true;
    batchPreview.value = false;
    batchNotice.value = "正在逐条创建新任务；离开页面不等于取消已经提交的请求。";
    batchFailures.value = [];
    const settlement = {
      succeededIds: [],
      failures: [],
      requestId: "",
    };
    for (const item of snapshot.items) {
      try {
        const response = await request(`/platform/collection/tasks/${item.task_id}/replay`, {
          method: "POST",
          idempotencyKey: `dead-batch:${snapshot.id}:${item.task_id}`,
          body: { reason: snapshot.reason },
        });
        settlement.succeededIds.push(item.id);
        settlement.requestId = response.request_id;
      } catch (error) {
        const failure = batchFailure(error, item);
        settlement.failures.push(failure);
        if (error instanceof ApiClientError) settlement.requestId = error.requestId;
      }
    }
    batchBusy.value = false;
    batchSnapshot.value = null;
    await applyBatchSettlement(settlement);
  }

  return {
    state,
    data,
    org,
    workspace,
    provider,
    timeWindow,
    errorCode,
    attemptPage,
    deadLetterPage,
    requestId,
    hint,
    refreshNotice,
    refreshing,
    selectedDeadLetterIds,
    batchReason,
    batchPreview,
    batchSnapshot,
    batchBusy,
    batchUnknown,
    batchNotice,
    batchFailures,
    sourcesExpanded,
    selectedDeadLetters,
    batchImpact,
    scopeFilterCount,
    orderedSources,
    visibleSources,
    hiddenSourceCount,
    scopeValidation,
    syncUrl,
    load,
    when,
    linkLabels,
    healthLabel,
    errorLabel,
    errorCategory,
    drillRootCause,
    applyScope,
    resetScope,
    goToPage,
    rangeLabel,
    toggleDeadLetter,
    previewBatchReplay,
    confirmBatchReplay,
    statusLabel,
  };
};
