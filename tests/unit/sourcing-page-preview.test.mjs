import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P21 does not turn missing supplier facts into confirmed quotes", async () => {
  const [source, dialogs, offers] = await Promise.all([
    readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/SourcingWorkspaceDialogs.vue", "utf8"),
    readFile("apps/web/src/components/SupplierOfferList.vue", "utf8"),
  ]);
  assert.match(source, /sourcing-pending[\s\S]*pendingMessage/);
  assert.match(source, /尚未取得供应商报价/);
  assert.match(offers, /待费用规则计算/);
  assert.match(dialogs, /确认依据证据（可搜索）[\s\S]*v-model="quote\.evidence_id"[\s\S]*required/);
});

test("P21 keeps comparison boundaries on actual confirmed quote state and retires procurement", async () => {
  const [workspace, logic] = await Promise.all([
    readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8"),
    readFile("apps/web/src/composables/useSourcingWorkspace.ts", "utf8"),
  ]);
  assert.match(workspace, /selectedQuotes\.length < 2 \|\| busy/);
  assert.match(workspace, /至少再选一家才能对比/);
  assert.match(logic, /if \(!candidate\.quote\) return;/);
  assert.match(logic, /selectedQuotes\.value\.length < 5/);
  assert.doesNotMatch(
    logic,
    /purchaseCandidate|purchaseForm|openPurchase|closePurchase|sourcing\/purchase-tasks/,
  );
  assert.doesNotMatch(workspace, /创建采购任务|openPurchase|purchase-candidate/);
});
