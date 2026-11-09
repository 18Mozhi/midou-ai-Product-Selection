import { ref } from "vue";
import type { NavigationShellKind } from "./navigation-shell-route-state";

export function useNavigationDiscovery(
  shell: () => NavigationShellKind,
  adminReady: () => boolean = () => false,
) {
  const discoveryMode = ref<"search" | null>(null);
  // Do not render the async overlay's inline loading panel before anyone opens it.
  // Keep the overlay mounted after first use so close can abort reads and restore focus.
  const discoveryActivated = ref(false);
  const openDiscovery = (mode: "search") => {
    discoveryActivated.value = true;
    discoveryMode.value = mode;
  };
  const closeDiscovery = () => (discoveryMode.value = null);
  const handleDiscoveryShortcut = (event: KeyboardEvent) => {
    if (
      (shell() === "member" || adminReady()) &&
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      openDiscovery("search");
    }
  };
  return {
    discoveryActivated,
    discoveryMode,
    openDiscovery,
    closeDiscovery,
    handleDiscoveryShortcut,
  };
}
