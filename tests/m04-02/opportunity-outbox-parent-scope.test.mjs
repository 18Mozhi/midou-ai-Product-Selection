import assert from "node:assert/strict";
import test from "node:test";
import { appendOpportunityOutbox } from "../../packages/database/dist/index.js";
import { opportunityOutboxProbeCleanupSql } from "../../scripts/lib/opportunity-outbox-probe-scope.mjs";

const event = {
  id: "delivery", eventId: "original-event", organizationId: "org", workspaceId: "workspace",
  eventType: "opportunity.decision.changed", resourceType: "opportunity", resourceId: "resource",
  payloadJson: '{"decision":"observe"}', requestId: "request", traceId: "trace", createdAt: new Date(0),
};
for (const normalized of [false, true]) {
  test(`delivery preserves distinct IDs and queue fields (normalized=${normalized})`, async () => {
    const calls = [];
    const fields = normalized ? ["event_id"] : ["organization_id", "workspace_id"];
    const query = async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_events"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [fields.map((Field) => ({ Field }))];
      return [{ affectedRows: 1 }];
    };
    await appendOpportunityOutbox({ query }, event);
    const { sql, args } = calls[1];
    assert.match(sql, /'queued',0,/);
    assert.equal((sql.match(/\?/g) ?? []).length, args.length);
    assert.deepEqual(args, [event.id, ...(normalized ? [event.eventId] : [event.organizationId, event.workspaceId]),
      event.eventType, event.resourceType, event.resourceId, event.payloadJson, event.createdAt,
      event.requestId, event.traceId, event.createdAt, event.createdAt]);
    const cleanup = await opportunityOutboxProbeCleanupSql({ query });
    assert.equal(cleanup, normalized
      ? "DELETE o FROM opportunity_outbox o JOIN opportunity_events e ON e.id=o.event_id WHERE e.organization_id IN (?,?)"
      : "DELETE o FROM opportunity_outbox o WHERE o.organization_id IN (?,?)");
  });
}

test("delivery write and cleanup both reject a partially migrated schema", async () => {
  const query = async (sql) => {
    assert.match(sql, /^SHOW COLUMNS/);
    return [[{ Field: "event_id" }, { Field: "workspace_id" }]];
  };
  await assert.rejects(appendOpportunityOutbox({ query }, event), /partial_inherited_scope_schema/);
  await assert.rejects(opportunityOutboxProbeCleanupSql({ query }), /partial_inherited_scope_schema/);
});
