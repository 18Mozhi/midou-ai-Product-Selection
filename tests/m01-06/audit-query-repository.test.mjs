import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAuditRepository } from "../../apps/api/dist/mysql-audit-repository.js";

const org = "00000000-0000-4000-8000-000000000801",
  cursor = "00000000-0000-4000-8000-000000000802";
const row = (id, occurredAt) => ({
  id,
  organization_id: org,
  workspace_id: null,
  actor_id: null,
  action: "organization.member.invited",
  resource_type: "membership",
  resource_id: null,
  outcome: "succeeded",
  request_id: "request",
  trace_id: "trace",
  metadata: { source: "test" },
  occurred_at: occurredAt,
  schema_version: 1,
});

test("M01-06 organization audit query unifies transactional and platform facts", async () => {
  const calls = [],
    pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [[row(cursor, new Date("2026-08-27T10:00:00.000Z"))]];
      },
    },
    repository = new MySqlAuditRepository(pool),
    result = await repository.list({ organizationId: org, limit: 50 });
  assert.equal(result.items.length, 1);
  assert.match(calls[0].sql, /platform_audit_events WHERE organization_id=\?/);
  assert.match(calls[0].sql, /UNION ALL[\s\S]*FROM audit_logs WHERE organization_id=\?/);
  assert.match(calls[0].sql, /'succeeded' outcome/);
  assert.deepEqual(calls[0].params, [org, org, 51]);
});

test("M01-06 organization audit cursor lookup stays inside the requested organization", async () => {
  const calls = [],
    occurredAt = new Date("2026-08-27T10:00:00.000Z"),
    pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (calls.length === 1) return [[{ occurred_at: occurredAt }]];
        return [[row("00000000-0000-4000-8000-000000000803", occurredAt)]];
      },
    },
    repository = new MySqlAuditRepository(pool);
  await repository.list({ organizationId: org, cursor, limit: 10 });
  assert.match(calls[0].sql, /FROM audit_logs WHERE organization_id=\?/);
  assert.deepEqual(calls[0].params, [org, org, cursor]);
  assert.match(calls[1].sql, /occurred_at<\? OR \(occurred_at=\? AND id<\?\)/);
  assert.deepEqual(calls[1].params, [
    org,
    occurredAt,
    occurredAt,
    cursor,
    org,
    occurredAt,
    occurredAt,
    cursor,
    11,
  ]);
});

test("M01-06 organization audit filters are pushed into both persisted sources", async () => {
  const calls = [],
    pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [[]];
      },
    },
    repository = new MySqlAuditRepository(pool);
  await repository.list({
    organizationId: org,
    action: "organization.member.invited",
    outcome: "succeeded",
    resourceType: "membership",
    requestId: "request",
    traceId: "trace",
    limit: 20,
  });
  assert.match(calls[0].sql, /platform_audit_events WHERE organization_id=\? AND action=\?/);
  assert.match(calls[0].sql, /outcome=\? AND resource_type=\? AND request_id=\? AND trace_id=\?/);
  assert.match(calls[0].sql, /audit_logs WHERE organization_id=\? AND action=\?/);
  assert.deepEqual(calls[0].params, [
    org,
    "organization.member.invited",
    "succeeded",
    "membership",
    "request",
    "trace",
    org,
    "organization.member.invited",
    "membership",
    "request",
    "trace",
    21,
  ]);
});

test("M01-06 failed organization audit outcome excludes transactional success facts", async () => {
  const calls = [],
    pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [[]];
      },
    },
    repository = new MySqlAuditRepository(pool);
  await repository.list({ organizationId: org, outcome: "failed", limit: 10 });
  assert.match(calls[0].sql, /platform_audit_events WHERE organization_id=\? AND outcome=\?/);
  assert.match(calls[0].sql, /audit_logs WHERE organization_id=\? AND 1=0/);
  assert.deepEqual(calls[0].params, [org, "failed", org, 11]);
});

test("M01-06 organization audit rejects a cursor from another scope", async () => {
  const repository = new MySqlAuditRepository({ query: async () => [[]] });
  await assert.rejects(
    () => repository.list({ organizationId: org, cursor, limit: 10 }),
    (error) => error.code === "audit_cursor_invalid",
  );
});
