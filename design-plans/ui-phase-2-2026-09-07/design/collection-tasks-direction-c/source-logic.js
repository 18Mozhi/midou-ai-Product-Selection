// Actual Vue script in an inert bridge; no Vue mount or HTTP.
window.COLLECTION_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    watch,
    useRoute,
    useRouter,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    document,
    HTMLElement,
    AbortController,
    URLSearchParams,
  } = bridge;
  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
  const route = useRoute(),
    router = useRouter(),
    pageSize = 50,
    requestTimeoutMs = 15_000,
    taskStatuses = [
      "draft",
      "scheduled",
      "queued",
      "leased",
      "running",
      "parsing",
      "validating",
      "persisted",
      "retry_scheduled",
      "rate_limited",
      "blocked_login",
      "blocked_captcha",
      "blocked_robots",
      "succeeded",
      "succeeded_empty",
      "completed_with_warnings",
      "failed_terminal",
      "dead_letter",
      "manually_replayed",
    ];
  const state = ref("loading"),
    tasks = ref([]),
    detail = ref(null),
    requestId = ref(""),
    status = ref("all"),
    query = ref(""),
    page = ref(1),
    total = ref(0),
    listLoading = ref(false),
    listIssue = ref(""),
    detailLoading = ref(false),
    detailIssue = ref(""),
    replayIssue = ref(""),
    confirming = ref(false),
    replayReason = ref(""),
    notice = ref(""),
    saving = ref(false),
    detailPanel = ref(null),
    detailCloseButton = ref(null);
  let listController = null,
    detailController = null,
    detailSequence = 0,
    detailOpenedFromList = false,
    returnFocus = null;
  const filtered = computed(() =>
    tasks.value.filter(
      (item) =>
        !query.value ||
        [item.id, item.organization_id, item.workspace_id, item.last_error_code].some((value) =>
          value?.toLowerCase().includes(query.value.toLowerCase()),
        ),
    ),
  );
  const metrics = computed(() => ({
    active: tasks.value.filter((item) =>
      [
        "scheduled",
        "queued",
        "leased",
        "running",
        "parsing",
        "validating",
        "persisted",
        "retry_scheduled",
        "rate_limited",
      ].includes(item.status),
    ).length,
    warnings: tasks.value.filter((item) => item.status === "completed_with_warnings").length,
    blocked: tasks.value.filter(
      (item) =>
        item.status.startsWith("blocked_") ||
        item.status === "dead_letter" ||
        item.status === "failed_terminal",
    ).length,
    evidence: tasks.value.reduce((sum, item) => sum + item.available_result_count, 0),
  }));
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize))),
    pageStart = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0)),
    pageEnd = computed(() => Math.min(page.value * pageSize, total.value)),
    detailOpen = computed(
      () => detailLoading.value || Boolean(detail.value) || Boolean(detailIssue.value),
    );
  const failure = (code) =>
    code === 401
      ? "expired"
      : code === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(code)
          ? "blocked"
          : "error";
  const time = (value) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const cell = (value) =>
    value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const label = (value) =>
    value
      ? ({
          scheduled: "待调度",
          queued: "已排队",
          leased: "已租约",
          running: "执行中",
          parsing: "解析中",
          validating: "校验中",
          persisted: "已持久化",
          retry_scheduled: "等待重试",
          blocked_login: "登录受阻",
          blocked_captcha: "验证码受阻",
          blocked_robots: "网站规则限制",
          rate_limited: "限流等待",
          succeeded: "成功",
          succeeded_empty: "无可用结果",
          completed_with_warnings: "部分完成",
          failed_terminal: "终止失败",
          dead_letter: "死信",
          manually_replayed: "已人工重放",
          automatically_replayed: "凭证续期后已自动重放",
          complete: "完整",
          partial: "部分",
          insufficient: "不足",
        }[value] ?? value)
      : "待计算";
  const subqueryRetryText = (task, retryable) => {
    if (!retryable) return "该错误不自动重试";
    if (!["retry_scheduled", "rate_limited"].includes(task.status)) return "尚未安排下次重试";
    return `下次重试 ${time(task.available_at)}（任务级调度）`;
  };
  const resultKindText = (value) =>
    value === "empty_success"
      ? "空成功：来源响应有效，但没有可解析条目"
      : value === "no_new_content"
        ? "无新内容：本次结果均已存在，未重复写入"
        : value === "parse_failed"
          ? "解析失败：来源载荷未通过当前解析合同"
          : "";
  const robotsDecisionText = (value) =>
    value.matched_rule
      ? `${value.allowed ? "允许" : "禁止"} · ${value.matched_rule.directive === "allow" ? "Allow" : "Disallow"} ${value.matched_rule.pattern_preview}${value.matched_rule.truncated ? "…" : ""}`
      : value.decision_basis === "missing_robots"
        ? "允许 · 来源未提供 robots.txt"
        : value.decision_basis === "http_status"
          ? `禁止 · robots.txt 返回 HTTP ${value.robots_http_status}`
          : "允许 · 没有命中限制规则";
  const subqueryDurationText = (startedAt, finishedAt) => {
    if (!startedAt) return "尚未开始";
    if (!finishedAt) return `执行中 · ${time(startedAt)} 开始`;
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (!Number.isFinite(durationMs) || durationMs < 0) return "耗时不可用";
    const seconds = Math.round(durationMs / 1000);
    if (seconds < 60) return `耗时 ${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `耗时 ${minutes} 分 ${remainingSeconds} 秒`;
  };
  const recoveryAction = computed(() => {
    const task = detail.value?.task;
    if (!task) return null;
    if (task.status === "dead_letter")
      return {
        kind: "replay",
        label: "填写原因并重放",
        description: "确认来源恢复后创建新任务；原任务和全部尝试记录保留。",
      };
    if (["blocked_login", "blocked_captcha"].includes(task.status))
      return {
        kind: "link",
        to: "/platform-admin/credentials",
        label: "检查网页登录",
        description: "更新或验证受控浏览器档案后，再回到任务查看恢复结果。",
      };
    if (task.status === "blocked_robots" || task.last_error_code === "source_changed")
      return {
        kind: "link",
        to: "/platform-admin/providers/sources",
        label: "检查来源设置",
        description: "核对来源规则、页面变化和当前启用状态。",
      };
    if (["failed_terminal", "completed_with_warnings"].includes(task.status))
      return {
        kind: "link",
        to: "/platform-admin/collection/overview",
        label: "查看根因与来源健康",
        description: "按真实错误根因继续下钻，不覆盖当前失败记录。",
      };
    return null;
  });
  const timeoutController = (kind) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort("request_timeout"), requestTimeoutMs);
    if (kind === "list") listController = controller;
    else detailController = controller;
    return { controller, stop: () => window.clearTimeout(timer) };
  };
  const syncListQuery = () => {
    const queryParams = { ...route.query };
    if (page.value > 1) queryParams.page = String(page.value);
    else delete queryParams.page;
    if (status.value !== "all") queryParams.status = status.value;
    else delete queryParams.status;
    void router.replace({ query: queryParams });
  };
  async function load(options = {}) {
    if (listLoading.value) return;
    listLoading.value = true;
    listIssue.value = "";
    if (!options.preserve || !tasks.value.length) state.value = "loading";
    const params = new URLSearchParams({
      page: String(page.value),
      page_size: String(pageSize),
    });
    if (status.value !== "all") params.set("status", status.value);
    listController?.abort("superseded");
    const timeout = timeoutController("list");
    try {
      const response = await request(`/platform/collection/tasks?${params}`, {
        signal: timeout.controller.signal,
      });
      requestId.value = response.request_id;
      tasks.value = response.data ?? [];
      total.value = response.meta?.total ?? tasks.value.length;
      if (!tasks.value.length && total.value > 0 && page.value > 1) {
        page.value = Math.min(page.value - 1, Math.ceil(total.value / pageSize));
        syncListQuery();
        listLoading.value = false;
        timeout.stop();
        await load();
        return;
      }
      state.value = tasks.value.length ? "ready" : "empty";
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? "";
      const message = timeout.controller.signal.aborted
        ? "任务列表读取超过 15 秒，已停止等待；当前页面数据未被覆盖。"
        : apiError?.actionHint || "任务列表暂不可用，请稍后重试。";
      if (tasks.value.length && options.preserve) {
        state.value = "ready";
        listIssue.value = message;
      } else state.value = apiError ? failure(apiError.status) : "blocked";
    } finally {
      timeout.stop();
      if (listController === timeout.controller) listController = null;
      listLoading.value = false;
    }
  }
  async function openTask(id, options = {}) {
    if (options.updateUrl) {
      const active = document.activeElement;
      returnFocus = active instanceof HTMLElement ? active : null;
      detailOpenedFromList = true;
      await router.push({ query: { ...route.query, task: id } });
      return;
    }
    const sequence = ++detailSequence;
    detailController?.abort("superseded");
    detail.value = null;
    detailIssue.value = "";
    detailLoading.value = true;
    const timeout = timeoutController("detail");
    try {
      const response = await request(`/platform/collection/tasks/${id}`, {
        signal: timeout.controller.signal,
      });
      if (sequence !== detailSequence) return;
      requestId.value = response.request_id;
      detail.value = response.data;
    } catch (error) {
      if (sequence !== detailSequence) return;
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      detailIssue.value = timeout.controller.signal.aborted
        ? "任务详情读取超过 15 秒，已停止等待。"
        : apiError?.actionHint || "任务详情依赖暂不可用。";
    } finally {
      timeout.stop();
      if (detailController === timeout.controller) detailController = null;
      if (sequence === detailSequence) {
        detailLoading.value = false;
        await nextTick();
        detailCloseButton.value?.focus();
      }
    }
  }
  async function replay() {
    if (!detail.value || saving.value) return;
    saving.value = true;
    confirming.value = false;
    replayIssue.value = "";
    try {
      const response = await request(`/platform/collection/tasks/${detail.value.task.id}/replay`, {
        method: "POST",
        body: { reason: replayReason.value.trim() },
      });
      requestId.value = response.request_id;
      const successNotice = `已创建重放任务 ${response.data.task.id.slice(0, 8)}…，原任务与全部尝试记录已保留。`;
      detail.value = response.data;
      replayReason.value = "";
      await router.replace({ query: { ...route.query, task: response.data.task.id } });
      await load({ preserve: true });
      notice.value = successNotice;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      replayIssue.value = apiError?.actionHint ?? "依赖不可用，未执行重放。";
    } finally {
      saving.value = false;
    }
  }
  function closeDetail() {
    detailController?.abort("closed");
    detailSequence += 1;
    detail.value = null;
    detailIssue.value = "";
    detailLoading.value = false;
    replayReason.value = "";
    replayIssue.value = "";
    if (detailOpenedFromList && route.query.task) {
      detailOpenedFromList = false;
      router.back();
    } else {
      const queryParams = { ...route.query };
      delete queryParams.task;
      void router.replace({ query: queryParams });
    }
    void nextTick(() => returnFocus?.focus());
  }
  function detailKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDetail();
      return;
    }
    if (event.key !== "Tab" || !detailPanel.value) return;
    const focusable = [
      ...detailPanel.value.querySelectorAll(
        "a[href],button:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex='-1'])",
      ),
    ];
    const first = focusable[0],
      last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  async function changeStatus() {
    page.value = 1;
    query.value = "";
    syncListQuery();
    await load();
  }
  async function changePage(nextPage) {
    if (listLoading.value || nextPage < 1 || nextPage > totalPages.value) return;
    page.value = nextPage;
    query.value = "";
    syncListQuery();
    await load();
    document.querySelector(".collection-task-table-card")?.scrollIntoView({ behavior: "smooth" });
  }
  watch(
    () => route.query.task,
    async (value) => {
      const taskId = typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : "";
      if (!taskId) {
        detailController?.abort("closed");
        detailSequence += 1;
        detail.value = null;
        detailIssue.value = "";
        detailLoading.value = false;
        await nextTick();
        returnFocus?.focus();
        return;
      }
      await openTask(taskId);
    },
  );
  watch(detailOpen, async (open) => {
    document.body.classList.toggle("collection-detail-open", open);
    if (!open) return;
    await nextTick();
    detailCloseButton.value?.focus();
  });
  onMounted(async () => {
    const initialStatus = typeof route.query.status === "string" ? route.query.status : "";
    status.value = taskStatuses.includes(initialStatus) ? initialStatus : "all";
    const initialPage = Number(route.query.page);
    page.value = Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
    await load();
    const taskId = typeof route.query.task === "string" ? route.query.task : "";
    if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) await openTask(taskId);
  });
  onBeforeUnmount(() => {
    listController?.abort("unmounted");
    detailController?.abort("unmounted");
    document.body.classList.remove("collection-detail-open");
  });

  return {
    state,
    tasks,
    detail,
    requestId,
    status,
    query,
    page,
    total,
    listLoading,
    listIssue,
    detailLoading,
    detailIssue,
    replayIssue,
    confirming,
    replayReason,
    notice,
    saving,
    filtered,
    metrics,
    totalPages,
    pageStart,
    pageEnd,
    detailOpen,
    taskStatuses,
    label,
    time,
    cell,
    subqueryRetryText,
    resultKindText,
    robotsDecisionText,
    subqueryDurationText,
    recoveryAction,
    load,
    openTask,
    replay,
    closeDetail,
    changeStatus,
    changePage,
    syncListQuery,
  };
};
