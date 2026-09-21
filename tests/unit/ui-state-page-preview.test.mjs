import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewUiStatePage } from "../../scripts/lib/ui-state-page-preview.mjs";

const file = "apps/web/src/components/UiStateShowcase.vue";
test("P72 C review preserves the state and confirmation script", async () => {
  const source = await readFile(file, "utf8"), reviewed = previewUiStatePage(source);
  assert.equal(reviewed.slice(0, reviewed.indexOf("<template>")), source.slice(0, source.indexOf("<template>")));
  assert.match(reviewed, /@click="selectState\(kind\)"/);
  assert.match(reviewed, /confirmation-text="确认撤销"/);
});
test("P72 C review removes the decorative orbit and keeps the internal boundary", async () => {
  const reviewed = previewUiStatePage(await readFile(file, "utf8"));
  assert.doesNotMatch(reviewed, /state-orbit/);
  assert.match(reviewed, /开发专用 · 无 API \/ 无写入/);
  assert.match(reviewed, /不进入生产构建/);
});
