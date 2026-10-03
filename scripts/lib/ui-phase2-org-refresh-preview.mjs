import assert from "node:assert/strict";
import { previewOrgSummary } from "./ui-phase2-shell-org-fixture.mjs";

export const orgRefreshCss = "design-plans/ui-phase-2-2026-09-07/implementation/org-refresh-c.css";
export const refreshFocusScript = `function refreshFromControl(event: MouseEvent) {
  const trigger = event.currentTarget;
  if (trigger instanceof HTMLButtonElement && document.activeElement === trigger) {
    const heading = trigger.closest(".org-admin-hero")?.querySelector<HTMLElement>(":is(h1, h2)");
    if (heading?.isConnected && !heading.closest("[inert]")) heading.focus({ preventScroll: true });
  }
  return load({ background: true });
}
`;
export const orgRefreshReplacements = [
  [
    ': \'h2\'\n          "\n          >{{ view === "summary" && data?.name ? data.name : title }}</component',
    ': \'h2\'\n          "\n          tabindex="-1"\n          >{{ view === "summary" && data?.name ? data.name : title }}</component',
  ],
  ['@click="load({ background: true })"', '@click="refreshFromControl($event)"'],
  [
    '<small v-if="summary?.observed_at">',
    '<small v-if="summary?.observed_at" role="status" aria-live="polite">',
  ],
  [
    '<template v-else\n        >{{ notice }} <code v-if="requestId">{{ requestId }}</code></template\n      >',
    '<template v-else>\n        <p>{{ notice }}</p>\n        <details v-if="requestId"><summary>本次读取追踪</summary><code>{{ requestId }}</code></details>\n      </template>',
  ],
  ["async function load(", refreshFocusScript + "async function load("],
];
export function previewOrgRefresh(source) {
  let result = previewOrgSummary(source);
  for (const [before, after] of orgRefreshReplacements) {
    assert.equal(result.split(before).length, 2, `Refresh preview anchor changed: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
