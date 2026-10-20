import { onMounted, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type { OpportunitySummary } from "./opportunity-workspace-types";

export function useHomeCompletedProducts(input: {
  apiBaseUrl: () => string;
  completedCount: () => number | null | undefined;
  refreshVersion: () => number;
}) {
  const items = ref<OpportunitySummary[]>([]);
  const state = ref<"loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked">(
    "loading",
  );
  const refreshing = ref(false),
    stale = ref(false),
    message = ref(""),
    requestId = ref("");
  let active = false,
    generation = 0,
    controller: AbortController | null = null;
  async function load() {
    if (!active) return;
    controller?.abort();
    const read = new AbortController(),
      current = ++generation;
    controller = read;
    refreshing.value = true;
    if (!items.value.length) state.value = "loading";
    try {
      const response = await createApiClient(input.apiBaseUrl())<OpportunitySummary[]>(
        "/opportunities?selection_view=completed&page=1&page_size=5",
        { signal: read.signal },
      );
      if (!active || read.signal.aborted || current !== generation) return;
      items.value = response.data;
      requestId.value = response.request_id;
      state.value = items.value.length ? "ready" : "empty";
      stale.value = false;
      message.value = "";
    } catch (error) {
      if (!active || read.signal.aborted || current !== generation) return;
      const kind = error instanceof ApiClientError ? error.kind : "error";
      requestId.value = error instanceof ApiClientError ? error.requestId : "";
      message.value =
        error instanceof ApiClientError ? error.actionHint : "商品列表暂时无法读取，请重试。";
      if (kind === "expired" || kind === "forbidden") {
        items.value = [];
        stale.value = false;
        state.value = kind;
      } else if (items.value.length) {
        stale.value = true;
      } else {
        state.value = kind === "blocked" || kind === "rate_limited" ? "blocked" : "error";
      }
    } finally {
      if (current === generation) refreshing.value = false;
      if (controller === read) controller = null;
    }
  }
  function activate() {
    if (active) return;
    active = true;
    void load();
  }
  function deactivate() {
    active = false;
    generation += 1;
    controller?.abort();
    controller = null;
    items.value = [];
    refreshing.value = stale.value = false;
    message.value = requestId.value = "";
    state.value = "loading";
  }
  watch(
    () => [input.completedCount(), input.refreshVersion(), input.apiBaseUrl()],
    () => {
      if (active) void load();
    },
  );
  onMounted(activate);
  onActivated(activate);
  onDeactivated(deactivate);
  onBeforeUnmount(deactivate);
  return { items, state, refreshing, stale, message, requestId, load };
}
