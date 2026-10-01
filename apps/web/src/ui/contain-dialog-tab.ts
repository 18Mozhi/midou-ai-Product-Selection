export function containDialogTab(event: KeyboardEvent, dialog: HTMLDialogElement | null) {
  if (event.key !== "Tab" || !dialog?.open) return;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (element) =>
      !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === dialog)
  ) {
    event.preventDefault();
    first.focus();
  }
}
