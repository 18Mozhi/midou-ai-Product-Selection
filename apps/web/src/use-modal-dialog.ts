import { nextTick, onUnmounted, ref, watch } from "vue";

export function useModalDialog(
  isOpen: () => boolean,
  requestClose: () => void,
  getFallbackFocus?: () => HTMLElement | null,
  options: { trapFocus?: boolean } = {},
) {
  const dialogElement = ref<HTMLDialogElement | null>(null);
  let returnFocus: HTMLElement | null = null;
  let shouldRestoreFocus = true;
  let tabTrappedDialog: HTMLDialogElement | null = null;

  function handleTabKeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const dialog = dialogElement.value;
    if (!dialog?.open) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      return (
        element.getClientRects().length > 0 &&
        style.visibility !== "hidden" &&
        !element.closest('[aria-hidden="true"], [inert]')
      );
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setTabTrap(dialog: HTMLDialogElement | null) {
    if (tabTrappedDialog === dialog) return;
    tabTrappedDialog?.removeEventListener("keydown", handleTabKeydown);
    tabTrappedDialog = dialog;
    tabTrappedDialog?.addEventListener("keydown", handleTabKeydown);
  }

  watch(
    isOpen,
    async (open) => {
      if (open) {
        const active = document.activeElement;
        returnFocus = active instanceof HTMLElement ? active : null;
        shouldRestoreFocus = true;
        await nextTick();
        if (dialogElement.value && !dialogElement.value.open) dialogElement.value.showModal();
        if (options.trapFocus) setTabTrap(dialogElement.value);
        return;
      }
      if (options.trapFocus) setTabTrap(null);
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
    if (options.trapFocus) setTabTrap(null);
    if (dialogElement.value?.open) dialogElement.value.close();
  });

  return { dialogElement, handleCancel, discardReturnFocus };
}
