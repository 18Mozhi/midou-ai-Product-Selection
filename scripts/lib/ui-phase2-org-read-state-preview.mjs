import assert from "node:assert/strict";
import { previewOrgRefresh } from "./ui-phase2-org-refresh-preview.mjs";

export const orgReadStateCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-read-state-c.css";
export const reloadFocusScript = `function reloadFromControl(event: MouseEvent) {
  const trigger = event.currentTarget;
  if (trigger instanceof HTMLButtonElement && document.activeElement === trigger) {
    const heading = trigger.closest(".org-admin-center")?.querySelector<HTMLElement>(".org-admin-hero h2");
    if (heading?.isConnected && !heading.closest("[inert]")) heading.focus({ preventScroll: true });
  }
  return load();
}
`;
export const orgReadStateReplacements = [
  [
    'view === "summary" && data?.name ? data.name : title',
    'view === "summary" && state === "ready" && data?.name ? data.name : title',
  ],
  [
    'v-if="summary?.observed_at" role="status"',
    'v-if="summary?.observed_at && state === \'ready\'" role="status"',
  ],
  [
    'v-if="notice"\n      class="org-admin-notice"',
    "v-if=\"notice && (view !== 'summary' || ['ready', 'empty'].includes(state))\"\n      class=\"org-admin-notice\"",
  ],
  [
    '<section v-if="state === \'loading\'" class="org-admin-state">正在读取当前组织数据…</section>',
    '<section v-if="state === \'loading\'" class="org-admin-state" role="status"><h3>正在读取组织资料</h3><p>读取完成后显示当前组织内容。</p></section>',
  ],
  [
    'class="org-admin-state"\n    >\n      <h3>',
    'class="org-admin-state" role="alert"\n    >\n      <h3>',
  ],
  ['? "无权管理当前组织"', '? "当前无法查看组织资料"'],
  [
    '<p>{{ notice }}</p>\n      <button @click="load()">重新加载</button>',
    '<p>{{ notice }}</p>\n      <details v-if="requestId"><summary>本次读取追踪</summary><code>{{ requestId }}</code></details>\n      <button @click="reloadFromControl($event)">重新加载</button>',
  ],
  ["async function load(options:", reloadFocusScript + "async function load(options:"],
];
export function previewOrgReadState(source) {
  let result = previewOrgRefresh(source);
  for (const [before, after] of orgReadStateReplacements) {
    assert.equal(
      result.split(before).length,
      2,
      `Organization read-state anchor changed: ${before}`,
    );
    result = result.replace(before, after);
  }
  return result;
}
