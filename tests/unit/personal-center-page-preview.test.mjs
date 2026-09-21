import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewAccountShell, previewPersonalCenter } from "../../scripts/lib/personal-center-page-preview.mjs";

test("P11 review templates preserve account request and five-section contracts", async () => {
  const [account, personal] = await Promise.all([
    readFile("apps/web/src/components/AccountShell.vue", "utf8"),
    readFile("apps/web/src/components/PersonalCenter.vue", "utf8"),
  ]);
  const transformedAccount = previewAccountShell(account);
  const transformedPersonal = previewPersonalCenter(personal);
  assert.match(transformedAccount, /query: \{ section: item\.key \}/);
  assert.match(transformedPersonal, /call\("\/me\/profile"/);
  assert.match(transformedPersonal, /expected_version: profile\.value\.version/);
  assert.match(transformedPersonal, /notification-preferences/);
  assert.match(transformedPersonal, /revokeSession\(session\.id\)/);
  assert.match(transformedAccount, /主题与密度/);
  assert.doesNotMatch(transformedPersonal, /免打扰/);
});
