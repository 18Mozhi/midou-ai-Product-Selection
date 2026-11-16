import assert from "node:assert/strict";
import test from "node:test";
import { appendOpportunityEvent, opportunityEventReadRelation } from "../../packages/database/dist/index.js";

const input = { id: "event", organizationId: "org", workspaceId: "ws", eventType: "event-type",
  resourceType: "selection_pipeline", resourceId: "op", actorType: "worker", actorId: "actor",
  requestId: "request", traceId: "trace", payloadJson: "{}", occurredAt: new Date(0) };
const fixture = (fields, affectedRows = 1) => {
  const writes = [];
  return { writes, async query(sql, args) {
    if (sql.startsWith("SHOW COLUMNS")) return [fields.map(Field => ({ Field }))];
    writes.push({ sql, args }); return [{ affectedRows }];
  } };
};
test("compiled selection event writer uses the correct parent and refuses mismatches", async () => {
  for (const [resourceType,parent] of [["opportunity","opportunities"], ["selection_pipeline","opportunities"],
    ["cost_rule","cost_rules"], ["score_rule","score_rules"], ["exchange_rate","exchange_rate_quotes"]]) {
    const c = fixture([]);
    await appendOpportunityEvent(c, { ...input, resourceType });
    const [{ sql, args }] = c.writes;
    assert.match(sql, new RegExp("FROM "+parent+" WHERE id=\\? AND organization_id=\\? AND workspace_id=\\?$"));
    assert.doesNotMatch(sql, /id,organization_id,workspace_id,event_type/);
    assert.equal((sql.match(/\?/g) ?? []).length, args.length);
    assert.deepEqual(args.slice(-3), ["op", "org", "ws"]);
  }
  await assert.rejects(appendOpportunityEvent(fixture([], 0), input), /broken_source_link:opportunity_events.resource_id/);
  await assert.rejects(appendOpportunityEvent(fixture(["workspace_id"]), input), /partial_inherited_scope_schema/);
  await assert.rejects(appendOpportunityEvent(fixture([]), { ...input, resourceType: "unknown" }), /unknown_source_resource_type/);
});
test("legacy event layout, DB clock and parent-scoped product read remain explicit", async () => {
  const c = fixture(["organization_id", "workspace_id"]);
  await appendOpportunityEvent(c, { ...input, occurredAt: "database_now" });
  assert.match(c.writes[0].sql, /id,organization_id,workspace_id,event_type/);
  assert.match(c.writes[0].sql, /NOW\(3\)\)$/);
  assert.match(opportunityEventReadRelation, /JOIN opportunities ep ON ep.id=ev.resource_id/);
  assert.doesNotMatch(opportunityEventReadRelation, /ev\.(organization_id|workspace_id)/);
});
