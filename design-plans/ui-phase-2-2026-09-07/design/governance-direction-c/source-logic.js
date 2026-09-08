window.GOVERNANCE_SOURCE = (b) => {
  const {
    computed,
    ref,
    onBeforeUnmount,
    onMounted,
    useRoute,
    useRouter,
    useModalDialog,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    URLSearchParams,
    AbortController,
  } = b;
  const props = defineProps();
  const request = createApiClient(props.apiBaseUrl);
  const sectionStatuses = {
    score_rules: [
      "draft",
      "pending_approval",
      "approved",
      "active",
      "retired",
      "rejected",
      "rolled_back",
    ],
    cost_rules: [
      "draft",
      "pending_approval",
      "approved",
      "active",
      "retired",
      "rejected",
      "rolled_back",
    ],
    approval_templates: ["draft", "published", "archived"],
    automation_rules: ["active", "paused"],
    releases: ["planned", "preflight_passed", "deploying", "healthy", "failed", "rolled_back"],
  };
  const route = useRoute(),
    router = useRouter(),
    queryValue = (name) => {
      const value = route.query[name];
      return typeof value === "string" ? value : "";
    },
    sectionValues = Object.keys(sectionStatuses),
    initialSection = sectionValues.includes(queryValue("section"))
      ? queryValue("section")
      : "score_rules",
    initialStatus = sectionStatuses[initialSection].includes(queryValue("status"))
      ? queryValue("status")
      : "",
    pageSize = 20,
    section = ref(initialSection),
    state = ref("loading"),
    data = ref({ summary: {}, items: [], pagination: null }),
    snapshotScope = ref(null),
    query = ref(queryValue("q").trim()),
    queryDraft = ref(query.value),
    status = ref(initialStatus),
    statusDraft = ref(initialStatus),
    page = ref(/^\d{1,4}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1),
    message = ref(""),
    requestId = ref(""),
    selected = ref(null),
    refreshing = ref(false);
  let activeController = null;
  const { dialogElement: detailDialogElement, handleCancel: handleDetailCancel } = useModalDialog(
    () => Boolean(selected.value),
    () => (selected.value = null),
  );
  const sections = [
    {
      value: "score_rules",
      label: "评分规则",
      action: "进入评分规则",
      href: "/opportunities/scoring-rules",
    },
    {
      value: "cost_rules",
      label: "费用与风险",
      action: "进入费用规则",
      href: "/sourcing/cost-rules",
    },
    {
      value: "approval_templates",
      label: "审批工作流",
      action: "进入组织审批",
      href: "/org-admin/approvals",
    },
    {
      value: "automation_rules",
      label: "自动化规则",
      action: "进入自动化规则",
      href: "/automations",
    },
    {
      value: "releases",
      label: "灰度与回滚",
      action: "进入发布控制",
      href: "/platform-admin/releases",
    },
  ];
  const current = computed(() => sections.find((item) => item.value === section.value));
  const recordSection = computed(() => snapshotScope.value?.section ?? section.value);
  const recordType = computed(() => sections.find((item) => item.value === recordSection.value));
  const scopeMismatch = computed(() =>
    Boolean(
      snapshotScope.value &&
      (snapshotScope.value.section !== section.value ||
        snapshotScope.value.query !== query.value ||
        snapshotScope.value.status !== status.value ||
        snapshotScope.value.page !== page.value),
    ),
  );
  const snapshotLabel = computed(() =>
    snapshotScope.value
      ? `${recordType.value.label} · 搜索：${snapshotScope.value.query || "不限"} · 状态：${snapshotScope.value.status ? statusName(snapshotScope.value.status) : "全部"} · 第 ${snapshotScope.value.page} 页`
      : "",
  );
  const rows = computed(() => data.value?.items ?? []);
  const pagination = computed(
    () => data.value?.pagination ?? { page: 1, page_size: pageSize, total: 0, total_pages: 0 },
  );
  const statusOptions = computed(() => sectionStatuses[section.value]);
  const hasLoadedFacts = computed(() => Boolean(data.value?.observed_at));
  const activeFilterCount = computed(
    () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
  );
  const rangeLabel = computed(() => {
    if (!pagination.value.total) return "0 条";
    const start = (pagination.value.page - 1) * pagination.value.page_size + 1,
      end = Math.min(pagination.value.page * pagination.value.page_size, pagination.value.total);
    return `${start}–${end} / ${pagination.value.total} 条`;
  });
  const summaryName = (key) =>
    ({
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
      provider_versions: "来源配置版本",
    })[key] ?? key;
  const statusName = (value) =>
    ({
      active: "启用",
      paused: "暂停",
      draft: "草稿",
      pending_approval: "待审批",
      published: "已发布",
      approved: "已批准",
      rejected: "已驳回",
      retired: "已退役",
      archived: "已归档",
      planned: "已计划",
      preflight_passed: "预检通过",
      deploying: "发布中",
      healthy: "运行健康",
      failed: "失败",
      rolled_back: "已回滚",
    })[String(value)] ?? String(value ?? "—");
  const typeName = (value) =>
    ({
      "approval.overdue": "审批节点超时",
      "approval.node.rejected": "审批被驳回",
      "competitor.alert.queued": "竞品告警入队",
      "competitor.changed": "竞品发生变化",
      "task.created": "任务创建",
      notify_owner: "通知负责人",
      create_task: "创建人工任务",
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
    })[String(value)] ?? String(value ?? "—");
  const editHref = (item) =>
    recordSection.value === "automation_rules"
      ? `/automations?rule=${item.id}&action=edit`
      : recordType.value.href;
  const versionText = (item) => {
    if (recordSection.value === "releases") return item.name ? `版本 ${item.name}` : "未记录版本";
    if (recordSection.value === "approval_templates")
      return `第 ${item.current_version ?? item.revision} 版`;
    if (recordSection.value === "automation_rules") return `第 ${item.version} 版`;
    return `第 ${item.revision} 版`;
  };
  const failureState = (error) =>
    error.kind === "expired" || error.kind === "forbidden"
      ? error.kind
      : error.kind === "blocked" || error.kind === "rate_limited"
        ? "blocked"
        : "error";
  async function syncUrl() {
    const next = {};
    if (section.value !== "score_rules") next.section = section.value;
    if (query.value) next.q = query.value;
    if (status.value) next.status = status.value;
    if (page.value > 1) next.page = String(page.value);
    await router.replace({ query: next });
  }
  async function load(options = {}) {
    if (refreshing.value) return;
    const hadData = hasLoadedFacts.value;
    const scope = { section: section.value, query: query.value, status: status.value };
    refreshing.value = true;
    if (!hadData) state.value = "loading";
    message.value = "";
    const params = new URLSearchParams({
      domain: "governance",
      section: section.value,
      page: String(page.value),
      page_size: String(pageSize),
    });
    if (query.value.trim()) params.set("query", query.value.trim());
    if (status.value) params.set("status", status.value);
    const controller = new AbortController();
    activeController = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      if (options.updateUrl !== false) await syncUrl();
      const response = await request(`/platform/management?${params}`, {
        signal: controller.signal,
      });
      requestId.value = response.request_id;
      data.value = response.data;
      page.value = response.data.pagination.page;
      snapshotScope.value = { ...scope, page: page.value };
      if (options.updateUrl !== false) await syncUrl();
      state.value = response.data.pagination.total ? "ready" : "empty";
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? requestId.value;
      message.value = controller.signal.aborted
        ? "读取超过 15 秒，已安全取消；上一份治理事实仍保留。"
        : (failure?.actionHint ?? "网络或服务异常，上一份治理事实仍保留。");
      state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      refreshing.value = false;
    }
  }
  function selectSection(value) {
    if (refreshing.value || value === section.value) return;
    section.value = value;
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    selected.value = null;
    void load();
  }
  function applyFilters() {
    if (refreshing.value) return;
    query.value = queryDraft.value.trim();
    status.value = statusDraft.value;
    page.value = 1;
    void load();
  }
  function resetFilters() {
    if (refreshing.value) return;
    query.value = "";
    queryDraft.value = "";
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    void load();
  }
  function goToPage(nextPage) {
    if (
      refreshing.value ||
      nextPage < 1 ||
      nextPage > pagination.value.total_pages ||
      nextPage === page.value
    )
      return;
    page.value = nextPage;
    void load();
  }
  onMounted(() => void load());
  onBeforeUnmount(() => activeController?.abort());

  return {
    sectionStatuses,
    sections,
    section,
    current,
    recordSection,
    recordType,
    scopeMismatch,
    snapshotLabel,
    snapshotScope,
    data,
    rows,
    pagination,
    rangeLabel,
    hasLoadedFacts,
    state,
    query,
    queryDraft,
    status,
    statusDraft,
    page,
    selected,
    refreshing,
    message,
    statusOptions,
    statusName,
    typeName,
    versionText,
    editHref,
    summaryName,
    load,
    selectSection,
    applyFilters,
    resetFilters,
    goToPage,
  };
};
