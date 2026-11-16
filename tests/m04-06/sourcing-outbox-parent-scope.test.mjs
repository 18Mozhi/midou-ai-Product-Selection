import assert from "node:assert/strict";
import test from "node:test";
import { projectBusinessTaskOnce } from "../../apps/worker/dist/business-task-projection-worker.js";

test("purchase worker uses the paired sourcing event and leaves the existing lease contract intact", async () => {
  const calls = [];
  const event = { id: "event", resource_id: "purchase", organization_id: "org", workspace_id: "ws",
    payload_json: JSON.stringify({ id: "purchase" }) };
  const query = async (sql, args) => {
    calls.push([sql, args]);
    if (sql.startsWith("SHOW COLUMNS FROM competitors")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
    if (sql.startsWith("SELECT o.*,ps.organization_id")) return [[event]];
    if (sql.startsWith("SELECT id,created_by FROM tasks")) return [[{ id: "task" }]];
    return [[]];
  };
  const c = { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
  const result = await projectBusinessTaskOnce({ query, getConnection: async () => c }, "worker", 30);
  assert.deepEqual(result, { status: "projected", taskId: "task" });
  const [claim] = calls.find(([sql]) => sql.startsWith("SELECT o.*,ps.organization_id"));
  assert.match(claim, /e.id=o.id AND e.resource_id=o.resource_id AND BINARY e.event_type=BINARY o.event_type/);
  assert.match(claim, /JOIN sourcing_purchase_tasks pp ON pp.id=e.resource_id/);
  assert.match(claim, /JOIN sourcing_searches ps ON ps.id=pc.search_id/);
  assert.match(claim, /JSON_EXTRACT\(o.payload_json,'\$.id'\)\)=BINARY o.resource_id/);
  assert.match(claim, /o.lease_expires_at<\?/);
  assert.match(claim, /ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE/);
  const [, args] = calls.find(([sql]) => sql.startsWith("INSERT IGNORE INTO tasks"));
  assert.deepEqual(args.slice(-3), ["purchase", "org", "ws"]);
  assert.deepEqual(calls.at(-1)[1], [event.id]);
});
