import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("apps/web/src/components/ProviderSourceCenter.vue", "utf8");

test("P48 cancels only active catalog and compatibility reads on actual Vue unmount", () => {
  const unmount = source.match(/onBeforeUnmount\(\(\) => \{([\s\S]*?)\n\}\);/)?.[1] ?? "",
    catalogRead =
      source.match(
        /async function load\([\s\S]*?(?=\nfunction setConfigurationSaveFeedback)/,
      )?.[0] ?? "",
    compatibilityRead =
      source.match(/async function loadCompatibility\([\s\S]*?(?=\nonMounted\(load\))/)?.[0] ?? "",
    probeWrite =
      source.match(/async function testSource\([\s\S]*?(?=\nfunction closeCompatibility)/)?.[0] ??
      "";

  assert.match(source, /const sourceReadControllers = new Set<AbortController>\(\)/);
  assert.match(unmount, /for \(const controller of sourceReadControllers\) controller\.abort\(\)/);
  assert.match(unmount, /sourceReadControllers\.clear\(\)/);
  assert.match(catalogRead, /sourceReadControllers\.add\(controller\)/);
  assert.match(catalogRead, /sourceReadControllers\.delete\(controller\)/);
  assert.match(compatibilityRead, /sourceReadControllers\.add\(controller\)/);
  assert.match(compatibilityRead, /sourceReadControllers\.delete\(controller\)/);
  assert.match(compatibilityRead, /signal:\s*controller\.signal/);
  assert.doesNotMatch(probeWrite, /AbortController|signal\s*:/);
});
