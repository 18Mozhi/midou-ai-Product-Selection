import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";

const id = "00000000-0000-4000-8000-000000000123";
const opportunity = "00000000-0000-4000-8000-000000000456";
const date = new Date("2026-01-01T00:00:00Z");
const search = {
  id,
  input_type: "opportunity",
  input_ref: opportunity,
  organization_id: "org",
  workspace_id: "ws",
  collection_task_id: "task",
  candidate_count: 99,
  owned_candidate_count: 1,
  missing_fields_json: [],
  status: "queued",
  created_at: date,
  updated_at: date,
};

test("quote reads reject a partially migrated evidence schema before hydrating saved quotes", async () => {
  const repo = new MySqlSourcingRepository({
    async query(sql) {
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT c.* FROM sourcing_comparisons"))
        return [[{ quote_ids_json: [id] }]];
      if (sql.includes("FROM information_schema.COLUMNS"))
        return [
          [
            { table_name: "raw_evidence", column_name: "account_id" },
            ...["organization_id", "workspace_id"].map((column_name) => ({
              table_name: "normalized_records",
              column_name,
            })),
          ],
        ];
      assert.fail("must not read quotes on a mixed layout");
    },
  });
  await assert.rejects(repo.listComparisons({ accountId: "alice" }), {
    code: "sourcing_evidence_scope_not_ready",
    statusCode: 503,
  });
});

test("owned legacy search history reads its original task but never resolves an ERP opportunity from text", async () => {
  const input = "historical collection input";
  const repo = new MySqlSourcingRepository({
    async query(sql) {
      if (sql.includes("FROM information_schema.COLUMNS"))
        return [
          ["raw_evidence", "normalized_records"].map((table_name) => ({
            table_name,
            column_name: "account_id",
          })),
        ];
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT s.*,") || sql.startsWith("SELECT s.id,s.input_type")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /s.input_ref NOT REGEXP/);
        assert.match(sql, /BINARY history_task.request_id=BINARY s.request_id/);
        assert.match(sql, /BINARY history_task.trace_id=BINARY s.trace_id/);
        assert.match(sql, /NOT EXISTS \(SELECT 1 FROM sourcing_candidates history_candidate/);
        return [[{ ...search, input_ref: input, display_name: input, owned_candidate_count: 0 }]];
      }
      if (sql.includes("FROM sourcing_candidates c JOIN")) return [[]];
      if (sql.includes("FROM collection_tasks t JOIN")) return [[]];
      assert.fail("unexpected history query");
    },
  });
  const result = await repo.detail({ accountId: "alice", searchId: id });
  assert.equal(result.input_ref, input);
  assert.equal(result.collection_task_id, "task");
  assert.deepEqual(result.candidates, []);
});

test("account sourcing applies ownership to paging, detail, evidence and saved quote comparisons", async () => {
  let calls = 0;
  const pool = {
    async query(sql, params) {
      if (sql.includes("FROM information_schema.COLUMNS"))
        return [
          ["raw_evidence", "normalized_records"].map((table_name) => ({
            table_name,
            column_name: "account_id",
          })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{ Field: "account_id" }]];
      calls++;
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.includes("preceding_count")) {
        assert.match(
          sql,
          /ra.source_table='sourcing_searches' AND ra.source_id=target.id AND ra.account_id=so.account_id/,
        );
        assert.deepEqual(params, [id, "alice", "%literal=_%"]);
        return [[{ preceding_count: 0 }]];
      }
      if (sql.startsWith("SELECT COUNT(*) total")) {
        assert.match(sql, /so.account_id=\?/);
        assert.equal(params[0], "alice");
        if (sql.includes("running")) assert.match(sql, /ra.source_table='sourcing_candidates'/);
        return [[{ total: 1, running: 1, candidates: 1, ready: 1 }]];
      }
      if (sql.startsWith("SELECT s.*,") || sql.startsWith("SELECT s.id,s.input_type")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /ra.source_table='opportunity_evidence_links'/);
        assert.match(sql, /ra.source_table='collection_subqueries'/);
        assert.match(sql, /ra.source_table='collection_tasks'/);
        if (sql.includes("WHERE s.id=? AND so.account_id=?")) {
          assert.equal(params[0], id);
          return [params[1] === "alice" ? [search] : []];
        }
        assert.equal(params[0], "alice");
        return [[search]];
      }
      if (sql.includes("FROM sourcing_candidates c JOIN")) {
        assert.deepEqual(params, [id, "alice"]);
        for (const part of ["supplier_quotes", "normalized_records", "raw_evidence"])
          assert.ok(sql.includes(`ra.source_table='${part}'`));
        assert.match(sql, /FROM raw_evidence qe WHERE qe.id=q.evidence_id/);
        assert.match(sql, /qn.account_id=co.account_id AND qr.account_id=co.account_id/);
        assert.match(sql, /qe.account_id=co.account_id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(
          sql,
          /ra.source_table='sourcing_searches' AND ra.source_id=cs.id AND ra.account_id=co.account_id/,
        );
        assert.match(sql, /ra.source_id=qe.id AND ra.account_id=co.account_id/);
        return [[]];
      }
      if (sql.includes("FROM collection_tasks t JOIN")) {
        assert.deepEqual(params, ["task", "alice"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /ra.source_table='collection_subqueries'/);
        return [[]];
      }
      if (sql.includes("normalized_record_id,n.payload_json")) {
        assert.deepEqual(params, [opportunity, "alice"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /s.raw_evidence_id=e.id AND s.provider_id=n.provider_id/);
        assert.match(sql, /oo.account_id=\?/);
        assert.match(sql, /ra.source_table='raw_evidence'/);
        return [[]];
      }
      if (sql.includes("FROM sourcing_comparisons c JOIN")) {
        assert.deepEqual(params, ["alice"]);
        return [
          [
            {
              id: "comparison",
              name: "Quotes",
              quote_ids_json: ["owned", "other-scope"],
              organization_id: "org",
              workspace_id: "ws",
              created_at: date,
            },
          ],
        ];
      }
      if (
        /FROM supplier_quotes q\s+JOIN sourcing_candidates qc ON qc.id=q.candidate_id\s+JOIN sourcing_searches qs ON qs.id=qc.search_id\s+JOIN account_owned_records qo/.test(
          sql,
        )
      ) {
        assert.deepEqual(params, ["alice", ["owned", "other-scope"]]);
        assert.match(sql, /qo.account_id=\?/);
        assert.match(sql, /FROM raw_evidence qe WHERE qe.id=q.evidence_id/);
        assert.match(sql, /ra.source_id=qe.id AND ra.account_id=qo.account_id/);
        assert.match(
          sql,
          /quote_task\.id=qs\.collection_task_id[\s\S]*quote_task\.account_id=qo\.account_id/,
        );
        assert.match(sql, /ra.source_table='sourcing_candidates' AND ra.source_id=qc.id/);
        assert.match(
          sql,
          /ra.source_table='sourcing_searches' AND ra.source_id=qs.id AND ra.account_id=qo.account_id/,
        );
        assert.match(
          sql,
          /qn.raw_evidence_id=qc.raw_evidence_id\s+AND qn.provider_id=qc.provider_id/,
        );
        assert.match(sql, /qc.id=q.candidate_id/);
        return [
          [
            { id: "owned", organization_id: "org", workspace_id: "ws", observed_at: date },
            { id: "other-scope", organization_id: "org", workspace_id: "other", observed_at: date },
          ],
        ];
      }
      assert.fail(sql);
    },
  };
  const app = buildApp({
    sourcing: {
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      service: new SourcingService(new MySqlSourcingRepository(pool)),
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: date }, session: { id: "s" } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope called");
        },
      },
    },
  });
  const request = (path, actor = "alice") =>
    app.inject({
      url: `/api/v1/sourcing/${path}`,
      headers: { cookie: `scoutops_session=${actor}` },
    });
  try {
    const denied = await request(`searches/${id}?account_id=alice`, "primary");
    assert.equal(denied.statusCode, 404, denied.body);
    assert.equal(calls, 2);
    const page = await request(`searches?q=literal_&page_size=1&record=${id}&account_id=primary`);
    assert.equal(page.statusCode, 200, page.body);
    assert.equal(page.headers["cache-control"], "private, no-store");
    assert.equal(page.json().data[0].candidate_count, 1);
    assert.deepEqual(page.json().meta.summary, { total: 1, running: 1, candidates: 1, ready: 1 });
    const detail = await request(`searches/${id}`);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.equal(detail.json().data.workspace_id, undefined);
    const comparisons = await request("comparisons");
    assert.equal(comparisons.statusCode, 200, comparisons.body);
    assert.deepEqual(
      comparisons.json().data[0].quotes.map((q) => q.id),
      ["owned", "other-scope"],
    );
  } finally {
    await app.close();
  }
});
