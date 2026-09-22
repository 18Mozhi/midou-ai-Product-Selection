import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parent = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
const panel = await readFile("apps/web/src/components/OrganizationTokenPanel.vue", "utf8");

test("P36 production route owns an explicit C scope", () => {
  assert.match(parent, /org-admin-center--token-review': view === 'tokens'/);
});

test("P36 reading order keeps lifecycle evidence before safety and creation", () => {
  const ledger = panel.indexOf('class="org-token-ledger"');
  const truth = panel.indexOf('class="org-token-truth"');
  const create = panel.indexOf('class="org-token-create"');

  assert.ok(ledger >= 0, "lifecycle ledger is present");
  assert.ok(truth > ledger, "safety boundary follows the ledger");
  assert.ok(create > truth, "creation form follows the safety boundary");
  assert.equal((panel.match(/class="org-token-truth"/g) ?? []).length, 1);
});

test("P36 keeps token action and one-time secret contracts in the production panel", () => {
  assert.match(panel, /createToken: \(value: CreateTokenInput\)/);
  assert.match(panel, /performTokenAction: \(item: any, action: "rotate" \| "revoke"\)/);
  assert.match(panel, /navigator\.clipboard\.writeText\(secret\)/);
  assert.match(panel, /maxlength="500"/);
});
