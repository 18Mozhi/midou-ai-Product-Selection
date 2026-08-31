import type { Ref } from "vue";

type PageState = "loading" | "ready" | "empty" | "error";

export function usePlatformStatus(options: {
  domain: Ref<string>;
  data: Ref<any>;
  state: Ref<PageState>;
  message: Ref<string>;
  refreshing: Ref<boolean>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
  let controller: AbortController | null = null,
    sequence = 0;

  async function load() {
    if (options.domain.value !== "status") {
      stop();
      return false;
    }
    if (controller) return true;
    const currentSequence = ++sequence,
      requestController = new AbortController(),
      hasStatusData = options.data.value?.domain === "status";
    controller = requestController;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, 15000);
    if (!hasStatusData) options.state.value = "loading";
    options.refreshing.value = true;
    options.message.value = "";
    try {
      const nextData = await options.request<any>("/platform/management?domain=status", {
        signal: requestController.signal,
      });
      if (currentSequence !== sequence) return true;
      options.data.value = nextData;
      options.state.value = "ready";
    } catch (error) {
      if (
        currentSequence !== sequence ||
        (error instanceof DOMException && error.name === "AbortError" && !timedOut)
      )
        return true;
      const failureMessage = error instanceof Error ? error.message : "管理数据暂不可用。";
      options.message.value = timedOut
        ? "读取超过 15 秒，已停止本次请求并保留上次成功数据。"
        : `${failureMessage}${hasStatusData ? " 已保留上次成功数据。" : ""}`;
      if (!hasStatusData) options.state.value = "error";
    } finally {
      window.clearTimeout(timeout);
      if (currentSequence === sequence) {
        controller = null;
        options.refreshing.value = false;
      }
    }
    return true;
  }

  function stop() {
    sequence += 1;
    controller?.abort();
    controller = null;
  }

  return { load, stop };
}
