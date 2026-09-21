import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewRegisterPage } from "../../scripts/lib/register-page-preview.mjs";

test("P03 C review preserves register payload and pending-verification transition", async () => {
  const review = previewRegisterPage(await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"));
  assert.match(review, /password\.value !== confirmPassword\.value[\s\S]*?return;/);
  assert.match(review, /request\("\/auth\/register", \{[\s\S]*?email: email\.value,[\s\S]*?password: password\.value/);
  assert.match(review, /mode\.value = "verify"[\s\S]*?验证邮件已进入受控投递队列/);
});
test("P03 C review binds three fields and keeps confirmation out of its request", async () => {
  const review = previewRegisterPage(await readFile("apps/web/src/components/LocalIdentity.vue", "utf8"));
  assert.match(review, /v-model="email"[\s\S]*?type="email"/);
  assert.match(review, /不会提交到服务端[\s\S]*?v-model="confirmPassword"/);
  assert.match(review, /@click="switchMode\('login'\)"/);
});
