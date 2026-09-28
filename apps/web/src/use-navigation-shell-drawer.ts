import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from "vue";

export function useNavigationShellDrawer(menuOpen: Ref<boolean>) {
  const navigationDialog = ref<HTMLDialogElement | null>(null);
  const compact = ref(false);
  let media: MediaQueryList | undefined;
  let disposed = false;
  let returnTarget: HTMLElement | null = null;

  const visible = (node: HTMLElement | null) => {
    if (!node?.isConnected || node.closest("[inert]") || !node.getClientRects().length)
      return false;
    const closedDetails = node.closest("details:not([open])");
    return !closedDetails || node === closedDetails.querySelector("summary");
  };
  const restoreFocus = () => {
    const brand = document.querySelector<HTMLElement>(".role-brand");
    const target = visible(returnTarget) ? returnTarget : brand;
    if (visible(target)) target?.focus({ preventScroll: true });
    returnTarget = null;
  };

  function containTab(event: KeyboardEvent) {
    const dialog = navigationDialog.value;
    if (event.key !== "Tab" || !dialog?.matches(":modal")) return;
    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>("a[href], button, input, summary, [tabindex]"),
    ).filter((node) => visible(node) && node.tabIndex >= 0 && !node.matches(":disabled"));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function syncDialog() {
    await nextTick();
    const dialog = navigationDialog.value;
    if (disposed || !dialog?.isConnected) return;

    if (!compact.value) {
      if (dialog.matches(":modal")) {
        dialog.close();
        restoreFocus();
      }
      dialog.open = true;
      return;
    }

    if (menuOpen.value) {
      if (!dialog.matches(":modal")) {
        returnTarget =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.open = false;
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>(".role-navigation-close")?.focus();
      }
      return;
    }

    if (dialog.open) {
      const restore = dialog.matches(":modal") || dialog.contains(document.activeElement);
      dialog.close();
      if (restore) restoreFocus();
    }
  }

  function syncBreakpoint() {
    compact.value = Boolean(media?.matches);
    if (!compact.value) menuOpen.value = false;
    void syncDialog();
  }

  watch(menuOpen, syncDialog, { flush: "post" });
  onMounted(() => {
    media = window.matchMedia("(max-width: 840px)");
    media.addEventListener("change", syncBreakpoint);
    syncBreakpoint();
  });
  onUnmounted(() => {
    disposed = true;
    media?.removeEventListener("change", syncBreakpoint);
    navigationDialog.value?.close();
  });

  return { navigationDialog, compact, containTab };
}
