import assert from "node:assert/strict";

export const teamsParentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const teamsReadResultComponent =
  "design-plans/ui-phase-2-2026-09-07/implementation/TeamCreateReadFailure.vue";

function once(source, before, after) {
  assert.equal(source.split(before).length, 2, `Inspect P33 read-result anchor: ${before}`);
  return source.replace(before, after);
}
function section(source, start, end) {
  assert.equal(source.split(start).length, 2);
  assert.equal(source.split(end).length, 2);
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  assert.ok(b > a);
  return source.slice(a, b);
}

export function teamsReadResultChanges(input) {
  const source = input.replaceAll("\r\n", "\n");
  const originalLoad = section(source, "async function load(options:", "function auditPath(");
  let load = once(
    originalLoad,
    "preserveNotice?: boolean",
    'preserveNotice?: boolean; onResult?: (result: "ready" | "failed" | "stale") => void; ownsResult?: () => boolean',
  );
  const stale = "    if (sequence !== loadSequence) return;";
  assert.equal(load.split(stale).length, 3);
  load = load.replaceAll(
    stale,
    '    if (sequence !== loadSequence || (options.ownsResult && !options.ownsResult())) {\n      options.onResult?.("stale");\n      return;\n    }',
  );
  load = once(
    load,
    '      : "empty";\n  } catch',
    '      : "empty";\n    if (currentView === "teams") teamCreateWriteRequestId.value = "";\n    options.onResult?.("ready");\n  } catch',
  );
  load = once(
    load,
    "    rethrowUnexpectedError(error);",
    '    rethrowUnexpectedError(error);\n    options.onResult?.("failed");',
  );

  const originalSubmit = section(source, "async function submit(", "async function inviteMembers(");
  let submit = once(
    originalSubmit,
    "options: { preserveForm?: boolean }",
    'options: { preserveForm?: boolean; ownsResult?: () => boolean; onRefreshResult?: (result: "ready" | "failed" | "stale", writeRequestId: string) => void }',
  );
  submit = once(
    submit,
    "  if (busy.value) return;",
    "  if (busy.value || (options.ownsResult && !options.ownsResult())) return;",
  );
  submit = once(
    submit,
    "      writeRequestId = response.request_id;",
    "      writeRequestId = response.request_id;\n    if (options.ownsResult && !options.ownsResult()) return true;",
  );
  submit = once(
    submit,
    "    await load({ background: true, preserveNotice: true });",
    `    const refreshState = { result: "stale" as "ready" | "failed" | "stale" };
    await load({ background: true, preserveNotice: true, ownsResult: options.ownsResult,
      onResult: (result) => { refreshState.result = result; } });
    if (options.ownsResult && !options.ownsResult()) return true;
    options.onRefreshResult?.(refreshState.result, writeRequestId);
    if (options.onRefreshResult && refreshState.result !== "ready") return true;`,
  );
  submit = once(
    submit,
    "  } catch (error) {\n    applyFailure(",
    "  } catch (error) {\n    if (options.ownsResult && !options.ownsResult()) { rethrowUnexpectedError(error); return false; }\n    applyFailure(",
  );

  const originalCreate = section(
    source,
    "async function createTeam(",
    "async function teamMemberAction(",
  );
  const create = once(
    originalCreate,
    '  const succeeded = await submit("/org/admin/teams", value, "POST", { preserveForm: true });\n  if (succeeded) notice.value = "团队已创建并写入审计。";',
    `  if (busy.value) return false;
  clearTeamCreateFeedback();
  const generation = teamCreateGeneration;
  const ownsResult = () => ownsTeamCreateResult(generation);
  let refreshed = false;
  const succeeded = await submit("/org/admin/teams", value, "POST", {
    preserveForm: true, ownsResult,
    onRefreshResult: (result, writeRequestId) => {
      refreshed = result === "ready";
      if (result === "failed") teamCreateWriteRequestId.value = writeRequestId;
    },
  });
  if (succeeded && refreshed && ownsResult()) notice.value = "团队已创建并写入审计。";`,
  );

  return [
    [
      'import OrganizationTeamPanel from "./OrganizationTeamPanel.vue";',
      'import OrganizationTeamPanel from "./OrganizationTeamPanel.vue";\nimport TeamCreateReadFailure from "../../../../design-plans/ui-phase-2-2026-09-07/implementation/TeamCreateReadFailure.vue";',
    ],
    [
      "  lastReadFailureStatus = ref<number | null>(null),",
      '  lastReadFailureStatus = ref<number | null>(null),\n  teamCreateWriteRequestId = ref(""),',
    ],
    [
      "let loadSequence = 0;",
      `let teamCreateGeneration = 0;
function clearTeamCreateFeedback() {
  teamCreateGeneration += 1;
  teamCreateWriteRequestId.value = "";
}
function ownsTeamCreateResult(generation: number) {
  return generation === teamCreateGeneration && surfaceActive && view.value === "teams";
}
async function reloadTeamCreateResult() {
  if (busy.value || refreshing.value) return;
  const generation = teamCreateGeneration;
  const ownsResult = () => ownsTeamCreateResult(generation);
  if (!ownsResult()) return;
  await load({ background: true, preserveNotice: true, ownsResult, onResult: (result) => {
    if (result === "ready" && ownsResult()) {
      noticeKind.value = "success";
      notice.value = "团队列表已更新。";
    }
  } });
}
let loadSequence = 0;`,
    ],
    [originalLoad, load],
    [originalSubmit, submit],
    [originalCreate, create],
    [
      'watch([() => props.routePath, () => props.organizationId], dismissTokenSecret, { flush: "sync" });',
      'watch([() => props.routePath, () => props.organizationId], () => { dismissTokenSecret(); clearTeamCreateFeedback(); }, { flush: "sync" });',
    ],
    [
      "onDeactivated(() => {\n  surfaceActive = false;\n  dismissTokenSecret();\n});",
      "onDeactivated(() => {\n  surfaceActive = false;\n  dismissTokenSecret();\n  clearTeamCreateFeedback();\n});",
    ],
    [
      "onBeforeUnmount(() => {\n  surfaceActive = false;\n  dismissTokenSecret();\n});",
      "onBeforeUnmount(() => {\n  surfaceActive = false;\n  dismissTokenSecret();\n  clearTeamCreateFeedback();\n});",
    ],
    [
      '      class="org-admin-notice"',
      "      class=\"org-admin-notice\"\n      :class=\"{ 'team-create-read-warning': view === 'teams' && Boolean(teamCreateWriteRequestId) }\"",
    ],
    [
      "      <template v-else\n        >{{ notice }}",
      `      <TeamCreateReadFailure v-else-if="view === 'teams' && teamCreateWriteRequestId"
        :notice="notice" :write-request-id="teamCreateWriteRequestId" :read-request-id="requestId"
        :loading="refreshing" :disabled="busy || refreshing" @reload="reloadTeamCreateResult" />
      <template v-else
        >{{ notice }}`,
    ],
  ];
}

export function previewTeamsReadResult(source) {
  let code = source.replaceAll("\r\n", "\n");
  for (const [before, after] of teamsReadResultChanges(code)) code = once(code, before, after);
  return code;
}
