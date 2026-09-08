// Actual Vue script and status labels; inert bridge, not a Vue mount.
window.OVERVIEW_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
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
    queryText = (name) => {
      const value = route.query[name];
      return typeof value === "string" ? value : "";
    },
    queryPage = (name) => {
      const value = queryText(name);
      return /^\d{1,6}$/.test(value) && Number(value) > 0 ? Number(value) : 1;
    },
    initialWindow = ["24h", "7d", "30d", "all"].includes(queryText("window"))
      ? queryText("window")
      : "24h";
  const state = ref("loading"),
    data = ref(null),
    org = ref(queryText("organization_id")),
    workspace = ref(queryText("workspace_id")),
    provider = ref(queryText("provider_id")),
    timeWindow = ref(initialWindow),
    errorCode = ref(queryText("error_code")),
    attemptPage = ref(queryPage("attempt_page")),
    deadLetterPage = ref(queryPage("dead_letter_page")),
    requestId = ref(""),
    hint = ref(""),
    refreshNotice = ref(""),
    refreshing = ref(false),
    selectedDeadLetterIds = ref([]),
    batchReason = ref(""),
    batchPreview = ref(false),
    batchId = ref(""),
    batchBusy = ref(false),
    batchNotice = ref(""),
    batchFailures = ref([]),
    sourcesExpanded = ref(false),
    rootCauseSection = ref(null);
  let activeController = null;
  const sourceDisplayLimit = 8;
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
  async function syncUrl() {
    const query = {};
    if (org.value.trim()) query.organization_id = org.value.trim();
    if (workspace.value.trim()) query.workspace_id = workspace.value.trim();
    if (provider.value) query.provider_id = provider.value;
    if (timeWindow.value !== "24h") query.window = timeWindow.value;
    if (errorCode.value) query.error_code = errorCode.value;
    if (attemptPage.value > 1) query.attempt_page = String(attemptPage.value);
    if (deadLetterPage.value > 1) query.dead_letter_page = String(deadLetterPage.value);
    if (route.query.root_cause === "1") query.root_cause = "1";
    await router.replace({ query });
  }
  async function load(options = {}) {
    if (refreshing.value) return;
    const validation = scopeValidation();
    if (validation) {
      refreshNotice.value = validation;
      return;
    }
    const hadData = Boolean(data.value);
    refreshing.value = true;
    refreshNotice.value = "";
    hint.value = "";
    if (!hadData) state.value = "loading";
    const q = new URLSearchParams();
    if (org.value.trim()) q.set("organization_id", org.value.trim());
    if (workspace.value.trim()) q.set("workspace_id", workspace.value.trim());
    if (provider.value) q.set("provider_id", provider.value);
    q.set("window", timeWindow.value);
    if (errorCode.value) q.set("error_code", errorCode.value);
    q.set("attempt_page", String(attemptPage.value));
    q.set("dead_letter_page", String(deadLetterPage.value));
    activeController = new AbortController();
    const controller = activeController;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      if (options.updateUrl !== false) await syncUrl();
      const response = await request(`/platform/collection/console?${q}`, {
        signal: controller.signal,
      });
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
        response.data.quality.length
          ? "ready"
          : "empty";
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      const message = controller.signal.aborted
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
      refreshing.value = false;
    }
  }
  onMounted(async () => {
    await load();
    if (route.query.root_cause === "1") {
      await nextTick();
      rootCauseSection.value?.scrollIntoView({ block: "start" });
      rootCauseSection.value?.focus();
    }
  });
  onBeforeUnmount(() => activeController?.abort());
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
      if (refreshing.value) return;
      errorCode.value = errorCode.value === value ? "" : value;
      attemptPage.value = 1;
      deadLetterPage.value = 1;
      await load();
    };
  function applyScope() {
    attemptPage.value = 1;
    deadLetterPage.value = 1;
    void load();
  }
  function resetScope() {
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
    if (refreshing.value || page < 1) return;
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
  function previewBatchReplay() {
    batchNotice.value = "";
    batchFailures.value = [];
    if (!selectedDeadLetters.value.length) {
      batchNotice.value = "请先选择要重放的开放死信。";
      return;
    }
    if (batchReason.value.trim().length < 2 || batchReason.value.length > 500) {
      batchNotice.value = "重放原因需要 2–500 字符。";
      return;
    }
    batchId.value = crypto.randomUUID();
    batchPreview.value = true;
  }
  async function confirmBatchReplay() {
    if (batchBusy.value) return;
    batchBusy.value = true;
    batchPreview.value = false;
    const batchItems = [...selectedDeadLetters.value];
    const succeeded = new Set();
    batchFailures.value = [];
    for (const item of batchItems) {
      try {
        await request(`/platform/collection/tasks/${item.task_id}/replay`, {
          method: "POST",
          idempotencyKey: `dead-batch:${batchId.value}:${item.task_id}`,
          body: { reason: batchReason.value.trim() },
        });
        succeeded.add(item.id);
      } catch (error) {
        const failure = error instanceof ApiClientError ? error : null;
        batchFailures.value.push({
          task: item.task_id.slice(0, 8),
          reason: failure?.actionHint ?? "重放请求失败，请查看任务详情与服务端日志。",
        });
      }
    }
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => !succeeded.has(id));
    batchNotice.value = `批量重放完成：成功 ${succeeded.size} 条，失败 ${batchFailures.value.length} 条；每条均保留独立任务历史、幂等记录与审计。`;
    batchBusy.value = false;
    await load({ updateUrl: false });
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
    batchId,
    batchBusy,
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
