window.OPEN_SOURCE = (b) => {
  const {
    computed,
    ref,
    reactive,
    nextTick,
    onMounted,
    onBeforeUnmount,
    defineProps,
    createApiClient,
    ApiClientError,
    location,
    history,
    innerWidth,
    document,
    navigator,
    window,
    URLSearchParams,
    AbortController,
  } = b;
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    params = new URLSearchParams(location.search),
    views = ["clients", "webhooks", "deliveries"],
    requestedView = params.get("view"),
    activeView = ref(requestedView && views.includes(requestedView) ? requestedView : "clients"),
    organizationId = ref(params.get("organization_id") ?? ""),
    state = ref("loading"),
    refreshing = ref(false),
    actionBusy = ref(false),
    hasSnapshot = ref(false),
    notice = ref(""),
    requestId = ref(""),
    secret = ref(null),
    pending = ref(null),
    fieldErrors = ref({}),
    form = reactive({
      name: "",
      target_url: "",
      reason: "开放平台配置变更",
      quota_per_minute: 60,
      events: ["scoutops.test"],
    }),
    filters = reactive({
      clients: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
      webhooks: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
      deliveries: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
    }),
    emptyMeta = () => ({ page: 1, page_size: 20, total: 0, total_pages: 1 }),
    data = ref({
      clients: [],
      webhooks: [],
      deliveries: [],
      summary: {
        clients: { total: 0, active: 0, expired: 0 },
        webhooks: { total: 0, active: 0 },
        deliveries: { total: 0, dead_letter: 0, retry_scheduled: 0 },
      },
      pagination: { clients: emptyMeta(), webhooks: emptyMeta(), deliveries: emptyMeta() },
      observed_at: null,
    });
  for (const view of views) {
    if (view !== activeView.value) continue;
    filters[view].query = params.get("query") ?? "";
    filters[view].status = params.get("status") ?? "all";
    filters[view].sort = params.get("sort") ?? "updated_desc";
    filters[view].page = Math.max(1, Number(params.get("page")) || 1);
    filters[view].pageSize = [10, 20, 50].includes(Number(params.get("page_size")))
      ? Number(params.get("page_size"))
      : 20;
  }
  const viewMeta = {
      clients: {
        title: "接口访问账号",
        description: "独立密钥、权限范围、配额和有效期",
        search: "搜索账号名称或公开前缀",
      },
      webhooks: {
        title: "事件回调地址",
        description: "签名校验、启停控制和真实投递测试",
        search: "搜索回调名称或安全网址",
      },
      deliveries: {
        title: "投递记录",
        description: "响应结果、重试进度和失败原因",
        search: "搜索端点、事件或完整投递 ID",
      },
    },
    currentFilter = computed(() => filters[activeView.value]),
    currentRows = computed(() => data.value[activeView.value] ?? []),
    currentPagination = computed(() => data.value.pagination?.[activeView.value] ?? emptyMeta()),
    currentSummary = computed(() => data.value.summary?.[activeView.value] ?? {}),
    currentTitle = computed(() => viewMeta[activeView.value].title),
    currentDescription = computed(() => viewMeta[activeView.value].description),
    currentSearch = computed(() => viewMeta[activeView.value].search),
    statusOptions = computed(() =>
      activeView.value === "clients"
        ? [
            ["all", "全部状态"],
            ["active", "可用"],
            ["expired", "已过期"],
            ["revoked", "已撤销"],
            ["rotated", "已轮换"],
          ]
        : activeView.value === "webhooks"
          ? [
              ["all", "全部状态"],
              ["active", "启用"],
              ["disabled", "停用"],
            ]
          : [
              ["all", "全部状态"],
              ["queued", "等待投递"],
              ["leased", "正在投递"],
              ["retry_scheduled", "等待重试"],
              ["succeeded", "成功"],
              ["dead_letter", "多次失败"],
            ],
    ),
    sortOptions = computed(() =>
      activeView.value === "deliveries"
        ? [
            ["updated_desc", "最近更新"],
            ["updated_asc", "最早更新"],
            ["attempts_desc", "尝试次数最多"],
          ]
        : [
            ["updated_desc", "最近更新"],
            ["updated_asc", "最早更新"],
            ["name_asc", "名称升序"],
            ["name_desc", "名称降序"],
          ],
    );
  let loadController = null;
  function syncUrl() {
    const query = new URLSearchParams(),
      current = currentFilter.value;
    query.set("view", activeView.value);
    if (organizationId.value.trim()) query.set("organization_id", organizationId.value.trim());
    if (current.query) query.set("query", current.query);
    if (current.status !== "all") query.set("status", current.status);
    if (current.sort !== "updated_desc") query.set("sort", current.sort);
    if (current.page !== 1) query.set("page", String(current.page));
    if (current.pageSize !== 20) query.set("page_size", String(current.pageSize));
    history.replaceState(history.state, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
  }
  async function revealActiveSummary() {
    await nextTick();
    if (innerWidth > 760) return;
    const navigation = document.querySelector(".open-summary"),
      active = navigation?.querySelector(`button[data-view="${activeView.value}"]`);
    if (navigation && active) navigation.scrollLeft = Math.max(0, active.offsetLeft - 18);
  }
  function apiQuery() {
    const query = new URLSearchParams();
    if (organizationId.value.trim()) query.set("organization_id", organizationId.value.trim());
    for (const view of views) {
      const singular = view === "clients" ? "client" : view === "webhooks" ? "webhook" : "delivery",
        filter = filters[view];
      query.set(`${singular}_page`, String(filter.page));
      query.set(`${singular}_page_size`, String(filter.pageSize));
      if (filter.query) query.set(`${singular}_query`, filter.query);
      if (filter.status !== "all") query.set(`${singular}_status`, filter.status);
      if (filter.sort !== "updated_desc") query.set(`${singular}_sort`, filter.sort);
    }
    return query;
  }
  async function load() {
    if (refreshing.value) return;
    loadController?.abort();
    loadController = new AbortController();
    const timeout = window.setTimeout(() => loadController?.abort("timeout"), 15000);
    refreshing.value = true;
    notice.value = "";
    if (!hasSnapshot.value) state.value = "loading";
    syncUrl();
    try {
      const response = await request(`/platform/open?${apiQuery()}`, {
        signal: loadController.signal,
      });
      requestId.value = response.request_id;
      data.value = response.data;
      for (const view of views)
        filters[view].page = response.data.pagination?.[view]?.page ?? filters[view].page;
      hasSnapshot.value = true;
      state.value = currentRows.value.length ? "ready" : "empty";
      await revealActiveSummary();
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? "";
      notice.value = loadController.signal.aborted
        ? "读取超过 15 秒，已安全停止；仍保留上次成功结果。"
        : (failure?.actionHint ?? "读取失败，请检查网络后重试。");
      if (!hasSnapshot.value)
        state.value =
          failure?.status === 401
            ? "expired"
            : failure?.status === 403
              ? "forbidden"
              : failure?.status === 429
                ? "rate_limited"
                : (failure?.status ?? 0) >= 500 || !failure
                  ? "blocked"
                  : "error";
    } finally {
      window.clearTimeout(timeout);
      refreshing.value = false;
    }
  }
  function switchView(view) {
    activeView.value = view;
    notice.value = "";
    syncUrl();
    state.value = currentRows.value.length ? "ready" : "empty";
    void revealActiveSummary();
  }
  function applyFilters() {
    currentFilter.value.page = 1;
    void load();
  }
  function resetFilters() {
    Object.assign(currentFilter.value, {
      query: "",
      status: "all",
      sort: "updated_desc",
      page: 1,
      pageSize: 20,
    });
    void load();
  }
  function goToPage(page) {
    if (refreshing.value || page < 1 || page > currentPagination.value.total_pages) return;
    currentFilter.value.page = page;
    void load();
  }
  async function call(path, method, body) {
    if (actionBusy.value) return;
    actionBusy.value = true;
    notice.value = "";
    try {
      const response = await request(path, { method, body });
      const actionRequestId = response.request_id,
        successNotice =
          response.data?.status === "queued"
            ? "已进入真实投递队列，可在投递记录查看 Worker 结果。"
            : "操作成功并已写入审计。";
      requestId.value = actionRequestId;
      if (response.data?.secret)
        secret.value = {
          value: response.data.secret,
          kind: path.includes("webhooks") ? "Webhook 签名密钥" : "API Client 密钥",
        };
      await load();
      requestId.value = actionRequestId;
      notice.value = successNotice;
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? "";
      notice.value = failure?.actionHint ?? "操作失败，请稍后重试。";
    } finally {
      actionBusy.value = false;
    }
  }
  function prepare(action) {
    if (actionBusy.value) return;
    pending.value = action;
  }
  function confirm() {
    if (!pending.value) return;
    const action = pending.value;
    pending.value = null;
    void call(action.path, action.method, action.body);
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function validate(kind) {
    const errors = {};
    if (!uuidPattern.test(organizationId.value.trim()))
      errors.organization_id = "请输入有效的组织内部编号。";
    if (!form.name.trim() || form.name.trim().length > 120) errors.name = "名称需为 1–120 个字符。";
    if (!form.reason.trim() || form.reason.trim().length > 500)
      errors.reason = "变更原因需为 1–500 个字符。";
    if (
      kind === "client" &&
      (!Number.isInteger(form.quota_per_minute) ||
        form.quota_per_minute < 1 ||
        form.quota_per_minute > 1000)
    )
      errors.quota = "每分钟配额需为 1–1000 的整数。";
    if (kind === "webhook") {
      try {
        const url = new URL(form.target_url);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.hash ||
          (url.port && url.port !== "443")
        )
          throw new Error();
      } catch {
        errors.target_url = "仅允许无凭证、无片段的 HTTPS 443 地址。";
      }
      if (!form.events.length) errors.events = "至少选择一个真实事件。";
    }
    fieldErrors.value = errors;
    return !Object.keys(errors).length;
  }
  function createClient() {
    if (!validate("client")) return;
    prepare({
      title: "创建接口访问账号",
      path: "/platform/open/clients",
      method: "POST",
      body: {
        organization_id: organizationId.value.trim(),
        name: form.name.trim(),
        scopes: ["status:read"],
        quota_per_minute: form.quota_per_minute,
        reason: form.reason.trim(),
      },
      description: `令牌权限风险预览：组织 ${organizationId.value.trim()}，仅授权“读取系统状态”。`,
      impact: `每分钟最多 ${form.quota_per_minute} 次；不包含业务数据写入权限。密钥仅显示一次。`,
    });
  }
  function createWebhook() {
    if (!validate("webhook")) return;
    prepare({
      title: "创建事件回调地址",
      path: "/platform/open/webhooks",
      method: "POST",
      body: {
        organization_id: organizationId.value.trim(),
        name: form.name.trim(),
        target_url: form.target_url.trim(),
        events: [...form.events],
        reason: form.reason.trim(),
      },
      description: `将 ${form.events.map(eventText).join("、")} 投递到指定 HTTPS 地址。`,
      impact: "签名密钥仅显示一次；Worker 会在每次投递前检查 DNS 和私网地址。",
    });
  }
  function clientAction(row, action) {
    prepare({
      title: action === "rotate" ? "轮换接口访问密钥" : "撤销接口访问账号",
      path: `/platform/open/clients/${row.id}/actions`,
      method: "POST",
      body: { action, expected_version: row.version, reason: form.reason.trim() },
      description: `令牌权限风险预览：账号 ${row.name}，组织 ${row.organization_id}，${row.scopes.map(scopeText).join("、")}。`,
      impact:
        action === "rotate"
          ? `仅保留读取系统状态权限，不包含业务数据写入权限；每分钟 ${row.quota_per_minute} 次限额保持不变。旧密钥立即失效，新密钥仅显示一次。`
          : "该账号不包含业务数据写入权限；撤销后访问立即终止且不可恢复，需要重新创建账号才能再次接入。",
      destructive: action === "revoke",
    });
  }
  function webhookUpdate(row) {
    const next = row.status === "active" ? "disabled" : "active";
    prepare({
      title: next === "active" ? "启用事件回调" : "停用事件回调",
      path: `/platform/open/webhooks/${row.id}`,
      method: "PATCH",
      body: {
        name: row.name,
        target_url: row.target_url,
        events: row.events,
        status: next,
        expected_version: row.version,
        reason: form.reason.trim(),
      },
      description: `${row.name} 将切换为“${statusText(next)}”。`,
      impact:
        next === "active"
          ? "恢复后新事件可再次进入投递队列。"
          : "停用期间不能发送测试回调，新事件不会投递到该地址。",
    });
  }
  function webhookAction(row, action) {
    prepare({
      title: action === "test" ? "发送测试回调" : "轮换回调签名密钥",
      path: `/platform/open/webhooks/${row.id}/${action}`,
      method: "POST",
      body: {
        ...(action === "rotate" ? { expected_version: row.version } : {}),
        reason: form.reason.trim(),
      },
      description:
        action === "test"
          ? `向 ${row.name} 提交一条真实测试事件。`
          : `轮换 ${row.name} 的签名密钥。`,
      impact:
        action === "test"
          ? "Worker 将执行 DNS/私网检查、签名、投递和失败重试。"
          : "旧签名密钥立即失效，新密钥仅显示一次。",
    });
  }
  function replay(row) {
    prepare({
      title: "重新投递回调",
      path: `/platform/open/deliveries/${row.id}/replay`,
      method: "POST",
      body: { reason: form.reason.trim() },
      description: `基于投递 ${row.id} 创建一条新投递。`,
      impact: "原投递与事件历史保持不变；新投递将由 Worker 独立处理。",
    });
  }
  async function copySecret() {
    if (!secret.value) return;
    try {
      await navigator.clipboard.writeText(secret.value.value);
      notice.value = "一次性密钥已复制，请保存到受限凭证系统。";
    } catch {
      notice.value = "浏览器未允许复制，请手动保存后立即关闭。";
    }
  }
  function toggleEvent(event) {
    form.events = form.events.includes(event)
      ? form.events.filter((item) => item !== event)
      : [...form.events, event];
  }
  const statusText = (value) =>
      ({
        active: "可用",
        expired: "已过期",
        revoked: "已撤销",
        rotated: "已轮换",
        enabled: "启用",
        disabled: "停用",
        queued: "等待投递",
        leased: "正在投递",
        succeeded: "成功",
        dead_letter: "多次失败",
        retry_scheduled: "等待重试",
      })[value] ?? "未知状态",
    scopeText = (value) => ({ "status:read": "读取系统状态" })[value] ?? "未知权限",
    eventText = (value) =>
      ({
        "scoutops.test": "测试事件",
        "task.updated": "任务更新",
        "approval.updated": "审批更新",
        "competitor.changed": "竞品变化",
      })[value] ?? "未知事件",
    formatTime = (value) => (value ? new Date(value).toLocaleString("zh-CN") : "从未"),
    rangeLabel = computed(() => {
      const meta = currentPagination.value;
      if (!meta.total) return "0 条";
      return `${(meta.page - 1) * meta.page_size + 1}–${Math.min(meta.page * meta.page_size, meta.total)} / ${meta.total} 条`;
    });
  onMounted(load);
  onBeforeUnmount(() => loadController?.abort());

  return {
    activeView,
    organizationId,
    state,
    refreshing,
    actionBusy,
    hasSnapshot,
    notice,
    requestId,
    secret,
    pending,
    fieldErrors,
    form,
    filters,
    data,
    currentRows,
    currentPagination,
    currentSummary,
    statusOptions,
    sortOptions,
    apiQuery,
    syncUrl,
    load,
    switchView,
    applyFilters,
    resetFilters,
    goToPage,
    call,
    prepare,
    confirm,
    validate,
    createClient,
    createWebhook,
    clientAction,
    webhookUpdate,
    webhookAction,
    replay,
    copySecret,
    toggleEvent,
    statusText,
    scopeText,
    eventText,
    rangeLabel,
  };
};
window.OPEN_LABELS = {
  statusText: (value) =>
    ({
      active: "可用",
      expired: "已过期",
      revoked: "已撤销",
      rotated: "已轮换",
      enabled: "启用",
      disabled: "停用",
      queued: "等待投递",
      leased: "正在投递",
      succeeded: "成功",
      dead_letter: "多次失败",
      retry_scheduled: "等待重试",
    })[value] ?? "未知状态",
  scopeText: (value) => ({ "status:read": "读取系统状态" })[value] ?? "未知权限",
  eventText: (value) =>
    ({
      "scoutops.test": "测试事件",
      "task.updated": "任务更新",
      "approval.updated": "审批更新",
      "competitor.changed": "竞品变化",
    })[value] ?? "未知事件",
};
