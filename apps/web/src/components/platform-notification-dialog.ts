import { nextTick, onBeforeUnmount, onDeactivated, useId, watch } from "vue";

export function useNotificationFields(saving: () => boolean) {
  const fieldId = useId();
  const fieldAttributes = (name: string, hasHelp = true) => ({
    "aria-labelledby": `${fieldId}-${name}-label`,
    "aria-describedby": hasHelp ? `${fieldId}-${name}-help` : undefined,
    disabled: saving(),
  });
  return { fieldId, fieldAttributes };
}

export function useNotificationInitialFocus(
  isOpen: () => boolean,
  field: () => HTMLElement | null,
) {
  watch(isOpen, async (open) => {
    if (!open) return;
    await nextTick();
    if (isOpen()) field()?.focus();
  });
}

export function trapNotificationDialogTab(event: KeyboardEvent, dialog: HTMLDialogElement | null) {
  if (event.key !== "Tab" || !dialog?.open) return;
  const controls = [...dialog.querySelectorAll<HTMLElement>("button,input,select,textarea")].filter(
    (element) =>
      !element.matches(":disabled") &&
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      element.checkVisibility({ visibilityProperty: true }),
  );
  const first = controls[0],
    last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Only supplement native restoration when a pending action disabled its original trigger.
export function useNotificationActionReturnFocus(isOpen: () => boolean) {
  let trigger: HTMLElement | null = null,
    fallback: HTMLElement | null = null;
  const clear = () => {
    trigger = null;
    fallback = null;
  };
  onDeactivated(clear);
  onBeforeUnmount(clear);
  watch(isOpen, async (open) => {
    if (open) {
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      fallback =
        trigger
          ?.closest(".message-workbench")
          ?.querySelector<HTMLElement>(".message-directory .is-selected") ?? null;
      return;
    }
    await nextTick();
    if (isOpen()) return;
    if (
      trigger?.matches(":disabled") &&
      fallback?.isConnected &&
      fallback.checkVisibility({ visibilityProperty: true }) &&
      !fallback.closest("[inert]") &&
      !document.activeElement?.closest("dialog[open], [role='dialog'], [role='alertdialog']")
    ) {
      fallback.focus({ preventScroll: true });
    }
    clear();
  });
}
