import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("P29 review skin retains profile versioned save", async () => {
  const s = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
  for (const item of [
    "/org/admin/profile",
    "expected_version: data.version",
    "/org/admin/summary",
    "/org/admin/workspaces",
  ])
    assert.ok(s.includes(item), item);
});
