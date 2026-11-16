import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";

test("account quote confirmation preserves versions and requires owned candidate and evidence", async () => {
  const candidate = "00000000-0000-4000-8000-000000000abc";
  const evidence = "00000000-0000-4000-8000-000000000def";
  const origin = "http://127.0.0.1:5173";
  let ready = false;
  let ownsEvidence = true;
  let ownsReplay = true;
  let taskOwner = "primary";
  let ownsOpportunity = true;
  let currentOwner = "other";
  let cached;
  let quoteId;
  let eventId;
  let writes = 0;
  let commits = 0;
  let rollbacks = 0;
  const c = {
    async beginTransaction() {},
    async commit() {
      commits++;
    },
    async rollback() {
      rollbacks++;
    },
    release() {},
    async query(sql, args) {
      if (sql.includes("FROM information_schema.COLUMNS"))
        return [
          ["raw_evidence", "normalized_records"].map((table_name) => ({
            table_name,
            column_name: "account_id",
          })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM sourcing_outbox")) return [[]];
      if (sql.startsWith("SHOW COLUMNS FROM sourcing_events")) return [[]];
      assert.equal((sql.match(/\?/g) ?? []).length, args?.length ?? 0, sql);
      if (sql.includes("FROM account_ownership_cutover"))
        return [ready ? [{ slot: "current" }] : []];
      if (sql.includes("SELECT c.*,co.reason")) {
        assert.match(sql, /s.deleted_at IS NULL/);
        assert.match(sql, /ra.source_table='raw_evidence'.*ra.source_id=c.raw_evidence_id/);
        assert.match(sql, /ra.source_table='sourcing_searches'/);
        assert.match(
          sql,
          /quote_task\.id=s\.collection_task_id[\s\S]*quote_task\.account_id=co\.account_id/,
        );
        assert.match(sql, /ra.source_table='collection_tasks'.*ra.source_id=quote_task.id/);
        assert.match(
          sql,
          /s\.input_type<>'opportunity'[\s\S]*ra.source_table='opportunities'.*ra.source_id=CONVERT\(s\.input_ref USING ascii\)/,
        );
        assert.match(sql, /n.id=c.normalized_record_id AND n.raw_evidence_id=c.raw_evidence_id/);
        assert.match(sql, /n.provider_id=c.provider_id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /ra.source_table='normalized_records'.*ra.source_id=n.id/);
        return [
          args[0] === candidate &&
          args[1] === "primary" &&
          taskOwner === "primary" &&
          ownsOpportunity
            ? [
                {
                  id: candidate,
                  organization_id: "org",
                  workspace_id: "ws",
                  ownership_reason: "shared",
                  supplier_name: "Source supplier",
                  product_title: "Source title",
                  quoted_price: "12.80",
                  currency: "CNY",
                  original_url: "https://example.invalid/quote",
                },
              ]
            : [],
        ];
      }
      if (sql.startsWith("SELECT e.id FROM raw_evidence")) {
        assert.match(sql, /e.account_id=eo.account_id/);
        assert.deepEqual(args, [evidence, "primary"]);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        return [ownsEvidence ? [{ id: evidence }] : []];
      }
      if (sql.startsWith("SELECT result_json")) {
        assert.match(sql, /FOR UPDATE$/);
        assert.deepEqual(args, [
          "primary",
          `POST:/api/v1/sourcing/quotes/${candidate}:account`,
          "quote-action-key",
        ]);
        return [cached ? [{ result_json: cached }] : []];
      }
      if (sql.startsWith("SELECT q.id FROM supplier_quotes")) {
        assert.match(sql, /qe.account_id=qo.account_id/);
        assert.match(sql, /qe.id=q.evidence_id/);
        assert.deepEqual(args, [quoteId, candidate, "primary"]);
        return [ownsReplay ? [{ id: quoteId }] : []];
      }
      if (sql.startsWith("SELECT qo.account_id")) {
        assert.match(sql, /q.is_current=1 FOR UPDATE/);
        return [[{ organization_id: "org", workspace_id: "ws", account_id: currentOwner }]];
      }
      if (sql.startsWith("SELECT COALESCE(MAX")) return [[{ version: 3 }]];
      if (sql.startsWith("UPDATE supplier_quotes")) {
        assert.match(sql, /SET is_current=0/);
        assert.deepEqual(args, [candidate]);
      } else if (sql.startsWith("INSERT INTO supplier_quotes")) {
        quoteId = args[0];
        assert.deepEqual(args.slice(1, 9), [
          candidate,
          3,
          "Source supplier",
          "Source title",
          "Fixture spec",
          100,
          "12.80",
          "CNY",
        ]);
        assert.equal(args[13], evidence);
        writes++;
      } else if (sql.startsWith("UPDATE sourcing_candidates")) {
        assert.equal(args.at(-1), candidate);
      } else if (sql.startsWith("INSERT INTO account_owned_records")) {
        assert.deepEqual(
          args,
          sql.includes("'sourcing_outbox'")
            ? [eventId, "primary", "shared", eventId, "primary", "shared"]
            : [quoteId, "primary", "shared"],
        );
      } else if (sql.startsWith("INSERT INTO sourcing_events")) {
        eventId = args[0];
        assert.deepEqual(args.slice(1, 4), ["supplier_quote.confirmed", quoteId, "primary"]);
      } else if (sql.startsWith("INSERT INTO sourcing_outbox")) {
        assert.equal(args[0], eventId);
      } else if (sql.startsWith("INSERT INTO sourcing_operations")) {
        cached = args[5];
      } else assert.fail(sql);
      return [[]];
    },
  };
  const app = buildApp({
    sourcing: {
      service: new SourcingService(
        new MySqlSourcingRepository({
          async getConnection() {
            return c;
          },
        }),
      ),
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: origin,
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: id === "unverified" ? null : new Date() } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy workspace was consulted");
        },
      },
    },
  });
  const payload = {
    candidate_id: candidate,
    evidence_id: evidence,
    moq: 100,
    specification: "Fixture spec",
    lead_time_days: 10,
    location: "Fixture",
    confidence_value: 100,
    stability_status: "stable",
    risk_level: "low",
    observed_at: "2026-01-01T00:00:00.000Z",
    accountOwnedQuote: true,
  };
  const post = ({ actor = "primary", id = candidate, ...headers } = {}) =>
    app.inject({
      method: "POST",
      url: "/api/v1/sourcing/quotes",
      headers: {
        origin,
        cookie: `scoutops_session=${actor}`,
        "idempotency-key": "quote-action-key",
        ...headers,
      },
      payload: { ...payload, candidate_id: id },
    });
  try {
    const retired = await app.inject({
      method: "POST",
      url: `/api/v1/sourcing/searches/${candidate}/refresh`,
      headers: { origin, cookie: "scoutops_session=primary", "idempotency-key": "refresh-key" },
    });
    assert.equal(retired.statusCode, 404, retired.body);
    assert.equal((await post()).statusCode, 503);
    ready = true;
    assert.equal((await post({ actor: "other" })).statusCode, 404);
    assert.equal((await post({ actor: "unverified" })).statusCode, 403);
    assert.equal((await post({ origin: "https://other.invalid" })).statusCode, 403);
    assert.equal((await post({ "idempotency-key": "" })).statusCode, 400);
    taskOwner = "other";
    assert.equal((await post()).statusCode, 404);
    taskOwner = "primary";
    ownsOpportunity = false;
    assert.equal((await post()).statusCode, 404);
    ownsOpportunity = true;
    ownsEvidence = false;
    assert.equal((await post()).statusCode, 404);
    ownsEvidence = true;
    assert.equal((await post()).statusCode, 409);
    currentOwner = "primary";
    const confirmed = await post();
    assert.equal(confirmed.statusCode, 201, confirmed.body);
    assert.deepEqual(confirmed.json().data, {
      id: quoteId,
      candidate_id: candidate,
      quote_version: 3,
      status: "confirmed",
    });
    assert.deepEqual(
      (await post({ id: candidate.toUpperCase() })).json().data,
      confirmed.json().data,
    );
    ownsReplay = false;
    assert.equal((await post()).statusCode, 404);
    assert.equal(writes, 1);
    assert.equal(commits, 2);
    assert.equal(rollbacks, 7);
  } finally {
    await app.close();
  }
});
