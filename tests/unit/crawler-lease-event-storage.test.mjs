import assert from "node:assert/strict";
import test from "node:test";
import { appendCrawlerLeaseEvent } from "../../packages/database/dist/index.js";

const input = { id: "event", runId: "run", profileId: "profile", actorId: "actor",
  requestId: "request", traceId: "trace", now: new Date(), action: "heartbeat" };

test("lease audit binds the exact run and profile in both layouts without changing provenance", async () => {
  for (const fields of [[], ["organization_id", "workspace_id"]]) {
    const db = { async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return [fields.map(Field => ({ Field }))];
      assert.match(sql, /FROM crawler_browser_runs r WHERE r.id=\? AND r.crawler_profile_id=\?$/);
      assert.equal(sql.includes("r.organization_id,r.workspace_id"), fields.length === 2);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      assert.deepEqual(args, ["event", "heartbeat", "actor", "request", "trace", input.now, "run", "profile"]);
      return [{ affectedRows: 1 }];
    } };
    await appendCrawlerLeaseEvent(db, input);
  }
});

test("lease audit rejects a partial layout and refuses a mismatched run/profile pair", async () => {
  const partial = { async query(sql) {
    assert.match(sql, /^SHOW COLUMNS/);
    return [[{ Field: "workspace_id" }]];
  } };
  await assert.rejects(appendCrawlerLeaseEvent(partial, input), /partial_inherited_scope_schema/);
  const mismatch = { async query(sql) {
    return sql.startsWith("SHOW COLUMNS") ? [[]] : [{ affectedRows: 0 }];
  } };
  await assert.rejects(appendCrawlerLeaseEvent(mismatch, input), /crawler_lease_event_parent_mismatch/);
});
