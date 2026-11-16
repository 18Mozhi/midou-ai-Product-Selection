import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";
import { OpportunityService } from "../../apps/api/dist/opportunity-service.js";

const id = "00000000-0000-4000-8000-000000000999";
const historyTaskId = "00000000-0000-4000-8000-000000000998";
const now = new Date("2026-01-01T00:00:00Z");

test("0195 detail authorizes the native root before loading its original children", async () => {
  const childQueries = [];
  const pool = {
    async execute(sql, params) {
      assert.match(sql, /o\.account_id=oo\.account_id/);
      assert.doesNotMatch(sql, /\.organization_id\b|\.workspace_id\b/);
      assert.equal(params.at(-2), id);
      assert.ok(params.slice(0, -2).every((owner) => owner === params.at(-1)));
      assert.match(sql, /lp_owner_0.account_id=\?/);
      return [params.at(-1) === "primary" ? [{ id, name: "Original", updated_at: now }] : []];
    },
    async query(sql, params) {
      if (/^SHOW COLUMNS FROM (normalized_records|opportunities)/.test(sql))
        return [[{ Field: "account_id" }]];
      if (sql.includes("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      assert.doesNotMatch(sql, /\.organization_id\b|\.workspace_id\b/);
      assert.ok(params.includes("primary"));
      assert.equal((sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) ?? []).length, params.length);
      childQueries.push(sql);
      if (sql.includes("FROM notifications n JOIN")) {
        assert.match(sql, /source_table='outbox_events'/);
        assert.match(sql, /t\.account_id=\?.*source_table='tasks'/s);
        assert.match(sql, /d\.opportunity_id=\?.*source_table='opportunity_decisions'/s);
      }
      if (sql.includes("FROM automatic_selection_evaluations e"))
        assert.match(sql, /op\.account_id=\?/);
      return [[]];
    },
  };
  const repo = new MySqlOpportunityRepository(pool);
  assert.equal(await repo.get({ opportunityId: id, accountId: "foreign" }), null);
  assert.equal(childQueries.length, 0);
  const result = await repo.get({ opportunityId: id, accountId: "primary" });
  assert.equal(result.id, id);
  assert.ok(
    childQueries.findIndex((sql) => sql.includes("FROM tasks t LEFT JOIN task_events")) <
      childQueries.findIndex((sql) => sql.includes("FROM notifications n JOIN")),
  );
  for (const table of [
    "opportunity_operating_facts",
    "opportunity_score_jobs",
    "opportunity_score_runs",
    "opportunity_profit_runs",
    "automatic_selection_evaluations",
    "notifications",
    "opportunity_events",
  ]) {
    assert.ok(
      childQueries.some((sql) => sql.includes("FROM " + table) || sql.includes("JOIN " + table)),
      table,
    );
  }
});

test("opportunity detail rejects a foreign root before evidence, lineage or history is read", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      if (/^SHOW COLUMNS FROM (normalized_records|opportunities)/.test(sql))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM notifications"))
        return [
          ["organization_id", "workspace_id", "source_event_id", "recipient_id"].map((Field) => ({
            Field,
          })),
        ];
      calls.push(sql);
      if (sql.includes("SELECT slot FROM account_ownership_cutover")) {
        assert.match(sql, /contract_version=25/);
        return [[{ slot: "current" }]];
      }
      if (sql.includes("WHERE o.id=? AND oo.account_id=?")) {
        assert.equal(params[0], id);
        assert.match(sql, /receipt.contract_version=25/);
        assert.match(sql, /oo.reason='exclusive_owner'/);
        assert.doesNotMatch(sql, /account_retirement_scopes/);
        assert.match(sql, /ra.source_id=n_primary_current.id AND ra.account_id=oo.account_id/);
        return [
          params[1] === "primary"
            ? [
                {
                  id,
                  organization_id: "org",
                  workspace_id: "ws",
                  name: "Owned opportunity",
                  updated_at: now,
                },
              ]
            : [],
        ];
      }
      if (sql.startsWith("SELECT l.id,s.title")) {
        assert.deepEqual(params, [id, "primary", "primary", "primary", "primary"]);
        assert.match(
          sql,
          /r\.id=l\.raw_evidence_id AND r\.id=s\.raw_evidence_id AND r\.provider_id=l\.provider_id AND s\.provider_id=l\.provider_id/,
        );
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        for (const table of [
          "opportunities",
          "opportunity_evidence_links",
          "trend_signals",
          "raw_evidence",
        ])
          assert.ok(sql.includes(`ra.source_table='${table}'`));
        return [
          [{ id: "link", title: "Owned evidence", observed_at: now, raw_evidence_id: "raw" }],
        ];
      }
      if (
        sql.startsWith("SELECT DISTINCT p.id source_id") ||
        sql.startsWith("SELECT DISTINCT a.id,a.task_id") ||
        sql.startsWith("SELECT DISTINCT q.id,q.metric_code")
      ) {
        assert.deepEqual(params, [id, "primary", "primary", "primary", "primary"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /ra.source_table='opportunities' AND ra.source_id=op.id/);
        assert.match(sql, /ra.source_table='raw_evidence'/);
        assert.match(sql, /l\.provider_id=re\.provider_id|re\.provider_id=l\.provider_id/);
        return [[]];
      }
      if (sql.startsWith("SELECT DISTINCT t.id,t.title,t.status,t.source_fresh_at")) {
        assert.deepEqual(params, ["primary", id, "primary", "primary"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /t\.id=o\.source_ref_id/);
        assert.match(sql, /ra.source_table='trend_signals'/);
        return [[]];
      }
      if (sql.startsWith("SELECT id,action,reason,actor_id,created_at,opportunity_version")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.deepEqual(params, [id, "primary"]);
        assert.match(sql, /ra.source_table='opportunity_decisions'/);
        return [
          [{ id: "decision", reason: "Original", actor_id: "original-actor", created_at: now }],
        ];
      }
      if (sql.includes("FROM tasks t LEFT JOIN task_events")) {
        assert.deepEqual(params, ["primary", id, "primary", "primary", "primary"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(
          sql,
          /t.source_type IN \('evidence_completion','selection_verification'\) AND t.source_ref_id=parent.id/,
        );
        assert.match(sql, /d.id=t.source_ref_id AND d.opportunity_id=parent.id/);
        for (const kind of ["tasks", "task_events", "opportunities", "opportunity_decisions"])
          assert.ok(sql.includes(`ra.source_table='${kind}'`));
        return [
          [{ id: historyTaskId, title: "Original task", status: "completed", updated_at: now }],
        ];
      }
      if (sql.includes("FROM notifications n JOIN")) {
        assert.deepEqual(params, ["org", "ws", id, "org", "ws", id, "primary", "primary"]);
        assert.match(sql, /n.recipient_id=\?/);
        assert.match(sql, /ra.source_table='tasks'/);
        return [[]];
      }
      if (sql.includes("FROM automatic_selection_evaluations e")) {
        assert.match(sql, /JOIN opportunities op ON op.id=e.opportunity_id/);
        assert.match(sql, /op.organization_id=\? AND op.workspace_id=\?/);
        assert.deepEqual(params, [id, "org", "ws"]);
        return [[]];
      }
      if (sql.startsWith("SELECT receipt.occurred_at")) {
        assert.deepEqual(params, ["primary", id, ""]);
        assert.match(sql, /receipt_owner\.account_id=\?/);
        assert.match(sql, /rejection_owner\.account_id=receipt_owner\.account_id/);
        assert.doesNotMatch(sql, /receipt\.workspace_id=\?/);
        return [[]];
      }
      if (sql.includes("FROM tasks WHERE source_type='evidence_completion'")) {
        assert.deepEqual(params, [id, "primary", "primary"]);
        assert.match(sql, /ra.source_id=tasks.id/);
        assert.match(sql, /ra.source_id=tasks.source_ref_id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        return [
          [{ id: "original-task", status: "completed", progress_percent: 100, updated_at: now }],
        ];
      }
      if (sql.startsWith("SELECT * FROM opportunity_score_runs")) {
        assert.deepEqual(params, [id, "org", "ws", "primary"]);
        return [[{ id: "score-run", status: "calculated", scored_at: now }]];
      }
      if (sql.includes("FROM opportunity_score_components")) {
        assert.match(
          sql,
          /ra.source_table='opportunity_score_components' AND ra.source_id=opportunity_score_components.id/,
        );
        assert.deepEqual(params, ["score-run", "primary"]);
        return [
          [
            {
              dimension_code: "market",
              weight_percent: 25,
              weighted_score: 20,
              evidence_ids_json: [],
              missing_fields_json: [],
            },
          ],
        ];
      }
      assert.match(sql, /account_owned_records/);
      assert.ok(params.includes("primary"));
      return [[]];
    },
  };
  const repo = new MySqlOpportunityRepository(pool);
  const app = buildApp({
    opportunities: {
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      service: new OpportunityService(repo),
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: now }, session: { id: "s" } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope called");
        },
      },
    },
  });
  const get = (actor) =>
    app.inject({
      url: `/api/v1/opportunities/${id}?account_id=primary`,
      headers: { cookie: `scoutops_session=${actor}` },
    });
  try {
    const denied = await get("alice");
    assert.equal(denied.statusCode, 404, denied.body);
    assert.equal(calls.length, 2);
    const allowed = await get("primary");
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.equal(allowed.headers["cache-control"], "private, no-store");
    const detail = allowed.json().data;
    assert.equal(detail.evidence[0].raw_evidence_id, "raw");
    assert.equal(detail.decisions[0].actor_id, "original-actor");
    assert.equal(detail.workspace_id, undefined);
    assert.equal(detail.score_components[0].weighted_score, 20);
    assert.ok(
      detail.lineage.nodes.some((node) => node.kind === "task" && node.id === historyTaskId),
    );
    for (const table of [
      "data_quality_issues",
      "opportunity_operating_facts",
      "opportunity_score_jobs",
      "opportunity_profit_runs",
      "opportunity_events",
      "task_events",
    ]) {
      assert.ok(
        calls.some((sql) => sql.includes(`ra.source_table='${table}'`)),
        table,
      );
    }
  } finally {
    await app.close();
  }
});
