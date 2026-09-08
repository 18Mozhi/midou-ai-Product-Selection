window.COMMERCIAL_SOURCE = (b) => {
  const {
    computed,
    ref,
    onBeforeUnmount,
    onMounted,
    defineProps,
    createApiClient,
    ApiClientError,
    useModalDialog,
    location,
    history,
    crypto,
    window,
    URLSearchParams,
    AbortController,
    DOMException,
  } = b;
  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
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
  const state = ref("loading"),
    data = ref(emptyData()),
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
  const noticeKind = ref("info");
  const requestId = ref("");
  const pending = ref(null);
  const editingPlan = ref(null);
  const creatingPlan = ref(false);
  let loadController = null,
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
    expected_version: null,
    reason: "分配或调整配额方案",
  });
  const adjustment = ref({
    quota_key: "collection_tasks",
    delta_value: 0,
    effective_at: "",
    expires_at: "",
    reason: "人工配额调整",
  });
  const quotaNames = {
    collection_tasks: "采集任务",
    open_api_requests: "外部接口请求",
    report_exports: "报表导出",
  };
  const quotaKeys = Object.keys(quotaNames);
  const selectablePlans = computed(() => {
    const active = data.value.plans.filter((item) => item.status === "active");
    if (data.value.assignment && !active.some((item) => item.id === data.value.assignment.plan_id))
      active.unshift({
        id: data.value.assignment.plan_id,
        name: data.value.assignment.plan_name,
        code: data.value.assignment.plan_code,
        status: "active",
        quotas: data.value.assignment.quotas,
      });
    return active;
  });
  const localDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  };
  const displayDate = (value) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
  const statusText = (value) =>
    ({
      draft: "草稿",
      active: "启用",
      retired: "已退役",
      suspended: "已暂停",
      ended: "已结束",
      unassigned: "未分配",
      revoked: "已撤销",
    })[value] ?? value;
  function normalizedData(next) {
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
  function setNotice(message, kind = "info") {
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
  function syncLocation(mode = "replace") {
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
  async function call(path, method = "GET", body, options = {}) {
    try {
      const response = await request(path, {
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
  async function load(options = {}) {
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
  function beginEditPlan(item) {
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
  function prepare(title, path, method, body, success = "变更已写入审计。") {
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
  function buildImpact(path, body) {
    const rows = [];
    if (path.startsWith("/platform/commercial/plans/")) {
      const planId = path.split("/").at(-1),
        current = data.value.plans.find((item) => item.id === planId);
      if (current)
        for (const key of quotaKeys) {
          const before = Number(current.quotas[key] ?? 0),
            after = Number(body.quotas?.[key] ?? before);
          if (before !== after)
            rows.push({ label: quotaNames[key], before: String(before), after: String(after) });
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
      const target = data.value.plans.find((item) => item.id === body.plan_id),
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
          label: quotaNames[key],
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
        item = data.value.adjustments.find((entry) => entry.id === adjustmentId),
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
  function changePage(nextPage) {
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
  function changeAdjustmentPage(nextPage) {
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

  return {
    data,
    state,
    loadedOnce,
    refreshing,
    mutating,
    organizationId,
    organizationInput,
    assignment,
    adjustment,
    plan,
    editingPlan,
    creatingPlan,
    pending,
    query,
    status,
    page,
    adjustmentPage,
    notice,
    noticeKind,
    requestId,
    selectablePlans,
    quotaNames,
    localDate,
    buildImpact,
    load,
    createPlan,
    beginEditPlan,
    savePlan,
    assignOrRenew,
    submitAdjustment,
    prepare,
    confirm,
    readOrganization,
    clearOrganization,
    applyFilters,
    changePage,
    changeAdjustmentPage,
    handlePopState,
  };
};
