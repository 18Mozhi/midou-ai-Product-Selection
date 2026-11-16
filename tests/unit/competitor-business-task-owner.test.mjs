import assert from "node:assert/strict";
import test from "node:test";
import { projectBusinessTaskOnce } from "../../apps/worker/dist/business-task-projection-worker.js";

const changeId = "00000000-0000-4000-8000-000000000021";
const config = {
  nodeEnv: "test",
  app: { host: "127.0.0.1" },
  database: { host: "127.0.0.1", name: "product_scout_task_rehearsal" },
};
const event = {
  id: "alert",
  aggregate_id: "competitor",
  event_type: "competitor.threshold.triggered",
  organization_id: "org",
  workspace_id: "ws",
  created_by: "historical-actor",
  title: "fixture",
  source_request_id: "req",
  source_trace_id: "trace",
  payload_json: {
    account_projection_contract: 25,
    change_id: changeId,
    rule_id: "rule",
    evidence_id: "evidence",
    field: "current_price",
    previous: "10",
    current: "20",
  },
};
for (const [native, nativeCompetitor] of [
  [false, false],
  [true, false],
  [true, true],
])
  for (const mode of [
    "new",
    "reuse",
    "foreign_evidence",
    "foreign_rule",
    "foreign_task",
    "delivery_conflict",
    "foreign_database",
  ]) {
    test(`owned competitor review task: ${mode}, native=${native}/${nativeCompetitor}`, async () => {
      const actions = [],
        writes = [],
        ledger = [];
      let task;
      const c = {
        beginTransaction: async () => actions.push("begin"),
        commit: async () => actions.push("commit"),
        rollback: async () => actions.push("rollback"),
        release: () => actions.push("release"),
        query: async (sql, v = []) => {
          if (sql.startsWith("SELECT DATABASE()"))
            return [
              [
                {
                  db:
                    mode === "foreign_database" ? "product_scout" : "product_scout_task_rehearsal",
                  version: "5.7.44-log",
                },
              ],
            ];
          if (sql.startsWith("SHOW COLUMNS FROM tasks"))
            return [
              (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
                Field,
              })),
            ];
          if (sql.startsWith("SHOW COLUMNS FROM competitors"))
            return [
              (nativeCompetitor ? ["account_id"] : ["organization_id", "workspace_id"]).map(
                (Field) => ({ Field }),
              ),
            ];
          if (sql.startsWith("SHOW COLUMNS")) return [[]];
          if (sql.startsWith("SELECT o.*")) {
            assert.match(
              sql,
              /o.event_type='competitor.threshold.triggered'.*account_projection_contract/,
            );
            if (nativeCompetitor) assert.doesNotMatch(sql, /organization_id|workspace_id/);
            return [
              [
                nativeCompetitor
                  ? { ...event, account_id: "primary", organization_id: null, workspace_id: null }
                  : event,
              ],
            ];
          }
          if (sql.startsWith("SELECT cut.primary_account_id"))
            return [[{ account_id: "primary", primary_account_id: "primary", reason: "shared" }]];
          if (sql.startsWith("SELECT a.rule_id,ch.evidence_id")) {
            assert.deepEqual(v, ["alert", "competitor", changeId, "evidence"]);
            assert.doesNotMatch(sql, /r\.(organization_id|workspace_id)/);
            assert.match(
              sql,
              /r.id=a.rule_id AND \(r.competitor_id IS NULL OR r.competitor_id=a.competitor_id\)/,
            );
            return [[{ rule_id: "rule", evidence_id: "evidence", snapshot_id: "snapshot" }]];
          }
          if (sql.startsWith("SELECT account_id FROM account_owned_records"))
            return [
              v[0].map(([, id]) => ({
                account_id:
                  (mode === "foreign_evidence" && id === "evidence") ||
                  (mode === "foreign_rule" && id === "rule") ||
                  (mode === "foreign_task" && id === "original-task")
                    ? "other"
                    : "primary",
              })),
            ];
          if (sql.startsWith("SELECT id,deleted_at FROM tasks")) {
            assert.deepEqual(v, native ? ["primary", changeId] : ["org", "ws", changeId]);
            assert.equal(sql.includes("WHERE account_id=?"), native);
            return [[{ id: task, deleted_at: null }]];
          }
          if (sql.startsWith("SELECT id FROM outbox_events")) {
            if (nativeCompetitor) assert.doesNotMatch(sql, /organization_id|workspace_id/);
            return [[]];
          }
          if (sql.startsWith("INSERT INTO account_owned_records")) {
            ledger.push(...v[0]);
            return [{ affectedRows: v[0].length }];
          }
          if (/^INSERT (?:IGNORE )?INTO tasks/.test(sql)) {
            task = ["reuse", "foreign_task"].includes(mode) ? "original-task" : v[0];
            assert.equal((sql.match(/\?/g) ?? []).length, v.length);
            assert.equal(sql.includes("(id,account_id,"), native);
            assert.equal(sql.endsWith("ON DUPLICATE KEY UPDATE id=id"), native);
            assert.deepEqual(v.slice(native ? 4 : 5, native ? 7 : 8), [
              "primary",
              changeId,
              "historical-actor",
            ]);
            writes.push(["tasks", v[0]]);
            return [{ affectedRows: task === v[0] ? 1 : 0 }];
          }
          if (sql.startsWith("INSERT INTO task_events")) {
            assert.deepEqual(v.slice(1, 3), [task, "historical-actor"]);
            assert.deepEqual(v.slice(4, 6), ["req", "trace"]);
            assert.equal(JSON.parse(v[3]).evidence_id, "evidence");
            writes.push(["task_events", v[0]]);
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("INSERT IGNORE INTO outbox_events")) {
            const body = JSON.parse(v[nativeCompetitor ? 2 : 4]);
            assert.equal(body.recipient_id, "primary");
            assert.equal(body.task_id, task);
            assert.equal(body.competitor_account_contract, nativeCompetitor ? 25 : undefined);
            if (nativeCompetitor) assert.doesNotMatch(sql, /organization_id|workspace_id/);
            writes.push(["outbox_events", v[0]]);
            return [{ affectedRows: mode === "delivery_conflict" ? 0 : 1 }];
          }
          if (sql.startsWith("UPDATE")) {
            writes.push([sql]);
            return [{ affectedRows: 1 }];
          }
          throw Error("Unexpected SQL " + sql);
        },
      };
      const run = () =>
        projectBusinessTaskOnce({ getConnection: async () => c }, "worker", 120, config);
      const failure = {
        foreign_evidence: "competitor_task_projection_owner_mismatch",
        foreign_rule: "competitor_task_projection_owner_mismatch",
        foreign_task: "competitor_validation_task_owner_mismatch",
        delivery_conflict: "competitor_validation_delivery_owner_mismatch",
        foreign_database: "mysql57_rehearsal_database_required",
      }[mode];
      if (failure) {
        await assert.rejects(run(), { message: failure });
        assert.deepEqual(
          actions,
          mode === "foreign_database" ? ["rollback", "release"] : ["begin", "rollback", "release"],
        );
        assert.ok(!writes.some(([sql]) => sql.startsWith("UPDATE competitor_outbox")));
        if (["foreign_evidence", "foreign_rule", "foreign_database"].includes(mode))
          assert.deepEqual(writes, []);
        return;
      }
      assert.deepEqual(await run(), { status: "projected", event_id: "alert", taskId: task });
      const names = mode === "new" ? ["tasks", "task_events", "outbox_events"] : ["outbox_events"];
      assert.deepEqual(
        ledger,
        writes.filter(([t]) => names.includes(t)).map(([t, id]) => [t, id, "primary", "shared"]),
      );
      assert.deepEqual(actions, ["begin", "commit", "release"]);
    });
  }
