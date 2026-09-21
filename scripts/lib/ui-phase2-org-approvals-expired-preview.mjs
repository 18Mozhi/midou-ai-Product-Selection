import assert from "node:assert/strict";
import { approvalsPermissionAnchor } from "./ui-phase2-org-approvals-permission-preview.mjs";

export const approvalsExpiredCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-expired-c.css";

export const approvalsExpiredReplacement =
  `      <template v-else-if="view === 'approvals' && state === 'expired'">
        <section class="org-approval-permission-c org-approval-expired-c" aria-label="审批登录状态提示">
          <p class="org-approval-permission-kicker">登录状态提示</p>
          <h3>登录已失效</h3>
          <p class="org-approval-permission-copy">重新登录后返回当前页面。</p>
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

export function previewApprovalsExpired(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(original.split(approvalsPermissionAnchor).length, 2, "One expired branch anchor");
  return original.replace(approvalsPermissionAnchor, approvalsExpiredReplacement);
}
