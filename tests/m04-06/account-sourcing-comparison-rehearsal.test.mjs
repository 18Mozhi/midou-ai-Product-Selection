import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";

for (const anchored of [false, true])
  test(`account comparison retains the exact snapshot across scopes (anchor=${anchored})`, async () => {
    const first = "00000000-0000-4000-8000-000000000abc";
    const second = "00000000-0000-4000-8000-000000000def";
    const origin = "http://127.0.0.1:5173";
    const quoteIds = [second, first];
    let ready = false;
    let foreign = true;
    let stale = true;
    let ownsComparison = true;
    let comparison;
    let operation;
    let event;
    let ledgerWrites = 0;
    let commits = 0;
    let rollbacks = 0;
    const connection = {
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
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
          return [[{ Field: "account_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM sourcing_outbox")) return [[]];
        if (sql.startsWith("SHOW COLUMNS FROM sourcing_events")) return [[]];
        assert.equal((sql.match(/\?/g) ?? []).length, args?.length ?? 0, sql);
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SHOW COLUMNS FROM sourcing_comparisons"))
          return [
            (anchored ? ["anchor_quote_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.startsWith("SELECT q.id,q.is_current")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.match(sql, /WHERE qo.account_id=\? AND q.id IN \(\?\)/);
          assert.match(sql, /qe.id=q.evidence_id/);
          assert.match(sql, /qe.account_id=qo.account_id/);
          assert.match(sql, /qn.account_id=qo.account_id AND qr.account_id=qo.account_id/);
          assert.match(sql, /qc.id=q.candidate_id/);
          assert.match(
            sql,
            /ra.source_table='sourcing_searches' AND ra.source_id=qs.id AND ra.account_id=qo.account_id/,
          );
          assert.match(sql, /qn.provider_id=qc.provider_id/);
          assert.match(
            sql,
            /quote_task\.id=qs\.collection_task_id[\s\S]*quote_task\.account_id=qo\.account_id/,
          );
          assert.match(sql, /ORDER BY q.id FOR UPDATE/);
          assert.deepEqual(args, ["primary", quoteIds]);
          return [
            [
              {
                id: first,
                organization_id: "org-a",
                workspace_id: "ws-a",
                is_current: 1,
                ownership_reason: "exclusive_owner",
              },
              ...(!foreign
                ? [
                    {
                      id: second,
                      organization_id: "org-b",
                      workspace_id: "ws-b",
                      is_current: stale ? 0 : 1,
                      ownership_reason: "shared",
                    },
                  ]
                : []),
            ],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(args, [
            "primary",
            "POST:/api/v1/sourcing/comparisons:account",
            "compare-fixture-key",
          ]);
          return [operation ? [{ result_json: operation }] : []];
        }
        if (sql.startsWith("SELECT x.name")) {
          assert.deepEqual(args, [comparison[0], "primary"]);
          return [
            ownsComparison
              ? [
                  {
                    name: comparison[anchored ? 2 : 3],
                    quote_ids_json: comparison[anchored ? 3 : 4],
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("INSERT INTO sourcing_comparisons")) {
          assert.equal(sql.includes("anchor_quote_id"), anchored);
          assert.deepEqual(args.slice(1, anchored ? 5 : 6), [
            ...(anchored ? [second] : ["org-b", "ws-b"]),
            "Fixture compare",
            JSON.stringify(quoteIds),
            "primary",
          ]);
          comparison = args;
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.deepEqual(
            args,
            sql.includes("'sourcing_outbox'")
              ? [event, "primary", "shared", event, "primary", "shared"]
              : [comparison[0], "primary", "shared"],
          );
          ledgerWrites++;
        } else if (sql.startsWith("INSERT INTO sourcing_events")) {
          event = args[0];
          assert.deepEqual(args.slice(1, 4), [
            "sourcing.comparison.created",
            comparison[0],
            "primary",
          ]);
        } else if (sql.startsWith("INSERT INTO sourcing_outbox")) {
          assert.equal(args[0], event);
        } else if (sql.startsWith("INSERT INTO sourcing_operations")) {
          operation = args[5];
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      sourcing: {
        service: new SourcingService(
          new MySqlSourcingRepository({
            async getConnection() {
              return connection;
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
    const post = (payload = {}, headers = {}) =>
      app.inject({
        method: "POST",
        url: "/api/v1/sourcing/comparisons",
        headers: {
          origin,
          cookie: "scoutops_session=primary",
          "idempotency-key": "compare-fixture-key",
          ...headers,
        },
        payload: {
          name: "Fixture compare",
          quote_ids: quoteIds,
          organization_id: "forged",
          ...payload,
        },
      });
    try {
      assert.equal((await post()).statusCode, 503);
      ready = true;
      assert.equal((await post({}, { cookie: "scoutops_session=unverified" })).statusCode, 403);
      assert.equal((await post({}, { origin: "https://other.invalid" })).statusCode, 403);
      assert.equal((await post({ quote_ids: [first, first.toUpperCase()] })).statusCode, 400);
      assert.equal((await post()).statusCode, 409);
      foreign = false;
      assert.equal((await post()).statusCode, 409);
      stale = false;
      const saved = await post();
      if (!anchored) {
        assert.equal(saved.statusCode, 503, saved.body);
        assert.equal(ledgerWrites, 0);
        assert.equal(commits, 0);
        return;
      }
      assert.equal(saved.statusCode, 201, saved.body);
      assert.deepEqual(saved.json().data, {
        id: comparison[0],
        name: "Fixture compare",
        quote_count: 2,
      });
      stale = true;
      const replay = await post();
      assert.equal(replay.statusCode, 201, replay.body);
      assert.deepEqual(replay.json().data, saved.json().data);
      assert.equal((await post({ name: "Changed" })).statusCode, 409);
      ownsComparison = false;
      assert.equal((await post()).statusCode, 404);
      foreign = true;
      assert.equal((await post()).statusCode, 409);
      assert.equal(ledgerWrites, 2);
      assert.equal(commits, 2);
      assert.equal(rollbacks, 6);
    } finally {
      await app.close();
    }
  });
