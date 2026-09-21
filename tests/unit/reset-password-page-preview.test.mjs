import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewResetPasswordPage } from "../../scripts/lib/reset-password-page-preview.mjs";

test("P06 preserves token reset submission without exposing its value", async () => {
  const source = previewResetPasswordPage(await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"));
  assert.match(source, /password-reset\/confirm[\s\S]*?new_password/);
  assert.match(source, /token 不展示/);
  assert.match(source, /minlength="12" maxlength="128"/);
  assert.doesNotMatch(source, /\{\{\s*params\.get\('token'\)\s*\}\}/);
});
