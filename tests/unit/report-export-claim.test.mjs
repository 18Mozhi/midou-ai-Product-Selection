import assert from "node:assert/strict";
import test from "node:test";
import { ReportExportWorker } from "../../apps/worker/dist/report-export-worker.js";

const scanAt = new Date("2026-11-17T09:10:00.000Z");
const claimAt = new Date("2026-11-17T09:10:00.125Z");
const candidate = { id: "report-1", account_id: "account-1", version: 4 };
const makeWorker = (pool, clock = () => scanAt) =>
  new ReportExportWorker(pool, "worker-1", "", 120, 3, 100, clock);

test("no eligible report returns idle without opening a transaction", async () => {
  const worker = makeWorker({
    async query(sql) {
      assert.match(sql, /^SELECT id,version,account_id FROM report_exports/);
      assert.match(sql, /ORDER BY available_at,id LIMIT 1$/);
      assert.doesNotMatch(sql, /FOR UPDATE/);
      return [[]];
    },
    getConnection() { assert.fail("idle report scan opened a transaction"); },
  });
  assert.equal(await worker.claim(true), null);
});

for (const mode of ["owned", "raced", "legacy", "error"]) {
  test(`report claim rechecks the selected primary key and lease: ${mode}`, async () => {
    const account = mode !== "legacy";
    const events = [];
    let clockCalls = 0;
    const connection = {
      async beginTransaction() { events.push("begin"); },
      async query(sql, args) {
        if (sql.startsWith("SELECT")) {
          events.push("lock");
          assert.match(sql, /WHERE id=\? AND version=\?/);
          if (account) assert.match(sql, /AND account_id=\?/);
          else assert.doesNotMatch(sql, /account_id/);
          assert.match(sql, /status='leased' AND lease_expires_at<=\?/);
          assert.match(sql, /expires_at>\? FOR UPDATE$/);
          assert.doesNotMatch(sql, /ORDER BY/);
          assert.deepEqual(args, [candidate.id, candidate.version, ...(account ? [candidate.account_id] : []), claimAt, claimAt, claimAt]);
          if (mode === "error") throw new Error("read_failed");
          return [mode === "raced" ? [] : [{ ...candidate, attempt_count: 2 }]];
        }
        events.push("update");
        assert.match(sql, /^UPDATE report_exports SET status='leased'/);
        assert.deepEqual(args, ["worker-1", claimAt, 120, claimAt, candidate.id]);
        return [{ affectedRows: 1 }];
      },
      async commit() { events.push("commit"); },
      async rollback() { events.push("rollback"); },
      release() { events.push("release"); },
    };
    const worker = makeWorker({
      async query(sql, args) {
        events.push("scan");
        assert.match(sql, /^SELECT id,version/);
        assert.doesNotMatch(sql, /FOR UPDATE/);
        assert.deepEqual(args, [scanAt, scanAt, scanAt]);
        return [[candidate]];
      },
      async getConnection() { events.push("acquire"); return connection; },
    }, () => clockCalls++ === 0 ? scanAt : claimAt);
    if (mode === "error") {
      await assert.rejects(worker.claim(account), /read_failed/);
      assert.deepEqual(events, ["scan", "acquire", "begin", "lock", "rollback", "release"]);
    } else {
      const result = await worker.claim(account);
      if (mode === "raced") assert.equal(result, null);
      else assert.deepEqual(result, { ...candidate, attempt_count: 3 });
      assert.deepEqual(events, ["scan", "acquire", "begin", "lock", ...(mode === "raced" ? [] : ["update"]), "commit", "release"]);
    }
  });
}
