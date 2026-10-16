import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P31 review retains distinct RBAC and resource-grant boundaries", async () => {
  const [source, parent] = await Promise.all([
    readFile("apps/web/src/components/OrganizationRolePanel.vue", "utf8"),
    readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8"),
  ]);
  for (const item of [
    "请在“成员与邀请”中分配角色。",
    "从资源详情页复制 UUID",
    "resource-grants",
    "expected_version",
  ])
    assert.ok(`${source}\n${parent}`.includes(item), item);
});
