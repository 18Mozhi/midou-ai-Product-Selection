import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";
import { TrendService } from "../../apps/api/dist/trend-service.js";

for (const [legacy, native] of [
  [true, false],
  [false, false],
  [false, true],
])
  test(`account topic mutations preserve owned event/delivery pairs (legacy=${legacy}, native=${native})`, async () => {
    const topic = "00000000-0000-4000-8000-000000000abc";
    const origin = "http://127.0.0.1:5173";
    const follows = new Map([["other", { organization_id: "org", workspace_id: "ws" }]]);
    const operations = new Map();
    const event = new Map();
    const mapped = [];
    let owner = "primary";
    let ready = false;
    let version = 1;
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
      async query(sql, p) {
        if (sql.startsWith("SHOW COLUMNS FROM trend_events"))
          return [native ? [] : [{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM trend_topics"))
          return [
            native
              ? [{ Field: "account_id" }]
              : [{ Field: "organization_id" }, { Field: "workspace_id" }],
          ];
        if (sql.startsWith("SHOW COLUMNS FROM trend_outbox"))
          return [(legacy ? ["organization_id", "workspace_id"] : []).map((Field) => ({ Field }))];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SELECT t.organization_id") || sql.startsWith("SELECT t.account_id")) {
          assert.match(sql, /o.source_table='trend_topics'.*o.account_id=\? FOR UPDATE/);
          if (native) assert.match(sql, /t.account_id=o.account_id/);
          return [
            p[0] === topic && p[1] === owner
              ? [
                  native
                    ? { account_id: owner, ownership_reason: "shared" }
                    : { organization_id: "org", workspace_id: "ws", ownership_reason: "shared" },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          assert.equal(p[0], "primary");
          assert.ok(p[1].includes(`/${topic}/`) && p[1].endsWith(":account"));
          const result_json = operations.get(p.join("/"));
          return [result_json ? [{ result_json }] : []];
        }
        if (sql.startsWith("SELECT id FROM account_trend_topic_follows")) {
          assert.deepEqual(p, [topic, "primary"]);
          return [follows.has(p[1]) ? [follows.get(p[1])] : []];
        }
        if (sql.startsWith("INSERT INTO account_trend_topic_follows")) {
          assert.deepEqual(p.slice(1, 3), ["primary", topic]);
          follows.set(p[1], { id: p[0] });
        } else if (sql.startsWith("DELETE FROM account_trend_topic_follows")) {
          assert.deepEqual(p, [topic, "primary"]);
          follows.delete(p[1]);
        } else if (sql.startsWith("UPDATE trend_topics")) {
          assert.equal(p[0], "irrelevant");
          assert.deepEqual(p.slice(2, -1), native ? [topic, "primary"] : [topic, "org", "ws"]);
          if (p.at(-1) !== version) return [{ affectedRows: 0 }];
          version++;
          return [{ affectedRows: 1 }];
        } else if (sql.startsWith("INSERT INTO trend_events")) {
          if (native) assert.doesNotMatch(sql, /organization_id|workspace_id/);
          else assert.deepEqual(p.slice(1, 3), ["org", "ws"]);
          assert.equal(p[native ? 5 : 7], "primary");
          event.set(p[0], [p[native ? 1 : 3], JSON.parse(p[native ? 8 : 10])]);
        } else if (sql.startsWith("INSERT INTO trend_outbox")) {
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          assert.equal((sql.match(/\?/g) ?? []).length, p.length);
          assert.equal(event.get(p[0])[0], p[legacy ? 3 : 1]);
          assert.deepEqual(JSON.parse(p[legacy ? 6 : 4]), event.get(p[0])[1]);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.match(sql, /VALUES \('trend_events',\?,\?,\?\),\('trend_outbox',\?,\?,\?\)/);
          assert.deepEqual(p.slice(1), ["primary", "shared", p[0], "primary", "shared"]);
          mapped.push(event.get(p[0]));
        } else if (sql.startsWith("INSERT INTO trend_operations")) {
          operations.set(p.slice(1, 4).join("/"), p[5]);
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      trends: {
        service: new TrendService(
          new MySqlTrendRepository({
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
            assert.fail("legacy membership was consulted");
          },
        },
      },
    });
    const inject = (
      method,
      type,
      payload,
      { actor = "primary", id = topic, key = "trend-action-key", ...headers } = {},
    ) =>
      app.inject({
        method,
        url: `/api/v1/trends/${id}/${type}`,
        payload,
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": key,
          ...headers,
        },
      });
    try {
      assert.equal((await inject("PUT", "follow")).statusCode, 503);
      ready = true;
      assert.equal((await inject("PUT", "follow", undefined, { actor: "other" })).statusCode, 404);
      assert.equal(
        (await inject("PUT", "follow", undefined, { actor: "unverified" })).statusCode,
        403,
      );
      assert.equal(
        (await inject("PUT", "follow", undefined, { origin: "https://other.invalid" })).statusCode,
        403,
      );
      assert.equal((await inject("PUT", "follow", undefined, { key: "" })).statusCode, 400);
      const followed = await inject("PUT", "follow");
      assert.equal(followed.statusCode, 200, followed.body);
      assert.equal(followed.json().data.followed, true);
      assert.equal(follows.size, 2);
      assert.deepEqual(
        (await inject("PUT", "follow", undefined, { id: topic.toUpperCase() })).json().data,
        followed.json().data,
      );
      owner = "other";
      assert.equal((await inject("PUT", "follow")).statusCode, 404);
      owner = "primary";
      const unfollowed = await inject("DELETE", "follow");
      assert.equal(unfollowed.statusCode, 200, unfollowed.body);
      assert.equal(unfollowed.json().data.followed, false);
      assert.deepEqual([...follows.keys()], ["other"]);
      const relevance = { status: "irrelevant", reason: "fixture reason" };
      assert.equal(
        (await inject("POST", "relevance", { ...relevance, expected_version: 2 })).statusCode,
        409,
      );
      const changed = await inject("POST", "relevance", { ...relevance, expected_version: 1 });
      assert.equal(changed.statusCode, 200, changed.body);
      assert.equal(changed.json().data.version, 2);
      assert.deepEqual(
        mapped.map(([name]) => name),
        ["trend.topic.followed", "trend.topic.unfollowed", "trend.topic.relevance_changed"],
      );
      assert.equal(mapped[2][1].reason, "fixture reason");
      assert.equal(commits, 4);
      assert.equal(rollbacks, 4);
    } finally {
      await app.close();
    }
  });
