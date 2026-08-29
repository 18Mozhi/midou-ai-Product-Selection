import { ref, type Ref } from "vue";

type PageState = "loading" | "ready" | "empty" | "error";

export function usePlatformNotificationList(options: {
  domain: Ref<string>;
  query: Ref<string>;
  status: Ref<string>;
  data: Ref<any>;
  state: Ref<PageState>;
  message: Ref<string>;
  refreshing: Ref<boolean>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  reload: () => void;
  fallbackApply: () => void;
  fallbackReset: () => void;
}) {
  const page = ref(1),
    messagePage = ref(1);
  let controller: AbortController | null = null,
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
      Number.isInteger(requestedMessagePage) && requestedMessagePage > 0 ? requestedMessagePage : 1;
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
      const nextData = await options.request<any>(`/platform/management?${params}`, {
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
  function changePage(nextPage: number) {
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
  function changeMessagePage(nextPage: number) {
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
