import assert from "node:assert/strict";

export const approvalsParentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const approvalsParentFrameCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-parent-frame-c.css";
export const approvalsParentFrameAnchor = '    class="org-admin-center"\n';
export const approvalsParentFrameReplacement =
  approvalsParentFrameAnchor + "    :data-approval-c-view=\"view === 'approvals'\"\n";
export function previewApprovalsParentFrame(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(
    original.split(approvalsParentFrameAnchor).length,
    2,
    "One exact P34 parent frame anchor",
  );
  return original.replace(approvalsParentFrameAnchor, approvalsParentFrameReplacement);
}
