import { shallowRef, type Ref } from "vue";

type ReviewStatus = "active" | "irrelevant" | "stale";
export interface PlatformContentReviewSnapshot {
  id: string;
  title: string;
  status: string;
  version: number;
  organization_name?: string;
  workspace_name?: string;
}

export function usePlatformContentReview(options: {
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  reload: () => Promise<boolean>;
  message: Ref<string>;
  busy: Ref<string>;
}) {
  const item = shallowRef<PlatformContentReviewSnapshot | null>(null),
    status = shallowRef<ReviewStatus>("active"),
    reason = shallowRef(""),
    error = shallowRef(""),
    submitting = shallowRef(false);
  let generation = 0;

  function begin(nextItem: any, nextStatus: ReviewStatus) {
    generation += 1;
    item.value = {
      id: String(nextItem.id),
      title: String(nextItem.title ?? ""),
      status: String(nextItem.status ?? ""),
      version: Number(nextItem.version),
      organization_name: nextItem.organization_name,
      workspace_name: nextItem.workspace_name,
    };
    status.value = nextStatus;
    reason.value = "";
    error.value = "";
  }

  function cancel() {
    generation += 1;
    item.value = null;
    error.value = "";
  }

  async function submit() {
    if (!item.value || reason.value.trim().length < 2 || submitting.value) return;
    const snapshot = item.value,
      submittedStatus = status.value,
      submittedReason = reason.value.trim(),
      submittedGeneration = generation;
    submitting.value = true;
    options.busy.value = snapshot.id;
    options.message.value = "";
    error.value = "";
    try {
      await options.request(`/platform/management/content/${snapshot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: submittedStatus,
          expected_version: snapshot.version,
          reason: submittedReason,
        }),
      });
      if (submittedGeneration === generation && item.value?.id === snapshot.id) {
        item.value = null;
        error.value = "";
      }
      const refreshed = await options.reload();
      options.message.value = refreshed
        ? "内容状态已更新并写入审计记录。"
        : "内容状态已更新，但列表未能刷新。请重新加载后核对最新状态。";
    } catch (failureError) {
      const failure = failureError instanceof Error ? failureError.message : "内容审核未完成";
      if (submittedGeneration === generation && item.value?.id === snapshot.id) {
        error.value = `${failure} 未确认写入结果，请先重新读取列表再决定是否重试。`;
      } else {
        options.message.value = `先前的内容审核未完成：${failure}`;
      }
    } finally {
      if (options.busy.value === snapshot.id) options.busy.value = "";
      submitting.value = false;
    }
  }

  return { item, status, reason, error, submitting, begin, cancel, submit };
}
