import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recordFailedRecoveryRun } from "../../scripts/backup-recovery.mjs";

const input = () => ({
  id: "11111111-1111-4111-8111-111111111111",
  requestId: "22222222-2222-4222-8222-222222222222",
  traceId: "33333333-3333-4333-8333-333333333333",
  runType: "restore_drill",
  startedAt: new Date("2026-10-15T12:00:00Z"),
  finishedAt: new Date("2026-10-15T12:01:00Z"),
  sourceCutoffAt: new Date("2026-10-15T11:00:00Z"),
  failureCode: "backup_pitr_sql_unsafe",
});

test("failed recovery appends one parameterized unverified row with actual correlation and times", async () => {
  const calls = [];
  const value = input();
  await recordFailedRecoveryRun({ query: async (...args) => calls.push(args) }, value);
  assert.equal(calls.length, 1);
  const [sql, values] = calls[0];
  assert.equal((sql.match(/\?/g) ?? []).length, values.length);
  assert.match(sql, /INSERT INTO backup_recovery_runs/);
  assert.match(sql, /'failed'/);
  assert.doesNotMatch(sql, /UPDATE|DELETE|verified'/);
  assert.match(sql, /,0,0,0,0,0,0,/);
  assert.deepEqual(values.slice(0, 8), [
    value.id,
    value.runType,
    value.sourceCutoffAt,
    value.startedAt,
    value.finishedAt,
    value.failureCode,
    value.requestId,
    value.traceId,
  ]);
  assert.deepEqual(JSON.parse(values[8]), {
    topology: "same_host_local_isolation",
    host_failure_protected: false,
  });
});

test("backup-stage failure keeps its own run type and unknown cutoff", async () => {
  let captured;
  await recordFailedRecoveryRun(
    {
      query: async (_, values) => {
        captured = values;
      },
    },
    { ...input(), runType: "backup", sourceCutoffAt: null },
  );
  assert.equal(captured[1], "backup");
  assert.equal(captured[2], null);
});

test("unsafe error codes and raw exception details are not persisted", async () => {
  let captured;
  await recordFailedRecoveryRun(
    {
      query: async (_, values) => {
        captured = values;
      },
    },
    {
      ...input(),
      failureCode: "invalid secret=password",
      message: "private password",
      sql: "private SQL",
    },
  );
  assert.equal(captured[5], "baota_backup_drill_failed");
  assert.doesNotMatch(JSON.stringify(captured), /private|password/);
});

for (const invalid of [
  { id: "invalid" },
  { traceId: "unknown" },
  { runType: "verified" },
  { startedAt: new Date("invalid") },
  { finishedAt: new Date("2026-10-15T11:59:00Z") },
  { sourceCutoffAt: new Date("2026-10-15T12:02:00Z") },
]) {
  test(`invalid failure record refuses writes: ${Object.keys(invalid)[0]}`, async () => {
    let calls = 0;
    await assert.rejects(
      recordFailedRecoveryRun(
        {
          query: async () => {
            calls += 1;
          },
        },
        { ...input(), ...invalid },
      ),
      { code: "backup_failure_record_invalid" },
    );
    assert.equal(calls, 0);
  });
}

test("database rejection remains an error rather than a successful audit", async () => {
  await assert.rejects(
    recordFailedRecoveryRun(
      {
        query: async () => {
          throw new Error("database unavailable");
        },
      },
      input(),
    ),
    /database unavailable/,
  );
});

test("runner records a new failure before cleanup without deleting failed or historical runs", async () => {
  const runner = await readFile("scripts/run-baota-backup-drill.mjs", "utf8");
  const catchStart = runner.lastIndexOf("} catch (error) {");
  const audit = runner.indexOf("await recordFailedRecoveryRun", catchStart);
  const cleanup = runner.indexOf("} finally {", catchStart);
  assert.ok(audit > catchStart && audit < cleanup);
  assert.match(runner, /failureRun\.runType = "restore_drill"/);
  assert.match(runner, /failureRun\.startedAt = drillStartedAt/);
  assert.match(runner, /backup_failure_record_write_failed/);
  assert.match(runner, /WHERE id=\? AND request_id=\? AND status='running'/);
  assert.match(runner.slice(catchStart, cleanup), /process\.exitCode = 2/);
});

test("the actual runner catch preserves the primary failure when its audit write fails", async () => {
  const runner = await readFile("scripts/run-baota-backup-drill.mjs", "utf8");
  const start = runner.lastIndexOf("} catch (error) {") + "} catch (error) {".length;
  const end = runner.indexOf("} finally {", start);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction(
    "databasePool",
    "failureRun",
    "recordFailedRecoveryRun",
    "requestId",
    "traceId",
    "process",
    "error",
    runner.slice(start, end),
  );
  const messages = [];
  const processStub = { stderr: { write: (value) => messages.push(JSON.parse(value)) } };
  const value = input();
  await execute(
    {},
    value,
    async () => {
      throw new Error("audit database unavailable");
    },
    value.requestId,
    value.traceId,
    processStub,
    { code: "backup_pitr_sql_unsafe", message: "original controlled failure" },
  );
  assert.deepEqual(
    messages.map((message) => message.code),
    ["backup_failure_record_write_failed", "backup_pitr_sql_unsafe"],
  );
  assert.equal(messages[1].status, "blocked");
  assert.equal(messages[1].request_id, value.requestId);
  assert.equal(messages[1].trace_id, value.traceId);
  assert.equal(processStub.exitCode, 2);
});
