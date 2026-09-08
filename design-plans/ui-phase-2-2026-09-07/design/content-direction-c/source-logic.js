window.CONTENT_SOURCE = (b) => {
  const { ref, window, URLSearchParams, AbortController, DOMException, Error } = b;
  function usePlatformContentList(options) {
    const page = ref(1);
    let controller = null,
      sequence = 0;
    function readLocation() {
      if (options.domain.value !== "content") return;
      const params = new URLSearchParams(window.location.search),
        requestedPage = Number(params.get("page") ?? 1);
      options.query.value = (params.get("query") ?? "").slice(0, 120);
      options.status.value = ["active", "irrelevant", "stale", "archived"].includes(
        params.get("status") ?? "",
      )
        ? (params.get("status") ?? "")
        : "";
      page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    }
    function syncLocation() {
      const params = new URLSearchParams();
      if (options.query.value.trim()) params.set("query", options.query.value.trim());
      if (options.status.value) params.set("status", options.status.value);
      if (page.value > 1) params.set("page", String(page.value));
      const suffix = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
      );
    }
    async function load() {
      if (options.domain.value !== "content") {
        controller?.abort();
        controller = null;
        sequence += 1;
        return false;
      }
      const currentSequence = ++sequence;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, 15000);
      const hasContentData = options.data.value?.domain === "content";
      if (!hasContentData) options.state.value = "loading";
      options.refreshing.value = true;
      options.message.value = "";
      const params = new URLSearchParams({
        domain: "content",
        page: String(page.value),
        page_size: "20",
      });
      if (options.query.value.trim()) params.set("query", options.query.value.trim());
      if (options.status.value) params.set("status", options.status.value);
      try {
        const nextData = await options.request(`/platform/management?${params}`, {
          signal: requestController.signal,
        });
        if (currentSequence !== sequence) return true;
        options.data.value = nextData;
        page.value = nextData?.pagination?.page ?? page.value;
        syncLocation();
        options.state.value = nextData?.items?.length ? "ready" : "empty";
      } catch (error) {
        if (
          currentSequence !== sequence ||
          (error instanceof DOMException && error.name === "AbortError" && !timedOut)
        )
          return true;
        options.message.value = timedOut
          ? "读取超时，已保留上次成功数据，请稍后重试。"
          : error instanceof Error
            ? error.message
            : "管理数据暂不可用";
        if (!hasContentData) options.state.value = "error";
      } finally {
        window.clearTimeout(timeout);
        if (currentSequence === sequence) options.refreshing.value = false;
      }
      return true;
    }
    function applyFilters() {
      page.value = 1;
      options.reload();
    }
    function resetFilters() {
      options.query.value = "";
      options.status.value = "";
      page.value = 1;
      options.reload();
    }
    function changePage(nextPage) {
      const totalPages = Number(options.data.value?.pagination?.total_pages ?? 1);
      if (
        options.refreshing.value ||
        nextPage < 1 ||
        nextPage > totalPages ||
        nextPage === page.value
      )
        return;
      page.value = nextPage;
      options.reload();
    }
    function stop() {
      controller?.abort();
    }
    return { page, readLocation, load, applyFilters, resetFilters, changePage, stop };
  }
  function usePlatformContentReview(options) {
    const item = ref(null),
      status = ref("active"),
      reason = ref("");
    function begin(nextItem, nextStatus) {
      item.value = nextItem;
      status.value = nextStatus;
      reason.value = "";
    }
    async function submit() {
      if (!item.value || reason.value.trim().length < 2) return;
      options.busy.value = item.value.id;
      options.message.value = "";
      try {
        await options.request(`/platform/management/content/${item.value.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: status.value,
            expected_version: item.value.version,
            reason: reason.value.trim(),
          }),
        });
        item.value = null;
        await options.reload();
        options.message.value = "内容状态已更新并写入审计记录。";
      } catch (error) {
        options.message.value = error instanceof Error ? error.message : "内容审核未完成";
      } finally {
        options.busy.value = "";
      }
    }
    return { item, status, reason, begin, submit };
  }
  const platformManagementTitles = {
    content: ["内容管理", "审核跨组织热点内容，处理无关和过期主题。"],
    notifications: ["通知管理", "查看站内通知、接收人、已读状态和各渠道投递结果。"],
    email: ["邮件管理", "统一查看账号邮件与业务通知邮件的队列、失败和死信状态。"],
    status: [
      "系统状态",
      "查看 API、MySQL、Redis、文件、Worker、Crawler、来源和采集任务的真实运行状态。",
    ],
    "api-coverage": ["接口覆盖证据", "仅供平台超级管理员核对接口、权限、消费方与采集副作用。"],
  };
  const summaryNames = {
    total: "总记录",
    active: "展示中",
    irrelevant: "无关",
    stale: "已过期",
    archived: "已归档",
    unread: "未读",
    critical: "严重",
    succeeded: "已送达",
    blocked: "受阻",
    api: "后端接口",
    database: "数据库",
    dashboard_reads: "15 分钟访问",
    active_organizations: "活动组织",
    active_users: "活动用户",
  };
  const stateNames = {
    active: "展示中",
    irrelevant: "无关",
    stale: "已过期",
    archived: "已归档",
    measured: "已测量",
    insufficient_data: "数据不足",
    delivered: "已送达",
    succeeded: "成功",
    pending: "等待",
    pending_placeholder: "待配置",
    blocked_provider: "服务商受阻",
    dead_letter: "死信",
    failed: "失败",
    queued: "排队中",
    scheduled: "已计划",
    leased: "已领取",
    running: "运行中",
    parsing: "解析中",
    validating: "校验中",
    persisted: "已入库",
    retry_scheduled: "等待重试",
    blocked_login: "登录受阻",
    blocked_captcha: "验证码受阻",
    blocked_robots: "规则受阻",
    rate_limited: "触发限流",
    succeeded_empty: "成功但无结果",
    completed_with_warnings: "完成但有警告",
    failed_terminal: "最终失败",
    manually_replayed: "人工重放",
    automatically_replayed: "自动重放",
    suppressed: "已停止投递",
    healthy: "正常",
    ready: "正常",
    warning: "警告",
    blocked: "阻断",
    degraded: "降级",
    unknown: "待检查",
    stopped: "已停止",
    enabled: "启用",
    disabled: "停用",
    read: "已读",
    unread: "未读",
    draft: "草稿",
    published: "已发布",
    cancelled: "已取消",
    system_fixed: "系统内置",
    pending_provider_selection: "邮件服务待配置",
    in_app: "站内通知",
    notification: "通知",
    email: "邮件",
    task: "任务",
    approval: "审批",
    competitor: "竞品",
    system: "系统",
    info: "普通",
    critical: "严重",
  };
  const platformManagementSummaryName = (key) => summaryNames[key] ?? key;
  const platformManagementStateName = (value) => stateNames[String(value)] ?? String(value ?? "—");
  const formatPlatformManagementTime = (value) =>
    value ? new Date(String(value)).toLocaleString("zh-CN") : "—";

  return { usePlatformContentList, usePlatformContentReview, platformManagementStateName };
};
