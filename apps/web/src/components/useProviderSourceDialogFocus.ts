import { nextTick, onBeforeUnmount, watch } from "vue";
import type { Ref } from "vue";

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])';

export function useProviderSourceDialogFocus(
  isOpen: () => boolean,
  dialog: Ref<HTMLElement | null>,
  initialFocus: Ref<HTMLElement | null>,
  close: () => void,
) {
  let trigger: HTMLElement | null = null;
  const inertedBackground = new Map<HTMLElement, boolean>();

  function setBackgroundInert(active: boolean) {
    if (!active) {
      for (const [element, wasInert] of inertedBackground)
        if (!wasInert) element.removeAttribute("inert");
      inertedBackground.clear();
      return;
    }

    const modal = dialog.value;
    const boundary = modal?.closest<HTMLElement>(".source-center") ?? modal?.parentElement;
    if (!modal || !boundary) return;

    let modalSurface: HTMLElement = modal;
    while (modalSurface.parentElement && modalSurface.parentElement !== boundary) {
      modalSurface = modalSurface.parentElement;
    }

    for (const child of Array.from(boundary.children)) {
      if (!(child instanceof HTMLElement) || child === modalSurface) continue;
      inertedBackground.set(child, child.hasAttribute("inert"));
      child.setAttribute("inert", "");
    }
  }

  const focusableElements = () =>
    Array.from(dialog.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
      (element) => element.getClientRects().length > 0 && !element.closest("[inert]"),
    );

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = focusableElements();
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.value?.focus({ preventScroll: true });
      return;
    }

    const active = document.activeElement;
    if (!focusable.includes(active as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(
    isOpen,
    async (open, wasOpen) => {
      if (open && !wasOpen) {
        trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        await nextTick();
        setBackgroundInert(true);
        initialFocus.value?.focus({ preventScroll: true });
      } else if (!open && wasOpen) {
        setBackgroundInert(false);
        await nextTick();
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
        trigger = null;
      }
    },
    { immediate: true, flush: "post" },
  );

  onBeforeUnmount(() => {
    setBackgroundInert(false);
    const focusReturn = trigger;
    void nextTick(() => {
      if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true });
    });
  });

  return { onKeydown };
}
