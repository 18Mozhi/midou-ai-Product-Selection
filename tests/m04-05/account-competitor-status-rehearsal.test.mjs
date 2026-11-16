import assert from "node:assert/strict";
import { appendCompetitorEvent } from "@scoutops/database";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";

test("an incomplete competitor event schema rejects writes before touching history", async () => {
  const statements = [];
  await assert.rejects(
    appendCompetitorEvent(
      {
        async query(sql) {
          statements.push(sql);
          return [[{ Field: "organization_id" }]];
        },
      },
      {
        id: "event",
        parentId: "rule",
        eventType: "competitor.rule.created",
        organizationId: "org",
        workspaceId: "workspace",
        actorId: "actor",
        payloadJson: "{}",
        requestId: "request",
        traceId: "trace",
        createdAt: new Date(),
      },
    ),
    /partial_inherited_scope_schema:competitor_events/,
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^SHOW COLUMNS/);
});
import { CompetitorService } from "../../apps/api/dist/competitor-service.js";

for (const [legacy, native] of [
  [true, false],
  [false, false],
  [false, true],
])
  test(`account competitor pause and resume keep owned history (${legacy}/${native})`, async () => {
    const id = "00000000-0000-4000-8000-000000000abc";
    const origin = "http://127.0.0.1:5173";
    let owner = "primary";
    let ready = false;
    let revision = 1;
    let eventId;
    let eventType;
    const operations = new Map();
    const eventTypes = [];
    const c = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql, args) {
        assert.equal((sql.match(/\?/g) ?? []).length, args?.length ?? 0);
        if (sql.startsWith("SHOW COLUMNS FROM competitors"))
          return [
            (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (
          sql.startsWith("SHOW COLUMNS FROM competitor_events") ||
          sql.startsWith("SHOW COLUMNS FROM competitor_outbox")
        )
          return [(legacy ? ["organization_id", "workspace_id"] : []).map((Field) => ({ Field }))];
        if (sql.startsWith("SELECT slot")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SELECT x.revision")) {
          assert.match(
            sql,
            /o.source_table='competitors'.*o.account_id=\?.*x.deleted_at IS NULL FOR UPDATE/,
          );
          assert.equal(sql.includes("x.account_id=o.account_id"), native);
          if (native) assert.doesNotMatch(sql, /organization_id|workspace_id/);
          return [
            args[0] === id && args[1] === owner
              ? [
                  {
                    revision,
                    organization_id: "org",
                    workspace_id: "ws",
                    ownership_reason: "shared",
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(args.slice(0, 2), [
            "primary",
            `POST:/api/v1/competitors/${id}/actions:account`,
          ]);
          const result_json = operations.get(args[2]);
          return [result_json ? [{ result_json }] : []];
        }
        if (sql.startsWith("UPDATE competitors")) {
          assert.equal(args[2], id);
          assert.equal(args[0], revision === 1 ? "paused" : "active");
          revision++;
        } else if (sql.startsWith("INSERT INTO competitor_events")) {
          eventId = args[0];
          eventType = args[legacy ? 4 : 2];
          assert.deepEqual(args.slice(1, legacy ? 6 : 4), [
            ...(legacy ? ["org", "ws"] : []),
            id,
            `competitor.${revision === 2 ? "paused" : "active"}`,
            "primary",
          ]);
        } else if (sql.startsWith("INSERT INTO competitor_outbox")) {
          assert.equal(args[0], eventId);
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          assert.equal(args[legacy ? 3 : 1], id);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.match(sql, /VALUES \('competitor_events'/);
          assert.match(sql, /\('competitor_outbox',\?,\?,\?\)/);
          assert.deepEqual(args, [eventId, "primary", "shared", eventId, "primary", "shared"]);
          eventTypes.push(eventType);
        } else if (sql.startsWith("INSERT INTO competitor_operations")) {
          operations.set(args[3], args[5]);
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      competitors: {
        service: new CompetitorService(
          new MySqlCompetitorRepository({
            async getConnection() {
              return c;
            },
          }),
        ),
        accountReadRehearsal: true,
        webOrigin: origin,
        secureCookie: false,
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
    const post = ({
      actor = "primary",
      target = id,
      status = "paused",
      expected_revision = 1,
      key = "competitor-pause-key",
      ...headers
    } = {}) =>
      app.inject({
        method: "POST",
        url: `/api/v1/competitors/${target}/actions`,
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": key,
          ...headers,
        },
        payload: { status, expected_revision, accountOwnedStatus: true },
      });
    try {
      await app.ready();
      for (const [method, url] of [
        ["POST", "/api/v1/competitors"],
        ["POST", "/api/v1/competitors/:id/snapshots"],
        ["POST", "/api/v1/competitors/:id/collect"],
        ["DELETE", "/api/v1/competitors/:id"],
        ["POST", "/api/v1/opportunities/:id/competitor-discovery"],
      ])
        assert.equal(app.hasRoute({ method, url }), false, `${method} ${url}`);
      assert.equal(app.hasRoute({ method: "POST", url: "/api/v1/competitors/:id/actions" }), true);
      assert.equal(app.hasRoute({ method: "POST", url: "/api/v1/competitor-monitor-rules" }), true);
      assert.equal((await post()).statusCode, 503);
      ready = true;
      assert.equal((await post({ actor: "other" })).statusCode, 404);
      assert.equal((await post({ actor: "unverified" })).statusCode, 403);
      assert.equal((await post({ origin: "https://other.invalid" })).statusCode, 403);
      assert.equal((await post({ expected_revision: 2 })).statusCode, 409);
      const paused = await post();
      assert.equal(paused.statusCode, 200, paused.body);
      assert.deepEqual(paused.json().data, { id, status: "paused", revision: 2 });
      assert.deepEqual((await post({ target: id.toUpperCase() })).json().data, paused.json().data);
      owner = "other";
      assert.equal((await post()).statusCode, 404);
      owner = "primary";
      const active = await post({
        status: "active",
        expected_revision: 2,
        key: "competitor-active-key",
      });
      assert.equal(active.statusCode, 200, active.body);
      assert.deepEqual(active.json().data, { id, status: "active", revision: 3 });
      assert.deepEqual(eventTypes, ["competitor.paused", "competitor.active"]);
    } finally {
      await app.close();
    }
  });
