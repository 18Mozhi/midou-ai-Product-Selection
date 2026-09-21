import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P31 review retains distinct RBAC and resource-grant boundaries", async () => {
  const [source, parent] = await Promise.all([
    readFile("apps/web/src/components/OrganizationRolePanel.vue", "utf8"),
    readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8"),
  ]);
  for (const item of [
    "角色分配在“成员与邀请”页完成",
    "从资源详情页复制 UUID",
    "resource-grants",
    "expected_version",
  ])
    assert.ok(`${source}\n${parent}`.includes(item), item);
});
