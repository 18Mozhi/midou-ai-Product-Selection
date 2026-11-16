import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  accountScopeInheritedSources,
  accountScopeSourceNames,
  accountScopeSources,
  findAccountUniqueKeyCollisions,
  stageAccountProductionRetirement,
  stageAccountScopeRetirement,
} from "../../scripts/stage-account-scope-retirement.mjs";
import { planAccountRetirementProduction } from "../../scripts/plan-account-retirement-production.mjs";

const migrations = new URL("../../database/migrations/", import.meta.url);
const quoteA = "00000000-0000-4000-8000-0000000000a1";
const quoteB = "00000000-0000-4000-8000-0000000000b2";
const comparisonId = "00000000-0000-4000-8000-0000000000c3";

test("production staging refuses without its fence, receipts, or empty staging ledger", async () => {
  const plan = await planAccountRetirementProduction();
  const receipts = plan.prerequisites.map(({ name, candidate_sha256: checksum }) => ({ name, checksum }));
  for (const [fence, prefix, existing, error] of [
    [{ locked: 1, other_sessions: 1 }, receipts, 0, "account_release_staging_not_fenced"],
    [{ locked: 1, other_sessions: 0 }, receipts.slice(0, 2), 0, "account_release_staging_requires_exact_prerequisites"],
    [{ locked: 1, other_sessions: 0 }, receipts, 1, "account_release_staging_requires_unmigrated_source"],
  ]) {
    const calls = [];
    const connection = {
      async query(sql) {
        calls.push(sql);
        if (sql.startsWith("SELECT DATABASE")) return [[{ db: "product_scout", version: "5.7.44", authenticated_as: "product_scout@localhost" }]];
        if (sql.startsWith("SELECT IS_USED_LOCK")) return [[fence]];
        if (sql.startsWith("SET TRANSACTION") || sql.startsWith("START TRANSACTION")) return [];
        if (sql.includes("SELECT name,checksum")) return [prefix];
        if (sql.includes("staged_runs")) return [[{ staged_runs: existing, cutover_rows: 0, forward_receipts: 0 }]];
        assert.fail(sql);
      },
      async rollback() { calls.push("rollback"); },
      async execute(sql) { assert.fail(sql); },
    };
    await assert.rejects(stageAccountProductionRetirement(connection, plan), { message: error });
    assert.equal(calls.includes("rollback"), fence.other_sessions === 0);
  }
});

test("staging contracts match the source schemas and their scoped relationship columns", () => {
  const schema = readdirSync(migrations)
    .filter((name) => name.endsWith(".up.sql"))
    .map((name) => readFileSync(new URL(name, migrations), "utf8"))
    .join("\n");
  const definitions = new Map(
    Array.from(
      schema.matchAll(/CREATE TABLE `?(\w+)`?\s*\(([\s\S]*?)\)\s*ENGINE=/gi),
      ([, name, sql]) => [name, sql],
    ),
  );
  for (const [table, links] of Object.entries(accountScopeSources)) {
    const created = definitions.get(table);
    assert.ok(created, table);
    const alterations = [
      ...schema.matchAll(new RegExp(`ALTER TABLE \`?${table}\`?\\s+([^;]+);`, "gi")),
    ];
    const definition = [created, ...alterations.map((m) => m[1])].join("\n");
    for (const column of [
      "id",
      "organization_id",
      "workspace_id",
      ...links.map(([name]) => name),
    ]) {
      assert.match(
        definition,
        new RegExp(
          `\\b${column}\u0060?\\s+${column === "input_ref" ? "VARCHAR\\(2048\\)" : "CHAR\\(36\\)"}`,
          "i",
        ),
        `${table}.${column}`,
      );
    }
    for (const [, parent, discriminator, value] of links) {
      for (const name of Array.isArray(parent) ? parent : [parent])
        assert.ok(Object.hasOwn(accountScopeSources, name));
      if (discriminator)
        assert.match(
          definition,
          new RegExp(
            discriminator === "resource_type" &&
              /^(trend_events|evidence_data_events|evidence_data_outbox)$/.test(table)
              ? "\\bresource_type\u0060?\\s+VARCHAR\\(80\\)"
              : discriminator === "event_type" &&
                  /^(competitor_events|sourcing_events|sourcing_outbox)$/.test(table)
                ? "\\bevent_type\u0060?\\s+VARCHAR\\(120\\)"
                : discriminator === "action_resource_type" && table === "automation_executions"
                  ? "\\baction_resource_type\u0060?\\s+VARCHAR\\(40\\)"
                  : `\\b${discriminator}\u0060?\\s+ENUM\\([^)]*'${value}'`,
            "i",
          ),
        );
    }
  }
  for (const [table, [column, parent]] of Object.entries(accountScopeInheritedSources)) {
    const definition = definitions.get(table);
    assert.ok(definition, table);
    assert.doesNotMatch(definition, /organization_id|workspace_id/);
    assert.match(
      definition,
      new RegExp(
        "FOREIGN KEY\\s*\\(\x60?" + column + "\x60?\\)\\s*REFERENCES\\s*\x60?" + parent + "\x60?",
        "i",
      ),
    );
    assert.ok(Object.hasOwn(accountScopeSources, parent));
  }
  const up = definitions.get("account_retirement_records");
  assert.match(up, /PRIMARY KEY \(run_id,source_table,source_id\)/);
  assert.match(
    up,
    /REFERENCES account_retirement_scopes \(run_id,legacy_org_id,legacy_workspace_id\)/,
  );
});

function rehearsal({
  db = "product_scout_scope_rehearsal",
  broken = false,
  mismatch = false,
  missing = false,
  collisions = false,
  brokenApproval = false,
  brokenQuote = false,
  brokenPurchase = false,
  brokenCompetitorRule = false,
  unmatchedBrowserArtifact = false,
  unknownEvidenceHistory = false,
  unpairedEvidenceDelivery = false,
  unpairedOpportunityDelivery = false,
  opportunityDeliveryShape = ["organization_id", "workspace_id"],
  opportunityEventScopeColumns = ["organization_id", "workspace_id"],
  evidenceEventScopeColumns = ["organization_id", "workspace_id"],
  evidenceOutboxScopeColumns = ["organization_id", "workspace_id"],
  unpairedTrendDelivery = false,
  badApprovalDelivery = false,
  badTaskDelivery = false,
  badRedecision = false,
  mismatchedCompetitorJob = false,
  unpairedCompetitorOutbox = false,
  brokenDeliveryTable = null,
  brokenInherited = false,
  approvalScopeColumns = ["organization_id", "workspace_id"],
  brokenCostApprovalParent = false,
  keywordScopeColumns = ["organization_id", "workspace_id"],
  brokenKeywordParent = false,
  signalScopeColumns = ["organization_id", "workspace_id"],
  taskHistoryScopeColumns = ["organization_id", "workspace_id"],
  approvalHistoryScopeColumns = ["organization_id", "workspace_id"],
  approvalTemplateNodeScopeColumns = ["organization_id", "workspace_id"],
  approvalTemplateVersionScopeColumns = ["organization_id", "workspace_id"],
  approvalRequestScopeColumns = ["organization_id", "workspace_id"],
  quoteScopeColumns = ["organization_id", "workspace_id"],
  purchaseScopeColumns = ["organization_id", "workspace_id"],
  candidateScopeColumns = ["organization_id", "workspace_id"],
  competitorHistoryScopeColumns = ["organization_id", "workspace_id"],
  decisionScopeColumns = ["organization_id", "workspace_id"],
  opportunityInputScopeColumns = ["organization_id", "workspace_id"],
  brokenOpportunityInputParent = null,
  calculationJobScopeColumns = ["organization_id", "workspace_id"],
  journeyScopeColumns = ["organization_id", "workspace_id"],
  evidenceLinkScopeColumns = ["organization_id", "workspace_id"],
  fieldProvenanceScopeColumns = ["organization_id", "workspace_id"],
  trendProjectionScopeColumns = ["organization_id", "workspace_id"],
  brokenTrendProjectionParent = false,
  invalidVerificationParentCount = null,
  comparison = null,
  comparisonQuotes = [],
  comparisonShape = ["organization_id", "workspace_id"],
  comparisonOwnershipTotal = 0,
  executionScopeColumns = ["organization_id", "workspace_id"],
  brokenExecutionNotification = false,
  browserArtifactScopeColumns = ["organization_id", "workspace_id"],
  competitorEventScopeColumns = ["organization_id", "workspace_id"],
  competitorRuleScopeColumns = ["organization_id", "workspace_id"],
  competitorOutboxScopeColumns = ["organization_id", "workspace_id"],
  trendOutboxScopeColumns = ["organization_id", "workspace_id"],
  trendEventScopeColumns = ["organization_id", "workspace_id"],
  trendChangeScopeColumns = ["organization_id", "workspace_id"],
  sourcingOutboxScopeColumns = ["organization_id", "workspace_id"],
  sourcingEventScopeColumns = ["organization_id", "workspace_id"],
  trendChange = null,
  trendTargets = [],
  unknownSourcingEvent = false,
  unpairedSourcingOutbox = false,
  unresolvedSourcingOpportunity = false,
} = {}) {
  const observed = [],
    writes = [],
    scopeRows = [];
  return {
    observed,
    writes,
    scopeRows,
    connection: {
      async query(sql, params) {
        if (sql.startsWith("SHOW COLUMNS FROM automation_rules "))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM approval_templates "))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") &&
          sql.includes("historical_context")
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM file_assets"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM notifications"))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM (score_rules|cost_rules) /.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          /^SHOW COLUMNS FROM (?:`reconciliation_runs`|`data_quality_issues`|exchange_rate_quotes) /.test(
            sql,
          )
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM `(realtime_events|collection_subqueries)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM `opportunity_events`"))
          return [opportunityEventScopeColumns.map((Field) => ({ Field }))];
        observed.push(sql);
        if (sql.startsWith("SHOW COLUMNS FROM `opportunity_outbox`"))
          return [opportunityDeliveryShape.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `evidence_data_events`"))
          return [evidenceEventScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `evidence_data_outbox`"))
          return [evidenceOutboxScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_comparisons`"))
          return [comparisonShape.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `automation_executions`"))
          return [executionScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `browser_evidence_artifacts`"))
          return [browserArtifactScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `competitor_events`"))
          return [competitorEventScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `competitor_monitor_rules`"))
          return [competitorRuleScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `competitor_outbox`"))
          return [competitorOutboxScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_outbox`"))
          return [trendOutboxScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_events`"))
          return [trendEventScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_topic_change_requests`"))
          return [trendChangeScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_outbox`"))
          return [sourcingOutboxScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_events`"))
          return [sourcingEventScopeColumns.map((Field) => ({ Field }))];
        if (sql.includes("LEFT JOIN notifications n ON n.id=x.notification_id"))
          return [brokenExecutionNotification ? [{}] : []];
        if (sql.includes("SELECT COUNT(*) total FROM account_owned_records co"))
          return [[{ total: comparisonOwnershipTotal }]];
        if (sql.startsWith("SHOW COLUMNS FROM `collection_task_evidence_links`"))
          return [evidenceLinkScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `field_provenance`"))
          return [fieldProvenanceScopeColumns.map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM `competitor_(snapshots|changes|alerts|snapshot_jobs)`/.test(sql))
          return [competitorHistoryScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `opportunity_decisions`"))
          return [decisionScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `selection_journeys`"))
          return [journeyScopeColumns.map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM (raw_evidence|normalized_records|trend_topics) /.test(sql))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_searches`"))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_candidates`"))
          return [candidateScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_purchase_tasks`"))
          return [purchaseScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `supplier_quotes`"))
          return [quoteScopeColumns.map((Field) => ({ Field }))];
        if (
          /^SHOW COLUMNS FROM `(opportunity_score_jobs|opportunity_profit_jobs|opportunity_score_runs|opportunity_profit_runs|opportunity_cost_inputs|opportunity_cost_input_reviews|opportunity_evidence_links|opportunity_rule_matches|selection_journey_decisions|selection_journey_events|selection_journey_outbox)`/.test(
            sql,
          )
        )
          return [calculationJobScopeColumns.map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM `collection_task_(events|outbox)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_projection_jobs`"))
          return [trendProjectionScopeColumns.map((Field) => ({ Field }))];
        if (sql.includes("FROM `trend_projection_jobs` s LEFT JOIN `normalized_records` p"))
          return [brokenTrendProjectionParent ? [{ found: 1 }] : []];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_projection_jobs`"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM `(opportunity_refresh_jobs|opportunity_score_inputs)`/.test(sql))
          return [opportunityInputScopeColumns.map((Field) => ({ Field }))];
        if (
          /FROM `(opportunity_refresh_jobs|opportunity_score_inputs)` s LEFT JOIN `opportunities` p/.test(
            sql,
          )
        )
          return [
            [
              ...(brokenOpportunityInputParent && sql.includes(brokenOpportunityInputParent)
                ? [{}]
                : []),
            ],
          ];
        if (/^SHOW COLUMNS FROM `(score_rule_actions|opportunity_operating_facts)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM `cost_rule_approvals`")) {
          return [approvalScopeColumns.map((Field) => ({ Field }))];
        }
        if (/^SHOW COLUMNS FROM `approval_(node_runs|actions|escalation_jobs)`/.test(sql))
          return [approvalHistoryScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `approval_template_nodes`"))
          return [approvalTemplateNodeScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `approval_template_versions`"))
          return [approvalTemplateVersionScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `approval_requests`"))
          return [approvalRequestScopeColumns.map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM `task_(events|comments)`/.test(sql))
          return [taskHistoryScopeColumns.map((Field) => ({ Field }))];
        if (/FROM `task_(events|comments)` s LEFT JOIN `tasks` p/.test(sql)) return [[]];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_signals`"))
          return [signalScopeColumns.map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `trend_topic_keywords`"))
          return [keywordScopeColumns.map((Field) => ({ Field }))];
        if (sql.includes("FROM `trend_topic_keywords` s LEFT JOIN `trend_topics` p"))
          return [brokenKeywordParent ? [{ found: 1 }] : []];
        if (/FROM `cost_rule_approvals` s LEFT JOIN `?cost_rules`? p/.test(sql))
          return [brokenCostApprovalParent ? [{ found: 1 }] : []];
        if (
          sql.includes("SELECT 1 FROM outbox_events o") &&
          sql.includes("LEFT JOIN approval_templates")
        ) {
          assert.match(
            sql,
            /IF\(o.event_type='approval.overdue','\$\.approval_request_id','\$\.id'\)/,
          );
          assert.match(sql, /n.approval_request_id=a.id AND n.organization_id=a.organization_id/);
          assert.match(sql, /o.schema_version<>1/);
          return [badApprovalDelivery ? [{}] : []];
        }
        if (sql.includes("SELECT 1 FROM outbox_events o") && sql.includes("FROM task_events e")) {
          assert.match(sql, /JSON_EXTRACT\(o.payload_json,'\$\.task_id'\)/);
          assert.match(sql, /e.trace_id=CONVERT\(o.trace_id USING ascii\)/);
          assert.doesNotMatch(sql, /e.id=o.id/);
          assert.match(sql, /NOT COALESCE/);
          assert.match(sql, /o.status='published'/);
          assert.match(sql, /NOT EXISTS \(SELECT 1 FROM tasks ot/);
          assert.match(sql, /JOIN notifications pn/);
          assert.match(sql, /JOIN realtime_events pr/);
          assert.match(sql, /m0503-a-/);
          return [badTaskDelivery ? [{}] : []];
        }
        if (
          sql.includes("SELECT 1 FROM outbox_events o") &&
          sql.includes("WHERE o.event_type='task.evidence_completion.redecision_ready'")
        ) {
          assert.match(sql, /r.opportunity_id=t.source_ref_id/);
          assert.match(
            sql,
            /r.organization_id=t.organization_id AND r.workspace_id=t.workspace_id/,
          );
          if (calculationJobScopeColumns.length === 0)
            assert.match(
              sql,
              /FROM `opportunity_score_runs` j\s+LEFT JOIN opportunities o ON o.id=j.opportunity_id/,
            );
          assert.match(sql, /t.source_type='evidence_completion'/);
          return [badRedecision ? [{}] : []];
        }
        if (
          sql.includes("SELECT 1 FROM trend_outbox o") ||
          (sql.includes("FROM trend_outbox o LEFT JOIN") && sql.includes("WHERE e.id IS NULL"))
        ) {
          assert.match(sql, /e.id=o.id AND e.organization_id=o.organization_id/);
          assert.match(
            sql,
            /e.workspace_id=o.workspace_id AND BINARY e.resource_type=BINARY o.resource_type/,
          );
          assert.match(
            sql,
            /e.resource_id=o.resource_id AND BINARY e.event_type=BINARY o.event_type/,
          );
          return [unpairedTrendDelivery ? [{}] : []];
        }
        if (
          sql.includes("SELECT 1 FROM opportunity_outbox o") ||
          (sql.includes("FROM opportunity_outbox d") && sql.includes("WHERE NOT EXISTS ("))
        ) {
          assert.match(
            sql,
            /BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id/,
          );
          assert.match(
            sql,
            /e.organization_id=o.organization_id\s+AND e.workspace_id=o.workspace_id/,
          );
          assert.doesNotMatch(sql, /e.id=o.id/);
          assert.equal(
            sql.includes("e.id=o.event_id"),
            opportunityDeliveryShape.includes("event_id"),
          );
          return [unpairedOpportunityDelivery ? [{}] : []];
        }
        if (sql.includes("WHERE resource_type NOT IN") && sql.includes("evidence_data_")) {
          assert.deepEqual(params, [
            [
              "raw_evidence",
              "browser_evidence_artifact",
              "data_quality_issue",
              "reconciliation_run",
            ],
          ]);
          return [unknownEvidenceHistory ? [{}] : []];
        }
        if (sql.includes("SELECT 1 FROM evidence_data_outbox o")) {
          assert.match(sql, /e.request_id=o.request_id AND e.trace_id=o.trace_id/);
          assert.equal(
            sql.includes("e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id"),
            evidenceEventScopeColumns.length !== 0 || evidenceOutboxScopeColumns.length !== 0,
          );
          assert.match(
            sql,
            /e.resource_type=o.resource_type\s+AND e.resource_id=o.resource_id AND e.event_type=o.event_type/,
          );
          assert.doesNotMatch(sql, /e.id=o.id|e.payload_json/);
          return [unpairedEvidenceDelivery ? [{}] : []];
        }
        if (sql.includes("LEFT JOIN browser_collection_jobs j ON j.id=a.browser_job_id")) {
          assert.match(
            sql,
            /j.collection_task_id=a.collection_task_id AND j.collection_subquery_id=a.collection_subquery_id/,
          );
          assert.match(sql, /j.provider_id=a.provider_id/);
          return [unmatchedBrowserArtifact ? [{}] : []];
        }
        if (
          sql.includes("SELECT 1 FROM competitor_snapshot_jobs j") ||
          (sql.includes("FROM `competitor_snapshot_jobs` d") &&
            sql.includes("s.competitor_id=j.competitor_id"))
        ) {
          assert.match(sql, /s.id=j.snapshot_id AND s.competitor_id=j.competitor_id/);
          assert.match(
            sql,
            /s.organization_id=j.organization_id AND s.workspace_id=j.workspace_id/,
          );
          return [mismatchedCompetitorJob ? [{}] : []];
        }
        if (
          sql.includes("SELECT 1 FROM competitor_outbox o") ||
          (sql.includes("FROM competitor_outbox x") &&
            sql.includes("WHERE e.id IS NULL AND a.id IS NULL"))
        ) {
          assert.match(
            sql,
            /e.id=o.id AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id/,
          );
          assert.match(
            sql,
            /o.event_type='competitor.threshold.triggered'\s+AND a.id=o.id AND a.competitor_id=o.aggregate_id/,
          );
          assert.match(
            sql,
            /a.organization_id=o.organization_id AND a.workspace_id=o.workspace_id/,
          );
          return [unpairedCompetitorOutbox ? [{}] : []];
        }
        if (sql.includes("event_type NOT IN")) {
          assert.ok(params[0].includes("sourcing.search.circuit_requeued"));
          return [unknownSourcingEvent ? [{}] : []];
        }
        if (
          sql.includes("AND BINARY e.event_type=BINARY o.event_type") &&
          sql.includes("e.resource_id=o.resource_id")
        ) {
          assert.match(sql, /e.resource_id=o.resource_id AND e.organization_id=o.organization_id/);
          return [unpairedSourcingOutbox ? [{}] : []];
        }
        if (sql.includes("FROM `supplier_quotes` q WHERE id IN")) {
          assert.deepEqual([...params[0]].sort(), [quoteA, quoteB]);
          return [comparisonQuotes];
        }
        if (/FROM `trend_(topics|signals)` WHERE id IN/.test(sql)) return [trendTargets];
        if (sql.includes("SELECT DATABASE()")) return [[{ db, version: "5.7.44" }]];
        if (/^(SET TRANSACTION|START TRANSACTION)/.test(sql)) return [[]];
        if (sql.includes("FROM workspaces w JOIN organizations"))
          return [
            [
              {
                organization_id: "org",
                workspace_id: "private",
                slug: "personal-user",
                organization_creator: "user",
                member_id: "user",
              },
              { organization_id: "shared", workspace_id: "team", slug: "team", member_id: "user" },
              {
                organization_id: "shared",
                workspace_id: "team",
                slug: "team",
                member_id: "another",
              },
              { organization_id: "orphan", workspace_id: "legacy", slug: "legacy" },
            ],
          ];
        if (sql.startsWith("INSERT INTO account_retirement_scopes")) {
          scopeRows.push(...params[0]);
          return [[]];
        }
        if (sql.startsWith("SELECT 1 FROM") || sql.startsWith("SELECT 1,((")) {
          if (sql.includes("WHERE p.id IS NULL")) {
            assert.match(sql, /LEFT JOIN `opportunity_(score|profit)_runs` p/);
            return [brokenInherited ? [{ found: 1 }] : []];
          }
          assert.match(sql, /parent.workspace_id=child.workspace_id/);
          if (
            sql.includes("FROM `sourcing_searches` child") &&
            sql.includes("JOIN `opportunities`")
          ) {
            assert.deepEqual(params, ["opportunity"]);
            assert.match(sql, /parent.id IS NULL AND NOT/);
            assert.match(sql, /child.input_ref NOT REGEXP/);
            assert.match(sql, /history_task.id=child.collection_task_id/);
            assert.match(sql, /history_task.workspace_id=child.workspace_id/);
            assert.match(sql, /BINARY history_task.request_id=BINARY child.request_id/);
            assert.match(sql, /BINARY history_task.trace_id=BINARY child.trace_id/);
            assert.match(sql, /NOT EXISTS \(SELECT 1 FROM sourcing_candidates/);
            if (unresolvedSourcingOpportunity) return [[{ found: 1 }]];
          }
          for (const [table, field, parent] of [
            ["collection_task_events", "task_id", "collection_tasks"],
            ["collection_task_outbox", "task_id", "collection_tasks"],
            ["selection_journey_outbox", "journey_id", "selection_journeys"],
          ]) {
            if (!sql.includes("FROM `" + table + "` child")) continue;
            assert.ok(
              sql.includes("LEFT JOIN `" + parent + "` parent ON parent.id=child.`" + field + "`"),
            );
            assert.match(sql, /parent.organization_id=child.organization_id/);
            assert.match(sql, /parent.id IS NULL/);
            if (brokenDeliveryTable === table) return [[{ found: 1 }]];
          }
          if (
            sql.includes("FROM `competitor_events` child") ||
            (sql.includes("FROM competitor_events x") && sql.includes(") child"))
          ) {
            assert.deepEqual(params, ["competitor.rule.created"]);
            if (
              sql.includes("JOIN `competitor_monitor_rules`") ||
              sql.includes("FROM competitor_monitor_rules r) parent")
            ) {
              assert.match(sql, /child.`event_type`=\?/);
              if (brokenCompetitorRule) return [[{ found: 1 }]];
            } else {
              assert.match(sql, /JOIN `competitors`/);
              assert.match(sql, /child.`event_type`<>\?/);
            }
          }
          if (
            sql.includes("FROM `opportunity_profit_jobs` child") &&
            sql.includes("JOIN cost_rules parent")
          ) {
            assert.match(sql, /parent.id=child.`cost_rule_id`/);
            assert.match(
              sql,
              /parent.organization_id=child.organization_id AND parent.workspace_id=child.workspace_id/,
            );
            if (brokenDeliveryTable === "opportunity_profit_jobs") return [[{ found: 1 }]];
          }
          if (sql.includes("child.`source_type`=?")) {
            if (sql.includes("FROM `tasks` child")) {
              if (params[0] === "sourcing_purchase") {
                if (purchaseScopeColumns.length === 0) {
                  assert.match(
                    sql,
                    /LEFT JOIN supplier_quotes q ON q.id=p.quote_id LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id/,
                  );
                  assert.match(
                    sql,
                    /parent.organization_id=child.organization_id AND parent.workspace_id=child.workspace_id/,
                  );
                } else assert.match(sql, /JOIN `sourcing_purchase_tasks` parent/);
                if (brokenPurchase) return [[{ found: 1 }]];
              } else if (params[0] === "selection_verification") {
                for (const [n, parent] of [
                  "opportunity_decisions",
                  "opportunities",
                  "competitor_changes",
                  "selection_journeys",
                ].entries()) {
                  const alias = n === 0 ? "parent" : `parent${n}`;
                  const relation =
                    parent === "opportunity_decisions" && decisionScopeColumns.length === 0
                      ? "(SELECT d.*,o.organization_id,o.workspace_id FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id)"
                      : parent === "competitor_changes" &&
                          competitorHistoryScopeColumns.length === 0
                        ? "(SELECT d.*,c.organization_id,c.workspace_id FROM `competitor_changes` d JOIN competitors c ON c.id=d.competitor_id)"
                        : parent === "selection_journeys" && journeyScopeColumns.length === 0
                          ? "(SELECT j.*,t.organization_id,t.workspace_id FROM selection_journeys j LEFT JOIN collection_tasks t ON t.id=j.task_id)"
                          : `\`${parent}\``;
                  assert.ok(
                    sql.includes(
                      `JOIN ${relation} ${alias} ON ${alias}.id=child.\`source_ref_id\``,
                    ),
                  );
                  assert.ok(sql.includes(`${alias}.workspace_id=child.workspace_id`));
                }
                assert.match(
                  sql,
                  /\(\(parent.id IS NOT NULL\)\+\(parent1.id IS NOT NULL\)\+\(parent2.id IS NOT NULL\)\+\(parent3.id IS NOT NULL\)\)<>1/,
                );
                if (invalidVerificationParentCount !== null && invalidVerificationParentCount !== 1)
                  return [[{ parent_matches: invalidVerificationParentCount }]];
              } else {
                assert.ok(["evidence_completion", "automation"].includes(params[0]));
                assert.match(
                  sql,
                  params[0] === "automation"
                    ? /JOIN `automation_executions`|FROM automation_executions e/
                    : /JOIN `opportunities`/,
                );
              }
            } else assert.deepEqual(params, ["trend_topic"]);
          }
          if (sql.includes("FROM `supplier_quotes` child") && sql.includes("child.`evidence_id`")) {
            assert.match(sql, /JOIN `raw_evidence` parent/);
            if (brokenQuote) return [[{ found: 1 }]];
          }
          if (
            sql.includes("FROM `approval_requests` child") &&
            sql.includes("child.`resource_type`=?")
          ) {
            if (sql.includes("JOIN `tasks`")) assert.deepEqual(params, ["task"]);
            else {
              assert.match(
                sql,
                decisionScopeColumns.length === 0
                  ? /FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id/
                  : /JOIN `opportunity_decisions`/,
              );
              assert.deepEqual(params, ["opportunity_decision"]);
              if (brokenApproval) return [[{ found: 1 }]];
            }
          }
          return [broken ? [{ found: 1 }] : []];
        }
        if (sql.includes("information_schema.STATISTICS")) {
          assert.ok(params[0].includes("file_assets"));
          return [
            [
              {
                table_name: "file_assets",
                index_name: "uq_file_asset_org_path",
                column_name: "organization_id",
                sub_part: null,
              },
              {
                table_name: "file_assets",
                index_name: "uq_file_asset_org_path",
                column_name: "relative_path",
                sub_part: 191,
              },
            ],
          ];
        }
        if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: "3" }]];
        throw new Error(sql);
      },
      async execute(sql, params) {
        observed.push(sql);
        if (sql.includes("FROM trend_topic_follows f")) return [[]];
        if (sql.includes("CAST(source_topic_ids_json AS CHAR)"))
          return [trendChange && params[0] === "" ? [trendChange] : []];
        if (sql.includes("CAST(quote_ids_json AS CHAR)")) {
          assert.match(sql, /c WHERE id>\? ORDER BY id LIMIT 250/);
          assert.deepEqual(params, params[0] ? [comparisonId] : [""]);
          return [comparison && params[0] === "" ? [comparison] : []];
        }
        if (sql.startsWith("SELECT id FROM users")) return [[{ id: "primary" }]];
        if (sql.startsWith("SELECT 1 FROM")) {
          assert.match(sql, /r.source_id=s.id/);
          assert.match(sql, /r.legacy_workspace_id=[sp].workspace_id/);
          return [missing ? [{ found: 1 }] : []];
        }
        if (sql.startsWith("INSERT INTO")) {
          assert.match(sql, /^INSERT INTO account_retirement_(runs|records)/);
          writes.push([sql, params]);
          return [[]];
        }
        if (sql.includes("FROM account_retirement_records"))
          return [[{ total: mismatch ? "2" : "3" }]];
        if (sql.includes("collision_groups")) {
          assert.match(
            sql,
            /s.`relative_path` IS NOT NULL GROUP BY m.account_id,LEFT\(s.`relative_path`,191\)/,
          );
          assert.match(sql, /HAVING COUNT\(\*\)>1/);
          return [
            [{ collision_groups: collisions ? "1" : "0", affected_rows: collisions ? "2" : "0" }],
          ];
        }
        throw new Error(sql);
      },
      async rollback() {
        observed.push("ROLLBACK");
      },
      async commit() {
        observed.push("COMMIT");
      },
    },
  };
}

test("retired approval columns use the parent scope and reject a missing parent or partial shape", async () => {
  const migrated = rehearsal({ approvalScopeColumns: [] });
  const result = await stageAccountScopeRetirement(migrated.connection);
  assert.equal(result.tables.cost_rule_approvals, "3");
  const [insert] = migrated.writes.find(([, params]) => params?.[0] === "cost_rule_approvals");
  assert.match(
    insert,
    /s.id,p.organization_id,p.workspace_id FROM `cost_rule_approvals` s JOIN cost_rules p/,
  );
  for (const [options, error] of [
    [
      { approvalScopeColumns: [], brokenCostApprovalParent: true },
      /broken_source_link:cost_rule_approvals.cost_rule_id/,
    ],
    [
      { approvalScopeColumns: ["workspace_id"] },
      /partial_inherited_scope_schema:cost_rule_approvals/,
    ],
  ]) {
    const bad = rehearsal(options);
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), error);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
  }
});

test("keywords inherit their original topic when duplicate scope fields are removed", async () => {
  const migrated = rehearsal({ keywordScopeColumns: [] });
  assert.equal(
    (await stageAccountScopeRetirement(migrated.connection)).tables.trend_topic_keywords,
    "3",
  );
  const [insert] = migrated.writes.find(([, params]) => params?.[0] === "trend_topic_keywords");
  assert.match(
    insert,
    /s.id,p.organization_id,p.workspace_id FROM `trend_topic_keywords` s JOIN `trend_topics` p/,
  );
  for (const [options, error] of [
    [
      { keywordScopeColumns: [], brokenKeywordParent: true },
      /broken_source_link:trend_topic_keywords.topic_id/,
    ],
    [
      { keywordScopeColumns: ["organization_id"] },
      /partial_inherited_scope_schema:trend_topic_keywords/,
    ],
  ]) {
    const bad = rehearsal(options);
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), error);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
  }
});

test("signals derive scope from the original topic without requiring the legacy view", async () => {
  const normalized = rehearsal({ signalScopeColumns: [] });
  const result = await stageAccountScopeRetirement(normalized.connection);
  assert.equal(result.tables.trend_signals, "3");
  assert.ok(
    normalized.observed.some(
      (sql) =>
        sql.includes(
          "FROM (SELECT s.*,t.organization_id,t.workspace_id FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id) child",
        ) && sql.includes("JOIN `normalized_records`"),
    ),
  );
  assert.ok(
    normalized.observed.some(
      (sql) =>
        sql.includes(
          "JOIN (SELECT s.*,t.organization_id,t.workspace_id FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id) parent",
        ) && sql.includes("FROM `opportunity_evidence_links` child"),
    ),
  );
  const partial = rehearsal({ signalScopeColumns: ["organization_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:trend_signals/,
  );
  assert.equal(partial.observed.at(-1), "ROLLBACK");
});

test("task history without duplicate scope still verifies original delivery linkage", async () => {
  const fixture = rehearsal({ taskHistoryScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.task_events, "3");
  assert.equal(result.tables.task_comments, "3");
  const delivery = fixture.observed.find((sql) => sql.includes("FROM task_events e JOIN tasks t"));
  assert.ok(delivery);
  assert.match(delivery, /t.organization_id=o.organization_id AND t.workspace_id=o.workspace_id/);
  assert.match(delivery, /e.trace_id=CONVERT\(o.trace_id USING ascii\)/);
  assert.doesNotMatch(delivery, /e\.(organization_id|workspace_id)/);
});

test("approval history still validates node/request and delivery links after scope fields are removed", async () => {
  const fixture = rehearsal({ approvalHistoryScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.approval_node_runs, "3");
  assert.equal(result.tables.approval_actions, "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM `approval_actions` d") &&
        sql.includes("parent.approval_request_id=child.approval_request_id"),
    ),
  );
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM outbox_events o") &&
        sql.includes("FROM `approval_node_runs` d") &&
        sql.includes("n.approval_request_id=a.id"),
    ),
  );
});

test("approval template nodes inherit the exact version and still match pinned request nodes", async () => {
  const fixture = rehearsal({ approvalTemplateNodeScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.approval_template_nodes, "3");
  const relation = "FROM `approval_template_nodes` d";
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes(relation) &&
        sql.includes("LEFT JOIN approval_template_versions r ON r.id=d.template_version_id") &&
        sql.includes("q.template_version_id=parent.template_version_id"),
    ),
  );
  const partial = rehearsal({ approvalTemplateNodeScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:approval_template_nodes/,
  );
  assert.equal(partial.observed.at(-1), "ROLLBACK");
});

test("normalized approval versions derive both node and request linkage from the original template", async () => {
  const fixture = rehearsal({
    approvalTemplateNodeScopeColumns: [],
    approvalTemplateVersionScopeColumns: [],
  });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.approval_template_versions, "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM `approval_template_nodes` d") &&
        sql.includes("FROM `approval_template_versions` d") &&
        sql.includes("LEFT JOIN approval_templates r ON r.id=d.template_id"),
    ),
  );
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("child.`template_version_id`") &&
        sql.includes("parent.template_id=child.template_id"),
    ),
  );
  const partial = rehearsal({ approvalTemplateVersionScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:approval_template_versions/,
  );
});

test("normalized approval requests retain polymorphic targets and derive outbox scope from the original template", async () => {
  const fixture = rehearsal({ approvalRequestScopeColumns: [], approvalHistoryScopeColumns: [] });
  assert.equal(
    (await stageAccountScopeRetirement(fixture.connection)).tables.approval_requests,
    "3",
  );
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM outbox_events o") &&
        sql.includes("FROM `approval_requests` d") &&
        sql.includes("LEFT JOIN approval_templates r ON r.id=d.template_id") &&
        sql.includes("a.organization_id=o.organization_id"),
    ),
  );
  for (const table of ["tasks", "opportunity_decisions"]) {
    assert.ok(
      fixture.observed.some(
        (sql) =>
          sql.includes("FROM `approval_requests` d") &&
          sql.includes(`LEFT JOIN \`${table}\` parent`) &&
          sql.includes("child.`resource_id`"),
      ),
    );
  }
});

test("supplier quotes keep candidate and evidence linkage after their scope columns are removed", async () => {
  const fixture = rehearsal({ quoteScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.supplier_quotes, "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM supplier_quotes d JOIN sourcing_candidates c ON c.id=d.candidate_id") &&
        sql.includes("LEFT JOIN `raw_evidence` parent") &&
        sql.includes("child.`evidence_id`"),
    ),
  );
  const partial = rehearsal({ quoteScopeColumns: ["organization_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:supplier_quotes/,
  );
  assert.equal(partial.observed.at(-1), "ROLLBACK");
});

test("normalized candidates still check source evidence and quote scope against the original search", async () => {
  const fixture = rehearsal({ candidateScopeColumns: [], quoteScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.sourcing_candidates, "3");
  const candidate = fixture.observed.find(
    (sql) =>
      sql.includes(
        "FROM sourcing_candidates c LEFT JOIN `sourcing_searches` s ON s.id=c.search_id",
      ) &&
      sql.includes(
        "LEFT JOIN `normalized_records` parent ON parent.id=child.`normalized_record_id`",
      ),
  );
  assert.match(
    candidate,
    /parent.raw_evidence_id=child.raw_evidence_id AND parent.provider_id=child.provider_id/,
  );
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM supplier_quotes d JOIN (SELECT c.*") &&
        sql.includes(
          "FROM sourcing_candidates c LEFT JOIN `sourcing_searches` s ON s.id=c.search_id",
        ),
    ),
  );
});

test("normalized purchase tasks still verify quote, task and sourcing event scope", async () => {
  const fixture = rehearsal({ purchaseScopeColumns: [], quoteScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.sourcing_purchase_tasks, "3");
  const relation = "FROM sourcing_purchase_tasks p LEFT JOIN supplier_quotes q ON q.id=p.quote_id";
  for (const table of ["tasks", "sourcing_events", "sourcing_outbox"])
    assert.ok(
      fixture.observed.some(
        (sql) => sql.includes("FROM `" + table + "` child") && sql.includes(relation),
      ),
      table,
    );
  const broken = rehearsal({
    purchaseScopeColumns: [],
    quoteScopeColumns: [],
    brokenPurchase: true,
  });
  await assert.rejects(
    stageAccountScopeRetirement(broken.connection, { commit: true }),
    /broken_source_link:tasks.source_ref_id/,
  );
  assert.equal(broken.observed.at(-1), "ROLLBACK");
});

test("normalized competitor history still binds snapshot jobs, changes and alert deliveries", async () => {
  const fixture = rehearsal({ competitorHistoryScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  for (const table of ["competitor_snapshots", "competitor_changes", "competitor_alerts"])
    assert.equal(result.tables[table], "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM `competitor_snapshot_jobs` d") &&
        sql.includes("FROM `competitor_snapshots` d"),
    ),
  );
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM competitor_outbox o") && sql.includes("FROM `competitor_alerts` d"),
    ),
  );
});

test("normalized selection decisions retain the approval and verification-task links", async () => {
  const fixture = rehearsal({ decisionScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.opportunity_decisions, "3");
  const derived = "FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id";
  assert.ok(
    fixture.observed.some(
      (sql) => sql.includes("FROM `approval_requests` child") && sql.includes(derived),
    ),
  );
  assert.ok(
    fixture.observed.some((sql) => sql.includes("FROM `tasks` child") && sql.includes(derived)),
  );
});

test("normalized refresh jobs and score inputs derive ownership from the original opportunity", async () => {
  const fixture = rehearsal({ opportunityInputScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  for (const table of ["opportunity_refresh_jobs", "opportunity_score_inputs"]) {
    assert.equal(result.tables[table], "3");
    assert.ok(
      fixture.observed.some((sql) =>
        sql.includes("FROM `" + table + "` s JOIN `opportunities` p ON p.id=s.`opportunity_id`"),
      ),
    );
    const broken = rehearsal({
      opportunityInputScopeColumns: [],
      brokenOpportunityInputParent: table,
    });
    await assert.rejects(
      stageAccountScopeRetirement(broken.connection, { commit: true }),
      new RegExp("broken_source_link:" + table + "\\.opportunity_id"),
    );
    assert.equal(broken.observed.at(-1), "ROLLBACK");
  }
  const partial = rehearsal({ opportunityInputScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:opportunity_(refresh_jobs|score_inputs)/,
  );
  assert.equal(partial.observed.at(-1), "ROLLBACK");
});

test("normalized calculation jobs and runs retain rule, task and component scope checks", async () => {
  const fixture = rehearsal({ calculationJobScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  for (const [table, rule, ruleId] of [
    ["opportunity_score_jobs", "score_rules", "score_rule_id"],
    ["opportunity_profit_jobs", "cost_rules", "cost_rule_id"],
    ["opportunity_score_runs", "score_rules", "score_rule_id"],
    ["opportunity_profit_runs", "cost_rules", "cost_rule_id"],
  ]) {
    assert.equal(result.tables[table], "3");
    const query = fixture.observed.find(
      (sql) =>
        sql.includes("FROM `" + table + "` j") &&
        sql.includes("LEFT JOIN " + rule + " parent ON parent.id=child.`" + ruleId + "`"),
    );
    assert.match(query, /LEFT JOIN opportunities o ON o.id=j.opportunity_id/);
    assert.match(
      query,
      /parent.organization_id=child.organization_id AND parent.workspace_id=child.workspace_id/,
    );
  }
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM `opportunity_score_jobs` j") &&
        sql.includes("LEFT JOIN `tasks` parent ON parent.id=child.`trigger_task_id`"),
    ),
  );
  for (const kind of ["score", "profit"]) {
    assert.ok(
      fixture.observed.some(
        (sql) =>
          sql.includes("FROM `opportunity_" + kind + "_components` s JOIN (SELECT j.*") &&
          sql.includes("FROM `opportunity_" + kind + "_runs` j") &&
          sql.includes("p.id=s.`" + kind + "_run_id`") &&
          sql.includes("m.legacy_workspace_id=p.workspace_id"),
      ),
    );
  }
  const partial = rehearsal({ calculationJobScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:opportunity_score_jobs/,
  );
  assert.equal(partial.observed.at(-1), "ROLLBACK");
});

test("normalized journey and its history inherit scope through the original collection task", async () => {
  const fixture = rehearsal({ journeyScopeColumns: [], calculationJobScopeColumns: [] });
  await stageAccountScopeRetirement(fixture.connection);
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("selection_journey_decisions") &&
        sql.includes("FROM selection_journeys j LEFT JOIN collection_tasks t ON t.id=j.task_id"),
    ),
  );
  const partial = rehearsal({ journeyScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection, { commit: true }),
    /partial_inherited_scope_schema:selection_journeys/,
  );
});

test("normalized reviews still require the original cost input on the exact opportunity", async () => {
  const fixture = rehearsal({ calculationJobScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.opportunity_cost_input_reviews, "3");
  const inputLink = fixture.observed.find(
    (sql) =>
      sql.includes("FROM `opportunity_cost_input_reviews` j") &&
      sql.includes("FROM `opportunity_cost_inputs` j") &&
      sql.includes("parent.id=child.`cost_input_id`"),
  );
  assert.match(inputLink, /parent.opportunity_id=child.opportunity_id/);
  assert.match(
    inputLink,
    /parent.organization_id=child.organization_id AND parent.workspace_id=child.workspace_id/,
  );
});

test("normalized opportunity evidence links retain separate raw and signal scope checks", async () => {
  const fixture = rehearsal({ calculationJobScopeColumns: [], signalScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.opportunity_evidence_links, "3");
  for (const [relation, id] of [
    ["`raw_evidence`", "raw_evidence_id"],
    [
      "(SELECT s.*,t.organization_id,t.workspace_id FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id)",
      "evidence_id",
    ],
  ]) {
    const query = fixture.observed.find(
      (sql) =>
        sql.includes("FROM `opportunity_evidence_links` j") &&
        sql.includes("LEFT JOIN " + relation + " parent ON parent.id=child.`" + id + "`"),
    );
    assert.match(query, /LEFT JOIN opportunities o ON o.id=j.opportunity_id/);
    assert.match(
      query,
      /parent.organization_id=child.organization_id AND parent.workspace_id=child.workspace_id/,
    );
  }
});

test("collection evidence links inherit their task and still check exact query, provider and raw record", async () => {
  const fixture = rehearsal({ evidenceLinkScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.collection_task_evidence_links, "3");
  for (const condition of [
    /parent.task_id=child.collection_task_id AND parent.provider_id=child.provider_id/,
    /parent.raw_evidence_id=child.raw_evidence_id AND parent.provider_id=child.provider_id/,
  ]) {
    assert.ok(
      fixture.observed.some(
        (sql) =>
          sql.includes("LEFT JOIN collection_tasks t ON t.id=l.collection_task_id") &&
          condition.test(sql),
      ),
    );
  }
  const partial = rehearsal({ evidenceLinkScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection),
    /partial_inherited_scope_schema:collection_task_evidence_links/,
  );
});

test("normalized field provenance still requires its exact normalized record and raw evidence", async () => {
  const fixture = rehearsal({ fieldProvenanceScopeColumns: [] });
  const result = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(result.tables.field_provenance, "3");
  const query = fixture.observed.find(
    (sql) =>
      sql.includes("FROM field_provenance l LEFT JOIN normalized_records t") &&
      sql.includes("parent.raw_evidence_id=child.raw_evidence_id"),
  );
  assert.match(
    query,
    /parent\.organization_id=child\.organization_id AND parent\.workspace_id=child\.workspace_id/,
  );
  const partial = rehearsal({ fieldProvenanceScopeColumns: ["workspace_id"] });
  await assert.rejects(
    stageAccountScopeRetirement(partial.connection),
    /partial_inherited_scope_schema:field_provenance/,
  );
});

test("generic outbox migrates only recognized approval/task slices and rolls back broken references", async () => {
  const good = rehearsal();
  assert.equal(
    (await stageAccountScopeRetirement(good.connection, { commit: true })).tables.outbox_events,
    "3",
  );
  assert.ok(
    good.observed.some(
      (sql) =>
        sql.includes("FROM outbox_events o") &&
        sql.includes("WHERE o.event_type IN") &&
        sql.includes("AND NOT COALESCE") &&
        sql.includes("'approval.node.approved'") &&
        sql.includes("'task.created'") &&
        !sql.includes("'automation.notification.queued'"),
    ),
  );
  const bad = rehearsal({ badApprovalDelivery: true });
  await assert.rejects(
    stageAccountScopeRetirement(bad.connection, { commit: true }),
    /broken_source_link:outbox_events.approval/,
  );
  assert.equal(bad.observed.at(-1), "ROLLBACK");
  for (const [options, code] of [
    [{ badTaskDelivery: true }, /broken_source_link:outbox_events.task/],
    [{ badRedecision: true }, /broken_source_link:outbox_events.redecision/],
  ]) {
    const fixture = rehearsal(options);
    await assert.rejects(stageAccountScopeRetirement(fixture.connection, { commit: true }), code);
    assert.equal(fixture.observed.at(-1), "ROLLBACK");
  }
});

test("trend projection and deliveries retain history and refuse an unmatched original event", async () => {
  const good = rehearsal();
  const report = await stageAccountScopeRetirement(good.connection, { commit: true });
  assert.equal(report.tables.trend_projection_jobs, "3");
  assert.equal(report.tables.trend_outbox, "3");
  const delivery = rehearsal({ trendOutboxScopeColumns: [] });
  assert.equal((await stageAccountScopeRetirement(delivery.connection)).tables.trend_outbox, "3");
  assert.ok(
    delivery.observed.some(
      (sql) =>
        sql.includes("FROM trend_outbox o LEFT JOIN trend_events e ON e.id=o.id") &&
        sql.includes("BINARY e.trace_id=BINARY o.trace_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        trendOutboxScopeColumns: [],
        unpairedTrendDelivery: true,
      }).connection,
    ),
    /broken_source_link:trend_outbox.event/,
  );
  const bad = rehearsal({ unpairedTrendDelivery: true });
  await assert.rejects(
    stageAccountScopeRetirement(bad.connection, { commit: true }),
    /broken_source_link:trend_outbox.event/,
  );
  assert.equal(bad.observed.at(-1), "ROLLBACK");
  const normalized = rehearsal({ trendProjectionScopeColumns: [] });
  const derived = await stageAccountScopeRetirement(normalized.connection);
  assert.equal(derived.tables.trend_projection_jobs, "3");
  assert.ok(
    normalized.observed.some((sql) =>
      sql.includes(
        "FROM `trend_projection_jobs` s JOIN `normalized_records` p ON p.id=s.`normalized_record_id`",
      ),
    ),
  );
  const orphan = rehearsal({ trendProjectionScopeColumns: [], brokenTrendProjectionParent: true });
  await assert.rejects(
    stageAccountScopeRetirement(orphan.connection, { commit: true }),
    /broken_source_link:trend_projection_jobs.normalized_record_id/,
  );
  assert.equal(orphan.observed.at(-1), "ROLLBACK");
});

test("selection outbox keeps separately identified deliveries only when their original event matches", async () => {
  const good = rehearsal();
  assert.equal(
    (await stageAccountScopeRetirement(good.connection, { commit: true })).tables
      .opportunity_outbox,
    "3",
  );
  const bad = rehearsal({ unpairedOpportunityDelivery: true });
  await assert.rejects(
    stageAccountScopeRetirement(bad.connection, { commit: true }),
    /broken_source_link:opportunity_outbox.event/,
  );
  assert.equal(bad.observed.at(-1), "ROLLBACK");
});

test("normalized selection outbox requires the exact original event ID and trace", async () => {
  const options = { opportunityDeliveryShape: ["event_id"] };
  const valid = rehearsal(options);
  assert.equal(
    (await stageAccountScopeRetirement(valid.connection)).tables.opportunity_outbox,
    "3",
  );
  assert.ok(
    valid.observed.some(
      (sql) => sql.includes("e.id=d.event_id") && sql.includes("e.id=o.event_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({ ...options, unpairedOpportunityDelivery: true }).connection,
    ),
    /broken_source_link:opportunity_outbox.event/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        opportunityDeliveryShape: ["event_id", "organization_id", "workspace_id"],
      }).connection,
    ),
    /partial_inherited_scope_schema:opportunity_outbox/,
  );
});

test("normalized selection event and outbox retain typed scope and their exact event ID", async () => {
  const options = { opportunityEventScopeColumns: [], opportunityDeliveryShape: ["event_id"] };
  const good = rehearsal(options);
  const result = await stageAccountScopeRetirement(good.connection);
  assert.equal(result.tables.opportunity_events, "3");
  assert.equal(result.tables.opportunity_outbox, "3");
  const query = good.observed.find(
    (sql) => sql.includes("FROM opportunity_outbox d") && sql.includes("WHERE NOT EXISTS"),
  );
  assert.ok(query);
  for (const name of ["opportunities", "cost_rules", "score_rules", "exchange_rate_quotes"])
    assert.ok(query.includes("LEFT JOIN " + name), name);
  assert.match(query, /e.id=o.event_id/);
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({ ...options, unpairedOpportunityDelivery: true }).connection,
    ),
    /broken_source_link:opportunity_outbox.event/,
  );
});

test("selection refresh and profit jobs are retained, but mismatched cost rules reject the batch", async () => {
  const good = rehearsal();
  const report = await stageAccountScopeRetirement(good.connection, { commit: true });
  assert.equal(report.tables.opportunity_refresh_jobs, "3");
  assert.equal(report.tables.opportunity_profit_jobs, "3");
  const bad = rehearsal({ brokenDeliveryTable: "opportunity_profit_jobs" });
  await assert.rejects(
    stageAccountScopeRetirement(bad.connection, { commit: true }),
    /broken_source_link:opportunity_profit_jobs.cost_rule_id/,
  );
  assert.equal(bad.observed.at(-1), "ROLLBACK");
});

test("evidence audit events, deliveries and reconciliation runs keep verified scope links", async () => {
  const good = rehearsal();
  const report = await stageAccountScopeRetirement(good.connection, { commit: true });
  for (const table of ["evidence_data_events", "evidence_data_outbox", "reconciliation_runs"])
    assert.equal(report.tables[table], "3");
  for (const [options, code] of [
    [{ unknownEvidenceHistory: true }, /unknown_source_resource_type:evidence_data_events/],
    [{ unpairedEvidenceDelivery: true }, /broken_source_link:evidence_data_outbox.event/],
  ]) {
    const bad = rehearsal(options);
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), code);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
  }
});

test("normalized evidence audit follows its typed original resource without rewriting deliveries", async () => {
  const options = { evidenceEventScopeColumns: [] };
  const good = rehearsal(options);
  assert.equal(
    (await stageAccountScopeRetirement(good.connection)).tables.evidence_data_events,
    "3",
  );
  const query = good.observed.find((sql) => sql.includes("SELECT 1 FROM evidence_data_outbox o"));
  for (const table of [
    "raw_evidence",
    "browser_evidence_artifacts",
    "collection_tasks",
    "data_quality_issues",
    "reconciliation_runs",
  ])
    assert.ok(query.includes("LEFT JOIN " + table), table);
  assert.match(query, /BINARY e.trace_id=BINARY o.trace_id/);
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({ ...options, unpairedEvidenceDelivery: true }).connection,
    ),
    /broken_source_link:evidence_data_outbox.event/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        evidenceEventScopeColumns: ["workspace_id"],
      }).connection,
    ),
    /partial_inherited_scope_schema:evidence_data_events/,
  );
});

test("normalized evidence delivery derives owner from its resource and keeps the historical event candidate set", async () => {
  const options = { evidenceEventScopeColumns: [], evidenceOutboxScopeColumns: [] };
  const good = rehearsal(options);
  assert.equal(
    (await stageAccountScopeRetirement(good.connection)).tables.evidence_data_outbox,
    "3",
  );
  const pairing = good.observed.find((sql) => sql.includes("SELECT 1 FROM evidence_data_outbox o"));
  assert.ok(pairing);
  assert.match(pairing, /BINARY e.resource_id=BINARY o.resource_id/);
  assert.doesNotMatch(pairing, /e\.id=o\.(id|event_id)|e\.payload_json/);
  assert.ok(
    good.observed.some(
      (sql) =>
        sql.includes("FROM evidence_data_outbox e") &&
        sql.includes(
          "COALESCE(r.organization_id,t.organization_id,i.organization_id,c.organization_id)",
        ),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({ ...options, unpairedEvidenceDelivery: true }).connection,
    ),
    /broken_source_link:evidence_data_outbox.event/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        evidenceOutboxScopeColumns: ["organization_id"],
      }).connection,
    ),
    /partial_inherited_scope_schema:evidence_data_outbox/,
  );
});

test("browser evidence keeps artifact ownership without mapping browser job execution state", async () => {
  const good = rehearsal();
  const report = await stageAccountScopeRetirement(good.connection, { commit: true });
  assert.equal(report.tables.browser_evidence_artifacts, "3");
  assert.equal(report.tables.browser_collection_jobs, undefined);
  const normalized = rehearsal({ browserArtifactScopeColumns: [] });
  assert.equal(
    (await stageAccountScopeRetirement(normalized.connection)).tables.browser_evidence_artifacts,
    "3",
  );
  assert.ok(
    normalized.observed.some(
      (sql) =>
        sql.includes(
          "FROM browser_evidence_artifacts l LEFT JOIN collection_tasks t ON t.id=l.collection_task_id",
        ) && sql.includes("j.collection_subquery_id=a.collection_subquery_id"),
    ),
  );
  const bad = rehearsal({ unmatchedBrowserArtifact: true });
  await assert.rejects(
    stageAccountScopeRetirement(bad.connection, { commit: true }),
    /broken_source_link:browser_evidence_artifacts.browser_job_id/,
  );
  assert.equal(bad.observed.at(-1), "ROLLBACK");
});

test("retains competitor snapshot jobs and both outbox producer shapes, rolling back unmatched records", async () => {
  const good = rehearsal();
  const report = await stageAccountScopeRetirement(good.connection, { commit: true });
  assert.equal(report.tables.competitor_snapshot_jobs, "3");
  assert.equal(report.tables.competitor_outbox, "3");
  assert.equal(good.observed.at(-1), "COMMIT");
  for (const [config, code] of [
    [{ mismatchedCompetitorJob: true }, /broken_source_link:competitor_snapshot_jobs.snapshot_id/],
    [{ unpairedCompetitorOutbox: true }, /broken_source_link:competitor_outbox.id/],
  ]) {
    const bad = rehearsal(config);
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), code);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
  }
});

test("staging retains merge and split requests, refusing broken or ambiguous JSON references", async () => {
  const scope = { organization_id: "shared", workspace_id: "team" };
  const merge = {
    id: comparisonId,
    ...scope,
    operation: "merge",
    target_topic_id: quoteA,
    source_topics: JSON.stringify([quoteB]),
    signals: "[]",
  };
  const split = {
    ...merge,
    operation: "split",
    source_topics: "[]",
    signals: JSON.stringify([quoteB]),
  };
  const target = { id: quoteB, ...scope };
  for (const trendChange of [merge, split]) {
    const valid = rehearsal({ trendChange, trendTargets: [target], trendChangeScopeColumns: [] });
    const report = await stageAccountScopeRetirement(valid.connection, { commit: true });
    assert.equal(report.tables.trend_topic_change_requests, "3");
    assert.ok(valid.writes.some(([, params]) => params[0] === "trend_topic_change_requests"));
    assert.ok(valid.observed.includes("COMMIT"));
    assert.ok(
      valid.observed.some(
        (sql) =>
          sql.includes("CAST(source_topic_ids_json") &&
          sql.includes("LEFT JOIN trend_topics t ON t.id=c.target_topic_id"),
      ),
    );
  }
  for (const [trendChange, trendTargets, error] of [
    [
      merge,
      [{ ...target, workspace_id: "private" }],
      /broken_source_link:trend_topic_change_requests.source_topic_ids_json/,
    ],
    [split, [], /broken_source_link:trend_topic_change_requests.signal_ids_json/],
    [
      { ...merge, source_topics: JSON.stringify([quoteA]) },
      [target],
      /invalid_source_link:trend_topic_change_requests.source_topic_ids_json/,
    ],
    [
      { ...split, signals: JSON.stringify([quoteB, quoteB.toUpperCase()]) },
      [target],
      /invalid_source_link:trend_topic_change_requests.signal_ids_json/,
    ],
  ]) {
    const bad = rehearsal({ trendChange, trendTargets });
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), error);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
    assert.ok(!bad.observed.includes("COMMIT"));
  }
});

test("staging preserves comparison JSON and refuses malformed, missing or cross-scope quotes", async () => {
  const scope = { organization_id: "shared", workspace_id: "team" };
  const comparison = { id: comparisonId, ...scope, quote_ids: JSON.stringify([quoteA, quoteB]) };
  const first = { id: quoteA, ...scope };
  const second = { id: quoteB, ...scope };
  const valid = rehearsal({ comparison, comparisonQuotes: [first, second] });
  const report = await stageAccountScopeRetirement(valid.connection, { commit: true });
  assert.equal(report.status, "staged");
  assert.equal(valid.observed.at(-1), "COMMIT");
  assert.equal(comparison.quote_ids, JSON.stringify([quoteA, quoteB]));
  for (const [ids, quotes, error] of [
    [[quoteA, quoteA.toUpperCase()], [], /invalid_source_link/],
    [[quoteA, 42], [], /invalid_source_link/],
    [{}, [], /invalid_source_link/],
    [[quoteA, quoteB], [first], /broken_source_link/],
    [[quoteA, quoteB], [first, { ...second, workspace_id: "other" }], /broken_source_link/],
  ]) {
    const bad = rehearsal({
      comparison: { ...comparison, quote_ids: JSON.stringify(ids) },
      comparisonQuotes: quotes,
    });
    await assert.rejects(stageAccountScopeRetirement(bad.connection, { commit: true }), error);
    assert.equal(bad.observed.at(-1), "ROLLBACK");
    assert.ok(!bad.observed.includes("COMMIT"));
  }
});

test("comparison anchor is exact and cross-scope quotes require matching ownership for the whole snapshot", async () => {
  const scope = { organization_id: "shared", workspace_id: "team" };
  const options = {
    comparisonShape: ["anchor_quote_id"],
    comparison: {
      id: comparisonId,
      ...scope,
      anchor_quote_id: quoteB,
      quote_ids: JSON.stringify([quoteB, quoteA]),
    },
    comparisonQuotes: [
      { id: quoteB, ...scope },
      { id: quoteA, ...scope, workspace_id: "other" },
    ],
    comparisonOwnershipTotal: 2,
  };
  const fixture = rehearsal(options);
  assert.equal(
    (await stageAccountScopeRetirement(fixture.connection)).tables.sourcing_comparisons,
    "3",
  );
  assert.ok(fixture.observed.some((sql) => sql.includes("q.id=c.anchor_quote_id")));
  await assert.rejects(
    stageAccountScopeRetirement(rehearsal({ ...options, comparisonOwnershipTotal: 1 }).connection),
    /broken_source_link:sourcing_comparisons.quote_ids_json/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        comparison: { ...options.comparison, anchor_quote_id: quoteA },
      }).connection,
    ),
    /broken_source_link:sourcing_comparisons.anchor_quote_id/,
  );
});

test("normalized automation executions inherit the original rule and fail closed for mismatched notifications", async () => {
  const good = rehearsal({ executionScopeColumns: [] });
  assert.equal(
    (await stageAccountScopeRetirement(good.connection)).tables.automation_executions,
    "3",
  );
  assert.ok(
    good.observed.some(
      (sql) =>
        sql.includes("LEFT JOIN automation_rules r ON r.id=e.rule_id") &&
        sql.includes("n.workspace_id=x.workspace_id"),
    ),
  );
  const broken = rehearsal({ executionScopeColumns: [], brokenExecutionNotification: true });
  await assert.rejects(
    stageAccountScopeRetirement(broken.connection, { commit: true }),
    /broken_source_link:automation_executions.notification_id/,
  );
  assert.equal(broken.observed.at(-1), "ROLLBACK");
});

test("all sources stage original IDs under their resolved account; default run rolls back", async () => {
  for (const commit of [false, true]) {
    const { connection, writes, scopeRows, observed } = rehearsal();
    const result = await stageAccountScopeRetirement(connection, { commit });
    assert.equal(result.status, commit ? "staged" : "rolled_back");
    assert.deepEqual(Object.keys(result.tables), accountScopeSourceNames);
    assert.ok(Object.values(result.tables).every((n) => n === "3"));
    assert.deepEqual(
      scopeRows.map((row) => row.slice(1)),
      [
        ["org", "private", "user", "exclusive_owner"],
        ["shared", "team", "primary", "shared"],
        ["orphan", "legacy", "primary", "unassigned"],
      ],
    );
    assert.equal(writes.length, 1 + accountScopeSourceNames.length);
    for (const [sql, [name]] of writes.slice(1)) {
      const inherited = accountScopeInheritedSources[name];
      if (!inherited) assert.match(sql, /s.id,s.organization_id,s.workspace_id/);
      else {
        assert.match(sql, /s.id,p.organization_id,p.workspace_id/);
        assert.ok(sql.includes("JOIN `" + inherited[1] + "` p ON p.id=s.`" + inherited[0] + "`"));
      }
    }
    assert.equal(observed.at(-1), commit ? "COMMIT" : "ROLLBACK");
  }
});

test("fails closed on production schemas, missing links and unmapped records", async () => {
  for (const [options, error, last] of [
    [{ db: "product_scout" }, /mysql57_rehearsal_database_required/, /SELECT DATABASE/],
    [{ broken: true }, /broken_source_link:opportunities.source_ref_id/, /ROLLBACK/],
    [
      { brokenInherited: true },
      /broken_source_link:opportunity_score_components.score_run_id/,
      /ROLLBACK/,
    ],
    [{ brokenApproval: true }, /broken_source_link:approval_requests.resource_id/, /ROLLBACK/],
    [{ brokenQuote: true }, /broken_source_link:supplier_quotes.evidence_id/, /ROLLBACK/],
    [{ brokenPurchase: true }, /broken_source_link:tasks.source_ref_id/, /ROLLBACK/],
    [{ unknownSourcingEvent: true }, /unknown_source_event_type:sourcing_events/, /ROLLBACK/],
    [{ unpairedSourcingOutbox: true }, /broken_source_link:sourcing_outbox.id/, /ROLLBACK/],
    [
      { unresolvedSourcingOpportunity: true },
      /broken_source_link:sourcing_searches.input_ref/,
      /ROLLBACK/,
    ],
    [
      { brokenDeliveryTable: "collection_task_events" },
      /broken_source_link:collection_task_events.task_id/,
      /ROLLBACK/,
    ],
    [
      { brokenDeliveryTable: "collection_task_outbox" },
      /broken_source_link:collection_task_outbox.task_id/,
      /ROLLBACK/,
    ],
    [
      { brokenDeliveryTable: "selection_journey_outbox" },
      /broken_source_link:selection_journey_outbox.journey_id/,
      /ROLLBACK/,
    ],
    [{ invalidVerificationParentCount: 0 }, /broken_source_link:tasks.source_ref_id/, /ROLLBACK/],
    [
      { invalidVerificationParentCount: 2 },
      /ambiguous_source_link:tasks.source_ref_id/,
      /ROLLBACK/,
    ],
    [
      { brokenCompetitorRule: true },
      /broken_source_link:competitor_events.competitor_id/,
      /ROLLBACK/,
    ],
    [{ mismatch: true }, /source_scope_count_mismatch:opportunities/, /ROLLBACK/],
    [{ missing: true }, /source_identity_mismatch:opportunities/, /ROLLBACK/],
  ]) {
    const { connection, observed } = rehearsal(options);
    await assert.rejects(stageAccountScopeRetirement(connection, { commit: true }), error);
    assert.match(observed.at(-1), last);
    assert.ok(!observed.includes("COMMIT"));
  }
});

test("normalized competitor events retain distinct rule and competitor parents and outbox scope", async () => {
  const fixture = rehearsal({ competitorEventScopeColumns: [] });
  const report = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(report.tables.competitor_events, "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM competitor_outbox o") &&
        sql.includes("x.event_type='competitor.rule.created' AND r.id=x.competitor_id") &&
        sql.includes("x.event_type<>'competitor.rule.created' AND c.id=x.competitor_id") &&
        sql.includes("e.workspace_id=o.workspace_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        competitorEventScopeColumns: [],
        brokenCompetitorRule: true,
      }).connection,
    ),
    /broken_source_link:competitor_events.competitor_id/,
  );
});

test("0165 audits original competitor event and outbox lineage after rule scope removal", async () => {
  const options = {
    competitorEventScopeColumns: [],
    competitorOutboxScopeColumns: [],
    competitorRuleScopeColumns: ["historical_context"],
  };
  const fixture = rehearsal(options);
  const report = await stageAccountScopeRetirement(fixture.connection);
  assert.equal(report.tables.competitor_events, "3");
  assert.ok(
    fixture.observed.some(
      (sql) =>
        sql.includes("FROM competitor_outbox x") &&
        sql.includes("JSON_EXTRACT(r.historical_context,'$.workspace_id')") &&
        sql.includes("x.event_type='competitor.rule.created' AND r.id=x.competitor_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        brokenCompetitorRule: true,
      }).connection,
    ),
    /broken_source_link:competitor_events.competitor_id/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        competitorRuleScopeColumns: ["workspace_id", "historical_context"],
      }).connection,
    ),
    /partial_inherited_scope_schema:competitor_monitor_rules/,
  );
});

test("normalized competitor deliveries inherit only exact event or alert lineage", async () => {
  const options = { competitorEventScopeColumns: [], competitorOutboxScopeColumns: [] };
  const good = rehearsal(options);
  assert.equal((await stageAccountScopeRetirement(good.connection)).tables.competitor_outbox, "3");
  assert.ok(
    good.observed.some(
      (sql) =>
        sql.includes("FROM competitor_outbox x") &&
        sql.includes("BINARY a.change_id") &&
        sql.includes("e.competitor_id=x.aggregate_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        unpairedCompetitorOutbox: true,
      }).connection,
    ),
    /broken_source_link:competitor_outbox.id/,
  );
});

test("normalized sourcing outbox checks the exact original event and purchase reference", async () => {
  const options = { sourcingOutboxScopeColumns: [] };
  const good = rehearsal(options);
  assert.equal((await stageAccountScopeRetirement(good.connection)).tables.sourcing_outbox, "3");
  assert.ok(
    good.observed.some(
      (sql) =>
        sql.includes("FROM sourcing_outbox o LEFT JOIN sourcing_events e ON e.id=o.id") &&
        sql.includes("BINARY o.resource_id"),
    ),
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        unpairedSourcingOutbox: true,
      }).connection,
    ),
    /broken_source_link:sourcing_outbox.id/,
  );
});

test("normalized sourcing events derive scope from their typed resources before staging outbox", async () => {
  const options = { sourcingEventScopeColumns: [], sourcingOutboxScopeColumns: [] };
  const good = rehearsal(options);
  assert.equal((await stageAccountScopeRetirement(good.connection)).tables.sourcing_events, "3");
  const pairing = good.observed.find(
    (sql) =>
      sql.includes("FROM sourcing_events e LEFT JOIN") &&
      sql.includes("BINARY e.event_type=BINARY o.event_type") &&
      sql.includes("e.resource_id=o.resource_id"),
  );
  assert.ok(pairing, "typed source relation must drive outbox pairing");
  for (const type of [
    "sourcing.search.queued",
    "supplier_quote.confirmed",
    "sourcing.comparison.created",
    "sourcing.purchase_task.account_rehearsal.queued",
  ])
    assert.ok(pairing.includes(`'${type}'`), type);
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        unpairedSourcingOutbox: true,
      }).connection,
    ),
    /broken_source_link:sourcing_outbox.id/,
  );
  await assert.rejects(
    stageAccountScopeRetirement(
      rehearsal({
        ...options,
        sourcingEventScopeColumns: ["organization_id"],
      }).connection,
    ),
    /partial_inherited_scope_schema:sourcing_events/,
  );
});

test("reports account-level index collisions without merging records or leaking key values", async () => {
  const { connection, observed } = rehearsal({ collisions: true });
  const result = await stageAccountScopeRetirement(connection);
  assert.deepEqual(result.account_unique_key_collisions, [
    {
      table: "file_assets",
      index: "uq_file_asset_org_path",
      collision_groups: "1",
      affected_rows: "2",
    },
  ]);
  assert.equal(observed.at(-1), "ROLLBACK");
  assert.ok(observed.every((sql) => !/^(DELETE|UPDATE|REPLACE)\b/.test(sql)));
});

test("history rehearsal recognizes only exact scoped natural keys backed by the original ID", async () => {
  const columns = (table, index, names, prefix = null) =>
    names.map((column_name, i) => ({
      table_name: table,
      index_name: index,
      column_name,
      sub_part: i === names.length - 1 ? prefix : null,
    }));
  const scopes = ["organization_id", "workspace_id"];
  const rows = [
    ...columns("trend_topics", "PRIMARY", ["id"]),
    ...columns("trend_topics", "uq_trend_topic_scope_key", [...scopes, "topic_key"]),
    ...columns("raw_evidence", "PRIMARY", ["id"]),
    ...columns("raw_evidence", "uq_raw_evidence_scope_dedupe", [
      ...scopes,
      "provider_id",
      "dedupe_key",
    ]),
    ...columns("normalized_records", "PRIMARY", ["id"]),
    ...columns("normalized_records", "uq_normalized_scope_record_version", [
      ...scopes,
      "provider_id",
      "record_key",
      "record_version",
    ]),
    ...columns("file_assets", "PRIMARY", ["id"]),
    ...columns("file_assets", "uq_file_asset_org_path", ["organization_id", "relative_path"], 191),
  ];
  const db = {
    async query() {
      return [rows];
    },
    async execute(sql) {
      assert.match(sql, /HAVING COUNT\(\*\)>1/);
      return [[{ collision_groups: "1", affected_rows: "2" }]];
    },
  };
  const strict = await findAccountUniqueKeyCollisions(db, "run");
  assert.ok(strict.every((row) => !row.preserved_by_original_id));
  const preserve = () =>
    findAccountUniqueKeyCollisions(db, "run", { preserveHistoricalKeys: true });
  assert.deepEqual(
    (await preserve()).filter((row) => row.preserved_by_original_id).map((row) => row.table),
    ["trend_topics", "raw_evidence", "normalized_records"],
  );
  rows.find((row) => row.column_name === "topic_key").sub_part = 30;
  rows.find(
    (row) => row.table_name === "raw_evidence" && row.index_name === "PRIMARY",
  ).column_name = "unexpected";
  assert.deepEqual(
    (await preserve()).filter((row) => row.preserved_by_original_id).map((row) => row.table),
    ["normalized_records"],
  );
});
