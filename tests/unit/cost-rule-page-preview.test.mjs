import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P22 makes rule activation distinct from per-opportunity cost approval", async () => {
  const source = await readFile("apps/web/src/components/CostRuleConsole.vue", "utf8");
  assert.match(source, /当前启用 \$\{activeCostRule\.value\.version_code\}/);
  assert.match(source, /商品成本可由双人复核或高置信爬虫证据形成/);
  assert.match(source, /不使用默认费用/);
});

test("P22 retains explicit rule states and server-side action transitions", async () => {
  const source = await readFile("apps/web/src/components/CostRuleConsole.vue", "utf8");
  assert.match(source, /pending_approval: "待审批"/);
  assert.match(source, /expected_revision: selected\.value\.revision/);
  assert.match(source, /action: currentAction\.action/);
});
