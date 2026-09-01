import { ref, type Ref } from "vue";

type ReviewStatus = "active" | "irrelevant" | "stale";

export function usePlatformContentReview(options: {
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  reload: () => Promise<void>;
  message: Ref<string>;
  busy: Ref<string>;
}) {
  const item = ref<any>(null),
    status = ref<ReviewStatus>("active"),
    reason = ref("");

  function begin(nextItem: any, nextStatus: ReviewStatus) {
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
