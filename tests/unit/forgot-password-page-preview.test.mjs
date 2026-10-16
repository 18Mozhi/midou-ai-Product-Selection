import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewForgotPasswordPage } from "../../scripts/lib/forgot-password-page-preview.mjs";
test("P04 C review preserves generic recovery request", async () => {
  const review = previewForgotPasswordPage(
    await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"),
  );
  assert.match(review, /request\("\/auth\/password-reset\/request",[\s\S]*?email: email\.value/);
  assert.match(review, /请求已受理。若该邮箱已注册，请留意重置说明。/);
  assert.match(review, /v-model="email"[\s\S]*?type="email"/);
});
