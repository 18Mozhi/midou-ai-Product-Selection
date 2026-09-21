import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewMfaPage } from "../../scripts/lib/mfa-page-preview.mjs";

test("P07 preserves MFA request actions and does not invent secret utilities", async () => {
  const source = previewMfaPage(await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"));
  assert.match(source, /loadMfa[\s\S]*?"\/me\/mfa"/);
  assert.match(source, /startMfa[\s\S]*?"\/me\/mfa\/totp\/enrollment"/);
  assert.match(source, /confirmMfa[\s\S]*?"\/me\/mfa\/totp\/confirm"/);
  assert.match(source, /disableMfa[\s\S]*?"\/me\/mfa\/totp"/);
  assert.match(source, /当前密码[\s\S]*?v-model="currentPassword"/);
  assert.doesNotMatch(source, /@click="(?:copy|download)/i);
});
