import { shallowRef, type Ref } from "vue";

type PageState = "loading" | "ready" | "empty" | "error";
type LoadOutcome = "idle" | "success" | "failure";

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
  const page = shallowRef(1),
    appliedQuery = shallowRef(""),
    appliedStatus = shallowRef(""),
    snapshotQuery = shallowRef(""),
    snapshotStatus = shallowRef(""),
    lastLoadOutcome = shallowRef<LoadOutcome>("idle");
  let controller: AbortController | null = null,
    sequence = 0;

  function readLocation() {
    if (options.domain.value !== "content") return;
    const params = new URLSearchParams(window.location.search),
      requestedPage = Number(params.get("page") ?? 1);
    const locationQuery = (params.get("query") ?? "").slice(0, 120),
      locationStatus = ["active", "irrelevant", "stale", "archived"].includes(
        params.get("status") ?? "",
      )
        ? (params.get("status") ?? "")
        : "";
    options.query.value = locationQuery;
    options.status.value = locationStatus;
    appliedQuery.value = locationQuery.trim();
    appliedStatus.value = locationStatus;
    page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  }

  function syncLocation() {
    const params = new URLSearchParams();
    if (appliedQuery.value) params.set("query", appliedQuery.value);
    if (appliedStatus.value) params.set("status", appliedStatus.value);
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
    const hasContentData = options.data.value?.domain === "content",
      requestedQuery = appliedQuery.value,
      requestedStatus = appliedStatus.value,
      requestedPage = page.value;
    if (!hasContentData) options.state.value = "loading";
    lastLoadOutcome.value = "idle";
    options.refreshing.value = true;
    options.message.value = "";
    const params = new URLSearchParams({
      domain: "content",
      page: String(requestedPage),
      page_size: "20",
    });
    if (requestedQuery) params.set("query", requestedQuery);
    if (requestedStatus) params.set("status", requestedStatus);
    try {
      const nextData = await options.request<any>(`/platform/management?${params}`, {
        signal: requestController.signal,
      });
      if (currentSequence !== sequence) return true;
      options.data.value = nextData;
      page.value = nextData?.pagination?.page ?? page.value;
      snapshotQuery.value = requestedQuery;
      snapshotStatus.value = requestedStatus;
      syncLocation();
      options.state.value = nextData?.items?.length ? "ready" : "empty";
      lastLoadOutcome.value = "success";
    } catch (error) {
      if (
        currentSequence !== sequence ||
        (error instanceof DOMException && error.name === "AbortError" && !timedOut)
      )
        return true;
      const cause = error instanceof Error ? error.cause : null,
        forbidden =
          typeof cause === "object" &&
          cause !== null &&
          "kind" in cause &&
          cause.kind === "forbidden";
      options.message.value = timedOut
        ? "读取超时，已保留上次成功数据，请稍后重试。"
        : forbidden
          ? "当前权限还不能读取这些内容。权限调整后，可以重新加载。"
          : error instanceof Error
            ? error.message
            : "管理数据暂不可用";
      if (!hasContentData) options.state.value = "error";
      lastLoadOutcome.value = "failure";
    } finally {
      window.clearTimeout(timeout);
      if (currentSequence === sequence) options.refreshing.value = false;
    }
    return true;
  }

  function applyFilters() {
    appliedQuery.value = options.query.value.trim();
    appliedStatus.value = options.status.value;
    page.value = 1;
    options.reload();
  }
  function resetFilters() {
    options.query.value = "";
    options.status.value = "";
    appliedQuery.value = "";
    appliedStatus.value = "";
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
    sequence += 1;
    controller?.abort();
    controller = null;
    options.refreshing.value = false;
  }

  return {
    page,
    appliedQuery,
    appliedStatus,
    snapshotQuery,
    snapshotStatus,
    lastLoadOutcome,
    readLocation,
    load,
    applyFilters,
    resetFilters,
    changePage,
    stop,
  };
}
