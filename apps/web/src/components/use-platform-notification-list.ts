import { shallowRef, type Ref } from "vue";
import { ApiClientError } from "../api-client";
import type { PlatformNotificationEnvelopeRequest } from "./platform-notification-types";

type PageState = "loading" | "ready" | "empty" | "error";
type LoadOutcome = "idle" | "success" | "failure";

export function usePlatformNotificationList(options: {
  domain: Ref<string>;
  query: Ref<string>;
  status: Ref<string>;
  data: Ref<any>;
  state: Ref<PageState>;
  message: Ref<string>;
  refreshing: Ref<boolean>;
  request: PlatformNotificationEnvelopeRequest;
  reload: () => void;
  fallbackApply?: () => void;
  fallbackReset?: () => void;
}) {
  const page = shallowRef(1),
    messagePage = shallowRef(1),
    appliedQuery = shallowRef(""),
    appliedStatus = shallowRef(""),
    snapshotQuery = shallowRef(""),
    snapshotStatus = shallowRef(""),
    snapshotPage = shallowRef(1),
    snapshotMessagePage = shallowRef(1),
    lastLoadOutcome = shallowRef<LoadOutcome>("idle"),
    snapshotRequestId = shallowRef(""),
    failureRequestId = shallowRef("");
  let controller: AbortController | null = null,
    sequence = 0;

  function readLocation() {
    if (options.domain.value !== "notifications") return;
    const params = new URLSearchParams(window.location.search),
      requestedPage = Number(params.get("page") ?? 1),
      requestedMessagePage = Number(params.get("message_page") ?? 1),
      locationQuery = (params.get("query") ?? "").slice(0, 120),
      locationStatus = ["task", "approval", "competitor", "system"].includes(
        params.get("status") ?? "",
      )
        ? (params.get("status") ?? "")
        : "";
    options.query.value = locationQuery;
    options.status.value = locationStatus;
    appliedQuery.value = locationQuery.trim();
    appliedStatus.value = locationStatus;
    page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    messagePage.value =
      Number.isInteger(requestedMessagePage) && requestedMessagePage > 0 ? requestedMessagePage : 1;
  }

  function syncLocation() {
    const params = new URLSearchParams();
    if (snapshotQuery.value) params.set("query", snapshotQuery.value);
    if (snapshotStatus.value) params.set("status", snapshotStatus.value);
    if (snapshotPage.value > 1) params.set("page", String(snapshotPage.value));
    if (snapshotMessagePage.value > 1)
      params.set("message_page", String(snapshotMessagePage.value));
    const suffix = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
    );
  }

  async function load() {
    if (options.domain.value !== "notifications") {
      stop();
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
    const hasSnapshot = options.data.value?.domain === "notifications",
      requestedQuery = appliedQuery.value,
      requestedStatus = appliedStatus.value,
      requestedPage = page.value,
      requestedMessagePage = messagePage.value;
    if (!hasSnapshot) options.state.value = "loading";
    lastLoadOutcome.value = "idle";
    failureRequestId.value = "";
    options.refreshing.value = true;
    options.message.value = "";
    const params = new URLSearchParams({
      domain: "notifications",
      page: String(requestedPage),
      page_size: "20",
      message_page: String(requestedMessagePage),
      message_page_size: "10",
    });
    if (requestedQuery) params.set("query", requestedQuery);
    if (requestedStatus) params.set("status", requestedStatus);
    try {
      const response = await options.request<any>(`/platform/management?${params}`, {
        signal: requestController.signal,
      });
      if (currentSequence !== sequence) return true;
      const nextData = response.data;
      options.data.value = nextData;
      snapshotRequestId.value = response.request_id;
      page.value = nextData?.pagination?.page ?? requestedPage;
      messagePage.value = nextData?.message_pagination?.page ?? requestedMessagePage;
      snapshotQuery.value = requestedQuery;
      snapshotStatus.value = requestedStatus;
      snapshotPage.value = page.value;
      snapshotMessagePage.value = messagePage.value;
      syncLocation();
      options.state.value =
        nextData?.items?.length || nextData?.messages?.length ? "ready" : "empty";
      lastLoadOutcome.value = "success";
    } catch (error) {
      if (
        currentSequence !== sequence ||
        (error instanceof DOMException && error.name === "AbortError" && !timedOut)
      )
        return true;
      const failure = error instanceof ApiClientError ? error : null,
        failureMessage =
          failure?.actionHint ?? (error instanceof Error ? error.message : "通知数据暂不可用");
      failureRequestId.value = failure?.requestId ?? "";
      options.message.value = timedOut
        ? hasSnapshot
          ? "读取超时，当前仍显示上次成功快照。"
          : "读取超时，请稍后重新加载通知工作台。"
        : failure?.kind === "forbidden"
          ? "当前权限还不能读取通知运营内容。权限调整后，可以重新加载。"
          : hasSnapshot
            ? `${failureMessage} 当前仍显示上次成功快照。`
            : failureMessage;
      if (!hasSnapshot) options.state.value = "error";
      lastLoadOutcome.value = "failure";
    } finally {
      window.clearTimeout(timeout);
      if (currentSequence === sequence) options.refreshing.value = false;
    }
    return true;
  }

  function applyFilters() {
    if (options.domain.value !== "notifications") return options.fallbackApply?.();
    appliedQuery.value = options.query.value.trim();
    appliedStatus.value = options.status.value;
    page.value = 1;
    options.reload();
  }

  function resetFilters() {
    if (options.domain.value !== "notifications") return options.fallbackReset?.();
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
      nextPage === snapshotPage.value
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
      nextPage === snapshotMessagePage.value
    )
      return;
    messagePage.value = nextPage;
    options.reload();
  }

  function showNewestMessages() {
    messagePage.value = 1;
  }

  function stop() {
    sequence += 1;
    controller?.abort();
    controller = null;
    options.refreshing.value = false;
  }

  return {
    page,
    messagePage,
    appliedQuery,
    appliedStatus,
    snapshotQuery,
    snapshotStatus,
    snapshotPage,
    snapshotMessagePage,
    lastLoadOutcome,
    snapshotRequestId,
    failureRequestId,
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
