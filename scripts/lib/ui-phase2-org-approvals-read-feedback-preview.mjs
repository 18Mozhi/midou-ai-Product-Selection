import assert from "node:assert/strict";
import { approvalsPermissionAnchor } from "./ui-phase2-org-approvals-permission-preview.mjs";

export const approvalsReadFeedbackCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-read-feedback-c.css";
export const approvalsReadFeedbackReplacement =
  `      <template v-else-if="view === 'approvals' && (['blocked', 'conflict'].includes(state) || (noticeKind === 'error' && ['ready', 'empty'].includes(state)))">
        <section class="org-approval-permission-c org-approval-read-feedback-c" aria-label="审批读取反馈" :data-retained="['ready', 'empty'].includes(state)">
          <p class="org-approval-permission-kicker">读取状态提示</p>
          <h3>{{ ['ready', 'empty'].includes(state) ? '审批内容未能更新' : state === 'conflict' ? '数据版本已变化' : '组织数据暂不可用' }}</h3>
          <p class="org-approval-permission-copy">{{ ['ready', 'empty'].includes(state) ? '可使用上方“刷新数据”重新读取。' : '可以查看读取详情，确认后重新加载。' }}</p>
          <p class="org-approval-permission-boundary">{{ ['ready', 'empty'].includes(state) ? '仍显示上次成功读取的内容，本次更新尚未完成。' : '审批内容目前未显示，不代表记录或模板为空。' }}</p>
          <details class="org-approval-permission-trace">
            <summary>读取详情与追踪</summary>
            <p>{{ notice }}</p>
            <code v-if="requestId">{{ requestId }}</code>
          </details>
          <button v-if="!['ready', 'empty'].includes(state)" type="button" @click="load()">重新加载</button>
        </section>
      </template>
` + approvalsPermissionAnchor;

export function previewApprovalsReadFeedback(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(
    original.split(approvalsPermissionAnchor).length,
    2,
    "One read-feedback branch anchor",
  );
  return original.replace(approvalsPermissionAnchor, approvalsReadFeedbackReplacement);
}
