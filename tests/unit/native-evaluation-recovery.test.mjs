import test from "node:test";
import assert from "node:assert/strict";
import {
  supplyClassifierNativeRecoverySql, recoverSupplyClassifierEvaluations,
} from "../../apps/worker/dist/automatic-selection-classifier-recovery.js";
import {
  deviceFitNativeRecoverySql, recoverDeviceFitEvaluations,
} from "../../apps/worker/dist/automatic-selection-device-fit-recovery.js";
import {
  skippedSelectionNativeRecoverySql, recoverSkippedSelectionEvaluations,
} from "../../apps/worker/dist/automatic-selection-skipped-recovery.js";
import {
  primarySourceNativeRecoverySql, recoverPrimarySourceEvaluations,
} from "../../apps/worker/dist/primary-source-support-recovery.js";

for (const [queries, recover] of [
  [supplyClassifierNativeRecoverySql, recoverSupplyClassifierEvaluations],
  [deviceFitNativeRecoverySql, recoverDeviceFitEvaluations],
  [skippedSelectionNativeRecoverySql, recoverSkippedSelectionEvaluations],
  [primarySourceNativeRecoverySql, recoverPrimarySourceEvaluations],
]) {
  test(recover.name + " uses the same sealed lineage before scan and point recheck", async () => {
    for (const sql of [queries.candidates, queries.update]) {
      assert.doesNotMatch(sql, /\bn_primary(?:_current)?\.(organization_id|workspace_id)|uq_normalized_scope_record_version/);
      assert.match(sql, /ao.account_id=cut.primary_account_id/);
      assert.match(sql, /seed_e.account_id=ao.account_id/);
      assert.match(sql, /active_t.workspace_id=seed_t.workspace_id/);
      assert.match(sql, /g.status='active'.*w.status='active'/);
    }
    assert.match(queries.candidates, /ao.account_id=scan_owner.account_id/);
    assert.match(queries.update, /ao.account_id=\?/);
    let writes = 0;
    const count = await recover({
      async query(sql, args) {
        if (sql === queries.candidates) return [[{opportunity_id:"op",organization_id:"org",workspace_id:"ws",account_id:"owner"}]];
        assert.equal(sql, queries.update);
        assert.equal(args.at(-1), "owner");
        writes++;
        return [{affectedRows:0}];
      },
    }, new Date("2026-10-15T00:00:00Z"), true);
    assert.equal(writes, 1);
    assert.equal(count, 0);
  });
}
