import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdtemp, rm, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MySqlReportRepository } from "../../apps/api/dist/mysql-report-repository.js";
import { ReportExportWorker } from "../../apps/worker/dist/report-export-worker.js";
import { ReportService } from "../../apps/api/dist/report-service.js";
import { buildReportExportPath, writeReportExportFile } from "../../packages/storage/dist/index.js";

const id = "01770000-0000-4000-8000-000000000001";
const org = "01770000-0000-4000-8000-000000000002";
const workspace = "01770000-0000-4000-8000-000000000003";
const layout = [[{ Field: "account_id" }, { Field: "historical_context" }]];
const caller = {
  accountOwned: true,
  actorId: "login",
  organizationId: "not-used",
  workspaceId: "not-used",
};

test("0177 export, queue and aggregate reads are bound to the account, not a caller-selected scope", async () => {
  const seen = [];
  const repo = new MySqlReportRepository({
    async query(sql, args = []) {
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics")) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS")) return layout;
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.includes("WHERE id=?")) {
        assert.deepEqual(args, [id, "other"]);
        assert.match(sql, /account_id=\?/);
      } else {
        assert.equal(args[0], "login");
        assert.match(sql, /account_id=\?/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        if (sql.includes("FROM trend_topics")) {
          assert.match(sql, /o.account_id=trend_topics.account_id/);
          assert.match(sql, /o.account_id=cut.primary_account_id/);
        }
      }
      seen.push(sql);
      return [[]];
    },
  });
  assert.deepEqual(await repo.listExports(caller), []);
  assert.equal((await repo.report({ ...caller, reportType: "trend" })).summary.total, 0);
  await assert.rejects(
    repo.exportFile({ ...caller, actorId: "other", exportId: id }),
    /report_export_not_found/,
  );
  await assert.rejects(repo.report({ ...caller, reportType: "team" }), /report_type_retired/);
  assert.equal(seen.length, 6);
});

test("account report aggregates and CSV source reads reject a partially converted opportunity table", async () => {
  const mixed = {
    async query(sql) {
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [[{ Field: "account_id" }, { Field: "workspace_id" }]];
      assert.fail("mixed layout must not query facts");
    },
  };
  await assert.rejects(
    new MySqlReportRepository(mixed).report({ ...caller, reportType: "opportunity" }),
    /account_report_scope_shape_invalid/,
  );
  await assert.rejects(
    new ReportExportWorker(mixed, "test", "unused", 30, 2, 10).rows({
      account_id: "login",
      report_type: "opportunity",
    }),
    /account_report_scope_shape_invalid/,
  );
});

test("0177 creates account-owned export, receipt, event and audit in one transaction without old scope", async () => {
  const steps = [];
  let receipt, owner = "login", rollbacks = 0;
  const c = {
    async beginTransaction() {},
    async commit() {
      steps.push("commit");
    },
    async rollback() {
      rollbacks++;
    },
    release() {},
    async query(sql, args = []) {
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot")) return [[{slot:"current"}]];
      if (sql.startsWith("SELECT id FROM users")) return [[{id:"login"}]];
      if (sql.startsWith("SELECT o.export_id")) {
        assert.match(sql, /LEFT JOIN report_exports e ON e.id=o.export_id.*FOR UPDATE/);
        return [receipt ? [{export_id:id,account_id:owner,report_type:"trend",format:"csv",result_json:receipt}] : []];
      }
      if (sql.startsWith("INSERT INTO report_exports")) {
        assert.match(sql, /\(id,account_id,report_type,/);
        assert.deepEqual(args.slice(0, 4), [id, "login", "trend", "csv"]);
        steps.push("export");
      } else if (sql.startsWith("INSERT INTO platform_audit_events")) steps.push("audit");
      else if (sql.startsWith("INSERT INTO report_export_events")) steps.push("event");
      else if (sql.startsWith("INSERT INTO report_export_operations")) {
        assert.equal(args[2], "route#account-v1");
        receipt = args[5];
        steps.push("receipt");
      } else assert.fail(sql);
      return [[]];
    },
  };
  const repo = new MySqlReportRepository({
    async getConnection() {
      return c;
    },
    async query(sql) {
      if (sql.startsWith("SHOW COLUMNS")) return layout;
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      assert.match(sql, /SELECT result_json/);
      return [[]];
    },
  });
  const input = {
        ...caller,
        id,
        route: "route",
        idempotencyKey: "key",
        requestId: "r",
        traceId: "t",
        value: {
          report_type: "trend",
          format: "csv",
          filename: "safe.csv",
          expires_at: new Date(),
        },
  };
  const first = await repo.createExport(input);
  assert.equal(first.status, "queued");
  assert.deepEqual(await repo.createExport(input), first);
  assert.deepEqual(steps, ["export", "audit", "event", "receipt", "commit", "commit"]);
  await assert.rejects(repo.createExport({...input,value:{...input.value,report_type:"opportunity"}}),
    {code:"report_export_idempotency_conflict"});
  owner = "foreign";
  await assert.rejects(repo.createExport(input), {code:"report_export_idempotency_conflict"});
  assert.equal(rollbacks,2);
});

test("0177 keeps the original CSV path for historical exports and uses account paths for new CSVs", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-report-0177-"));
  try {
    const row = {
      id,
      filename: "safe.csv",
      account_id: "login",
      status: "succeeded",
      expires_at: "2100-01-01",
    };
    const history = {
      ...row,
      byte_size: 8,
      content_sha256: createHash("sha256").update("original").digest("hex"),
      historical_context: { organization_id: org, workspace_id: workspace },
    };
    const legacyPath = await writeReportExportFile(root, history, Buffer.from("original"));
    const newPath = await writeReportExportFile(root, row, Buffer.from("new"));
    assert.equal(
      legacyPath,
      join(root, "organizations", org, "workspaces", workspace, "export", id, "safe.csv"),
    );
    assert.equal(newPath, join(root, "accounts", "login", "export", id, "safe.csv"));
    const service = new ReportService(
      {
        async exportFile(i) {
          assert.equal(i.actorId, "login");
          return history;
        },
      },
      root,
      24,
    );
    assert.equal(
      (await service.download({ ...caller, exportId: id })).content.toString(),
      "original",
    );
    assert.equal((await readFile(newPath)).toString(), "new");
    await link(legacyPath, join(root, "second-link.csv"));
    await assert.rejects(service.download({...caller,exportId:id}),{code:"report_export_file_missing"});
    await unlink(join(root, "second-link.csv"));
    await writeFile(legacyPath, "tampered");
    await assert.rejects(service.download({...caller,exportId:id}),{code:"report_export_integrity_failed"});
    assert.throws(() => buildReportExportPath(root, { ...row, filename: "../escape.csv" }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const validLease of [true,false]) test(`0177 Worker verifies the account lease before writing: ${validLease}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-report-worker-0177-"));
  const now = new Date("2026-10-15T00:00:00Z"),
    steps = [];
  const job = {
    id,
    account_id: "login",
    version: 1,
    report_type: "trend",
    filename: "safe.csv",
    attempt_count: 0,
    request_id: "r",
    trace_id: "t",
  };
  let claim = true;
  const tx = {
    async beginTransaction() {},
    async commit() {
      steps.push("commit");
    },
    async rollback() {
      assert.equal(validLease,false);
      steps.push("rollback");
    },
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT * FROM report_exports")) {
        assert.match(sql, /WHERE id=\? AND version=\? AND account_id=\?.*FOR UPDATE/);
        assert.deepEqual(args, [id, job.version, "login", now, now, now]);
        return [[...(claim ? [job] : [])]];
      }
      if (sql.startsWith("SELECT id FROM report_exports")) {
        assert.match(sql,/account_id=\?.*leased_by=\?.*attempt_count=\?.*lease_expires_at>\?.*FOR UPDATE/);
        assert.deepEqual(args,[id,"login","worker",1,now,now]);
        return [validLease ? [{id}] : []];
      }
      if (sql.startsWith("UPDATE report_exports SET status='leased'")) {
        claim = false;
        steps.push("lease");
      } else if (sql.startsWith("UPDATE report_exports SET status='succeeded'"))
        steps.push("succeeded");
      else if (sql.startsWith("INSERT INTO platform_audit_events")) steps.push("audit");
      else if (sql.startsWith("INSERT INTO report_export_events")) steps.push("event");
      else assert.fail(sql);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      return [[]];
    },
  };
  const worker = new ReportExportWorker(
    {
      async getConnection() {
        return tx;
      },
      async query(sql, args) {
        if (sql.startsWith("SHOW COLUMNS FROM trend_topics")) return [[{ Field: "account_id" }]];
        if (sql.startsWith("SHOW COLUMNS")) return layout;
        if (sql.startsWith("SELECT id,filename,account_id,historical_context")) return [[]];
        if (sql.startsWith("SELECT id,version,account_id FROM report_exports")) {
          assert.match(sql, /ORDER BY available_at,id LIMIT 1$/);
          assert.deepEqual(args, [now, now, now]);
          return [claim ? [{ id, version: job.version, account_id: "login" }] : []];
        }
        assert.match(sql, /source_table='trend_topics'[\s\S]*o\.account_id=\?/);
        assert.match(sql, /o.account_id=trend_topics.account_id/);
        assert.deepEqual(args, ["login", 11]);
        return [[{ title: "mine" }]];
      },
    },
    "worker",
    root,
    30,
    2,
    10,
    () => now,
  );
  try {
    if (!validLease) {
      assert.equal((await worker.processOnce()).status, "lease_lost");
      await assert.rejects(readFile(join(root,"accounts","login","export",id,"safe.csv")), {code:"ENOENT"});
      assert.deepEqual(steps,["lease","commit","rollback"]);
      return;
    }
    assert.equal((await worker.processOnce()).status, "succeeded");
    assert.match(
      await readFile(join(root, "accounts", "login", "export", id, "safe.csv"), "utf8"),
      /"mine"/,
    );
    assert.deepEqual(steps, ["lease", "commit", "succeeded", "audit", "event", "commit"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
