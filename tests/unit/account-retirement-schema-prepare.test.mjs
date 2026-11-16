import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectAccountProductionLegacySchema,
  prepareAccountProductionPrerequisites,
  prepareAccountRetirementSchema,
} from "../../scripts/prepare-account-retirement-schema.mjs";
import {
  compileAccountRetirementProduction,
  planAccountRetirementProduction,
} from "../../scripts/plan-account-retirement-production.mjs";

test("production prerequisite writer requires exact SQL and the same idle release session", async () => {
  const plan = await planAccountRetirementProduction();
  const compiled = await compileAccountRetirementProduction(plan.plan_sha256);
  const good = { db: "product_scout", version: "5.7.44", authenticated_as: "product_scout@localhost" };
  for (const [bundle, fence, error, expectedCalls] of [
    [{ ...compiled, prerequisites: [] }, { locked: 1, other_sessions: 0 }, "account_release_prerequisites_plan_invalid", 1],
    [compiled, { locked: 0, other_sessions: 0 }, "account_release_prerequisites_not_fenced", 2],
    [compiled, { locked: 1, other_sessions: 1 }, "account_release_prerequisites_not_fenced", 2],
  ]) {
    const calls = [];
    await assert.rejects(prepareAccountProductionPrerequisites({
      async query(sql) {
        calls.push(sql);
        if (/^SELECT DATABASE/.test(sql)) return [[good]];
        if (/^SELECT IS_USED_LOCK/.test(sql)) {
          assert.match(sql, /=CONNECTION_ID\(\)/);
          return [[fence]];
        }
        assert.fail(sql);
      },
    }, bundle), { message: error });
    assert.equal(calls.length, expectedCalls);
  }
  const calls = [];
  const properSourceButMissingTables = await prepareAccountProductionPrerequisites({
    async query(sql) {
      calls.push(sql);
      if (/^SELECT DATABASE/.test(sql)) return [[good]];
      if (/^SELECT IS_USED_LOCK/.test(sql)) return [[{ locked: 1, other_sessions: 0 }]];
      if (/^SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
      if (/^SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
      assert.match(sql, /information_schema\.TABLES/);
      return [[]];
    },
  }, compiled);
  assert.equal(properSourceButMissingTables.status, "source_schema_incompatible");
  assert.ok(!calls.some((x) => /^(CREATE|ALTER|DROP|INSERT)/.test(x)));
});

test("production legacy metadata verifier cannot run with root, a wrong schema or a wrong version", async () => {
  const good = {
    db: "product_scout",
    version: "5.7.44-log",
    authenticated_as: "product_scout@localhost",
  };
  for (const override of [
    { db: "product_scout_copy_rehearsal" },
    { version: "8.0.44" },
    { authenticated_as: "root@localhost" },
  ]) {
    let calls = 0;
    await assert.rejects(
      inspectAccountProductionLegacySchema({
        async query(statement) {
          calls++;
          assert.match(statement, /^SELECT DATABASE\(\)/);
          return [[{ ...good, ...override }]];
        },
      }),
      /account_release_legacy_schema_target_invalid/,
    );
    assert.equal(calls, 1);
  }
  const seen = [];
  const report = await inspectAccountProductionLegacySchema({
    async query(statement) {
      seen.push(statement);
      if (statement.startsWith("SELECT DATABASE()")) return [[good]];
      assert.match(statement, /FROM information_schema\.TABLES/);
      return [
        [{ table_name: "account_owned_records", column_name: "source_id", engine: "InnoDB" }],
      ];
    },
  });
  assert.equal(report.status, "source_schema_incompatible");
  assert.equal(report.executable, false);
  assert.deepEqual(report.existing_targets, ["account_owned_records"]);
  assert.equal(seen.length, 2);
});

test("schema preparation stops before DDL on the wrong database or a competing lock", async () => {
  for (const [db, version, error, queryCount] of [
    ["product_scout", "5.7.44", "mysql57_rehearsal_database_required", 1],
    ["product_scout_copy_rehearsal", "8.0.44", "mysql57_rehearsal_database_required", 1],
    ["product_scout_copy_rehearsal", "5.7.44", "account_rehearsal_schema_lock_busy", 2],
  ]) {
    const calls = [];
    await assert.rejects(
      prepareAccountRetirementSchema(
        {
          async query(sql) {
            calls.push(sql);
            if (sql.startsWith("SELECT DATABASE")) return [[{ db, version }]];
            if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 0 }]];
            assert.fail(sql);
          },
        },
        { apply: true },
      ),
      { message: error },
    );
    assert.equal(calls.length, queryCount);
  }
});

test("schema preparation permits both absent scope columns but refuses one missing scope column", async () => {
  const evidence = "collection_task_evidence_links",
    escalations = "approval_escalation_jobs",
    browserJobs = "browser_collection_jobs";
  const rows = {
    [evidence]: [
      "id",
      "collection_task_id",
      "collection_subquery_id",
      "raw_evidence_id",
      "normalized_record_id",
      "provider_id",
    ],
    [escalations]: ["id", "approval_request_id", "node_run_id"],
    [browserJobs]: ["id", "collection_task_id", "collection_subquery_id", "provider_id"],
  };
  const checks = async (scope) => {
    const report = await prepareAccountRetirementSchema({
      async query(sql) {
        if (sql.startsWith("SELECT DATABASE"))
          return [[{ db: "product_scout_copy_rehearsal", version: "5.7.44" }]];
        if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }]];
        if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }]];
        assert.match(sql, /information_schema.TABLES/);
        return [
          Object.entries(rows).flatMap(([table_name, columns]) =>
            [...columns, ...scope].map((column_name) => ({
              table_name,
              column_name,
              engine: "InnoDB",
            })),
          ),
        ];
      },
    });
    // Other business tables are intentionally omitted in this metadata fixture.
    return report.missing.filter(({ table }) =>
      [evidence, escalations, browserJobs].includes(table),
    );
  };
  assert.deepEqual(await checks([]), []);
  assert.deepEqual(await checks(["organization_id", "workspace_id"]), []);
  assert.deepEqual(await checks(["workspace_id"]), [
    { table: escalations, reason: "partial_scope_schema" },
    { table: evidence, reason: "partial_scope_schema" },
    { table: browserJobs, reason: "partial_scope_schema" },
  ]);
});
