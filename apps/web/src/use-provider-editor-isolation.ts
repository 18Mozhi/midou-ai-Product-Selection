import { onActivated, onBeforeUnmount, onDeactivated, watch, type Ref } from "vue";

// P46 keeps its current inline editor and its provider-aware close/focus handling.
export function useProviderEditorIsolation(
  panel: Ref<HTMLFormElement | null>,
  isOpen: () => boolean,
) {
  const previousInert = new Map<HTMLElement, string | null>();
  let active = true;
  let observer: MutationObserver | null = null;
  let overflow: { value: string; priority: string } | null = null;

  const restoreInert = (element: HTMLElement, value: string | null) => {
    if (value === null) element.removeAttribute("inert");
    else element.setAttribute("inert", value);
  };
  const release = () => {
    observer?.disconnect();
    observer = null;
    for (const [element, value] of previousInert) restoreInert(element, value);
    previousInert.clear();
    if (overflow) {
      const style = document.documentElement.style;
      // Do not overwrite a different scroll policy installed by a later surface.
      if (
        style.getPropertyValue("overflow") === "hidden" &&
        style.getPropertyPriority("overflow") === ""
      ) {
        if (overflow.value) style.setProperty("overflow", overflow.value, overflow.priority);
        else style.removeProperty("overflow");
      }
      overflow = null;
    }
  };
  const sync = () => {
    const editor = panel.value;
    if (!active || !isOpen() || !editor?.isConnected) {
      release();
      return;
    }
    const targets = new Set<HTMLElement>();
    // Leave the editor's own scrim operable; isolate siblings at every ancestor level.
    let branch: HTMLElement | null = editor.parentElement;
    while (branch && branch !== document.body) {
      const parent: HTMLElement | null = branch.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (
          sibling instanceof HTMLElement &&
          sibling !== branch &&
          !sibling.matches("dialog,script,style,link")
        )
          targets.add(sibling);
      }
      branch = parent;
    }
    for (const [element, value] of previousInert) {
      if (!targets.has(element)) {
        restoreInert(element, value);
        previousInert.delete(element);
      }
    }
    for (const element of targets) {
      if (!previousInert.has(element)) previousInert.set(element, element.getAttribute("inert"));
      element.inert = true;
    }
    if (!overflow) {
      const style = document.documentElement.style;
      overflow = {
        value: style.getPropertyValue("overflow"),
        priority: style.getPropertyPriority("overflow"),
      };
      style.setProperty("overflow", "hidden");
    }
    if (!observer) {
      observer = new MutationObserver(sync);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };
  watch([isOpen, panel], sync, { flush: "post" });
  onActivated(() => {
    active = true;
    sync();
    if (isOpen() && panel.value?.isConnected) panel.value.focus({ preventScroll: true });
  });
  onDeactivated(() => {
    active = false;
    release();
  });
  onBeforeUnmount(() => {
    active = false;
    release();
  });
}
