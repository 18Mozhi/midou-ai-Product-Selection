import assert from "node:assert/strict";
import test from "node:test";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";

for (const legacy of [false, true]) {
  test(`topic change inherits target scope without rewriting source references (legacy=${legacy})`, async () => {
    const now = new Date("2026-10-15T00:00:00Z"), calls = [];
    const scoped = legacy ? [{ Field: "organization_id" }, { Field: "workspace_id" }] : [];
    const connection = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async query(sql, values = []) {
        calls.push({ sql, values });
        assert.equal((sql.match(/\?/g) ?? []).length, values.length, sql);
        if (sql.startsWith("SHOW COLUMNS")) return [scoped];
        if (sql.startsWith("SELECT result_json")) return [[]];
        if (sql.startsWith("SELECT id,title,market,language,status,version FROM trend_topics"))
          return [[{ id: "target", title: "One", market: "US", language: "en", status: "active", version: 1 },
            { id: "source", title: "Two", market: "US", language: "en", status: "active", version: 2 }]];
        if (sql.startsWith("SELECT c.*,t.title")) return [[]];
        return [{ affectedRows: 1 }];
      },
    };
    const repo = new MySqlTrendRepository({ query: connection.query, getConnection: async () => connection }, () => now);
    const ctx = { organizationId: "org", workspaceId: "ws", actorId: "user", requestId: "request",
      traceId: "trace", idempotencyKey: "key", route: "test" };
    const result = await repo.proposeTopicChange({ ...ctx, requestIdValue: "change", operation: "merge",
      targetTopicId: "target", sourceTopicIds: ["source"], signalIds: [], newTitle: null, newCategory: null,
      expectedVersions: { target: 1, source: 2 }, reason: "test only" });
    assert.equal(result.status, "pending");
    const insert = calls.find(c => c.sql.startsWith("INSERT INTO trend_topic_change_requests"));
    assert.equal(insert.sql.includes("organization_id,workspace_id"), legacy);
    assert.deepEqual(insert.values.slice(0, legacy ? 7 : 5),
      ["change", ...(legacy ? ["org", "ws"] : []), "merge", "target", '["source"]', "[]"]);
    const event = calls.find(c => c.sql.startsWith("INSERT INTO trend_events"));
    if (!legacy) assert.match(event.sql, /JOIN trend_topics t ON t.id=c.target_topic_id WHERE c.id=\? AND t.organization_id=\? AND t.workspace_id=\?/);
    await repo.listChangeRequests(ctx);
    assert.match(calls.at(-1).sql, /t.id=c.target_topic_id WHERE t.organization_id=\? AND t.workspace_id=\?/);
  });
}
