window.DATA_QUALITY_SOURCE = (b) => {
  const {
    computed,
    ref,
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
  } = b;
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    route = useRoute(),
    router = useRouter(),
    queryValue = (name) => {
      const value = route.query[name];
      return typeof value === "string" ? value : "";
    },
    pageSize = 20,
    initialPage = /^\d{1,3}$/.test(queryValue("quality_page"))
      ? Math.max(1, Number(queryValue("quality_page")))
      : 1,
    state = ref("loading"),
    evidence = ref([]),
    issues = ref([]),
    runs = ref([]),
    totalEvidence = ref(0),
    totalIssues = ref(0),
    totalOpenIssues = ref(0),
    totalCriticalIssues = ref(0),
    observedAt = ref(""),
    requestId = ref(""),
    tab = ref("evidence"),
    selectedRunId = ref(""),
    query = ref(""),
    detail = ref(null),
    notice = ref(""),
    resolving = ref(null),
    reason = ref(""),
    confirming = ref(false),
    saving = ref(false),
    refreshing = ref(false),
    page = ref(initialPage);
  let activeController = null;
  const memberOptions = ref([]),
    selectedIssueIds = ref([]),
    batchAction = ref("attribute"),
    batchReason = ref(""),
    batchAssignee = ref(""),
    batchConfirming = ref(false);
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
      const latest = new Map();
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
    pageTotal = computed(() =>
      tab.value === "evidence" ? totalEvidence.value : totalIssues.value,
    ),
    totalPages = computed(() => Math.max(1, Math.ceil(pageTotal.value / pageSize))),
    rangeLabel = computed(() => {
      if (!pageTotal.value) return "0 条";
      const start = (page.value - 1) * pageSize + 1,
        end = Math.min(page.value * pageSize, pageTotal.value);
      return `${start}–${end} / ${pageTotal.value} 条`;
    });
  const failure = (code) =>
      code === 401
        ? "expired"
        : code === 403
          ? "forbidden"
          : [408, 425, 429, 502, 503, 504].includes(code)
            ? "blocked"
            : "error",
    time = (value) =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)),
    size = (value) =>
      value < 1024
        ? `${value} B`
        : value < 1048576
          ? `${(value / 1024).toFixed(1)} KB`
          : `${(value / 1048576).toFixed(1)} MB`,
    metricLabel = (value) =>
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
    qualityStatusLabel = (value) =>
      ({ passed: "通过", failed: "未通过", insufficient_sample: "样本不足" })[value] ?? "状态未知";
  const retentionStatus = (value) => {
    const observed = Date.parse(observedAt.value),
      expiry = Date.parse(value);
    if (!Number.isFinite(observed) || !Number.isFinite(expiry)) return "到期风险未知";
    if (expiry <= observed) return "已到期，等待受控治理";
    const days = Math.ceil((expiry - observed) / 86400000);
    return days <= 7 ? `${days} 天内到期` : `剩余 ${days} 天`;
  };
  async function syncUrl() {
    const next = { view: "quality" };
    if (page.value > 1) next.quality_page = String(page.value);
    await router.replace({ query: next });
  }
  async function load(options = {}) {
    if (refreshing.value) return;
    const hadData = Boolean(evidence.value.length || issues.value.length || runs.value.length);
    refreshing.value = true;
    if (!hadData) state.value = "loading";
    notice.value = "";
    const controller = new AbortController();
    activeController = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      if (options.updateUrl !== false) await syncUrl();
      const response = await request(
        `/platform/data-quality?page=${page.value}&page_size=${pageSize}&status=all`,
        { signal: controller.signal },
      );
      requestId.value = response.request_id;
      evidence.value = response.data.evidence ?? [];
      issues.value = response.data.issues ?? [];
      runs.value = response.data.reconciliationRuns ?? [];
      memberOptions.value = response.data.memberOptions ?? [];
      selectedIssueIds.value = [];
      totalEvidence.value = response.data.totalEvidence ?? 0;
      totalIssues.value = response.data.totalIssues ?? 0;
      totalOpenIssues.value =
        response.data.openIssues ?? issues.value.filter((item) => item.status === "open").length;
      totalCriticalIssues.value =
        response.data.criticalIssues ??
        issues.value.filter((item) => item.status === "open" && item.severity === "critical")
          .length;
      observedAt.value = response.data.observedAt ?? "";
      state.value =
        evidence.value.length || issues.value.length || runs.value.length ? "ready" : "empty";
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      notice.value = controller.signal.aborted
        ? "读取超过 15 秒，已安全取消；上一份质量数据仍保留。"
        : (apiError?.actionHint ?? "网络或服务异常，上一份质量数据仍保留。");
      state.value = hadData ? "ready" : apiError ? failure(apiError.status) : "blocked";
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      refreshing.value = false;
    }
  }
  function switchTab(value) {
    if (value === tab.value || refreshing.value) return;
    tab.value = value;
    page.value = 1;
    selectedIssueIds.value = [];
    if (value === "runs") void syncUrl();
    else void load();
  }
  function goToPage(value) {
    if (refreshing.value || value < 1 || value > totalPages.value || value === page.value) return;
    page.value = value;
    void load();
  }
  async function openEvidence(id) {
    try {
      const response = await request(`/platform/data/evidence/${id}`);
      requestId.value = response.request_id;
      detail.value = response.data;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      notice.value = apiError?.actionHint ?? "证据详情依赖暂不可用";
    }
  }
  async function grantDownload(item) {
    try {
      const response = await request(`/platform/data/evidence/${item.id}/download-grant`, {
        method: "POST",
        body: {},
      });
      requestId.value = response.request_id;
      notice.value = `短时下载授权已签发，${time(response.data.expires_at)} 前有效。`;
      window.location.assign(
        `${props.apiBaseUrl}/platform/data/evidence/${item.id}/download?grant=${encodeURIComponent(response.data.grant)}`,
      );
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      notice.value = apiError?.actionHint ?? "下载依赖暂不可用";
    }
  }
  function beginResolve(item) {
    resolving.value = item;
    reason.value = "";
  }
  function drillIntoRun(run) {
    selectedRunId.value = run.id;
    query.value = "";
    tab.value = "issues";
    notice.value = `${run.provider_name} · ${run.parser_version}：正在查看本次核对的异常样本与字段。`;
  }
  function clearRunDrilldown() {
    selectedRunId.value = "";
    notice.value = "已返回全部质量问题。";
  }
  async function resolveIssue() {
    if (!resolving.value) return;
    saving.value = true;
    try {
      const response = await request(
        `/platform/data-quality/issues/${resolving.value.id}/resolve`,
        {
          method: "POST",
          body: {
            reason: reason.value.trim(),
            expected_version: resolving.value.version,
          },
        },
      );
      requestId.value = response.request_id;
      await load();
      notice.value = `质量问题 ${response.data.id.slice(0, 8)}… 已记录解决原因。`;
      resolving.value = null;
      reason.value = "";
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      notice.value = apiError?.actionHint ?? "依赖不可用，未更新质量问题";
    } finally {
      saving.value = false;
      confirming.value = false;
    }
  }
  function toggleIssue(id, checked) {
    selectedIssueIds.value = checked
      ? [...selectedIssueIds.value, id]
      : selectedIssueIds.value.filter((value) => value !== id);
  }
  function previewBatch() {
    if (!selectedIssues.value.length) {
      notice.value = "先选择 1–50 个开放问题。";
      return;
    }
    if (batchReason.value.trim().length < 2) {
      notice.value = "填写至少 2 个字符的处理原因。";
      return;
    }
    if (batchAction.value === "assign" && !batchAssignee.value) {
      notice.value = batchMembers.value.length
        ? "选择所选问题所属组织的活动成员。"
        : "批量指派只能选择同一组织的问题。";
      return;
    }
    batchConfirming.value = true;
  }
  async function executeBatch() {
    saving.value = true;
    try {
      const response = await request("/platform/data-quality/issues/batch", {
        method: "POST",
        body: {
          items: selectedIssues.value.map((item) => ({
            id: item.id,
            expected_version: item.version,
          })),
          action: batchAction.value,
          reason: batchReason.value.trim(),
          assignee_membership_id: batchAction.value === "assign" ? batchAssignee.value : null,
        },
      });
      requestId.value = response.request_id;
      const count = response.data.length;
      await load();
      notice.value = `已批量处理 ${count} 个质量问题；每个问题均已增加独立事件和审计事实。`;
      batchReason.value = "";
      batchAssignee.value = "";
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? requestId.value;
      notice.value = apiError?.actionHint ?? "依赖不可用，批量处理未生效";
    } finally {
      saving.value = false;
      batchConfirming.value = false;
    }
  }
  onMounted(async () => {
    await load({ updateUrl: false });
    const params = new URLSearchParams(window.location.search),
      evidenceId = params.get("evidence") || params.get("evidence_id"),
      issueId = params.get("issue_id");
    if (evidenceId && /^[0-9a-f-]{36}$/i.test(evidenceId)) await openEvidence(evidenceId);
    if (issueId && /^[0-9a-f-]{36}$/i.test(issueId)) {
      tab.value = "issues";
      query.value = issueId;
      notice.value = filteredIssues.value.length
        ? "已定位从业务页面进入的数据质量问题。"
        : "当前页未包含该质量问题，请使用质量问题检索或分页继续定位。";
    }
  });
  onBeforeUnmount(() => activeController?.abort());

  return {
    evidence,
    issues,
    runs,
    totalEvidence,
    totalIssues,
    totalOpenIssues,
    totalCriticalIssues,
    observedAt,
    state,
    query,
    tab,
    page,
    filteredEvidence,
    filteredIssues,
    metrics,
    retentionRisks,
    qualityHighlights,
    selectedIssues,
    selectedIssueIds,
    memberOptions,
    batchMembers,
    batchAction,
    batchReason,
    batchAssignee,
    batchConfirming,
    previewBatch,
    executeBatch,
    drillIntoRun,
    clearRunDrilldown,
    openEvidence,
    detail,
    grantDownload,
    beginResolve,
    resolving,
    reason,
    resolveIssue,
    notice,
    load,
    refreshing,
    saving,
    confirming,
  };
};
