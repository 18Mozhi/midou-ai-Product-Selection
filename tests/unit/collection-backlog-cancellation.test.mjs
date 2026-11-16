import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cancelFrozenBacklog,
  readBacklogSnapshot,
} from "../../scripts/cancel-collection-backlog.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n, status = "queued") => ({
  id: id(n),
  organization_id: id(100),
  workspace_id: id(200),
  status,
  version: 2,
});
const makeSnapshot = (...rows) => ({
  schema: 1,
  batch_id: id(999),
  captured_at: "2026-11-09 02:36:44.287",
  rows,
});
const hash = (b) => createHash("sha256").update(b).digest("hex");

function database(rows, { oldSchema = false, failAudit = false } = {}) {
  let tasks = new Map(rows.map((r) => [r.id, { ...r }]));
  let receipts = [];
  let prior;
  const calls = [];
  const sameScope = (r, params) =>
    r && r.organization_id === params[1] && r.workspace_id === params[2];
  const eligible = (r) => ["scheduled", "queued"].includes(r.status) && !r.protected;
  return {
    calls,
    get tasks() {
      return tasks;
    },
    get receipts() {
      return receipts;
    },
    async beginTransaction() {
      prior = structuredClone({ tasks, receipts });
    },
    async commit() {
      prior = null;
    },
    async rollback() {
      ({ tasks, receipts } = prior);
      prior = null;
      calls.push("rollback");
    },
    async query(sql, p = []) {
      calls.push(sql);
      if (sql.includes("information_schema.COLUMNS"))
        return [
          [
            {
              kind: oldSchema
                ? "enum('scheduled','queued')"
                : "enum('scheduled','queued','cancelled')",
            },
          ],
        ];
      if (sql.startsWith("SET SESSION") || sql.includes("RELEASE_LOCK")) return [[]];
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.includes("WHERE t.id IN (?)"))
        return [[...tasks.values()].filter((r) => p[0].includes(r.id) && eligible(r))];
      if (sql.includes("SELECT e.task_id")) return [receipts];
      const current = tasks.get(p[0]);
      if (sql.startsWith("SELECT status,version")) {
        assert.ok(sql.endsWith("FOR UPDATE"));
        return [sameScope(current, p) ? [current] : []];
      }
      if (sql.startsWith("UPDATE")) {
        assert.match(sql, /t\.version=\?/);
        assert.match(sql, /NOT EXISTS .*collection_task_attempts/);
        assert.match(sql, /NOT EXISTS .*raw_evidence/);
        if (!sameScope(current, p) || !eligible(current) || current.version !== p[3])
          return [{ affectedRows: 0 }];
        tasks.set(current.id, { ...current, status: "cancelled", version: current.version + 1 });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT")) {
        assert.ok(prior, "write and audit must share one transaction");
        assert.equal(p[7], id(999));
        assert.equal(p[8], id(999));
        assert.match(p[9], /snapshot_sha256/);
        if (failAudit) throw new Error("injected_audit_failure");
        receipts.push({
          id: p[1],
          organization_id: p[2],
          workspace_id: p[3],
          snapshot_sha256: JSON.parse(p[9]).snapshot_sha256,
          current_status: "cancelled",
        });
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test("snapshot is bound to exact hash and rejects duplicate or cross-tenant rows", () => {
  const bytes = Buffer.from(JSON.stringify(makeSnapshot(row(1))));
  assert.equal(readBacklogSnapshot(bytes, hash(bytes)).rows.length, 1);
  assert.throws(() => readBacklogSnapshot(bytes, "a".repeat(64)), /hash_mismatch/);
  for (const pair of [row(1), { ...row(2), organization_id: id(101) }]) {
    const invalid = Buffer.from(JSON.stringify(makeSnapshot(row(1), pair)));
    assert.throws(() => readBacklogSnapshot(invalid, hash(invalid)), /snapshot_row_invalid/);
  }
});

test("preview does not write; apply audits only still-unstarted snapshot tasks; rerun is idempotent", async () => {
  const snapshot = makeSnapshot(row(1), row(2), row(3), row(4), row(5, "scheduled"), row(7));
  const db = database([
    row(1),
    row(2, "leased"),
    { ...row(3), protected: true },
    { ...row(4), organization_id: id(101) },
    row(5),
    row(6),
    row(7, "succeeded"),
  ]);
  const preview = await cancelFrozenBacklog(db, snapshot, "a".repeat(64));
  assert.equal(preview.eligible_remaining, 2);
  assert.equal(
    db.calls.some((sql) => /^(UPDATE|INSERT|SET SESSION)/.test(sql)),
    false,
  );
  const result = await cancelFrozenBacklog(db, snapshot, "a".repeat(64), { apply: true });
  assert.deepEqual(result, {
    batch_id: snapshot.batch_id,
    mode: "apply",
    snapshot_count: 6,
    cancelled: 2,
    eligible_remaining: 0,
    protected_or_no_longer_eligible: 4,
  });
  assert.equal(db.tasks.get(id(6)).status, "queued", "new task not in the frozen snapshot");
  assert.equal(db.tasks.get(id(2)).status, "leased");
  assert.equal(db.tasks.get(id(3)).status, "queued");
  assert.equal(db.tasks.get(id(7)).status, "succeeded");
  assert.deepEqual(
    await cancelFrozenBacklog(db, snapshot, "a".repeat(64), { apply: true }),
    result,
  );
});

test("audit failure rolls back the status update and a pre-migration database fails closed", async () => {
  const snapshot = makeSnapshot(row(1));
  const db = database(snapshot.rows, { failAudit: true });
  await assert.rejects(
    cancelFrozenBacklog(db, snapshot, "a".repeat(64), { apply: true }),
    /audit_failure/,
  );
  assert.equal(db.tasks.get(id(1)).status, "queued");
  assert.equal(db.receipts.length, 0);
  assert.ok(db.calls.includes("rollback"));
  const old = database(snapshot.rows, { oldSchema: true });
  await assert.rejects(
    cancelFrozenBacklog(old, snapshot, "a".repeat(64), { apply: true }),
    /migration_required/,
  );
  assert.equal(old.calls.length, 1);
});

test("0076 only appends the enum value; the deployer packages the tool without invoking it", async () => {
  const [prior, migration, deploy] = await Promise.all([
    readFile("database/migrations/0049_credential_renewal_auto_replay.up.sql", "utf8"),
    readFile("database/migrations/0076_collection_backlog_cancellation.up.sql", "utf8"),
    readFile("scripts/deploy-baota.py", "utf8"),
  ]);
  const values = (sql) => sql.match(/ENUM\(([^)]+)\)/)[1];
  assert.equal(values(migration), values(prior) + ",'cancelled'");
  assert.match(migration, /ALGORITHM=INPLACE, LOCK=NONE/);
  assert.equal(deploy.split('"cancel-collection-backlog.mjs"').length, 2);
});
