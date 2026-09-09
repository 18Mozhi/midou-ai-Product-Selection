window.SECURITY_SOURCE = (b) => {
  const {
    computed,
    ref,
    watch,
    onBeforeUnmount,
    onMounted,
    useRoute,
    useRouter,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    URLSearchParams,
    AbortController,
    DOMException,
  } = b;
  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
  const route = useRoute();
  const router = useRouter();
  const securityViews = ["events", "sessions", "credentials", "audit"];
  const emptyPagination = () => ({ page: 1, page_size: 20, total: 0, total_pages: 1 });
  const emptyData = () => ({
    window: "24h",
    view: "events",
    summary: {
      security_events: 0,
      risk_events: 0,
      active_sessions: 0,
      active_credentials: 0,
      credentials_expiring: 0,
      active_org_tokens: 0,
    },
    security_events: [],
    sessions: [],
    credential_assets: [],
    organization_tokens: [],
    audit_events: [],
    pagination: {
      security_events: emptyPagination(),
      sessions: emptyPagination(),
      credential_assets: emptyPagination(),
      organization_tokens: emptyPagination(),
      audit_events: emptyPagination(),
    },
    observed_at: null,
  });
  const state = ref("loading");
  const data = ref(emptyData());
  const loadedOnce = ref(false);
  const refreshing = ref(false);
  const requestId = ref("");
  const notice = ref("");
  const noticeKind = ref("info");
  const activeView = ref("events");
  const windowCode = ref("24h");
  const query = ref("");
  const queryInput = ref("");
  const status = ref("");
  const page = ref(1);
  const tokenPage = ref(1);
  let mounted = false;
  let loadController = null;
  let loadSequence = 0;
  let lastManualRefreshAt = 0;
  const statusOptions = computed(() =>
    activeView.value === "events" || activeView.value === "audit"
      ? [
          { value: "", label: "全部结果" },
          { value: "succeeded", label: "成功" },
          { value: "failed", label: "失败" },
          { value: "blocked", label: "已阻止" },
        ]
      : [
          { value: "", label: "全部状态" },
          { value: "active", label: "可用" },
          { value: "expired", label: "已过期" },
          { value: "revoked", label: "已撤销" },
        ],
  );
  const searchLabel = computed(
    () =>
      ({
        events: "搜索事件、用户或请求 ID",
        sessions: "搜索账号、设备或会话 ID",
        credentials: "搜索凭证、来源、令牌或组织 ID",
        audit: "搜索操作、对象、操作者或请求 ID",
      })[activeView.value],
  );
  const mainPaginationKey = computed(
    () =>
      ({
        events: "security_events",
        sessions: "sessions",
        credentials: "credential_assets",
        audit: "audit_events",
      })[activeView.value],
  );
  const mainPagination = computed(
    () => data.value.pagination[mainPaginationKey.value] ?? emptyPagination(),
  );
  const tokenPagination = computed(
    () => data.value.pagination.organization_tokens ?? emptyPagination(),
  );
  const normalizeView = (value) => {
    const candidate = String(value ?? "events");
    return securityViews.includes(candidate) ? candidate : "events";
  };
  const positiveInteger = (value) => {
    const parsed = Number(value ?? 1);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  };
  function readLocation() {
    activeView.value = normalizeView(route.query.view);
    windowCode.value = ["24h", "7d", "30d"].includes(String(route.query.window))
      ? String(route.query.window)
      : "24h";
    query.value = String(route.query.query ?? "")
      .slice(0, 120)
      .trim();
    queryInput.value = query.value;
    const requestedStatus = String(route.query.status ?? "");
    status.value = statusOptions.value.some((item) => item.value === requestedStatus)
      ? requestedStatus
      : "";
    page.value = positiveInteger(route.query.page);
    tokenPage.value = positiveInteger(route.query.token_page);
  }
  function routeQuery(overrides = {}) {
    const next = {
      view: activeView.value,
      window: windowCode.value,
      query: query.value,
      status: status.value,
      page: page.value,
      token_page: tokenPage.value,
      ...overrides,
    };
    const result = {};
    if (next.view !== "events") result.view = String(next.view);
    if (next.window !== "24h") result.window = String(next.window);
    if (String(next.query ?? "").trim()) result.query = String(next.query).trim();
    if (next.status) result.status = String(next.status);
    if (Number(next.page) > 1) result.page = String(next.page);
    if (next.view === "credentials" && Number(next.token_page) > 1)
      result.token_page = String(next.token_page);
    return result;
  }
  async function navigate(overrides) {
    const target = { path: "/platform-admin/security", query: routeQuery(overrides) };
    if (router.resolve(target).fullPath === route.fullPath) await load();
    else await router.push(target);
  }
  const viewLocation = (view) => ({
    path: "/platform-admin/security",
    query: routeQuery({ view, query: "", status: "", page: 1, token_page: 1 }),
  });
  function normalizeData(value) {
    const fallback = emptyData();
    return {
      ...fallback,
      ...value,
      summary: { ...fallback.summary, ...(value?.summary ?? {}) },
      pagination: {
        ...fallback.pagination,
        ...(value?.pagination ?? {}),
      },
    };
  }
  function setNotice(message, kind = "info") {
    notice.value = message;
    noticeKind.value = kind;
  }
  async function load() {
    if (refreshing.value) return;
    const sequence = ++loadSequence;
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
    setNotice("");
    const parameters = new URLSearchParams({
      window: windowCode.value,
      view: activeView.value,
      page: String(page.value),
      page_size: "20",
      token_page: String(tokenPage.value),
      token_page_size: "20",
    });
    if (query.value) parameters.set("query", query.value);
    if (status.value) parameters.set("status", status.value);
    try {
      const response = await request(`/platform/security/operations?${parameters}`, {
        signal: controller.signal,
      });
      if (sequence !== loadSequence) return;
      requestId.value = response.request_id;
      data.value = normalizeData(response.data);
      page.value = mainPagination.value.page;
      tokenPage.value = tokenPagination.value.page;
      loadedOnce.value = true;
      // Summary counts do not include historical lifecycle records or platform audits.
      // Keep the workspace available; each collection owns its own empty state.
      state.value = "ready";
    } catch (error) {
      if (
        sequence !== loadSequence ||
        (error instanceof DOMException && error.name === "AbortError" && !timedOut)
      )
        return;
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? requestId.value;
      setNotice(
        timedOut
          ? "读取超过 15 秒，已停止本次请求并保留上次成功数据。"
          : `${failure?.actionHint ?? "安全运营事实读取失败。"}${loadedOnce.value ? " 已保留上次成功数据。" : ""}`,
        "error",
      );
      if (!loadedOnce.value)
        state.value =
          failure?.kind === "expired" || failure?.kind === "forbidden"
            ? failure.kind
            : failure?.kind === "rate_limited"
              ? "rate_limited"
              : (failure?.status ?? 0) >= 500
                ? "blocked"
                : "error";
    } finally {
      window.clearTimeout(timeout);
      if (sequence === loadSequence) refreshing.value = false;
    }
  }
  async function refresh() {
    const now = Date.now();
    if (refreshing.value || now - lastManualRefreshAt < 500) return;
    lastManualRefreshAt = now;
    await load();
  }
  async function applyWindow() {
    page.value = 1;
    tokenPage.value = 1;
    await navigate({ window: windowCode.value, page: 1, token_page: 1 });
  }
  async function applyFilters() {
    query.value = queryInput.value.trim().slice(0, 120);
    page.value = 1;
    tokenPage.value = 1;
    await navigate({ query: query.value, status: status.value, page: 1, token_page: 1 });
  }
  async function resetFilters() {
    query.value = "";
    queryInput.value = "";
    status.value = "";
    page.value = 1;
    tokenPage.value = 1;
    await navigate({ query: "", status: "", page: 1, token_page: 1 });
  }
  async function goPage(kind, next) {
    if (kind === "main") page.value = next;
    else tokenPage.value = next;
    await navigate(kind === "main" ? { page: next } : { token_page: next });
  }
  const when = (value) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
  const summaryText = (value) =>
    ({
      security_events: "安全事件",
      risk_events: "风险事件",
      active_sessions: "有效会话",
      active_credentials: "有效凭证",
      credentials_expiring: "七天内到期",
      active_org_tokens: "有效访问令牌",
    })[value] ?? value;
  const statusText = (value) =>
    ({
      active: "可用",
      revoked: "已撤销",
      expired: "已过期",
      succeeded: "成功",
      failed: "失败",
      blocked: "已阻止",
      allowed: "已允许",
    })[value] ?? `其他状态（${value || "未知"}）`;
  const kindText = (value) =>
    ({
      api_key: "接口密钥",
      account_secret: "账号资料",
      cookie_bundle: "登录状态",
      private_key: "私钥",
      browser_profile: "网页登录档案",
    })[value] ?? "其他凭证";
  const eventText = (value) =>
    ({
      login_succeeded: "登录成功",
      login_failed: "登录失败",
      "login.succeeded": "登录成功",
      "login.failed": "登录失败",
      session_revoked: "登录已撤销",
      mfa_failed: "二次验证失败",
      password_changed: "密码已修改",
    })[value] ?? "未分类安全事件";
  const scopeText = (value) =>
    ({ "status:read": "读取系统状态", "report:read": "读取报表" })[value] ?? "其他权限";
  const auditActionText = (value) =>
    ({
      "platform.security.operations.read": "查看安全运营事实",
      "platform.account.organization.created": "创建组织",
      "platform.account.user.status_changed": "变更用户状态",
      "platform.account.role.changed": "变更平台管理员角色",
      "platform.credential.rotated": "轮换来源凭证",
      "platform.token.revoked": "撤销访问令牌",
    })[value] ?? "平台管理操作";
  const resourceText = (value) =>
    ({
      security_operations: "安全运营",
      organization: "组织",
      user: "用户",
      platform_role: "平台角色",
      credential: "来源凭证",
      organization_token: "组织访问令牌",
    })[value] ?? "平台对象";
  const stateTitle = computed(
    () =>
      ({
        loading: "正在读取安全事实",
        expired: "登录已失效",
        forbidden: "你没有安全运营权限",
        rate_limited: "请求过于频繁",
        blocked: "安全运营依赖受阻",
        error: "安全运营读取失败",
        ready: "",
      })[state.value],
  );
  onMounted(async () => {
    mounted = true;
    readLocation();
    await load();
  });
  watch(
    () => route.fullPath,
    async () => {
      if (!mounted) return;
      loadedOnce.value = false;
      readLocation();
      await load();
    },
  );
  onBeforeUnmount(() => {
    mounted = false;
    loadController?.abort();
  });

  return {
    data,
    state,
    loadedOnce,
    refreshing,
    activeView,
    windowCode,
    query,
    queryInput,
    status,
    page,
    tokenPage,
    requestId,
    notice,
    statusOptions,
    mainPagination,
    tokenPagination,
    searchLabel,
    routeQuery,
    viewLocation,
    readLocation,
    load,
    refresh,
    applyWindow,
    applyFilters,
    resetFilters,
    goPage,
    statusText,
    eventText,
    kindText,
    scopeText,
    auditActionText,
    resourceText,
    summaryText,
  };
};
window.SECURITY_LABELS = {
  statusText: (value) =>
    ({
      active: "可用",
      revoked: "已撤销",
      expired: "已过期",
      succeeded: "成功",
      failed: "失败",
      blocked: "已阻止",
      allowed: "已允许",
    })[value] ?? `其他状态（${value || "未知"}）`,
  eventText: (value) =>
    ({
      login_succeeded: "登录成功",
      login_failed: "登录失败",
      "login.succeeded": "登录成功",
      "login.failed": "登录失败",
      session_revoked: "登录已撤销",
      mfa_failed: "二次验证失败",
      password_changed: "密码已修改",
    })[value] ?? "未分类安全事件",
  kindText: (value) =>
    ({
      api_key: "接口密钥",
      account_secret: "账号资料",
      cookie_bundle: "登录状态",
      private_key: "私钥",
      browser_profile: "网页登录档案",
    })[value] ?? "其他凭证",
  scopeText: (value) =>
    ({ "status:read": "读取系统状态", "report:read": "读取报表" })[value] ?? "其他权限",
  auditActionText: (value) =>
    ({
      "platform.security.operations.read": "查看安全运营事实",
      "platform.account.organization.created": "创建组织",
      "platform.account.user.status_changed": "变更用户状态",
      "platform.account.role.changed": "变更平台管理员角色",
      "platform.credential.rotated": "轮换来源凭证",
      "platform.token.revoked": "撤销访问令牌",
    })[value] ?? "平台管理操作",
  resourceText: (value) =>
    ({
      security_operations: "安全运营",
      organization: "组织",
      user: "用户",
      platform_role: "平台角色",
      credential: "来源凭证",
      organization_token: "组织访问令牌",
    })[value] ?? "平台对象",
  summaryText: (value) =>
    ({
      security_events: "安全事件",
      risk_events: "风险事件",
      active_sessions: "有效会话",
      active_credentials: "有效凭证",
      credentials_expiring: "七天内到期",
      active_org_tokens: "有效访问令牌",
    })[value] ?? value,
};
