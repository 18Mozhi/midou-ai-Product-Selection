import { ref } from "vue";
import type { NavigationShellKind } from "./navigation-shell-route-state";

export function useNavigationDiscovery(shell: () => NavigationShellKind) {
  const discoveryMode = ref<"search" | "create" | null>(null);
  const openDiscovery = (mode: "search" | "create") => (discoveryMode.value = mode);
  const closeDiscovery = () => (discoveryMode.value = null);
  const handleDiscoveryShortcut = (event: KeyboardEvent) => {
    if (
      shell() === "member" &&
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      openDiscovery("search");
    }
  };
  return { discoveryMode, openDiscovery, closeDiscovery, handleDiscoveryShortcut };
}
