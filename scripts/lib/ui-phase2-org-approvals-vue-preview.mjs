import assert from "node:assert/strict";

export const approvalsVueFile = "apps/web/src/components/OrganizationApprovalPanel.vue";
export const approvalsVueCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-vue-c.css";
export const approvalsVueChanges = [
  ['class="org-approval-governance"', 'class="org-approval-governance org-approval-c-workbench"'],
  ["APPROVAL GOVERNANCE · 只读治理", "组织审批 · 只读治理"],
  [
    '<nav class="org-approval-section-tabs" aria-label="审批治理视图">',
    `<nav class="org-approval-section-tabs" aria-label="审批治理视图">
      <div class="org-approval-c-index-title"><span>组织治理</span><strong>审批工作台</strong></div>`,
  ],
  [
    '<section v-if="section === \'requests\'" class="org-approval-section">',
    '<section v-if="section === \'requests\'" class="org-approval-section org-approval-c-requests">',
  ],
  [
    '<section v-else class="org-approval-section">',
    '<section v-else class="org-approval-section org-approval-c-templates">',
  ],
  [
    '        <article v-if="selectedTemplate" class="org-approval-template-detail">',
    `        <article v-if="selectedTemplate" class="org-approval-template-detail">
          <p v-if="!visibleTemplates.some(template => template.id === selectedTemplate.id)" class="org-approval-c-selection-note" role="status">当前详情来自其他目录页。翻页不会自动切换已选模板。</p>`,
  ],
  ["<span>VERSION DIFF</span>", "<span>最近版本对照</span>"],
  [
    '<del>{{ field.before ?? "未设置" }}</del\n                      ><span>→</span><ins>{{ field.after ?? "未设置" }}</ins>',
    '<del><small>变更前</small>{{ field.before ?? "未设置" }}</del\n                      ><span aria-hidden="true">→</span><ins><small>变更后</small>{{ field.after ?? "未设置" }}</ins>',
  ],
];
export function previewApprovalsVue(source) {
  let result = source.replaceAll("\r\n", "\n");
  for (const [before, after] of approvalsVueChanges) {
    assert.equal(result.split(before).length, 2, `Inspect P34 C anchor: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
