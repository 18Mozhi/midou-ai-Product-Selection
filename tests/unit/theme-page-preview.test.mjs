import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewThemePage } from "../../scripts/lib/theme-page-preview.mjs";

test("P10 review directly mounts the production C Vue without replacing its template", async () => {
  const source = previewThemePage(
    await readFile("apps/web/src/components/ThemeStudio.vue", "utf8"),
  );
  assert.match(source, /request<Preference>\("\/me\/ui-preferences"/);
  assert.match(source, /expected_version/);
  assert.match(source, /chooseDensity\(\$event\)/);
  assert.match(source, /仅在当前会话生效/);
  assert.match(source, /state === "conflict"/);
  assert.match(source, /preference_scope_required/);
  assert.match(source, /PreferenceRadioGroup/);
  assert.match(source, /此期间选择已锁定/);
  assert.doesNotMatch(source, /自动覆盖/);
});
