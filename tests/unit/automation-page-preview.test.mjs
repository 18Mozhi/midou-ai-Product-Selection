import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P27 review skin leaves actual automation operations in the production component", async () => {
  const source = await readFile("apps/web/src/components/AutomationRuleCenter.vue", "utf8");
  for (const path of ["/automations", "/automations/preview", "/tasks/member-options", "/actions"])
    assert.ok(source.includes(path), path);
});
