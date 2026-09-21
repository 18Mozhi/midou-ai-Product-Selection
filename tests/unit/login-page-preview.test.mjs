import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewLoginPage } from "../../scripts/lib/login-page-preview.mjs";

test("P02 C review preserves LocalIdentity safety script", async () => {
  const source = await readFile("apps/web/src/components/LocalIdentity.vue", "utf8");
  const review = previewLoginPage(source);
  assert.match(review, /mfa_required[\s\S]*?mode\.value = "mfa-challenge"/);
  assert.match(review, /security_setup\?\.required[\s\S]*?mode\.value = "security-setup"/);
  assert.match(review, /request<LoginResult>\("\/auth\/login"/);
  assert.match(review, /request<\{ route: string \}>\("\/me\/landing", undefined, "GET"/);
});

test("P02 C review exposes source-bound login, challenge and seed steps", async () => {
  const source = await readFile("apps/web/src/components/LocalIdentity.vue", "utf8");
  const review = previewLoginPage(source);
  assert.match(review, /v-model="identifier"[\s\S]*?autocomplete="username"/);
  assert.match(review, /认证器验证码或恢复码[\s\S]*?v-model="mfaCode"/);
  assert.match(review, /securitySetup\.must_change_password[\s\S]*?changeSeedPassword/);
  assert.match(review, /requestState === 'loading'/);
});
