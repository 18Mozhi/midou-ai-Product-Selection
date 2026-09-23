import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewLandingPage } from "../../scripts/lib/landing-page-preview.mjs";
const file = "apps/web/src/components/LandingRedirect.vue";
const surfaceFile = "apps/web/src/components/LandingRedirectSurface.vue";
test("P01 C review preserves landing resolution script", async () => {
  const source = await readFile(file, "utf8"),
    reviewed = previewLandingPage(source);
  assert.equal(
    reviewed.slice(0, reviewed.indexOf("<template>")),
    source.slice(0, source.indexOf("<template>")),
  );
  assert.match(reviewed, /<LandingRedirectSurface/);
  assert.match(reviewed, /@retry="resolveLanding"/);
  assert.match(reviewed, /request-id="requestId"/);
});
test("P01 C review separates loading and retry boundaries", async () => {
  const [reviewed, surface] = await Promise.all([
    readFile(file, "utf8").then(previewLandingPage),
    readFile(surfaceFile, "utf8"),
  ]);
  assert.match(reviewed, /<LandingRedirectSurface/);
  assert.match(surface, /state === 'loading' \? 'loading' : 'blocked'/);
  assert.match(surface, /加载时不展示可重复动作/);
  assert.match(
    surface,
    /:primary-label="props\.state === 'loading' \? '正在进入工作台' : '重新检查'"/,
  );
});
