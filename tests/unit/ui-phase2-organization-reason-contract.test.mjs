import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertOrganizationReasonContract } from "../../scripts/lib/ui-phase2-organization-reason-contract.mjs";

const dialog = readFileSync("apps/web/src/components/AuditedReasonDialog.vue", "utf8");
const parent = readFileSync("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");

test("P30/P36 actual Vue renders no caller/default cap while preserving an explicit optional cap", async () => {
  assert.deepEqual(await assertOrganizationReasonContract(dialog, parent), {
    defaultMaximum: null,
    explicitMaximum: 500,
    minimum: 2,
    required: true,
  });
});

for (const [label, mutate, expected] of [
  [
    "static cap",
    (s) => s.replace(':maxlength="maximumLength"', 'maxlength="500"'),
    /default reason maxlength/,
  ],
  [
    "template fallback",
    (s) => s.replace(':maxlength="maximumLength"', ':maxlength="maximumLength ?? 500"'),
    /default reason maxlength/,
  ],
  [
    "prop default",
    (s) =>
      s
        .replace("const props = defineProps<", "const props = withDefaults(defineProps<")
        .replace("}>();", "}>(), { maximumLength: 500 });"),
    /default reason maxlength/,
  ],
  [
    "lost explicit cap",
    (s) => s.replace(':maxlength="maximumLength"', ""),
    /explicit optional reason limit/,
  ],
]) {
  test(`reason contract rejects ${label} without changing production`, async () => {
    const changed = mutate(dialog);
    assert.notEqual(changed, dialog);
    await assert.rejects(() => assertOrganizationReasonContract(changed, parent), expected);
  });
}

for (const [label, addition, expected] of [
  ["static caller cap", 'maximum-length="500"', /caller imposes/],
  ["bound caller cap", ':maximum-length="500"', /caller imposes/],
  ["opaque forwarding", 'v-bind="options"', /opaque reason caller/],
  ["dynamic forwarding", 'v-bind:[field]="500"', /opaque reason caller/],
]) {
  test(`reason contract rejects ${label}`, async () => {
    const changed = parent.replace("<AuditedReasonDialog", `<AuditedReasonDialog ${addition}`);
    assert.notEqual(changed, parent);
    await assert.rejects(() => assertOrganizationReasonContract(dialog, changed), expected);
  });
}
