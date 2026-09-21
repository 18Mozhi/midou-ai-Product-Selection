import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewThemePage } from "../../scripts/lib/theme-page-preview.mjs";

test("P10 review preserves theme persistence and session-only density", async () => {
  const source = previewThemePage(
    await readFile("apps/web/src/components/ThemeStudio.vue", "utf8"),
  );
  assert.match(source, /request<Preference>\("\/me\/ui-preferences"/);
  assert.match(source, /expected_version/);
  assert.match(source, /chooseDensity\(density\.id\)/);
  assert.match(source, /密度只在当前会话生效/);
  assert.match(source, /state==='conflict'/);
  assert.match(source, /刷新最新偏好后重新选择/);
  assert.doesNotMatch(source, /自动覆盖/);
});
