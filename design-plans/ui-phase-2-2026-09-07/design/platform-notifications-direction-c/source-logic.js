window.PN_SOURCE = (b) => {
  const {
    ref,
    computed,
    window,
    URLSearchParams,
    AbortController,
    DOMException,
    Error,
    domain,
    messageEditor,
    messageForm,
    messageSaving,
    notificationList,
    message,
    busy,
    api,
    load,
    askActionReason,
  } = b;
  function usePlatformNotificationList(options) {
    const page = ref(1),
      messagePage = ref(1);
    let controller = null,
      sequence = 0;
    function readLocation() {
      if (options.domain.value !== "notifications") return;
      const params = new URLSearchParams(window.location.search),
        requestedPage = Number(params.get("page") ?? 1),
        requestedMessagePage = Number(params.get("message_page") ?? 1);
      options.query.value = (params.get("query") ?? "").slice(0, 120);
      options.status.value = ["task", "approval", "competitor", "system"].includes(
        params.get("status") ?? "",
      )
        ? (params.get("status") ?? "")
        : "";
      page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      messagePage.value =
        Number.isInteger(requestedMessagePage) && requestedMessagePage > 0
          ? requestedMessagePage
          : 1;
    }
    function syncLocation() {
      const params = new URLSearchParams();
      if (options.query.value.trim()) params.set("query", options.query.value.trim());
      if (options.status.value) params.set("status", options.status.value);
      if (page.value > 1) params.set("page", String(page.value));
      if (messagePage.value > 1) params.set("message_page", String(messagePage.value));
      const suffix = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
      );
    }
    async function load() {
      if (options.domain.value !== "notifications") {
        controller?.abort();
        controller = null;
        sequence += 1;
        return false;
      }
      if (options.refreshing.value) return true;
      const currentSequence = ++sequence;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, 15000);
      const hasNotificationData = options.data.value?.domain === "notifications";
      if (!hasNotificationData) options.state.value = "loading";
      options.refreshing.value = true;
      options.message.value = "";
      const params = new URLSearchParams({
        domain: "notifications",
        page: String(page.value),
        page_size: "20",
        message_page: String(messagePage.value),
        message_page_size: "10",
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
        messagePage.value = nextData?.message_pagination?.page ?? messagePage.value;
        syncLocation();
        options.state.value =
          nextData?.items?.length || nextData?.messages?.length ? "ready" : "empty";
      } catch (error) {
        if (
          currentSequence !== sequence ||
          (error instanceof DOMException && error.name === "AbortError" && !timedOut)
        )
          return true;
        options.message.value = timedOut
          ? "读取超时，已保留上次成功数据，请稍后重试。"
          : `${error instanceof Error ? error.message : "管理数据暂不可用"}；已保留上次成功数据。`;
        if (!hasNotificationData) options.state.value = "error";
      } finally {
        window.clearTimeout(timeout);
        if (currentSequence === sequence) options.refreshing.value = false;
      }
      return true;
    }
    function applyFilters() {
      if (options.domain.value !== "notifications") return options.fallbackApply();
      page.value = 1;
      options.reload();
    }
    function resetFilters() {
      if (options.domain.value !== "notifications") return options.fallbackReset();
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
    function changeMessagePage(nextPage) {
      const totalPages = Number(options.data.value?.message_pagination?.total_pages ?? 1);
      if (
        options.refreshing.value ||
        nextPage < 1 ||
        nextPage > totalPages ||
        nextPage === messagePage.value
      )
        return;
      messagePage.value = nextPage;
      options.reload();
    }
    function showNewestMessages() {
      messagePage.value = 1;
    }
    function stop() {
      controller?.abort();
    }
    return {
      page,
      messagePage,
      readLocation,
      load,
      applyFilters,
      resetFilters,
      changePage,
      changeMessagePage,
      showNewestMessages,
      stop,
    };
  }
  function useAuditedReason() {
    const request = ref(null);
    let resolveRequest = null;
    const open = computed(() => request.value !== null);
    function ask(input) {
      if (resolveRequest) resolveRequest(null);
      request.value = {
        title: input.title,
        description: input.description ?? "原因会写入审计记录。",
        initialValue: input.initialValue ?? "",
        minimumLength: input.minimumLength ?? 2,
        ...(input.workspaceRestore ? { workspaceRestore: { ...input.workspaceRestore } } : {}),
      };
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    }
    function finish(value) {
      const resolve = resolveRequest;
      resolveRequest = null;
      request.value = null;
      resolve?.(value);
    }
    return {
      request,
      open,
      ask,
      submit: (value) => finish(value),
      cancel: () => finish(null),
    };
  }
  function openMessage(item) {
    const kind = domain.value === "email" ? "email" : "notification";
    messageEditor.value = item ?? { id: "" };
    messageForm.value = item
      ? {
          kind: item.kind,
          title: item.title,
          body: item.body,
          category: item.category,
          severity: item.severity,
          audience_type: item.audience_type,
          organization_id: item.organization_id ?? "",
          user_id: item.user_id ?? "",
          in_app_enabled: Boolean(item.in_app_enabled),
          email_enabled: false,
          reason: "编辑平台消息",
          expected_version: item.version,
        }
      : {
          kind,
          title: "",
          body: "",
          category: "system",
          severity: "info",
          audience_type: "all_users",
          organization_id: "",
          user_id: "",
          in_app_enabled: kind === "notification",
          email_enabled: kind === "email",
          reason: "创建平台消息草稿",
          expected_version: 1,
        };
  }
  async function saveMessage() {
    if (!messageEditor.value) return;
    messageSaving.value = true;
    try {
      const editing = Boolean(messageEditor.value.id);
      await api(`/platform/management/messages${editing ? `/${messageEditor.value.id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(messageForm.value),
      });
      if (!editing) notificationList.showNewestMessages();
      messageEditor.value = null;
      await load();
      message.value = editing ? "草稿已更新。" : "草稿已创建，可继续编辑或发布。";
    } catch (error) {
      message.value = error instanceof Error ? error.message : "草稿未保存";
    } finally {
      messageSaving.value = false;
    }
  }
  async function messageAction(item, action) {
    const actionName = action === "publish" ? (item.kind === "email" ? "发送" : "发布") : "取消";
    const reason = await askActionReason({
      title: `填写${actionName}原因`,
      description: "原因会与消息版本、受众范围、操作者和执行结果一起保存。",
      initialValue: `${actionName}平台消息`,
    });
    if (reason === null) return;
    if (reason.trim().length < 2) {
      message.value = "操作原因至少需要 2 个字。";
      return;
    }
    busy.value = item.id;
    try {
      const result = await api(`/platform/management/messages/${item.id}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          expected_version: item.version,
          reason: reason.trim(),
        }),
      });
      await load();
      message.value =
        action === "publish"
          ? `${actionName}完成：覆盖 ${result.recipient_count} 人，站内 ${result.in_app_count} 条，邮件队列 ${result.email_count} 条。`
          : "草稿已取消。";
    } catch (error) {
      message.value = error instanceof Error ? error.message : `${actionName}未完成`;
    } finally {
      busy.value = "";
    }
  }

  return { usePlatformNotificationList, useAuditedReason, openMessage, saveMessage, messageAction };
};
