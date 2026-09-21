import assert from "node:assert/strict";
import { previewTeamsRecoveryFocus } from "./ui-phase2-teams-recovery-focus-preview.mjs";
import { previewTeamsCreateStates } from "./ui-phase2-teams-create-states-preview.mjs";

export const teamsMemberDialogFile = "apps/web/src/components/AuditedReasonDialog.vue";
export const teamsMemberDialogCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/teams-member-dialog-c.css";

export const teamsMemberParentChanges = [
  ["computed, nextTick,", "computed, nextTick, shallowRef,"],
  [
    '  teamCreateWriteRequestId = ref(""),',
    `  teamCreateWriteRequestId = ref(""),
  teamMemberReason = shallowRef<{ teamName: string; memberLabel: string; action: "assign" | "remove" } | null>(null),`,
  ],
  [
    '  const reason = await auditedReason(action === "assign" ? "分配团队成员" : "移除团队成员");',
    `  const member = data.value?.members?.find((candidate: any) => candidate.id === membership_id);
  const context = {
    teamName: item.name,
    memberLabel: member ? (member.display_name ? \`\${member.display_name} · \${member.email}\` : member.email) : "当前选择的成员",
    action,
  };
  teamMemberReason.value = context;
  let reason: string;
  try {
    reason = await auditedReason(action === "assign" ? "分配团队成员" : "移除团队成员");
  } finally {
    if (teamMemberReason.value === context) teamMemberReason.value = null;
  }`,
  ],
  [
    '      :workspace-restore="auditedReasonRequest?.workspaceRestore"',
    '      :workspace-restore="auditedReasonRequest?.workspaceRestore"\n      :team-member="view === \'teams\' ? teamMemberReason ?? undefined : undefined"',
  ],
];

export const teamsMemberDialogChanges = [
  [
    "  workspaceRestore?: WorkspaceRestoreReasonContext;",
    '  workspaceRestore?: WorkspaceRestoreReasonContext;\n  teamMember?: { teamName: string; memberLabel: string; action: "assign" | "remove" };',
  ],
  [
    ":class=\"{ 'workspace-restore-reason': Boolean(workspaceRestore) }\"",
    ":class=\"{ 'workspace-restore-reason': Boolean(workspaceRestore), 'teams-member-reason-c': Boolean(teamMember) }\"\n    :data-team-action=\"teamMember?.action\"",
  ],
  [
    ":aria-describedby=\"workspaceRestore ? 'workspace-restore-target' : undefined\"",
    ":aria-describedby=\"teamMember ? 'teams-member-reason-target' : workspaceRestore ? 'workspace-restore-target' : undefined\"",
  ],
  [
    '<p v-if="!workspaceRestore">审计原因</p>',
    '<p v-if="!workspaceRestore">{{ teamMember ? "成员关系变更" : "审计原因" }}</p>',
  ],
  ['{{ workspaceRestore ? "关闭" : "×" }}', '{{ workspaceRestore || teamMember ? "关闭" : "×" }}'],
  [
    "      <p v-else>{{ description }}</p>",
    `      <section v-else-if="teamMember" id="teams-member-reason-target">
        <p class="teams-member-target-label">本次操作对象</p>
        <dl>
          <div><dt>团队</dt><dd>{{ teamMember.teamName }}</dd></div>
          <div><dt>成员</dt><dd>{{ teamMember.memberLabel }}</dd></div>
        </dl>
        <p>{{ description }}</p>
      </section>
      <p v-else>{{ description }}</p>`,
  ],
  [
    "          确认提交",
    '          {{ teamMember ? (teamMember.action === "assign" ? "确认分配" : "确认移除") : "确认提交" }}',
  ],
];

export const teamsMemberPanelChanges = [
  [
    '  memberBusy.value = true;\n  memberFeedback.value = "";',
    `  const reasonTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const reasonDialog = reasonTrigger?.closest(".org-admin-center")?.querySelector(".audited-reason-dialog");
  let returnFocus = Boolean(reasonTrigger), memberActionSucceeded = false;
  const trackReasonFocus = (event: FocusEvent) => {
    if (event.target === document.body) return;
    if (event.target !== reasonTrigger && (!(event.target instanceof Node) || !reasonDialog?.contains(event.target))) returnFocus = false;
  };
  document.addEventListener("focusin", trackReasonFocus, true);
  memberBusy.value = true;
  memberFeedback.value = "";`,
  ],
  [
    "    if (succeeded)\n      memberFeedback.value",
    "    memberActionSucceeded = succeeded;\n    if (succeeded)\n      memberFeedback.value",
  ],
  [
    "  } finally {\n    memberBusy.value = false;\n  }",
    `  } finally {
    memberBusy.value = false;
    try {
      await nextTick();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (!memberActionSucceeded && returnFocus &&
          (document.activeElement === document.body || (!reasonDialog?.hasAttribute("open") && reasonDialog?.contains(document.activeElement))) &&
          reasonTrigger?.isConnected && reasonTrigger.getClientRects().length && !reasonTrigger.matches(":disabled")) reasonTrigger.focus();
    } finally {
      document.removeEventListener("focusin", trackReasonFocus, true);
    }
  }`,
  ],
];

function apply(source, changes) {
  let result = source.replaceAll("\r\n", "\n");
  for (const [before, after] of changes) {
    assert.equal(result.split(before).length, 2, `Inspect member reason anchor: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
export const previewTeamsMemberParent = (source) =>
  apply(previewTeamsRecoveryFocus(source), teamsMemberParentChanges);
export const previewTeamsMemberDialog = (source) => apply(source, teamsMemberDialogChanges);
export const previewTeamsMemberPanel = (source) =>
  apply(previewTeamsCreateStates(source), teamsMemberPanelChanges);
