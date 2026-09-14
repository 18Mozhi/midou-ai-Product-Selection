import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from "vue";

// New mobile interaction proposal. Never imported by the production application.
export function useShellReviewNavigation(menuOpen: Ref<boolean>) {
  const reviewNavigation = ref<HTMLDialogElement | null>(null);
  const reviewCompact = ref(false);
  let media: MediaQueryList | undefined;
  let disposed = false;
  let trigger: HTMLElement | null = null;
  const visible = (node: HTMLElement | null) =>
    node?.isConnected && !node.closest("[inert]") && node.getClientRects().length > 0;
  const restore = () => {
    const fallback = document.querySelector<HTMLElement>(".role-brand");
    const target = visible(trigger) ? trigger : fallback;
    if (visible(target)) target?.focus({ preventScroll: true });
    trigger = null;
  };
  const reviewKeydown = (event: KeyboardEvent) => {
    const dialog = reviewNavigation.value;
    if (event.key !== "Tab" || !dialog?.matches(":modal")) return;
    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>("a[href], button, input, summary, [tabindex]"),
    ).filter((node) => visible(node) && node.tabIndex >= 0 && !node.matches(":disabled"));
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const sync = async () => {
    await nextTick();
    const dialog = reviewNavigation.value;
    if (disposed || !dialog?.isConnected) return;
    if (!reviewCompact.value) {
      if (dialog.matches(":modal")) {
        dialog.close();
        restore();
      }
      dialog.open = true;
    } else if (menuOpen.value) {
      if (!dialog.matches(":modal")) {
        trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.open = false;
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>(".role-navigation-close")?.focus();
      }
    } else if (dialog.open) {
      const wasModal = dialog.matches(":modal");
      const containedFocus = dialog.contains(document.activeElement);
      dialog.close();
      if (wasModal || containedFocus) restore();
    }
  };
  const resize = () => {
    reviewCompact.value = Boolean(media?.matches);
    if (!reviewCompact.value) menuOpen.value = false;
    void sync();
  };
  watch(menuOpen, sync, { flush: "post" });
  onMounted(() => {
    media = window.matchMedia("(max-width: 840px)");
    media.addEventListener("change", resize);
    resize();
  });
  onUnmounted(() => {
    disposed = true;
    media?.removeEventListener("change", resize);
    reviewNavigation.value?.close();
  });
  return { reviewNavigation, reviewCompact, reviewKeydown };
}
