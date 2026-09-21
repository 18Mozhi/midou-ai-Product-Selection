import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const refreshFocusBeforeSha =
  "ea3eaecf5bb8a6ec5e8e701dd8743cac61a35c6806a8a0d35079ba64be3b5e40";
export const refreshFocusFunction = `function refreshFromButton(event: MouseEvent) {
  const trigger = event.currentTarget;
  if (trigger instanceof HTMLElement && document.activeElement === trigger) {
    const heading = trigger.closest<HTMLElement>(".adapter-heading");
    if (heading?.isConnected && !heading.closest("[inert]")) heading.focus({ preventScroll: true });
  }
  void load();
}
`;

// Reconstruct only the complete exact pre-fix source, never normalize unknown changes.
export function beforeAdapterRefreshFocus(source) {
  source = source.replaceAll("\r\n", "\n");
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  if (hash(source) === refreshFocusBeforeSha) return source;
  for (const [before, after] of [
    [refreshFocusFunction, ""],
    ['<header class="adapter-heading" tabindex="-1">', '<header class="adapter-heading">'],
    ['@click="refreshFromButton"', '@click="load"'],
  ]) {
    assert.equal(source.split(before).length, 2, before);
    source = source.replace(before, after);
  }
  assert.equal(
    hash(source),
    refreshFocusBeforeSha,
    "Unknown source outside the exact refresh focus fix",
  );
  return source;
}
