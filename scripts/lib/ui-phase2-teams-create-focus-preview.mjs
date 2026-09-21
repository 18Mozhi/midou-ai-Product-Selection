import assert from "node:assert/strict";
import { previewTeamsVue } from "./ui-phase2-teams-vue-preview.mjs";

export const teamsCreateFocusChanges = [
  [
    'import { computed, ref, watch } from "vue";',
    'import { computed, nextTick, ref, watch } from "vue";',
  ],
  [
    "  createOpen = ref(false),",
    `  createOverviewTrigger = ref<HTMLButtonElement | null>(null),
  createForm = ref<HTMLFormElement | null>(null),
  createTrigger = ref<HTMLButtonElement | null>(null),
  createOpen = ref(false),`,
  ],
  [
    `function openCreate() {
  createOpen.value = true;
  window.requestAnimationFrame(() =>
    document.querySelector<HTMLInputElement>("#team-name")?.focus(),
  );
}`,
    `function openCreate(event?: Event) {
  createTrigger.value = event?.currentTarget instanceof HTMLButtonElement
    ? event.currentTarget : createOverviewTrigger.value;
  createOpen.value = true;
  window.requestAnimationFrame(() =>
    createForm.value?.querySelector<HTMLInputElement>("#team-name")?.focus(),
  );
}`,
  ],
  [
    `function cancelCreate() {
  if (createBusy.value) return;
  form.value = { name: "", lead_membership_id: "", default_workflow_key: "", reason: "" };
  createOpen.value = false;
}`,
    `function cancelCreate() {
  if (createBusy.value) return;
  const restoreFocus = createForm.value?.contains(document.activeElement);
  form.value = { name: "", lead_membership_id: "", default_workflow_key: "", reason: "" };
  createOpen.value = false;
  void nextTick(() => {
    if (!restoreFocus || document.activeElement !== document.body) return;
    const trigger = createTrigger.value?.isConnected
      ? createTrigger.value : createOverviewTrigger.value;
    if (trigger?.isConnected && !trigger.disabled) trigger.focus();
  });
}`,
  ],
  [
    '<button type="button" :disabled="busy" @click="openCreate">新建团队</button>',
    '<button ref="createOverviewTrigger" type="button" :disabled="busy" :aria-expanded="createOpen" :aria-controls="createOpen ? \'p33-create-form\' : undefined" @click="openCreate">新建团队</button>',
  ],
  [
    '<form v-if="createOpen" class="org-team-create" @submit.prevent="submitCreate">',
    '<form v-if="createOpen" id="p33-create-form" ref="createForm" class="org-team-create" @submit.prevent="submitCreate">',
  ],
  [
    '<button v-else type="button" @click="openCreate">创建团队</button>',
    '<button v-else type="button" :aria-expanded="createOpen" :aria-controls="createOpen ? \'p33-create-form\' : undefined" @click="openCreate">创建团队</button>',
  ],
];

// Local C preview only. No focus trap: creation remains an inline form, not a modal.
export function previewTeamsCreateFocus(source) {
  let result = previewTeamsVue(source);
  for (const [before, after] of teamsCreateFocusChanges) {
    assert.equal(result.split(before).length, 2, `Inspect P33 creation focus anchor: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
