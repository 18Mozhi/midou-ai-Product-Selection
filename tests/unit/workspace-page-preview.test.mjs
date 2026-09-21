import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P32 review retains workspace governance actions and default protection", async () => {
  const source = await readFile("apps/web/src/components/OrganizationWorkspacePanel.vue", "utf8");
  for (const item of [
    "默认工作区不可归档",
    "创建并写入审计",
    "performWorkspaceAction",
    "必须先在组织资料中更换默认项",
  ])
    assert.ok(source.includes(item), item);
});
