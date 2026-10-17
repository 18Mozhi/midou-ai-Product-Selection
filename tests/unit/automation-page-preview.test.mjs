import { readArchivedAutomationSource } from "../../scripts/lib/retired-automation-surface.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P27 historical review retains capture-era automation operations without a production component", async () => {
  const source = readArchivedAutomationSource("apps/web/src/components/AutomationRuleCenter.vue");
  for (const path of ["/automations", "/automations/preview", "/tasks/member-options", "/actions"])
    assert.ok(source.includes(path), path);
});
