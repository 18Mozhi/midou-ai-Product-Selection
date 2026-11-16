import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCrawlerSchedulerLease,
  crawlerSchedulerLeaseHasLegacyScope,
} from "../../packages/database/dist/index.js";

const scope = { organizationId: "organization", workspaceId: "workspace" };
const now = new Date("2026-11-13T02:03:04.123Z");
const expiresAt = new Date("2026-11-13T02:04:04.123Z");
const tokenHash = "a".repeat(64);

test("scheduler leases preserve slot identity, parent references, hash and timing in both layouts", async () => {
  for (const fields of [[], ["organization_id", "workspace_id"]]) {
    const legacy = fields.length === 2;
    for (const [slotType, taskId, runId] of [
      ["worker", "task", null], ["provider", "task", null],
      ["crawler", null, "run"], ["crawler", "task", "run"],
    ]) {
      const db = { async query(sql, bindings) {
        if (sql.startsWith("SHOW COLUMNS")) return [fields.map(Field => ({ Field }))];
        assert.match(sql, /^INSERT INTO crawler_scheduler_leases \(slot_type,slot_key,slot_no,/);
        assert.match(sql, /VALUES \(\?,\?,1,.*UNHEX\(\?\)/);
        assert.equal(sql.includes("organization_id,workspace_id"), legacy);
        assert.equal((sql.match(/\?/g) ?? []).length, bindings.length);
        assert.deepEqual(bindings, [
          slotType, "key", ...(legacy ? ["organization", "workspace"] : []),
          taskId, runId, "worker-1", tokenHash, now, now, expiresAt, "request", "trace",
        ]);
        return [{ affectedRows: 1 }];
      } };
      assert.equal(await crawlerSchedulerLeaseHasLegacyScope(db), legacy);
      await appendCrawlerSchedulerLease(db, legacy, scope, {
        slotType, slotKey: "key", taskId, runId, owner: "worker-1", tokenHash,
        now, expiresAt, requestId: "request", traceId: "trace",
      });
    }
  }
});

test("scheduler lease writes fail closed on either incomplete migration shape", async () => {
  for (const Field of ["organization_id", "workspace_id"]) {
    const db = { async query(sql) {
      assert.match(sql, /^SHOW COLUMNS FROM crawler_scheduler_leases/);
      return [[{ Field }]];
    } };
    await assert.rejects(crawlerSchedulerLeaseHasLegacyScope(db),
      /partial_inherited_scope_schema:crawler_scheduler_leases/);
  }
});
