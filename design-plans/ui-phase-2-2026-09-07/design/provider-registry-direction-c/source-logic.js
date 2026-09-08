// Generated from actual ProviderRegistry script; inert bridge, not mounted Vue. Do not hand-edit.
window.PROVIDER_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    reactive,
    watch,
    nextTick,
    onMounted,
    onBeforeUnmount,
    ApiClientError,
    Date,
    window,
    document,
    HTMLElement,
    AbortController,
    URL,
  } = bridge;
  const defineProps = () => ({ apiBaseUrl: "" }),
    createApiClient = () => bridge.request;
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    state = ref("loading"),
    items = ref([]),
    requestId = ref(""),
    loadMessage = ref(""),
    refreshing = ref(false),
    successMessage = ref(""),
    editing = ref(null),
    editorOpen = ref(false),
    editorStep = ref(1),
    saving = ref(false),
    message = ref(""),
    searchQuery = ref(""),
    statusFilter = ref("all"),
    accessModeFilter = ref("all"),
    admissionFilter = ref("all"),
    sortOrder = ref("name_asc"),
    page = ref(1),
    pageSize = 20,
    editorPanel = ref(null),
    editorTrigger = ref(null),
    loadController = ref(null),
    form = reactive({
      code: "",
      name: "",
      target_url: "",
      access_mode: "public_rss",
      markets: "US",
      languages: "en-US",
      fields: "title,summary,published_at,canonical_url,publisher",
      schedule_minutes: 30,
      concurrency_limit: 1,
      timeout_ms: 15000,
      retry_limit: 2,
      circuit_failure_threshold: 5,
      dedupe_key: "canonical_url",
      retention_days: 365,
      failure_rules: "timeout,rate_limited,login_expired,parser_changed,empty",
      parser_version: "v1",
      healthcheck_url: "",
      owner_label: "平台运营",
      terms_review_status: "pending",
      terms_reference_url: "",
      terms_version: "",
      terms_expires_at: "",
      status: "disabled",
    });
  const steps = ["基本信息", "范围与字段", "执行策略", "合规与发布"],
    stepForField = {
      code: 1,
      name: 1,
      target_url: 1,
      owner_label: 1,
      markets: 2,
      languages: 2,
      fields: 2,
      dedupe_key: 2,
      parser_version: 2,
      healthcheck_url: 2,
      schedule_minutes: 3,
      concurrency_limit: 3,
      timeout_ms: 3,
      retry_limit: 3,
      circuit_failure_threshold: 3,
      retention_days: 3,
      failure_rules: 3,
      terms_reference_url: 4,
      terms_version: 4,
      terms_expires_at: 4,
    };
  const failure = (s) =>
    s === 401
      ? "expired"
      : s === 403
        ? "forbidden"
        : [408, 429, 502, 503, 504].includes(s)
          ? "blocked"
          : "error";
  const accessModeText = (value) =>
      ({
        public_page: "公开页面",
        public_rss: "公开订阅源",
        authenticated_browser: "登录浏览器",
        import: "文件导入",
        manual: "人工录入",
      })[value] ?? "其他方式",
    providerStatusText = (value) =>
      ({ draft: "草稿", disabled: "未启用", enabled: "已启用" })[value] ?? "未知状态",
    termsStatusText = (value) =>
      value === "approved" ? "已批准" : value === "rejected" ? "已拒绝" : "待复核";
  const admission = (item) => {
      if (item.status !== "enabled")
        return {
          state: "inactive",
          label: "未进入调度",
          detail: item.status === "draft" ? "定义仍为草稿" : "来源定义未启用",
        };
      if (["public_page", "public_rss"].includes(item.access_mode)) {
        const expiresAt = item.terms_expires_at
          ? new Date(item.terms_expires_at).getTime()
          : Number.NaN;
        const complete =
          item.terms_review_status === "approved" &&
          Boolean(item.terms_reference_url) &&
          Boolean(item.terms_version) &&
          Number.isFinite(expiresAt) &&
          expiresAt > Date.now();
        return complete
          ? {
              state: "compliant",
              label: "合规门禁已满足",
              detail: "仅表示公开采集准入条件完整，不代表采集任务已成功",
            }
          : {
              state: "blocked",
              label: "执行受阻",
              detail:
                item.terms_review_status === "rejected"
                  ? "公开采集条款已拒绝"
                  : item.terms_review_status !== "approved"
                    ? "公开采集条款尚未批准"
                    : !item.terms_reference_url || !item.terms_version
                      ? "公开采集条款资料不完整"
                      : "公开采集条款已过期或缺少有效期",
            };
      }
      if (item.access_mode === "authenticated_browser")
        return {
          state: "runtime_gate",
          label: "需运行时登录门禁",
          detail: "定义已启用，执行仍取决于登录态、风控与采集程序状态",
        };
      return {
        state: "registered",
        label: item.access_mode === "import" ? "等待导入" : "等待人工录入",
        detail: "定义已启用，数据进入仍取决于对应导入或人工流程",
      };
    },
    admissionText = (item) => admission(item).label,
    normalizedSearch = computed(() => searchQuery.value.trim().toLocaleLowerCase("zh-CN")),
    filteredItems = computed(() => {
      const result = items.value.filter((item) => {
        const matchesSearch =
          !normalizedSearch.value ||
          [item.name, item.code, item.owner_label, ...item.markets, ...item.languages]
            .join(" ")
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedSearch.value);
        return (
          matchesSearch &&
          (statusFilter.value === "all" || item.status === statusFilter.value) &&
          (accessModeFilter.value === "all" || item.access_mode === accessModeFilter.value) &&
          (admissionFilter.value === "all" || admission(item).state === admissionFilter.value)
        );
      });
      return [...result].sort((left, right) => {
        if (sortOrder.value === "updated_desc")
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        if (sortOrder.value === "status")
          return admissionText(left).localeCompare(admissionText(right), "zh-CN");
        return left.name.localeCompare(right.name, "zh-CN");
      });
    }),
    pageCount = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize))),
    visibleItems = computed(() =>
      filteredItems.value.slice((page.value - 1) * pageSize, page.value * pageSize),
    ),
    enabledCount = computed(() => items.value.filter((item) => item.status === "enabled").length),
    blockedCount = computed(
      () => items.value.filter((item) => admission(item).state === "blocked").length,
    ),
    inactiveCount = computed(
      () => items.value.filter((item) => admission(item).state === "inactive").length,
    );
  const list = (v) =>
      v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    validHttpUrl = (value, httpsOnly = false) => {
      try {
        const url = new URL(value.replace(/\{[^}]+\}/g, "value"));
        return (
          (httpsOnly ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol)) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    },
    formErrors = computed(() => {
      const errors = {};
      if (!/^[a-z0-9_]{2,80}$/.test(form.code))
        errors.code = "仅允许 2–80 位小写字母、数字和下划线。";
      if (form.name.trim().length < 2 || form.name.length > 160)
        errors.name = "名称需要 2–160 字符。";
      if (
        !form.target_url ||
        (!["import", "manual"].includes(form.access_mode) && !validHttpUrl(form.target_url))
      )
        errors.target_url = "目标地址必须是有效的 HTTP(S) 技术合同。";
      if (form.owner_label.trim().length < 2 || form.owner_label.length > 120)
        errors.owner_label = "负责人需要 2–120 字符。";
      for (const field of ["markets", "languages", "fields", "failure_rules"])
        if (!list(form[field]).length || list(form[field]).length > 100)
          errors[field] = "使用英文逗号分隔，需要 1–100 项。";
      if (!form.dedupe_key.trim() || form.dedupe_key.length > 255)
        errors.dedupe_key = "去重键需要 1–255 字符。";
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(form.parser_version))
        errors.parser_version = "仅允许字母、数字、点、下划线和短横线。";
      if (form.healthcheck_url && !validHttpUrl(form.healthcheck_url))
        errors.healthcheck_url = "健康检查地址必须是 HTTP(S)。";
      for (const [field, min, max] of [
        ["schedule_minutes", 1, 10080],
        ["concurrency_limit", 1, 20],
        ["timeout_ms", 1000, 120000],
        ["retry_limit", 0, 10],
        ["circuit_failure_threshold", 1, 20],
        ["retention_days", 1, 3650],
      ]) {
        const value = form[field];
        if (!Number.isInteger(value) || value < min || value > max)
          errors[field] = `请输入 ${min}–${max} 的整数。`;
      }
      if (form.terms_reference_url && !validHttpUrl(form.terms_reference_url, true))
        errors.terms_reference_url = "必须是不含账号信息的 HTTPS 地址。";
      if (form.terms_version && !/^[A-Za-z0-9._:-]{1,80}$/.test(form.terms_version))
        errors.terms_version = "仅允许字母、数字、点、下划线、冒号和短横线。";
      if (form.terms_expires_at && !Number.isFinite(new Date(form.terms_expires_at).getTime()))
        errors.terms_expires_at = "请选择有效时间。";
      if (["public_page", "public_rss"].includes(form.access_mode) && form.status === "enabled") {
        if (form.terms_review_status !== "approved")
          errors.terms_reference_url = "启用公开来源前必须批准条款并补齐下列信息。";
        if (!form.terms_reference_url || !validHttpUrl(form.terms_reference_url, true))
          errors.terms_reference_url = "启用前必须登记 HTTPS 条款地址。";
        if (!form.terms_version) errors.terms_version = "启用前必须登记条款版本。";
        if (!form.terms_expires_at || new Date(form.terms_expires_at) <= new Date())
          errors.terms_expires_at = "启用前必须登记未来的到期时间。";
      }
      return errors;
    }),
    currentStepErrors = computed(() =>
      Object.entries(formErrors.value).filter(
        ([field]) => stepForField[field] === editorStep.value,
      ),
    );
  async function load() {
    loadController.value?.abort();
    const controller = new AbortController();
    loadController.value = controller;
    loadMessage.value = "";
    refreshing.value = Boolean(items.value.length);
    if (!items.value.length) state.value = "loading";
    const timeout = window.setTimeout(() => controller.abort("provider_registry_timeout"), 12000);
    try {
      const response = await request("/platform/providers", {
        signal: controller.signal,
      });
      requestId.value = response.request_id;
      items.value = response.data;
      state.value = items.value.length ? "ready" : "empty";
      page.value = 1;
    } catch (error) {
      if (controller !== loadController.value) return;
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? "";
      const nextState = apiError ? failure(apiError.status) : "blocked";
      if (items.value.length) {
        state.value = "ready";
        loadMessage.value =
          controller.signal.aborted && !apiError
            ? "刷新超过 12 秒，已保留上次成功数据。"
            : `刷新失败：${apiError?.actionHint ?? "请稍后重试。"} 已保留上次成功数据。`;
      } else state.value = nextState;
    } finally {
      window.clearTimeout(timeout);
      refreshing.value = false;
      if (loadController.value === controller) loadController.value = null;
    }
  }
  function edit(item, event) {
    editorTrigger.value =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    editing.value = item ?? null;
    editorOpen.value = true;
    editorStep.value = 1;
    message.value = "";
    Object.assign(
      form,
      item
        ? {
            ...item,
            markets: item.markets.join(","),
            languages: item.languages.join(","),
            fields: item.fields.join(","),
            failure_rules: item.failure_rules.join(","),
            healthcheck_url: item.healthcheck_url ?? "",
            terms_reference_url: item.terms_reference_url ?? "",
            terms_version: item.terms_version ?? "",
            terms_expires_at: item.terms_expires_at?.slice(0, 16) ?? "",
          }
        : {
            code: "",
            name: "",
            target_url: "",
            access_mode: "public_rss",
            markets: "US",
            languages: "en-US",
            fields: "title,summary,published_at,canonical_url,publisher",
            schedule_minutes: 30,
            concurrency_limit: 1,
            timeout_ms: 15000,
            retry_limit: 2,
            circuit_failure_threshold: 5,
            dedupe_key: "canonical_url",
            retention_days: 365,
            failure_rules: "timeout,rate_limited,login_expired,parser_changed,empty",
            parser_version: "v1",
            healthcheck_url: "",
            owner_label: "平台运营",
            terms_review_status: "pending",
            terms_reference_url: "",
            terms_version: "",
            terms_expires_at: "",
            status: "disabled",
          },
    );
    void nextTick(() => editorPanel.value?.querySelector("input, select")?.focus());
  }
  function closeEditor() {
    editing.value = null;
    editorOpen.value = false;
    message.value = "";
    void nextTick(() => editorTrigger.value?.focus());
  }
  function applyTemplate() {
    const shared = {
      schedule_minutes: 30,
      concurrency_limit: 1,
      timeout_ms: 15000,
      retry_limit: 2,
      circuit_failure_threshold: 5,
      retention_days: 365,
      dedupe_key: "canonical_url",
      parser_version: "v1",
    };
    Object.assign(form, shared);
    if (form.access_mode === "public_rss") {
      form.fields = "title,summary,published_at,canonical_url,publisher";
      form.failure_rules = "timeout,rate_limited,source_changed,empty_result";
    } else if (["public_page", "authenticated_browser"].includes(form.access_mode)) {
      form.fields = "title,canonical_url,observed_at";
      form.failure_rules =
        form.access_mode === "authenticated_browser"
          ? "timeout,rate_limited,login_required,session_expired,source_changed"
          : "timeout,rate_limited,source_changed,empty_result";
    } else {
      form.fields = "title,external_id,observed_at";
      form.failure_rules = "validation_failed,empty_result";
    }
    message.value = `已应用${accessModeText(form.access_mode)}技术模板，请按真实来源合同核对后发布。`;
  }
  function nextStep() {
    if (currentStepErrors.value.length) {
      message.value = `当前步骤还有 ${currentStepErrors.value.length} 项需要修正。`;
      return;
    }
    editorStep.value = Math.min(4, editorStep.value + 1);
    message.value = "";
  }
  async function save() {
    if (saving.value) return;
    if (Object.keys(formErrors.value).length) {
      editorStep.value = Math.min(
        ...Object.keys(formErrors.value).map((field) => stepForField[field] ?? 4),
      );
      message.value = `还有 ${Object.keys(formErrors.value).length} 项即时校验未通过。`;
      return;
    }
    saving.value = true;
    message.value = "";
    const body = {
        ...form,
        markets: list(form.markets),
        languages: list(form.languages),
        fields: list(form.fields),
        failure_rules: list(form.failure_rules),
        healthcheck_url: form.healthcheck_url || null,
        terms_reference_url: form.terms_reference_url || null,
        terms_version: form.terms_version || null,
        terms_expires_at: form.terms_expires_at
          ? new Date(form.terms_expires_at).toISOString()
          : null,
        ...(editing.value ? { expected_version: editing.value.version } : {}),
      },
      path = editing.value ? `/platform/providers/${editing.value.id}` : "/platform/providers";
    try {
      const savedName = form.name;
      const action = editing.value ? "更新" : "创建";
      const response = await request(path, {
        method: editing.value ? "PUT" : "POST",
        body,
      });
      requestId.value = response.request_id;
      closeEditor();
      await load();
      successMessage.value = `${savedName}已${action}，来源定义列表已刷新。`;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? "";
      message.value = apiError?.actionHint ?? "依赖不可用，未保存";
    } finally {
      saving.value = false;
    }
  }
  function resetFilters() {
    searchQuery.value = "";
    statusFilter.value = "all";
    accessModeFilter.value = "all";
    admissionFilter.value = "all";
    sortOrder.value = "name_asc";
  }
  watch([searchQuery, statusFilter, accessModeFilter, admissionFilter, sortOrder], () => {
    page.value = 1;
  });
  watch(pageCount, (count) => {
    if (page.value > count) page.value = count;
  });
  onMounted(load);
  onBeforeUnmount(() => loadController.value?.abort());

  function buildRequest() {
    const body = {
        ...form,
        markets: list(form.markets),
        languages: list(form.languages),
        fields: list(form.fields),
        failure_rules: list(form.failure_rules),
        healthcheck_url: form.healthcheck_url || null,
        terms_reference_url: form.terms_reference_url || null,
        terms_version: form.terms_version || null,
        terms_expires_at: form.terms_expires_at
          ? new Date(form.terms_expires_at).toISOString()
          : null,
        ...(editing.value ? { expected_version: editing.value.version } : {}),
      },
      path = editing.value ? `/platform/providers/${editing.value.id}` : "/platform/providers";

    return { path, method: editing.value ? "PUT" : "POST", body };
  }
  return {
    state,
    items,
    requestId,
    loadMessage,
    refreshing,
    successMessage,
    editing,
    editorOpen,
    editorStep,
    saving,
    message,
    searchQuery,
    statusFilter,
    accessModeFilter,
    admissionFilter,
    sortOrder,
    page,
    pageSize,
    form,
    steps,
    stepForField,
    failure,
    accessModeText,
    providerStatusText,
    termsStatusText,
    admission,
    filteredItems,
    pageCount,
    visibleItems,
    enabledCount,
    blockedCount,
    inactiveCount,
    list,
    validHttpUrl,
    formErrors,
    currentStepErrors,
    load,
    edit,
    closeEditor,
    applyTemplate,
    nextStep,
    save,
    resetFilters,
    buildRequest,
  };
};
