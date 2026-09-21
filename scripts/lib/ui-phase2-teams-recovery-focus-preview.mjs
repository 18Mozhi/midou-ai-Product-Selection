import assert from "node:assert/strict";
import { previewTeamsReadResult } from "./ui-phase2-teams-read-result-preview.mjs";

export const teamsRecoveryFocusChanges = [
  ["import { computed, onActivated,", "import { computed, nextTick, onActivated,"],
  [
    '  teamCreateWriteRequestId = ref(""),',
    '  teamCreateWriteRequestId = ref(""),\n  teamCreateNotice = ref<HTMLElement | null>(null),',
  ],
];

const originalReload = `async function reloadTeamCreateResult() {
  if (busy.value || refreshing.value) return;
  const generation = teamCreateGeneration;
  const ownsResult = () => ownsTeamCreateResult(generation);
  if (!ownsResult()) return;
  await load({ background: true, preserveNotice: true, ownsResult, onResult: (result) => {
    if (result === "ready" && ownsResult()) {
      noticeKind.value = "success";
      notice.value = "团队列表已更新。";
    }
  } });
}`;
const revisedReload = `async function reloadTeamCreateResult() {
  if (busy.value || refreshing.value) return;
  const generation = teamCreateGeneration;
  const ownsResult = () => ownsTeamCreateResult(generation);
  if (!ownsResult()) return;
  const noticeElement = teamCreateNotice.value;
  let restoreFocus = Boolean(noticeElement?.contains(document.activeElement));
  let recovered = false;
  const trackFocus = (event: FocusEvent) => {
    if (!(event.target instanceof Node) || !noticeElement?.contains(event.target)) restoreFocus = false;
  };
  document.addEventListener("focusin", trackFocus, true);
  try {
    await load({ background: true, preserveNotice: true, ownsResult, onResult: (result) => {
      if (result === "ready" && ownsResult()) {
        recovered = true;
        noticeKind.value = "success";
        notice.value = "团队列表已更新。";
      }
    } });
    await nextTick();
    if (recovered && ownsResult() && restoreFocus && noticeElement?.isConnected &&
        teamCreateNotice.value === noticeElement &&
        (document.activeElement === document.body || noticeElement.contains(document.activeElement))) {
      noticeElement.focus();
    }
  } finally {
    document.removeEventListener("focusin", trackFocus, true);
  }
}`;
teamsRecoveryFocusChanges.push([originalReload, revisedReload]);
teamsRecoveryFocusChanges.push([
  '      class="org-admin-notice"',
  '      class="org-admin-notice"\n      ref="teamCreateNotice"\n      :tabindex="view === \'teams\' ? -1 : undefined"',
]);

export const teamsRecoveryFocusStyle = `
<style>
html body.teams-vue-c #app .org-admin-center .org-admin-notice[tabindex="-1"]:focus-visible {
  outline: 3px solid #4d79ff;
  outline-offset: 3px;
}
</style>
`;

// A local review composition, not a mutation of production or the r2 evidence.
export function previewTeamsRecoveryFocus(source) {
  let result = previewTeamsReadResult(source);
  for (const [before, after] of teamsRecoveryFocusChanges) {
    assert.equal(result.split(before).length, 2, `Inspect recovery focus anchor: ${before}`);
    result = result.replace(before, after);
  }
  return result + teamsRecoveryFocusStyle;
}
