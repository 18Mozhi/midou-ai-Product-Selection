import assert from "node:assert/strict";
import { previewCommercialCreateOutcome } from "./ui-phase2-commercial-create-outcome-preview.mjs";

export const draftFocusBoundary = `function keepDraftFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  const dialog = event.currentTarget;
  if (!(dialog instanceof HTMLDialogElement) || !dialog.open || !dialog.matches(":modal")) return;
  const candidates = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], summary, [tabindex]"));
  const stops = candidates.filter((element) => {
    if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.visibility === "collapse" || !element.getClientRects().length) return false;
    for (let ancestor = element.parentElement; ancestor && ancestor !== dialog; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
        const summary = Array.from(ancestor.children).find((child) => child.tagName === "SUMMARY");
        if (!summary?.contains(element)) return false;
      }
    }
    return true;
  });
  if (!stops.length) {
    event.preventDefault();
    const anchor = dialog.querySelector<HTMLElement>('h3[tabindex="-1"]') ?? dialog;
    anchor.focus({ preventScroll: true });
    anchor.scrollIntoView({ block: "center", inline: "nearest" });
    return;
  }
  const active = document.activeElement;
  if (!stops.includes(active as HTMLElement) || (!event.shiftKey && active === stops.at(-1)) || (event.shiftKey && active === stops[0])) {
    event.preventDefault();
    (event.shiftKey ? stops.at(-1)! : stops[0]).focus();
  }
}
`;

export function previewCommercialCreateFocus(source) {
  let preview = previewCommercialCreateOutcome(source);
  const marker = preview.includes('const draftFeedback = ref("");')
    ? 'const draftFeedback = ref("");'
    : "async function createPlan() {";
  assert.equal(preview.split(marker).length, 2);
  preview = preview.replace(marker, draftFocusBoundary + marker);
  const reference = 'ref="createDialogElement"';
  assert.equal(preview.split(reference).length, 2);
  const referenceIndex = preview.indexOf(reference),
    start = preview.lastIndexOf("<dialog", referenceIndex),
    openEnd = preview.indexOf(">", referenceIndex) + 1;
  assert.ok(start >= 0 && openEnd > referenceIndex);
  const openTag = preview.slice(start, openEnd);
  assert.ok(!openTag.includes('@keydown="keepDraftFocus"'));
  return (
    preview.slice(0, start) +
    openTag.replace(">", ' @keydown="keepDraftFocus">') +
    preview.slice(openEnd)
  );
}
