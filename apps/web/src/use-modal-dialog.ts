import { nextTick, onUnmounted, ref, watch } from "vue";

export function useModalDialog(isOpen: () => boolean, requestClose: () => void) {
  const dialogElement = ref<HTMLDialogElement | null>(null);
  let returnFocus: HTMLElement | null = null;

  watch(
    isOpen,
    async (open) => {
      if (open) {
        const active = document.activeElement;
        returnFocus = active instanceof HTMLElement ? active : null;
        await nextTick();
        if (dialogElement.value && !dialogElement.value.open) dialogElement.value.showModal();
        return;
      }
      if (dialogElement.value?.open) dialogElement.value.close();
      await nextTick();
      returnFocus?.focus();
      returnFocus = null;
    },
    { immediate: true },
  );

  function handleCancel(event: Event) {
    event.preventDefault();
    requestClose();
  }

  onUnmounted(() => {
    if (dialogElement.value?.open) dialogElement.value.close();
  });

  return { dialogElement, handleCancel };
}
