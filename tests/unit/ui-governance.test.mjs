import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("UI governance keeps responsive, status, dialog and error boundaries shared", async () => {
  const [main, responsive, accessibility, statusLabels, apiClient, routeCatalog, shell] =
    await Promise.all(
      [
        "apps/web/src/main.ts",
        "apps/web/src/responsive-baselines.css",
        "apps/web/src/accessibility.css",
        "apps/web/src/ui/status-labels.ts",
        "apps/web/src/api-client.ts",
        "apps/web/src/route-catalog.ts",
        "apps/web/src/components/NavigationShell.vue",
      ].map((path) => readFile(path, "utf8")),
    );
  assert.match(main, /responsive-baselines\.css/);
  for (const width of [390, 768, 1024, 1440]) assert.match(responsive, new RegExp(String(width)));
  assert.match(responsive, /safe-area-inset-bottom/);
  assert.match(accessibility, /--so-touch-target:\s*44px/);
  assert.match(statusLabels, /statusLabel/);
  assert.match(apiClient, /rethrowUnexpectedError/);
  assert.match(routeCatalog, /surface[\s\S]*cachePolicy/);
  assert.match(shell, /selectedSurfaceComponent[\s\S]*surfaceCacheKey/);
  for (const stylesheet of [
    "apps/web/src/styles.css",
    "apps/web/src/styles/access-governance.css",
    "apps/web/src/styles/onboarding-navigation.css",
    "apps/web/src/styles/platform-operations.css",
  ]) {
    const source = await readFile(stylesheet, "utf8");
    assert.ok(source.split(/\r?\n/u).length < 1_500, `${stylesheet} must stay bounded`);
  }

  const componentFiles = (await readdir("apps/web/src/components", { recursive: true }))
    .filter((path) => path.endsWith(".vue"))
    .map((path) => `apps/web/src/components/${path.replaceAll("\\", "/")}`);
  const componentSource = (
    await Promise.all(componentFiles.map((path) => readFile(path, "utf8")))
  ).join("\n");
  assert.doesNotMatch(componentSource, /window\.prompt|\bprompt\s*\(/);
  assert.doesNotMatch(componentSource, /catch\s*(?:\([^)]*\))?\s*\{\s*\}/);
});
