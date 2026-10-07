import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertP34HistoricalSourceHash } from "./ui-phase2-org-approvals-owner-path-history.mjs";
import {
  assertCaptureSourceRevision,
  assertCurrentSourceRevision,
} from "./ui-phase2-token-copy-baseline.mjs";

export const historicalShellFile = "apps/web/src/components/NavigationShell.vue";
export const historicalStyleFile = "apps/web/src/signal-ledger.css";
const additions = new Map([
  [
    historicalShellFile,
    `  // P57 internals are imported by their owning page, not addressed by the shell dispatcher.
  "!./PlatformNotificationFacts.vue",
  "!./PlatformNotificationActionDialog.vue",
  "!./PlatformNotificationCenter.vue",
  "!./PlatformNotificationManagement.vue",
  "!./PlatformNotificationOperations.vue",
  "!./PlatformNotificationPagination.vue",
`,
  ],
  [
    historicalStyleFile,
    `html[data-design="signal-ledger"] .confirm-status {
  border-left-color: var(--so-danger);
  background: color-mix(in srgb, var(--so-danger) 7%, var(--so-bg-elevated));
}
`,
  ],
]);

// Historical evidence only; no runtime, generator, or current-source replacement.
// Reverse the known additions when present; later source revisions are checked against HEAD.
export function beforeP34SharedChanges(file, source) {
  const text = source.replaceAll("\r\n", "\n"),
    addition = additions.get(file);
  if (!addition) return text;
  assert.equal(text.split(addition).length, 2, `Exact P34 shared-source addition: ${file}`);
  return text.replace(addition, "");
}

export function assertP34LegacySourceHash(file, source, expected) {
  try {
    assertP34HistoricalSourceHash(file, beforeP34SharedChanges(file, source), expected);
    return;
  } catch {
    // Later legitimate shared-source edits may replace the original addition block.
    // Preserve fail-closed behavior by proving both exact source versions in Git.
    const normalized = source.replaceAll("\r\n", "\n");
    assertCurrentSourceRevision(file, normalized);
    assertCaptureSourceRevision(file, normalized, expected);
  }
}
