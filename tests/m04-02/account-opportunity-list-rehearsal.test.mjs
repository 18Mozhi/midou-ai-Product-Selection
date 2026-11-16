import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";
import { OpportunityService } from "../../apps/api/dist/opportunity-service.js";

const now = new Date("2026-01-01T00:00:00Z");
const topic = "00000000-0000-4000-8000-000000000888";

test("0195 catalogue preserves each view without reading deleted coordinates", async () => {
  for (const selectionView of [
    undefined,
    "all",
    "recommended",
    "rule_candidates",
    "evidence_pending",
    "completed",
  ]) {
    const reads = [];
    const repository = new MySqlOpportunityRepository({
      async query(sql) {
        if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "account_id" }]];
        if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
        assert.fail(sql);
      },
      async execute(sql, params) {
        reads.push(sql);
        assert.doesNotMatch(sql, /\b\w+\.(organization_id|workspace_id)\b/);
        assert.match(sql, /o.account_id=oo.account_id/);
        assert.equal(
          (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) ?? []).length,
          params.length,
        );
        assert.ok(params.includes("primary"));
        return [sql.startsWith("SELECT COUNT(*) total") ? [{ total: 0 }] : []];
      },
    });
    assert.deepEqual(
      await repository.list({
        accountId: "primary",
        selectionView,
        sourceTopicId: topic,
        pageSize: 2,
        page: 1,
      }),
      { items: [], total: 0 },
    );
    assert.equal(reads.length, 2);
    assert.match(reads[0], /tt.account_id=oo.account_id/);
    if (selectionView === "recommended") {
      assert.match(reads[0], /sc_gate.dimension_code='risk'/);
      assert.match(reads[0], /o\.created_at>scope_cut\.created_at/);
      assert.match(
        reads[0],
        /AND NOT EXISTS \(SELECT 1 FROM account_retirement_records scope_record/,
      );
      assert.match(reads[0], /'accountId',\?/);
      assert.match(reads[0], /scope_record\.legacy_org_id/);
    }
    if (selectionView === "completed")
      assert.match(reads[0], /earlier.occurred_at<completed.occurred_at/);
  }
});

test("account opportunity list binds session owner, pages across owned scopes, and filters price evidence", async () => {
  const prices = [];
  let queryCount = 0;
  const pool = {
    async query(sql, params) {
      queryCount++;
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.includes("SELECT slot FROM account_ownership_cutover")) {
        assert.match(sql, /contract_version=25/);
        return [[{ slot: "current" }]];
      }
      if (sql.startsWith("SELECT ci.opportunity_id")) {
        assert.match(sql, /co.source_table='opportunity_cost_inputs'/);
        for (const kind of [
          "opportunities",
          "raw_evidence",
          "normalized_records",
          "collection_task_evidence_links",
          "collection_tasks",
          "sourcing_searches",
          "collection_subqueries",
          "opportunity_rule_matches",
          "trend_monitoring_rules",
        ])
          assert.ok(sql.includes(`ra.source_table='${kind}'`));
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(
          sql,
          /sq\.id=l\.collection_subquery_id AND sq\.task_id=link_task\.id AND sq\.provider_id=n\.provider_id/,
        );
        assert.match(
          sql,
          /BINARY rm\.monitoring_rule_id=BINARY JSON_UNQUOTE\(JSON_EXTRACT\(sq\.target_json,'\$\.monitoring_rule_id'\)\)/,
        );
        assert.match(sql, /='rule_product_discovery' AND rm\.opportunity_id=ci\.opportunity_id/);
        const [account, ...ids] = params;
        assert.equal(account, "primary");
        prices.push(ids);
        return [
          [
            ...ids.map((id) => ({
              opportunity_id: id,
              id: `price-${id}`,
              amount_value: 19,
              observed_at: now,
              evidence_id: `evidence-${id}`,
              source_ref_id: `ref-${id}`,
            })),
          ],
        ];
      }
      assert.match(sql, /oo.source_table='opportunities' AND oo.source_id=o.id/);
      assert.match(sql, /receipt.contract_version=25/);
      assert.match(
        sql,
        /oo.reason IN \('shared','unassigned'\) AND oo.account_id=receipt.primary_account_id/,
      );
      assert.doesNotMatch(sql, /account_retirement_scopes/);
      assert.match(sql, /WHERE oo.account_id=\?/);
      assert.match(sql, /ra.source_table='trend_topics'/);
      assert.doesNotMatch(sql, /tt\.workspace_id=o\.workspace_id/);
      assert.match(sql, /o\.source_type='trend_topic' AND o\.source_ref_id=tt\.id/);
      assert.match(
        sql,
        /r\.id=l\.raw_evidence_id AND r\.id=ts\.raw_evidence_id AND r\.provider_id=l\.provider_id/,
      );
      for (const [table, alias] of [
        ["opportunity_evidence_links", "l"],
        ["trend_signals", "ts"],
        ["raw_evidence", "r"],
      ])
        assert.ok(
          sql.includes(
            `ra.source_table='${table}' AND ra.source_id=${alias}.id AND ra.account_id=oo.account_id`,
          ),
        );
      assert.match(sql, /ra.source_table='opportunity_events'/);
      assert.match(sql, /ra.source_id=earlier.resource_id AND ra.account_id=oo.account_id/);
      assert.match(
        sql,
        /rejection_owner.source_id=rejected_source.id AND rejection_owner.account_id=oo.account_id/,
      );
      assert.match(
        sql,
        /origin_owner.source_id=rejected_origin.id AND origin_owner.account_id=oo.account_id/,
      );
      assert.doesNotMatch(
        sql,
        /earlier\.workspace_id=completed\.workspace_id|completed\.workspace_id=o\.workspace_id/,
      );
      assert.equal(params[1], topic);
      if (sql.includes("SELECT COUNT(*) total FROM"))
        return [[{ total: params[0] === "primary" ? 2 : 0 }]];
      assert.match(sql, /ra.source_table='opportunity_evidence_links'/);
      assert.match(sql, /ra.source_id=n_primary_current.id AND ra.account_id=o.account_owner/);
      assert.doesNotMatch(
        sql,
        /l_primary\.opportunity_id=o\.id AND n_primary\.organization_id=o\.organization_id/,
      );
      assert.match(sql, /n_primary_current\.workspace_id=n_primary\.workspace_id/);
      assert.match(sql, /ra.source_id=n_seed.id AND ra.account_id=o.account_owner/);
      assert.match(sql, /ra.source_id=n.raw_evidence_id AND ra.account_id=o.account_owner/);
      assert.match(sql, /n.workspace_id=n_seed.workspace_id/);
      assert.doesNotMatch(
        sql,
        /l\.opportunity_id=o\.id AND n_seed\.organization_id=o\.organization_id/,
      );
      assert.match(sql, /ra.source_table='competitor_snapshots'/);
      assert.doesNotMatch(sql, /ss\.(organization_id|workspace_id)/);
      for (const [table, id] of [
        ["sourcing_searches", "ss.id"],
        ["sourcing_candidates", "sc.id"],
        ["collection_tasks", "ss.collection_task_id"],
        ["raw_evidence", "sc.raw_evidence_id"],
      ])
        assert.ok(
          sql.includes(
            `ra.source_table='${table}' AND ra.source_id=${id} AND ra.account_id=o.account_owner`,
          ),
        );
      assert.deepEqual(params.slice(-2), [2, 0]);
      if (params[0] !== "primary") return [[]];
      return [
        [
          { id: "a", organization_id: "org1", workspace_id: "ws1", updated_at: now },
          { id: "b", organization_id: "org2", workspace_id: "ws2", updated_at: now },
        ],
      ];
    },
  };
  const app = buildApp({
    opportunities: {
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      service: new OpportunityService(new MySqlOpportunityRepository(pool)),
      auth: {
        async authenticate(id) {
          return {
            user: { id, email_verified_at: id === "unverified" ? null : now },
            session: { id: "s" },
          };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope called");
        },
      },
    },
  });
  const list = (id) =>
    app.inject({
      url: `/api/v1/opportunities?selection_view=completed&source_topic_id=${topic}&page_size=2&account_id=primary`,
      headers: { cookie: `scoutops_session=${id}` },
    });
  try {
    const denied = await list("alice");
    assert.equal(denied.statusCode, 200, denied.body);
    assert.deepEqual(denied.json().data, []);
    assert.equal(denied.json().meta.total, 0);
    assert.deepEqual(prices, []);
    const allowed = await list("primary");
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.equal(allowed.headers["cache-control"], "private, no-store");
    assert.equal(allowed.json().meta.total, 2);
    assert.deepEqual(
      allowed.json().data.map((row) => [row.id, row.automatic_purchase_price?.id]),
      [
        ["a", "price-a"],
        ["b", "price-b"],
      ],
    );
    assert.deepEqual(prices, [["a", "b"]]);
    assert.ok(
      allowed
        .json()
        .data.every((row) => row.account_owner === undefined && row.workspace_id === undefined),
    );
    const before = queryCount;
    assert.equal((await list("unverified")).statusCode, 403);
    assert.equal(queryCount, before);
  } finally {
    await app.close();
  }
});

test("account candidate filter uses owned evidence rather than the opportunity workspace", async () => {
  const calls = [];
  const repository = new MySqlOpportunityRepository({
    async query(sql, params) {
      if (sql.includes("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      calls.push({ sql, params });
      return [sql.includes("SELECT COUNT(*) total FROM") ? [{ total: 0 }] : []];
    },
  });
  await repository.list({
    accountId: "primary",
    selectionView: "rule_candidates",
    pageSize: 2,
    page: 1,
  });
  assert.equal(calls.length, 2);
  for (const { sql, params } of calls) {
    assert.equal(params[0], "primary");
    assert.match(sql, /ra.source_id=l_primary.id AND ra.account_id=oo.account_id/);
    assert.match(sql, /ra.source_id=n_primary_current.id AND ra.account_id=oo.account_id/);
    assert.doesNotMatch(
      sql,
      /l_primary\.opportunity_id=o\.id AND n_primary\.organization_id=o\.organization_id/,
    );
    assert.match(sql, /n_primary_current\.workspace_id=n_primary\.workspace_id/);
  }
});

test("0190 list and detail use native evidence ownership in all read gates", async () => {
  const calls = [];
  let shape = [{ Field: "account_id" }];
  const transaction = [];
  const repository = new MySqlOpportunityRepository({
    async execute(sql, params) {
      return this.query(sql, params);
    },
    async getConnection() {
      return {
        async query(sql) {
          transaction.push(sql);
        },
        async execute(sql, params) {
          calls.push({ sql, params });
          if (sql.startsWith("SELECT STRAIGHT_JOIN COUNT(*) total")) return [[{ total: 1 }]];
          if (sql.startsWith("SELECT STRAIGHT_JOIN o.id,o.filter_primary_asin"))
            return [[{ id: "test-id", filter_primary_asin: "B000000001" }]];
          return [[]];
        },
        async rollback() {
          transaction.push("rollback");
        },
        release() {
          transaction.push("release");
        },
      };
    },
    async query(sql, params) {
      if (sql.includes("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records")) return [shape];
      calls.push({ sql, params });
      return [sql.includes("SELECT COUNT(*) total FROM") ? [{ total: 0 }] : []];
    },
  });
  for (const selectionView of [
    "all",
    "recommended",
    "rule_candidates",
    "evidence_pending",
    "completed",
  ]) {
    const start = calls.length;
    await repository.list({
      accountId: "primary",
      selectionView,
      pageSize: 2,
      page: 1,
      ...(selectionView === "recommended"
        ? { sourceTopicId: topic, lifecycleStatus: "archived" }
        : {}),
    });
    assert.equal(calls.length, start + (selectionView === "recommended" ? 3 : 2));
  }
  await repository.get({ accountId: "primary", opportunityId: "test-id" });
  assert.equal(calls.length, 12);
  assert.deepEqual(transaction, [
    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ",
    "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY",
    "rollback",
    "release",
  ]);
  for (const { sql, params } of calls.slice(2, 4)) {
    assert.match(sql, /^SELECT STRAIGHT_JOIN /);
    assert.match(sql, /filter_primary_asin/);
    assert.equal(
      (
        sql.match(
          /FROM opportunity_evidence_links l_primary FORCE INDEX \(uq_opportunity_evidence\) STRAIGHT_JOIN/g,
        ) ?? []
      ).length,
      1,
    );
    assert.match(sql, /n_primary_current FORCE INDEX \(uq_normalized_account_record_version\)/);
    assert.match(sql, /STRAIGHT_JOIN raw_evidence seed_e ON seed_e.id=n_primary.raw_evidence_id/);
    assert.match(
      sql,
      /STRAIGHT_JOIN raw_evidence active_e ON active_e.id=n_primary_current.raw_evidence_id/,
    );
    assert.equal(
      (sql.match(/STRAIGHT_JOIN account_owned_records lp_owner_\d+ FORCE INDEX \(PRIMARY\)/g) ?? [])
        .length,
      7,
    );
    assert.match(sql, /COUNT\(DISTINCT UPPER\(c_sample.external_id\)\)/);
    assert.match(sql, /c_bound.external_id.*LIMIT 18446744073709551615\) o LIMIT/);
    assert.match(sql, /n_relation\.account_id=\?/);
    assert.match(sql, /ra.source_id=tt.id AND ra.account_id=o.account_owner/);
    assert.ok(params.includes(topic) && params.includes("archived"));
  }
  assert.match(calls[4].sql, /1 candidate_ready,1 risk_gate_passed,1 competition_gate_passed/);
  assert.ok(calls[4].params.includes("B000000001"));
  for (const { sql, params } of calls.filter((_, i) => i !== 4)) {
    assert.ok(params.includes("primary"));
    assert.doesNotMatch(
      sql,
      /\b(?:n|n_seed|n_primary|n_primary_current|n_detail|n_relation)\.(?:organization_id|workspace_id)\b|uq_normalized_scope_record_version|idx_normalized_scope_status/,
    );
    if (!/^SELECT (?:STRAIGHT_JOIN )?(?:COUNT\(\*\) total|o.id,o.filter_primary_asin) /.test(sql)) {
      assert.match(sql, /n_primary_current\.account_id=n_primary\.account_id/);
      assert.match(sql, /active_t\.workspace_id=seed_t\.workspace_id/);
      assert.match(sql, /n_detail\.account_id=\?/);
      assert.match(sql, /n_relation\.account_id=\?/);
      assert.equal((sql.replace(/'(?:''|[^'])*'/g, "").match(/\?/g) ?? []).length, params.length);
    }
  }
  shape = [{ Field: "account_id" }, { Field: "workspace_id" }];
  await assert.rejects(
    repository.list({ accountId: "primary", selectionView: "all", pageSize: 2, page: 1 }),
    /normalized_record_scope_schema_invalid/,
  );
  assert.equal(calls.length, 12);
});

test("unsealed candidate filter still requires the original workspace", async () => {
  const calls = [];
  const repository = new MySqlOpportunityRepository({
    async query(sql, params) {
      calls.push({ sql, params });
      return [sql.includes("SELECT COUNT(*) total FROM") ? [{ total: 0 }] : []];
    },
  });
  await repository.list({
    organizationId: "org",
    workspaceId: "workspace",
    selectionView: "rule_candidates",
    pageSize: 2,
    page: 1,
  });
  assert.equal(calls.length, 2);
  for (const { sql, params } of calls) {
    assert.deepEqual(params.slice(0, 2), ["org", "workspace"]);
    assert.match(
      sql,
      /l_primary\.opportunity_id=o\.id AND n_primary\.organization_id=o\.organization_id AND n_primary\.workspace_id=o\.workspace_id/,
    );
    assert.doesNotMatch(sql, /ra\.source_id=l_primary\.id/);
    if (!sql.includes("SELECT COUNT(*) total FROM"))
      assert.match(
        sql,
        /l\.opportunity_id=o\.id AND n_seed\.organization_id=o\.organization_id AND n_seed\.workspace_id=o\.workspace_id/,
      );
  }
});
