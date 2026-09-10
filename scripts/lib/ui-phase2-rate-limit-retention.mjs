import assert from "node:assert/strict";

export const rateLimitBaseline = "d2d566c2fceeef6ab1754f409475e2cf7582b8ef";
export const rateLimitParent = "apps/web/src/components/OrganizationAdminCenter.vue";
export const rateLimitCard = "apps/web/src/components/OrganizationApprovalFirstFailure.vue";
const lf = (s) => s.replaceAll("\r\n", "\n");
export function assertRateLimitPresentationDelta(before, after) {
  let parent = lf(after[rateLimitParent]);
  const expanded = `      view === 'approvals' &&
      !data &&
      ((state === 'error' && lastReadFailureStatus === 500) ||
        (state === 'rate_limited' && lastReadFailureStatus === 429))`;
  assert.equal(parent.split(expanded).length, 2);
  parent = parent.replace(
    expanded,
    "      view === 'approvals' && state === 'error' && !data && lastReadFailureStatus === 500",
  );
  const branch = `      <template
        v-else-if="
          view === 'approvals' && state === 'rate_limited' && !data && lastReadFailureStatus === 429
        "
      >
        <OrganizationApprovalFirstFailure
          title="请求过于频繁"
          :notice="notice"
          :request-id="requestId"
          @reload="load()"
        />
        <span class="org-approval-first-failure-legacy">
          {{ notice }} <code v-if="requestId">{{ requestId }}</code>
        </span>
      </template>
`;
  assert.equal(parent.split(branch).length, 2, "Missing or duplicated approved rate-limit branch");
  parent = parent.replace(branch, "");
  assert.equal(
    parent,
    lf(before[rateLimitParent]),
    "Unrelated parent business/presentation change",
  );
  let card = lf(after[rateLimitCard]);
  for (const [from, to] of [
    [
      "defineProps<{ notice: string; requestId: string; title?: string }>();",
      "defineProps<{ notice: string; requestId: string }>();",
    ],
    ['    <h3>{{ title || "组织后台暂不可用" }}</h3>', "    <h3>组织后台暂不可用</h3>"],
  ]) {
    assert.equal(card.split(from).length, 2);
    card = card.replace(from, to);
  }
  assert.equal(
    card,
    lf(before[rateLimitCard]),
    "Only optional rate-limit title may change shared card",
  );
}
