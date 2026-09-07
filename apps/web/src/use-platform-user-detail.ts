import { onBeforeUnmount, onDeactivated, ref, watch, type Ref } from "vue";
import { ApiClientError, type createApiClient } from "./api-client";

export function usePlatformUserDetail(
  request: ReturnType<typeof createApiClient>,
  selected: Ref<any>,
  routePath: () => string,
) {
  const detailOpen = ref(false);
  const detail = ref<any>(null);
  const detailError = ref("");
  const detailSuccess = ref("");
  let sequence = 0;

  function clearDetailFeedback() {
    detailError.value = "";
    detailSuccess.value = "";
  }

  function captureDetailAction() {
    const actionSequence = sequence;
    const userId = selected.value?.id;
    const actionRoute = routePath();
    clearDetailFeedback();
    return () =>
      actionSequence === sequence &&
      detailOpen.value &&
      selected.value?.id === userId &&
      routePath() === actionRoute;
  }

  function closeUserDetail() {
    sequence += 1;
    detailOpen.value = false;
    detail.value = null;
    clearDetailFeedback();
  }

  async function openUserDetail(item: any, preserveFeedback = false) {
    const requestSequence = ++sequence;
    const userId = item.id;
    const requestRoute = routePath();
    const isCurrent = () =>
      requestSequence === sequence &&
      detailOpen.value &&
      selected.value?.id === userId &&
      routePath() === requestRoute;
    if (!preserveFeedback) clearDetailFeedback();
    selected.value = item;
    detail.value = null;
    detailOpen.value = true;
    try {
      const response = await request<any>(`/platform/accounts/users/${userId}`);
      if (isCurrent()) detail.value = response.data;
    } catch (error) {
      if (isCurrent())
        detailError.value = error instanceof ApiClientError ? error.actionHint : "读取详情失败";
    }
  }

  watch(routePath, closeUserDetail, { flush: "sync" });
  onDeactivated(closeUserDetail);
  onBeforeUnmount(closeUserDetail);

  return {
    detailOpen,
    detail,
    detailError,
    detailSuccess,
    clearDetailFeedback,
    captureDetailAction,
    closeUserDetail,
    openUserDetail,
  };
}
