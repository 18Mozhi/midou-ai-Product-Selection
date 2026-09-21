import assert from "node:assert/strict";

export const approvalsLoadingCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-loading-c.css";
export const approvalsLoadingAnchor =
  '    <section v-if="state === \'loading\'" class="org-admin-state">正在读取当前组织数据…</section>';
export const approvalsLoadingReplacement = `    <section v-if="state === 'loading'" class="org-admin-state" :class="{ 'org-approval-loading-c': view === 'approvals' }" :role="view === 'approvals' ? 'status' : undefined">
      <template v-if="view === 'approvals'">
        <div class="org-approval-loading-copy">
          <p class="org-approval-loading-kicker">审批内容</p>
          <h3>正在读取当前组织数据…</h3>
          <p>读取完成后显示审批记录和模板版本。</p>
        </div>
        <div class="org-approval-loading-placeholder" aria-hidden="true">
          <i></i><i></i><i></i>
        </div>
      </template>
      <template v-else>正在读取当前组织数据…</template>
    </section>`;

export function previewApprovalsLoading(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(original.split(approvalsLoadingAnchor).length, 2, "One P34 loading branch anchor");
  return original.replace(approvalsLoadingAnchor, approvalsLoadingReplacement);
}
