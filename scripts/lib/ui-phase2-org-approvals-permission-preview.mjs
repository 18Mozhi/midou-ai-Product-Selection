import assert from "node:assert/strict";

export const approvalsPermissionCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-permission-c.css";
export const approvalsPermissionAnchor =
  '      <template v-else\n        >{{ notice }} <code v-if="requestId">{{ requestId }}</code></template\n      >';
export const approvalsPermissionReplacement =
  `      <template v-else-if="view === 'approvals' && state === 'forbidden'">
        <section class="org-approval-permission-c" aria-label="审批查看权限提示">
          <p class="org-approval-permission-kicker">查看权限提示</p>
          <h3>当前无法查看审批内容</h3>
          <p class="org-approval-permission-copy">当前权限还不能读取这些内容。权限调整后，可以重新加载。</p>
          <p class="org-approval-permission-boundary">审批内容目前未显示，不代表记录或模板为空。</p>
          <details class="org-approval-permission-trace">
            <summary>读取详情与追踪</summary>
            <p>{{ notice }}</p>
            <code v-if="requestId">{{ requestId }}</code>
          </details>
          <button type="button" @click="load()">重新加载</button>
        </section>
      </template>
` + approvalsPermissionAnchor;

export function previewApprovalsPermission(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(
    original.split(approvalsPermissionAnchor).length,
    2,
    "One exact P34 permission branch anchor",
  );
  return original.replace(approvalsPermissionAnchor, approvalsPermissionReplacement);
}
