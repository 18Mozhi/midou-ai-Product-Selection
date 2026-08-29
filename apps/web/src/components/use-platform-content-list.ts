import { ref, type Ref } from "vue";

type PageState = "loading" | "ready" | "empty" | "error";

export function usePlatformContentList(options: {
  domain: Ref<string>;
  query: Ref<string>;
  status: Ref<string>;
  data: Ref<any>;
  state: Ref<PageState>;
  message: Ref<string>;
  refreshing: Ref<boolean>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  reload: () => void;
}) {
  const page = ref(1);
  let controller: AbortController | null = null,
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
      const nextData = await options.request<any>(`/platform/management?${params}`, {
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
  function stop() {
    controller?.abort();
  }

  return { page, readLocation, load, applyFilters, resetFilters, changePage, stop };
}
