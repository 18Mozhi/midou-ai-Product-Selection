import assert from "node:assert/strict";
import test from "node:test";
import { verifyAccountRetirementOwnership } from "../../scripts/verify-account-retirement-ownership.mjs";
import { accountScopeSourceNames } from "../../scripts/stage-account-scope-retirement.mjs";

function fixture({
  db = "product_scout_restore_m0704_3a10e02cf47d_rehearsal",
  receipt = true,
  invalid = "0",
  wrongPrimary = "0",
  missing = "0",
  extra = "0",
  ledgerTotal = "19",
  supplementalMissing = "0",
  selectiveMissing = "0",
  quoteInvalid = "0",
  comparisonInvalid = "0",
  quoteChecked = "1",
  comparisonChecked = "1",
  fxChecked = "1",
  fxInaccessible = "0",
  emptyQuotes = false,
  nativeEvidence = false,
  rawInvalid = "0",
  normalizedInvalid = "0",
  evidenceChecked = "1",
  nativeTopics = false,
  invalidTopics = "0",
  topicChecked = "1",
  nativeTasks = false,
  invalidTasks = "0",
  taskChecked = "1",
  anchored = false,
  nativeBusiness = false,
  invalidBusiness = "0",
  businessChecked = "1",
  nativeCompetitor = false,
  competitorRefs = "0",
  nativeOpportunity = false,
  opportunityRefs = "0",
  comparisonShape = anchored ? ["anchor_quote_id"] : ["organization_id", "workspace_id"],
  ruleShapes = {},
  ruleInvalid = {},
  ruleChecked = {},
  approvalInvalid = "0",
  approvalChecked = "1",
  retired = false,
  physicalResidue = false,
  archiveWithoutReceipt = false,
  legacyColumn = false,
  foreignReference = false,
} = {}) {
  const commands = [];
  return {
    commands,
    async query(sql) {
      commands.push(sql);
      if (sql.includes("0197_retire_tenancy_roots.up.sql")) return [[{ applied: retired ? 1 : 0 }]];
      if (
        sql.includes("FROM information_schema.TABLES") &&
        sql.includes("historical_organizations")
      )
        return [
          [
            ...(retired || archiveWithoutReceipt
              ? [
                  "historical_organizations",
                  "historical_workspaces",
                  ...(physicalResidue ? ["organizations"] : []),
                ]
              : ["organizations", "workspaces"]
            ).map((table_name) => ({ table_name, table_type: "BASE TABLE" })),
          ],
        ];
      if (
        sql.includes("FROM information_schema.COLUMNS") &&
        sql.includes("COLUMN_NAME IN ('organization_id','workspace_id')")
      )
        return [
          [
            { table_name: "historical_workspaces", column_name: "organization_id" },
            ...(legacyColumn ? [{ table_name: "tasks", column_name: "workspace_id" }] : []),
          ],
        ];
      if (
        sql.includes("FROM information_schema.KEY_COLUMN_USAGE") &&
        sql.includes("historical_workspaces")
      )
        return [
          [
            {
              local_schema: 1,
              table_name: "historical_organizations",
              constraint_name: "fk_organizations_default_workspace",
              column_name: "default_workspace_id",
              target_table: "historical_workspaces",
              target_column: "id",
            },
            {
              local_schema: 1,
              table_name: "historical_workspaces",
              constraint_name: "fk_workspaces_org",
              column_name: "organization_id",
              target_table: "historical_organizations",
              target_column: "id",
            },
            ...(foreignReference
              ? [
                  {
                    local_schema: 0,
                    table_name: "external_lookup",
                    constraint_name: "fk_external_org",
                    column_name: "organization_id",
                    target_table: "historical_organizations",
                    target_column: "id",
                  },
                ]
              : []),
          ],
        ];
      const rule =
        /^SHOW COLUMNS FROM (score_rules|cost_rules|trend_monitoring_rules|competitor_monitor_rules|automation_rules) /.exec(
          sql,
        )?.[1];
      if (rule)
        return [
          (ruleShapes[rule] ?? ["organization_id", "workspace_id"]).map((Field) => ({ Field })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM sourcing_comparisons"))
        return [comparisonShape.map((Field) => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [
          (nativeTasks ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
            Field,
          })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM tasks"))
        return [
          (nativeBusiness ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
            Field,
          })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM competitors"))
        return [
          (nativeCompetitor ? ["account_id"] : ["organization_id", "workspace_id"]).map(
            (Field) => ({ Field }),
          ),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [
          (nativeOpportunity ? ["account_id"] : ["organization_id", "workspace_id"]).map(
            (Field) => ({ Field }),
          ),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics"))
        return [
          (nativeTopics ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
            Field,
          })),
        ];
      if (/^SHOW COLUMNS FROM (raw_evidence|normalized_records) /.test(sql))
        return [
          (nativeEvidence ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
            Field,
          })),
        ];
      if (sql.includes("FROM cost_rule_approvals"))
        return [[{ id: "approval", approval_role: "primary_account" }]];
      return [[{ db, version: "5.7.44-log" }]];
    },
    async execute(sql, args) {
      commands.push(sql);
      if (sql.includes("approval_checked")) {
        assert.deepEqual(args, ["sealed"]);
        assert.match(sql, /p.id=a.cost_rule_id/);
        assert.match(sql, /ar.account_id<=>pr.account_id AND ar.reason<=>pr.reason/);
        assert.match(
          sql,
          /asrc.legacy_org_id<=>psrc.legacy_org_id AND asrc.legacy_workspace_id<=>psrc.legacy_workspace_id/,
        );
        assert.equal(
          sql.includes("p.account_id<=>pr.account_id"),
          ruleShapes.cost_rules?.includes("account_id") ?? false,
        );
        return [[{ approval_checked: approvalChecked, invalid: approvalInvalid }]];
      }
      if (sql.includes("rule_checked")) {
        const table = /FROM (\w+) q/.exec(sql)?.[1];
        assert.deepEqual(args, ["sealed", table]);
        assert.match(sql, /r\.source_id=q\.id/);
        assert.match(sql, /o\.account_id=s\.account_id AND o\.reason=s\.reason/);
        assert.match(sql, /q\.historical_context[\s\S]*r\.legacy_workspace_id/);
        assert.equal(sql.includes("q.account_id"), table !== "competitor_monitor_rules");
        return [[{ rule_checked: ruleChecked[table] ?? "1", invalid: ruleInvalid[table] ?? "0" }]];
      }
      if (sql.includes("invalid_references")) {
        if (sql.includes("FROM opportunities p")) {
          assert.match(sql, /t.id=p.source_ref_id/);
          assert.match(sql, /p.account_id<=>t.account_id/);
          assert.match(sql, /p.account_id<=>o.account_id/);
          return [[{ invalid_references: opportunityRefs }]];
        }
        assert.match(sql, /s.id=c.latest_snapshot_id AND s.competitor_id=c.id/);
        assert.match(sql, /c.account_id<=>p.account_id/);
        return [[{ invalid_references: competitorRefs }]];
      }
      if (sql.includes("task_checked")) {
        assert.deepEqual(args, ["sealed"]);
        assert.match(sql, /o.source_id=t.id AND o.account_id=t.account_id/);
        assert.match(sql, /t.account_id<=>s.account_id AND o.reason<=>s.reason/);
        assert.doesNotMatch(sql, /t\.(organization_id|workspace_id)/);
        if (sql.includes("FROM tasks t")) {
          assert.match(sql, /r.source_table='tasks'/);
          return [[{ task_checked: businessChecked, invalid: invalidBusiness }]];
        }
        return [[{ task_checked: taskChecked, invalid: invalidTasks }]];
      }
      if (sql.includes("topic_checked")) {
        assert.deepEqual(args, ["sealed"]);
        assert.match(sql, /o.source_id=t.id AND o.account_id=t.account_id/);
        assert.match(sql, /t.account_id<=>s.account_id AND o.reason<=>s.reason/);
        return [[{ topic_checked: topicChecked, invalid: invalidTopics }]];
      }
      if (sql.includes("JOIN users u")) {
        assert.deepEqual(args, ["2313645627@qq.com"]);
        assert.match(sql, /contract_version=25.*u.status='active'/s);
        return [
          receipt
            ? [
                {
                  source_run_id: "sealed",
                  primary_account_id: "private-user",
                  source_record_count: "19",
                },
              ]
            : [],
        ];
      }
      if (sql.includes("wrong_primary")) {
        assert.deepEqual(args, ["private-user", "sealed"]);
        assert.match(
          sql,
          /o.source_id=r.source_id\s+AND o.account_id=s.account_id AND o.reason=s.reason/,
        );
        assert.match(sql, /SELECT COUNT\(\*\) FROM account_owned_records/);
        return [
          [
            {
              staged: "19",
              ledger_total: ledgerTotal,
              shared: "12",
              unassigned: "1",
              exclusive: "6",
              invalid,
              wrong_primary: wrongPrimary,
            },
          ],
        ];
      }
      if (sql.includes("inaccessible_evidence")) {
        assert.deepEqual(args, ["sealed"]);
        assert.match(sql, /eo.account_id=qo.account_id/);
        return [
          [
            {
              checked: emptyQuotes ? "0" : fxChecked,
              missing_evidence: "0",
              provider_mismatch: "0",
              inaccessible_evidence: fxInaccessible,
            },
          ],
        ];
      }
      if (sql.includes("COUNT(*) checked")) {
        assert.deepEqual(args, ["sealed"]);
        if (/FROM (raw_evidence|normalized_records) x/.test(sql)) {
          const raw = sql.includes("FROM raw_evidence x");
          assert.match(sql, /o.source_id=x.id AND o.account_id=x.account_id/);
          assert.match(sql, /workspace_id <=> r.legacy_workspace_id/);
          assert.match(
            sql,
            raw
              ? /q.task_id=p.id AND q.provider_id=x.provider_id/
              : /p.provider_id=x.provider_id AND p.account_id=x.account_id/,
          );
          if (nativeTasks) {
            assert.match(sql, /record.run_id=cut.source_run_id/);
            assert.match(
              sql,
              raw
                ? /p.id=x.collection_task_id AND p.account_id=x.account_id/
                : /t.id=p.collection_task_id AND t.account_id=x.account_id/,
            );
          }
          return [[{ checked: evidenceChecked, invalid: raw ? rawInvalid : normalizedInvalid }]];
        }
        if (
          sql.includes("FROM supplier_quotes") ||
          sql.includes("JOIN supplier_quotes q ON q.id=r.source_id")
        ) {
          assert.match(sql, /eo.account_id=qo.account_id/);
          assert.match(sql, /n.raw_evidence_id=ce.id/);
          assert.match(sql, /sto.source_id=st.id AND sto.account_id=qo.account_id/);
          assert.equal(sql.includes("st.account_id=qo.account_id"), nativeTasks);
          for (const alias of ["e", "ce", "n"])
            assert.equal(
              new RegExp(`\\b${alias}\\.account_id=qo\\.account_id`).test(sql),
              nativeEvidence,
            );
          return [[{ checked: emptyQuotes ? "0" : quoteChecked, invalid: quoteInvalid }]];
        }
        assert.match(sql, /qo.account_id=co.account_id/);
        assert.match(sql, /COUNT\(DISTINCT CASE WHEN JSON_TYPE/);
        assert.equal(sql.includes("NOT (c.anchor_quote_id <=>"), anchored);
        return [[{ checked: emptyQuotes ? "0" : comparisonChecked, invalid: comparisonInvalid }]];
      }
      assert.equal(args[0], "sealed");
      assert.match(sql, /live.id=r.source_id/);
      if (sql.includes("r.source_table='outbox_events'")) {
        assert.deepEqual(args, ["sealed"]);
        return [[{ staged_rows: "1", missing_original: selectiveMissing }]];
      }
      const isQuote = args[1] === "supplier_quotes";
      if (
        emptyQuotes &&
        ["supplier_quotes", "sourcing_comparisons", "exchange_rate_quotes"].includes(args[1])
      )
        return [
          [
            {
              source_rows: "0",
              staged_rows: "0",
              missing_original: "0",
              shared: "0",
              unassigned: "0",
              exclusive: "0",
            },
          ],
        ];
      return [
        [
          {
            source_rows: isQuote ? String(1n + BigInt(extra)) : "1",
            staged_rows: "1",
            missing_original: isQuote
              ? missing
              : args[1] === "normalized_records"
                ? supplementalMissing
                : "0",
            shared: "1",
            unassigned: "0",
            exclusive: "0",
          },
        ],
      ];
    },
    async rollback() {
      commands.push("ROLLBACK");
    },
  };
}

test("completed root retirement blocks a sealed ownership report if a runtime root still exists", async () => {
  const good = await verifyAccountRetirementOwnership(fixture({ retired: true }));
  assert.equal(good.status, "ownership_verified");
  assert.equal(good.tenancy_schema.status, "retired");
  const bad = await verifyAccountRetirementOwnership(
    fixture({ retired: true, physicalResidue: true }),
  );
  assert.equal(bad.wrong_primary_rows, "0");
  assert.equal(bad.status, "blocked");
  assert.equal(bad.tenancy_schema.status, "mismatch");
  assert.equal(bad.tenancy_schema.runtime_roots, 1);
  const baseline = await verifyAccountRetirementOwnership(fixture());
  assert.equal(baseline.tenancy_schema.status, "not_applied");
  for (const [fixtureOptions, key, value] of [
    [{ retired: true, legacyColumn: true }, "legacy_columns", 2],
    [{ retired: true, foreignReference: true }, "unexpected_references", 1],
    [{ archiveWithoutReceipt: true }, "archived_roots", 2],
  ]) {
    const result = await verifyAccountRetirementOwnership(fixture(fixtureOptions));
    assert.equal(result.status, "blocked");
    assert.equal(result.tenancy_schema.status, "mismatch");
    assert.equal(result.tenancy_schema[key], value);
  }
});

test("post-cutover rule readback rejects mismatched or missing rule ownership and archive scope", async () => {
  const ruleShapes = Object.fromEntries(
    ["score_rules", "cost_rules", "trend_monitoring_rules", "automation_rules"].map((table) => [
      table,
      ["account_id", "historical_context"],
    ]),
  );
  ruleShapes.competitor_monitor_rules = ["historical_context"];
  const result = await verifyAccountRetirementOwnership(fixture({ ruleShapes }));
  assert.equal(result.status, "ownership_verified");
  assert.equal(result.rule_ownership.competitor_monitor_rules.layout, "ledger");
  for (const table of Object.keys(ruleShapes)) {
    assert.equal(result.rule_ownership[table].invalid, "0");
    const bad = await verifyAccountRetirementOwnership(
      fixture({ ruleShapes, ruleInvalid: { [table]: "1" } }),
    );
    assert.equal(bad.status, "blocked", table);
  }
  const missing = await verifyAccountRetirementOwnership(
    fixture({ ruleShapes, ruleChecked: { cost_rules: "0" } }),
  );
  assert.equal(missing.status, "blocked");
  await assert.rejects(
    verifyAccountRetirementOwnership(
      fixture({ ruleShapes: { cost_rules: ["account_id", "workspace_id"] } }),
    ),
    /invalid_rule_scope_schema/,
  );
  const transitional = await verifyAccountRetirementOwnership(
    fixture({
      ruleShapes: { trend_monitoring_rules: ["account_id", "workspace_id", "organization_id"] },
    }),
  );
  assert.deepEqual(transitional.rule_ownership.trend_monitoring_rules, { layout: "legacy" });
});

test("0193 read-only ownership gate blocks an incorrect native account or incomplete coverage", async () => {
  const good = await verifyAccountRetirementOwnership(fixture({ nativeBusiness: true }));
  assert.equal(good.status, "ownership_verified");
  assert.deepEqual(good.business_task_ownership, { layout: "account", checked: "1", invalid: "0" });
  for (const options of [{ invalidBusiness: "1" }, { businessChecked: "0" }])
    assert.equal(
      (await verifyAccountRetirementOwnership(fixture({ nativeBusiness: true, ...options })))
        .status,
      "blocked",
    );
});

test("0195 ownership verifier requires the original native topic as well as the sealed opportunity", async () => {
  const good = await verifyAccountRetirementOwnership(
    fixture({ nativeOpportunity: true, nativeTopics: true }),
  );
  assert.equal(good.status, "ownership_verified");
  assert.deepEqual(good.opportunity_ownership, {
    layout: "account",
    checked: "1",
    invalid: "0",
    invalid_references: "0",
  });
  assert.equal(
    (
      await verifyAccountRetirementOwnership(
        fixture({ nativeOpportunity: true, nativeTopics: true, opportunityRefs: "1" }),
      )
    ).status,
    "blocked",
  );
  await assert.rejects(
    verifyAccountRetirementOwnership(fixture({ nativeOpportunity: true })),
    /opportunity_topic_scope_schema_invalid/,
  );
});

test("0194 verifier refuses a foreign competitor parent or stale latest snapshot", async () => {
  const good = await verifyAccountRetirementOwnership(fixture({ nativeCompetitor: true }));
  assert.equal(good.status, "ownership_verified");
  assert.equal(good.competitor_ownership.invalid_references, "0");
  assert.equal(
    (
      await verifyAccountRetirementOwnership(
        fixture({ nativeCompetitor: true, competitorRefs: "1" }),
      )
    ).status,
    "blocked",
  );
});

test("verifies seven domains and emits counts only from a read-only snapshot", async () => {
  const connection = fixture();
  const report = await verifyAccountRetirementOwnership(connection, "sealed");
  assert.equal(report.status, "ownership_verified");
  assert.equal(report.cost_approval_audit.count, 1);
  assert.deepEqual(report.cost_approval_ownership, { checked: "1", invalid: "0" });
  assert.deepEqual(report.cost_approval_audit.roles, ["primary_account"]);
  assert.match(report.cost_approval_audit.sha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.keys(report.domains).length, 7);
  assert.deepEqual(report.ownership_reasons, { shared: "12", unassigned: "1", exclusive: "6" });
  assert.equal(report.unmatched_ledger_rows, "0");
  assert.equal(report.domains.quotes.supplier_quotes.source_rows, "1");
  assert.equal(report.domains.quotes.exchange_rate_quotes.source_rows, "1");
  assert.deepEqual(report.quote_references, {
    supplier_quotes: { checked: "1", invalid: "0" },
    sourcing_comparisons: { checked: "1", invalid: "0" },
  });
  assert.equal(report.supplemental_tables.normalized_records.source_rows, "1");
  assert.deepEqual(
    new Set([
      ...Object.values(report.domains).flatMap(Object.keys),
      ...Object.keys(report.supplemental_tables),
      "outbox_events",
    ]),
    new Set(accountScopeSourceNames),
  );
  assert.equal(report.selective_outbox.staged_rows, "1");
  assert.doesNotMatch(JSON.stringify(report), /private-user|sealed\"|2313645627/);
  assert.match(connection.commands[2], /READ ONLY$/);
  assert.equal(connection.commands.at(-1), "ROLLBACK");
});

test("approval ownership rejects broken original rule links even if row counts and signatures exist", async () => {
  const ruleShapes = { cost_rules: ["account_id", "historical_context"] };
  for (const config of [{ approvalInvalid: "1" }, { approvalChecked: "0" }]) {
    const db = fixture({ ruleShapes, ...config });
    assert.equal((await verifyAccountRetirementOwnership(db)).status, "blocked");
    assert.equal(db.commands.at(-1), "ROLLBACK");
  }
});

test("quote readback verifies the first-quote anchor and rejects partially migrated comparison layouts", async () => {
  assert.equal(
    (await verifyAccountRetirementOwnership(fixture({ anchored: true, nativeTasks: true }))).status,
    "ownership_verified",
  );
  assert.equal(
    (
      await verifyAccountRetirementOwnership(
        fixture({ anchored: true, nativeTasks: true, comparisonInvalid: "1" }),
      )
    ).status,
    "blocked",
  );
  const partial = fixture({ comparisonShape: ["anchor_quote_id", "organization_id"] });
  await assert.rejects(
    verifyAccountRetirementOwnership(partial),
    /sourcing_comparison_scope_shape_invalid/,
  );
  assert.equal(partial.commands.at(-1), "ROLLBACK");
});

test("supplier quote gate requires native evidence owners as well as the ledger", async () => {
  const options = { anchored: true, nativeTasks: true, nativeEvidence: true };
  assert.equal(
    (await verifyAccountRetirementOwnership(fixture(options))).status,
    "ownership_verified",
  );
  const bad = await verifyAccountRetirementOwnership(fixture({ ...options, quoteInvalid: "1" }));
  assert.equal(bad.status, "blocked");
  assert.equal(bad.quote_coverage.supplier_quotes.status, "mismatch");
});

test("retains an FX quote with inaccessible evidence without treating it as usable", async () => {
  const report = await verifyAccountRetirementOwnership(fixture({ fxInaccessible: "1" }));
  assert.equal(report.status, "ownership_verified");
  assert.equal(report.fx_evidence.checked, "1");
  assert.equal(report.fx_evidence.inaccessible_evidence, "1");
  assert.equal(report.quote_coverage.exchange_rate_quotes.status, "historical_rows_checked");
});

test("quote evidence distinguishes an empty snapshot from positive coverage and a mismatched reference", async () => {
  const empty = await verifyAccountRetirementOwnership(fixture({ emptyQuotes: true }));
  assert.equal(empty.status, "ownership_verified");
  for (const result of Object.values(empty.quote_coverage)) {
    assert.deepEqual(result, { source_rows: "0", checked_rows: "0", status: "no_historical_rows" });
  }
  const positive = await verifyAccountRetirementOwnership(fixture());
  assert.equal(positive.quote_coverage.supplier_quotes.status, "historical_rows_checked");
  const bad = await verifyAccountRetirementOwnership(fixture({ quoteInvalid: "1" }));
  assert.equal(bad.status, "blocked");
  assert.equal(bad.quote_coverage.supplier_quotes.status, "mismatch");
});

test("0190 readback refuses native evidence drift even when ID coverage and the ledger match", async () => {
  const valid = await verifyAccountRetirementOwnership(fixture({ nativeEvidence: true }));
  assert.equal(valid.status, "ownership_verified");
  assert.deepEqual(valid.evidence_ownership, {
    layout: "account",
    raw_evidence: { checked: "1", invalid: "0" },
    normalized_records: { checked: "1", invalid: "0" },
  });
  for (const options of [{ rawInvalid: "1" }, { normalizedInvalid: "1" }, { evidenceChecked: "0" }])
    assert.equal(
      (await verifyAccountRetirementOwnership(fixture({ nativeEvidence: true, ...options })))
        .status,
      "blocked",
    );
});

test("0191 readback blocks mismatched topic accounts and short coverage", async () => {
  const valid = await verifyAccountRetirementOwnership(fixture({ nativeTopics: true }));
  assert.equal(valid.status, "ownership_verified");
  assert.deepEqual(valid.trend_topic_ownership, { layout: "account", checked: "1", invalid: "0" });
  for (const options of [{ invalidTopics: "1" }, { topicChecked: "0" }])
    assert.equal(
      (await verifyAccountRetirementOwnership(fixture({ nativeTopics: true, ...options }))).status,
      "blocked",
    );
});

test("0192 readback blocks native task or evidence drift independently of sealed ledger totals", async () => {
  const valid = await verifyAccountRetirementOwnership(
    fixture({ nativeTasks: true, nativeEvidence: true }),
  );
  assert.equal(valid.status, "ownership_verified");
  assert.deepEqual(valid.collection_task_ownership, {
    layout: "account",
    checked: "1",
    invalid: "0",
  });
  for (const options of [{ invalidTasks: "1" }, { taskChecked: "0" }, { normalizedInvalid: "1" }])
    assert.equal(
      (
        await verifyAccountRetirementOwnership(
          fixture({ nativeTasks: true, nativeEvidence: true, ...options }),
        )
      ).status,
      "blocked",
    );
});

test("blocks production before opening a transaction, and rejects a wrong or missing receipt", async () => {
  const production = fixture({ db: "product_scout" });
  await assert.rejects(
    () => verifyAccountRetirementOwnership(production),
    /mysql57_rehearsal_database_required/,
  );
  assert.equal(production.commands.length, 1);
  for (const [connection, run] of [
    [fixture(), "other-run"],
    [fixture({ receipt: false }), "sealed"],
  ]) {
    assert.equal((await verifyAccountRetirementOwnership(connection, run)).status, "blocked");
    assert.equal(connection.commands.at(-1), "ROLLBACK");
  }
});

test("blocks an owner/reason mismatch, misassigned shared row, missing original, or unsealed source row", async () => {
  for (const options of [
    { invalid: "1" },
    { wrongPrimary: "1" },
    { missing: "1" },
    { extra: "1" },
    { ledgerTotal: "20" },
    { supplementalMissing: "1" },
    { selectiveMissing: "1" },
    { quoteInvalid: "1" },
    { comparisonInvalid: "1" },
    { quoteChecked: "0" },
    { comparisonChecked: "0" },
    { fxChecked: "0" },
  ]) {
    const connection = fixture(options);
    assert.equal((await verifyAccountRetirementOwnership(connection)).status, "blocked");
    assert.equal(connection.commands.at(-1), "ROLLBACK");
  }
});
