import { onBeforeUnmount, onDeactivated, onMounted, shallowRef } from "vue";
import { useModalDialog } from "../use-modal-dialog";

export function usePlatformNotificationReader() {
  const mobileReaderOpen = shallowRef(false);
  const { dialogElement, handleCancel, discardReturnFocus } = useModalDialog(
    () => mobileReaderOpen.value,
    () => (mobileReaderOpen.value = false),
  );
  let viewport: MediaQueryList | null = null;
  function viewportChanged() {
    if (!viewport?.matches) mobileReaderOpen.value = false;
  }
  function stop() {
    discardReturnFocus();
    mobileReaderOpen.value = false;
    if (dialogElement.value?.open) dialogElement.value.close();
  }
  onMounted(() => {
    viewport = window.matchMedia("(max-width: 760px)");
    viewport.addEventListener("change", viewportChanged);
  });
  onDeactivated(stop);
  onBeforeUnmount(() => {
    stop();
    viewport?.removeEventListener("change", viewportChanged);
  });
  return { mobileReaderOpen, dialogElement, handleCancel };
}
