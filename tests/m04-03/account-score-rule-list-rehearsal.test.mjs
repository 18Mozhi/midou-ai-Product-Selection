import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlScoringRepository } from "../../apps/api/dist/mysql-scoring-repository.js";
import { ScoringService } from "../../apps/api/dist/scoring-service.js";

test("rehearsal score rules use the verified session owner; production list retains scoped authorization", async () => {
  let ready = false;
  const day = new Date("2026-01-01T00:00:00.000Z");
  const queries = [];
  const authz = [];
  const service = new ScoringService(
    new MySqlScoringRepository({
      async query(sql, args) {
        queries.push(sql);
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.includes("FROM score_rules r")) {
          assert.match(
            sql,
            /ra.source_table='score_rules' AND ra.source_id=r.id AND ra.account_id=\?/,
          );
          assert.equal(args.length, 1);
          return [
            args[0] === "owner"
              ? [
                  {
                    id: "rule",
                    name: "Owned rule",
                    dimensions_json: [],
                    thresholds_json: {},
                    status: "active",
                    revision: 1,
                    version_code: "v1",
                    updated_at: day,
                  },
                ]
              : [],
          ];
        }
        assert.match(sql, /FROM score_rules WHERE organization_id=\? AND workspace_id=\?/);
        assert.deepEqual(args, ["org", "ws"]);
        return [[]];
      },
    }),
  );
  const appFor = (accountReadRehearsal) =>
    buildApp({
      scoring: {
        service,
        accountReadRehearsal,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
        auth: {
          async authenticate(id) {
            return {
              user: { id, email_verified_at: id === "unverified" ? null : day },
              session: { id: "session" },
            };
          },
        },
        authorization: {
          async resolveSession(id) {
            assert.equal(accountReadRehearsal, false, "legacy scope was consulted");
            authz.push(id);
            return { context: { organization_id: "org", workspace_id: "ws" } };
          },
          async authorize(input) {
            assert.equal(input.capability, "opportunity:read");
            authz.push(input.capability);
          },
        },
      },
    });
  const rehearsal = appFor(true),
    legacy = appFor(false);
  const list = (app, account) =>
    app.inject({
      url: "/api/v1/opportunity-score-rules?accountId=owner",
      headers: { cookie: `scoutops_session=${account}` },
    });
  try {
    assert.equal((await list(rehearsal, "unverified")).statusCode, 403);
    assert.equal(queries.length, 0);
    assert.equal((await list(rehearsal, "owner")).statusCode, 503);
    ready = true;
    const owner = await list(rehearsal, "owner");
    assert.equal(owner.statusCode, 200, owner.body);
    assert.equal(owner.headers["cache-control"], "private, no-store");
    assert.equal(owner.json().data[0].name, "Owned rule");
    const foreign = await list(rehearsal, "other");
    assert.equal(foreign.statusCode, 200, foreign.body);
    assert.deepEqual(foreign.json().data, []);
    assert.deepEqual(authz, []);
    assert.equal((await list(legacy, "owner")).statusCode, 200);
    assert.deepEqual(authz, ["owner", "opportunity:read"]);
  } finally {
    await rehearsal.close();
    await legacy.close();
  }
});
