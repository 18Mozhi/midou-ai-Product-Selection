import assert from "node:assert/strict";
import test from "node:test";
import { projectBusinessTaskOnce } from "../../apps/worker/dist/business-task-projection-worker.js";

for (const threshold of [false, true]) test(`normalized competitor delivery uses exact parents (threshold=${threshold})`, async () => {
  const calls = [];
  const changeId = "00000000-0000-4000-8000-000000000021";
  const event = {
    id: "event", aggregate_id: "competitor",
    event_type: threshold ? "competitor.threshold.triggered" : "competitor.collection.scheduled",
    organization_id: "parent-org", workspace_id: "parent-workspace",
    payload_json: JSON.stringify(threshold ? { change_id: changeId } : {}),
    created_by: "original-owner",
    source_request_id: "original-request", source_trace_id: "original-trace",
  };
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params) {
      calls.push([sql, params]);
      if (sql.startsWith("SHOW COLUMNS FROM tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM competitors")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.startsWith("SELECT o.*")) return [[event]];
      if (sql.startsWith("SELECT id FROM tasks")) return [[{ id: "validation-task" }]];
      return [[]];
    },
  };
  const result = await projectBusinessTaskOnce({ getConnection: async () => connection }, "test", 10);
  assert.deepEqual(result, { status: "projected", event_id: event.id, ...(threshold ? { taskId: "validation-task" } : {}) });
  const [select] = calls.find(([sql]) => sql.startsWith("SELECT o.*"));
  assert.match(select, /c.organization_id,c.workspace_id/);
  assert.doesNotMatch(select, /o\.(?:organization_id|workspace_id)/);
  assert.match(select, /e.event_type=o.event_type AND e.competitor_id=o.aggregate_id/);
  assert.match(select, /a.id=o.id AND a.competitor_id=o.aggregate_id/);
  assert.match(select, /JSON_EXTRACT\(o.payload_json,'\$.change_id'\)\)=BINARY a.change_id/);
  assert.match(select, /AND o.event_type<>'competitor.rule.created' AND \(e.id IS NOT NULL OR a.id IS NOT NULL\)/);
  assert.match(select, /ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE/);
  const [, delivery] = calls.find(([sql]) => sql.startsWith("INSERT IGNORE INTO outbox_events"));
  assert.deepEqual(delivery.slice(0, 4), [event.id, event.organization_id, event.workspace_id, event.event_type]);
  assert.deepEqual(delivery.slice(6, 8), [event.source_request_id, event.source_trace_id]);
  const task = calls.find(([sql]) => sql.startsWith("INSERT IGNORE INTO tasks"));
  if (threshold) {
    assert.deepEqual(task[1].slice(5, 8), [event.created_by, changeId, event.created_by]);
    assert.equal(JSON.parse(delivery[4]).task_id, "validation-task");
    assert.equal(JSON.parse(delivery[4]).recipient_id, event.created_by);
  } else {
    assert.equal(task, undefined);
  }
});
