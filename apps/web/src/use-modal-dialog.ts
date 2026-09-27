import { nextTick, onUnmounted, ref, watch } from "vue";

export function useModalDialog(
  isOpen: () => boolean,
  requestClose: () => void,
  getFallbackFocus?: () => HTMLElement | null,
) {
  const dialogElement = ref<HTMLDialogElement | null>(null);
  let returnFocus: HTMLElement | null = null;
  let shouldRestoreFocus = true;

  watch(
    isOpen,
    async (open) => {
      if (open) {
        const active = document.activeElement;
        returnFocus = active instanceof HTMLElement ? active : null;
        shouldRestoreFocus = true;
        await nextTick();
        if (dialogElement.value && !dialogElement.value.open) dialogElement.value.showModal();
        return;
      }
      if (dialogElement.value?.open) dialogElement.value.close();
      await nextTick();
      if (shouldRestoreFocus) {
        const target =
          returnFocus?.isConnected && returnFocus !== document.body
            ? returnFocus
            : getFallbackFocus?.();
        target?.focus();
      }
      returnFocus = null;
      shouldRestoreFocus = true;
    },
    { immediate: true },
  );

  function handleCancel(event: Event) {
    event.preventDefault();
    requestClose();
  }

  function discardReturnFocus() {
    returnFocus = null;
    shouldRestoreFocus = false;
  }

  onUnmounted(() => {
    if (dialogElement.value?.open) dialogElement.value.close();
  });

  return { dialogElement, handleCancel, discardReturnFocus };
}
