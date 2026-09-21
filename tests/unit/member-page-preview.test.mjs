import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P30 review retains invitation and directory contracts", async () => {
  const center = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
  const panel = await readFile("apps/web/src/components/OrganizationMemberPanel.vue", "utf8");
  for (const item of [
    "/org/admin/members",
    "/org/admin/invitations",
    "邮件服务尚未配置时",
    "expected_version: item.version",
  ])
    assert.ok(`${center}\n${panel}`.includes(item), item);
});
