import assert from "node:assert/strict";
import { previewTeamsCreateFocus } from "./ui-phase2-teams-create-focus-preview.mjs";

export const teamsCreateStatesCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/teams-create-states-c.css";
export const teamsCreateStatesChanges = [
  [
    '<form v-if="createOpen" id="p33-create-form"',
    '<p v-if="createBusy" class="teams-create-progress" role="status">正在创建团队，请等待本次请求完成。</p>\n    <form v-if="createOpen" :aria-busy="createBusy" id="p33-create-form"',
  ],
  ['id="team-name"', 'id="team-name" aria-describedby="p33-name-help"'],
  ['id="team-lead"', 'id="team-lead" aria-describedby="p33-lead-help"'],
  ['id="team-workflow"', 'id="team-workflow" aria-describedby="p33-workflow-help"'],
  ['id="team-reason"', 'id="team-reason" aria-describedby="p33-reason-help"'],
  ["<small>{{ form.name.length }}/120", '<small id="p33-name-help">{{ form.name.length }}/120'],
  [
    "<small>负责人创建后会自动成为团队成员</small>",
    '<small id="p33-lead-help">负责人创建后会自动成为团队成员</small>',
  ],
  [
    "<small\n            >{{ form.default_workflow_key.length }}/80",
    '<small id="p33-workflow-help"\n            >{{ form.default_workflow_key.length }}/80',
  ],
  [
    "<small>{{ form.reason.length }}/500",
    '<small id="p33-reason-help">{{ form.reason.length }}/500',
  ],
];

// Accessible state metadata only: no field limits, write logic or parent feedback changes.
export function previewTeamsCreateStates(source) {
  let code = previewTeamsCreateFocus(source);
  for (const [before, after] of teamsCreateStatesChanges) {
    assert.equal(code.split(before).length, 2, `Inspect P33 create-state anchor: ${before}`);
    code = code.replace(before, after);
  }
  return code;
}
