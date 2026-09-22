import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wizard = await readFile("apps/web/src/components/OrganizationCreationWizard.vue", "utf8");
const parent = await readFile("apps/web/src/components/PlatformAccountCenter.vue", "utf8");

test("P41 production wizard uses the approved identity rail and factual form surface", () => {
  assert.match(wizard, /class="organization-wizard__layout"/);
  assert.match(wizard, /class="organization-wizard__identity"/);
  assert.match(wizard, /class="organization-wizard__content"/);
  assert.match(wizard, /class="organization-wizard__progress"/);
  assert.match(wizard, /class="organization-wizard__actions"/);
});

test("P41 accessible labels and help preserve the existing organization fields", () => {
  assert.match(wizard, /aria-label="组织名称"/);
  assert.match(wizard, /aria-describedby="p41-name-help"/);
  assert.match(wizard, /aria-label="组织标识"/);
  assert.match(wizard, /pattern="\[a-z0-9\]\(\?:\[a-z0-9\]\|-\)\{1,62\}"/);
  assert.match(wizard, /aria-label="首位组织管理员"/);
  assert.match(wizard, /item\.status !== 'active'/);
  assert.match(wizard, /class="organization-wizard__error" role="alert"/);
});

test("P41 pending creation remains bound to the open route while the sent write continues", () => {
  assert.match(parent, /const createOrganizationOwner = useUserCreationOwner\(/);
  assert.match(parent, /const isCurrent = createOrganizationOwner\.capture\(\);/);
  assert.match(parent, /\(value\) => isCurrent\(\) && \(createError\.value = value\)/);
  assert.match(parent, /if \(created && isCurrent\(\)\)/);
});
