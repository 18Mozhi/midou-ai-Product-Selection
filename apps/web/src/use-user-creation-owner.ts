import { onBeforeUnmount, onDeactivated, watch } from "vue";

// Only owns feedback on the current creation form. Sent writes and list refreshes continue.
export function useUserCreationOwner(isOpen: () => boolean, routePath: () => string) {
  let generation = 0;
  const invalidate = () => {
    generation += 1;
  };
  watch([isOpen, routePath], invalidate, { flush: "sync" });
  onDeactivated(invalidate);
  onBeforeUnmount(invalidate);

  function capture() {
    const capturedGeneration = ++generation;
    const capturedRoute = routePath();
    return () => isOpen() && generation === capturedGeneration && routePath() === capturedRoute;
  }
  return { capture, invalidate };
}
