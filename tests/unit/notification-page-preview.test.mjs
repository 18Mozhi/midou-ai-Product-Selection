import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("P26 keeps notification read and workflow contracts", async () => {
  const s = await readFile("apps/web/src/components/NotificationCenter.vue", "utf8");
  assert.match(s, /\/notifications\/summary/);
  assert.match(s, /action: "read",\s*expected_version: detail\.version/);
  assert.match(s, /email_enabled: false/);
  assert.match(s, /action, expected_version: detail\.version/);
  assert.match(s, /errorChannel: "page" \| "detail" \| "preferences"/);
  assert.match(s, /role="alert"[\s\S]*aria-live="assertive"/);
  assert.match(s, /:aria-describedby="detailError \?/);
  assert.match(s, /:aria-describedby="preferencesError \?/);
  assert.equal((s.match(/\{ trapFocus: true \}/g) ?? []).length, 2);
});

test("current page preview verifies Vue without historical CSS injection", async () => {
  const cli = await readFile("scripts/verify-notification-page-preview.mjs", "utf8");
  assert.match(cli, /@playwright\/test\/cli/);
  assert.match(cli, /m05-03-notifications/);
  assert.doesNotMatch(cli, /PagePlugin|createServer|addStyleTag|implementation\//);
});
