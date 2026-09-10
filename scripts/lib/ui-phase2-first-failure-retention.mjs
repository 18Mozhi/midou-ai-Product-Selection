import assert from "node:assert/strict";

export const firstFailureBaseline = "d815f74b57bfdb5eb7ea514098fd948d129c8133";
export const firstFailureParent = "apps/web/src/components/OrganizationAdminCenter.vue";
export function assertFirstFailureParentDelta(previous, current) {
  const lf = (s) => s.replaceAll("\r\n", "\n");
  let reverted = lf(current);
  for (const fragment of [
    'import OrganizationApprovalFirstFailure from "./OrganizationApprovalFirstFailure.vue";\n',
    "  lastReadFailureStatus = ref<number | null>(null),\n",
    "    lastReadFailureStatus.value = failure?.status ?? null;\n",
    "    :data-approval-first-failure=\"\n      view === 'approvals' && state === 'error' && !data && lastReadFailureStatus === 500\n    \"\n",
  ]) {
    assert.equal(
      reverted.split(fragment).length,
      2,
      "Missing or duplicated approved presentation delta",
    );
    reverted = reverted.replace(fragment, "");
  }
  const start = reverted.indexOf(
    "      <template\n        v-if=\"view === 'approvals' && state === 'error' && !data && lastReadFailureStatus === 500\"",
  );
  const end = reverted.indexOf("\n    </div>\n    <section v-if=\"state === 'loading'\"", start);
  assert.ok(start > 0 && end > start, "Missing scoped notice composition");
  const expected = `      <template
        v-if="view === 'approvals' && state === 'error' && !data && lastReadFailureStatus === 500"
      >
        <OrganizationApprovalFirstFailure
          :notice="notice"
          :request-id="requestId"
          @reload="load()"
        />
        <span class="org-approval-first-failure-legacy">
          {{ notice }} <code v-if="requestId">{{ requestId }}</code>
        </span>
      </template>
      <template v-else
        >{{ notice }} <code v-if="requestId">{{ requestId }}</code></template
      >`;
  assert.equal(
    reverted.slice(start, end),
    expected,
    "Only the reviewed notice composition is permitted",
  );
  reverted =
    reverted.slice(0, start) +
    '      {{ notice }} <code v-if="requestId">{{ requestId }}</code>' +
    reverted.slice(end);
  assert.equal(
    reverted,
    lf(previous),
    "Unrelated parent business/template changes forbid source refresh",
  );
}
