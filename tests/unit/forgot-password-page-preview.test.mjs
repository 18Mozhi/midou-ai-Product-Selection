import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewForgotPasswordPage } from "../../scripts/lib/forgot-password-page-preview.mjs";
test("P04 C review preserves generic recovery request", async () => {
  const review = previewForgotPasswordPage(
    await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"),
  );
  assert.match(review, /request\("\/auth\/password-reset\/request",[\s\S]*?email: email\.value/);
  assert.match(review, /如账号存在，重置邮件会进入受控投递队列/);
  assert.match(review, /v-model="email"[\s\S]*?type="email"/);
});
