import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewNotFoundPage } from "../../scripts/lib/not-found-page-preview.mjs";

const file = "apps/web/src/components/NotFoundPage.vue";
test("P73 uses the actual Vue composition for C review", async () => {
  const source = await readFile(file, "utf8"),
    reviewed = previewNotFoundPage(source);
  assert.equal(reviewed, source);
  assert.match(reviewed, /:to="recentDestination.fullPath"/);
  assert.match(reviewed, /ref="heading" tabindex="-1"/);
});
test("P73 C view removes old orbital decoration", async () => {
  const reviewed = previewNotFoundPage(await readFile(file, "utf8"));
  const template = reviewed.slice(
    reviewed.indexOf("<template>"),
    reviewed.lastIndexOf("</template>"),
  );
  assert.doesNotMatch(template, /not-found-orbit|not-found-satellite/);
  assert.match(template, /公开兜底 \/ 不读业务数据/);
  assert.match(reviewed, /<style scoped>/);
});
