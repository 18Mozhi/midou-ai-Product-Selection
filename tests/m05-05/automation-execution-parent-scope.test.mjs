import assert from "node:assert/strict";
import test from "node:test";
import { AutomationWorker } from "../../apps/worker/dist/automation-worker.js";

test("discovery and claim preserve rule and notification links without changing scheduler predicates", async () => {
  for (const fields of [[], ["organization_id", "workspace_id"], ["organization_id"]]) {
    const calls = [];
    const record = async (sql, args) => {
      if (sql.startsWith("SHOW COLUMNS FROM notifications")) return [["organization_id","workspace_id","recipient_id","source_event_id"].map(Field => ({ Field }))];
      calls.push([sql, args]); return [[]];
    };
    const connection = {
      query: record, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    };
    const worker = new AutomationWorker({
      async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM automation_rules ")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        if (sql.startsWith("SHOW COLUMNS FROM notifications")) return [["organization_id","workspace_id","recipient_id","source_event_id"].map(Field => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS")) return [fields.map((Field) => ({ Field }))];
        return record(sql, args);
      },
      async getConnection() { return connection; },
    }, "fixture", 120, 3);
    if (fields.length === 1) {
      await assert.rejects(worker.processOnce(), /partial_inherited_scope_schema:automation_executions/);
      assert.equal(calls.length, 0);
      continue;
    }
    assert.deepEqual(await worker.processOnce(), { status: "idle" });
    const [[discover, params], [claim]] = calls;
    assert.match(discover, /n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id/);
    assert.match(discover, /ORDER BY n.created_at LIMIT 100/);
    assert.equal(discover.includes("id,organization_id,workspace_id,rule_id"), fields.length === 2);
    assert.equal(params.length, 3);
    assert.match(claim, /status IN \('queued','retry_scheduled'\)/);
    assert.match(claim, /lease_expires_at<=\?/);
    if (!fields.length) {
      assert.match(claim, /JOIN automation_rules r ON r.id=x.rule_id/);
      assert.match(claim, /JOIN notifications n ON n.id=x.notification_id AND n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id/);
      assert.match(claim, /ORDER BY x.available_at,x.id LIMIT 1 FOR UPDATE/);
    }
  }
});
