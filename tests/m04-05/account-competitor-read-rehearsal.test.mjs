import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { CompetitorService } from "../../apps/api/dist/competitor-service.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";

const target = "00000000-0000-4000-8000-000000000123";
const opportunity = "00000000-0000-4000-8000-000000000124";

test("competitor read rejects a partially migrated evidence pair before reading snapshots", async () => {
  const repo = new MySqlCompetitorRepository({
    async query(sql) {
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      assert.match(sql, /FROM information_schema.COLUMNS/);
      return [
        [
          { TABLE_NAME: "normalized_records", COLUMN_NAME: "account_id" },
          ...["organization_id", "workspace_id"].map((COLUMN_NAME) => ({
            TABLE_NAME: "raw_evidence",
            COLUMN_NAME,
          })),
        ],
      ];
    },
  });
  await assert.rejects(
    repo.list({ accountId: "alice" }),
    /competitor_evidence_scope_schema_invalid/,
  );
});

test("account rule storage rejects a foreign target and records rule, event and outbox atomically", async () => {
  let owned = false,
    ownedRule = true,
    replay = null,
    commits = 0,
    rollbacks = 0;
  const inserts = [];
  const c = {
    async beginTransaction() {},
    async commit() {
      commits++;
    },
    async rollback() {
      rollbacks++;
    },
    release() {},
    async query(sql, args = []) {
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM competitor_monitor_rules"))
        return [[{ Field: "historical_context" }]];
      if (sql.startsWith("SHOW COLUMNS FROM competitors")) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM competitor_")) return [[]];
      if (sql.startsWith("SELECT result_json")) return [replay ? [{ result_json: replay }] : []];
      if (sql.startsWith("SELECT x.id FROM competitors")) {
        assert.match(sql, /x.account_id=o.account_id/);
        assert.deepEqual(args, [target, "owner"]);
        return [owned ? [{ id: target }] : []];
      }
      if (sql.startsWith("SELECT r.id FROM competitor_monitor_rules")) {
        assert.match(sql, /r.competitor_id <=> \?/);
        assert.match(sql, /co.account_id=cut.primary_account_id/);
        assert.deepEqual(args, ["rule", "owner", target]);
        return [ownedRule ? [{ id: "rule" }] : []];
      }
      assert.match(sql, /^INSERT/);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      inserts.push([sql, args]);
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlCompetitorRepository({ getConnection: async () => c });
  const input = {
    id: "rule",
    accountOwnedRule: true,
    actorId: "owner",
    route: "route",
    idempotencyKey: "key",
    requestId: "request",
    traceId: "trace",
    value: { competitor_id: target, metric: "price", direction: "change", threshold_value: 3 },
  };
  await assert.rejects(repo.createRule(input), { code: "competitor_not_found" });
  assert.equal(rollbacks, 1);
  assert.equal(inserts.length, 0);
  owned = true;
  replay = await repo.createRule(input);
  assert.equal(replay.threshold_value, 3);
  assert.equal(inserts.length, 5);
  assert.match(inserts[0][0], /JSON_OBJECT\(\)/);
  assert.match(inserts[3][0], /'competitor_outbox'/);
  assert.deepEqual(inserts[3][1], [
    "rule",
    "owner",
    inserts[1][1][0],
    "owner",
    inserts[2][1][0],
    "owner",
  ]);
  assert.deepEqual(await repo.createRule(input), replay);
  await assert.rejects(
    repo.createRule({ ...input, value: { ...input.value, competitor_id: null } }),
    { code: "competitor_rule_idempotency_conflict" },
  );
  for (const changed of [{ threshold_value: 7 }, { direction: "increase" }, { metric: "rank" }]) {
    await assert.rejects(repo.createRule({ ...input, value: { ...input.value, ...changed } }), {
      code: "competitor_rule_idempotency_conflict",
    });
  }
  ownedRule = false;
  await assert.rejects(repo.createRule(input), { code: "competitor_rule_idempotency_conflict" });
  owned = false;
  await assert.rejects(repo.createRule(input), { code: "competitor_not_found" });
  assert.equal(inserts.length, 5);
  assert.equal(commits, 2);
});

test("account rule creation routes only the verified session account to the service", async () => {
  const seen = [];
  const app = buildApp({
    competitors: {
      accountReadRehearsal: true,
      webOrigin: "http://127.0.0.1:5173",
      secureCookie: false,
      auth: {
        async authenticate(id) {
          return { user: { id, email_verified_at: id === "verified" ? new Date() : null } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope resolved");
        },
      },
      service: new CompetitorService({
        async createRule(i) {
          seen.push(i);
          return { id: i.id };
        },
      }),
    },
  });
  const send = (actor, origin = "http://127.0.0.1:5173") =>
    app.inject({
      method: "POST",
      url: "/api/v1/competitor-monitor-rules",
      headers: {
        cookie: `scoutops_session=${actor}`,
        origin,
        "idempotency-key": "competitor-rule-probe",
      },
      payload: {
        competitor_id: target,
        metric: "price",
        direction: "change",
        threshold_value: 3,
        actorId: "foreign",
      },
    });
  try {
    assert.equal((await send("unverified")).statusCode, 403);
    assert.equal((await send("verified", "http://example.invalid")).statusCode, 403);
    const ok = await send("verified");
    assert.equal(ok.statusCode, 201, ok.body);
    assert.equal(seen[0].actorId, "verified");
    assert.equal(seen[0].accountOwnedRule, true);
    assert.equal(seen[0].workspaceId, undefined);
    assert.equal(seen.length, 1);
  } finally {
    await app.close();
  }
});

for (const [legacy, nativeTask, nativeCompetitor] of [
  [true, false, false],
  [false, false, false],
  [false, true, false],
  [false, true, true],
])
  test(`competitor rehearsal applies account ownership to nested history (${legacy}/${nativeTask}/${nativeCompetitor})`, async () => {
    const queries = [];
    const pool = {
      async query(sql, params) {
        queries.push(sql);
        if (sql.includes("FROM information_schema.COLUMNS"))
          return [
            [
              ["normalized_records", !legacy],
              ["raw_evidence", !legacy],
              ["competitors", nativeCompetitor],
              ["collection_tasks", nativeTask],
            ].flatMap(([TABLE_NAME, native]) =>
              (native ? ["account_id"] : ["organization_id", "workspace_id"]).map(
                (COLUMN_NAME) => ({ TABLE_NAME, COLUMN_NAME }),
              ),
            ),
          ];
        if (sql.startsWith("SHOW COLUMNS FROM competitor_events"))
          return [(legacy ? ["organization_id", "workspace_id"] : []).map((Field) => ({ Field }))];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25/);
          return [[{ slot: "current" }]];
        }
        if (sql.includes("snapshot_count FROM competitors")) {
          assert.match(sql, /co.source_table='competitors'/);
          assert.match(sql, /co.account_id=\?/);
          assert.match(sql, /owner.source_table='competitor_snapshots'/);
          assert.match(sql, /owner.source_table='normalized_records'/);
          assert.match(sql, /owner.source_table='raw_evidence'/);
          assert.match(sql, /owner.source_table='opportunities'/);
          if (legacy) {
            assert.match(sql, /n_signal.organization_id=c.organization_id/);
          } else {
            assert.doesNotMatch(sql, /n_(signal|detail)\.(organization_id|workspace_id)/);
            assert.match(sql, /n_signal.account_id=co.account_id/);
            assert.match(sql, /n_detail.account_id=co.account_id/);
            assert.match(
              sql,
              nativeTask
                ? /proof_t.account_id=co.account_id/
                : /proof_t.workspace_id=t_detail.workspace_id/,
            );
            if (nativeTask) assert.doesNotMatch(sql, /organization_id|workspace_id/);
            assert.equal(sql.includes("AND c.account_id=co.account_id"), nativeCompetitor);
            if (nativeTask) {
              assert.match(sql, /WHERE t_detail.account_id=co.account_id/);
              assert.doesNotMatch(
                sql,
                /JOIN competitors c_detail[^]*?co.account_id[^]*?WHERE LEFT\(/,
              );
              if (nativeCompetitor) assert.match(sql, /c_detail.account_id=t_detail.account_id/);
            }
            assert.match(sql, /owner.source_id=l_detail.id AND owner.account_id=co.account_id/);
          }
          const isDetail = sql.includes("WHERE c.id=?");
          const account = params[isDetail ? 1 : 0];
          if (!isDetail) assert.equal(params[1], opportunity);
          if (account !== "alice") return [[]];
          return [
            [
              {
                id: target,
                organization_id: "legacy-org",
                workspace_id: "legacy-ws",
                title: "Owned competitor",
                latest_snapshot_id: "foreign-snapshot",
                visible_snapshot_id: null,
                snapshot_count: 1,
              },
            ],
          ];
        }
        if (sql.includes("FROM competitor_monitor_rules r")) {
          assert.deepEqual(params, ["alice"]);
          assert.match(sql, /co.source_table='competitor_monitor_rules'/);
          return [[{ id: "owned-rule" }]];
        }
        if (sql.includes("FROM competitor_events e")) {
          assert.equal(sql.includes("JOIN competitors parent_competitor"), !legacy && !nativeTask);
          assert.equal(sql.includes("e.organization_id=?"), legacy);
          assert.deepEqual(
            params,
            nativeTask
              ? [target, "alice", "alice", "alice"]
              : [target, "legacy-org", "legacy-ws", "alice", "alice"],
          );
          assert.match(sql, /owner.source_table='competitor_events'/);
          assert.match(sql, /owner.source_table='collection_tasks'/);
          return [[{ id: "owned-task" }]];
        }
        const child = sql.match(
          /^SELECT \* FROM (competitor_snapshots|competitor_changes|competitor_alerts)/,
        )?.[1];
        assert.ok(child, sql);
        assert.ok(sql.includes(`owner.source_table='${child}'`));
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.deepEqual(params, [target, "alice"]);
        return [[{ id: child, payload_json: {} }]];
      },
    };
    const app = buildApp({
      competitors: {
        accountReadRehearsal: true,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
        service: new CompetitorService(new MySqlCompetitorRepository(pool)),
        auth: {
          async authenticate(id) {
            return {
              user: { id, email_verified_at: id === "unverified" ? null : new Date() },
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
    const request = (url, user) =>
      app.inject({ url, headers: { cookie: `scoutops_session=${user}` } });
    try {
      const bad = await request(`/api/v1/competitors/${target}?account_id=alice`, "primary");
      assert.equal(bad.statusCode, 404, bad.body);
      assert.equal(queries.length, 3, "foreign root never loads nested history");
      const list = await request(
        `/api/v1/competitors?opportunity_id=${opportunity}&account_id=primary`,
        "alice",
      );
      assert.equal(list.statusCode, 200, list.body);
      assert.deepEqual(
        list.json().data.map((x) => x.id),
        [target],
      );
      assert.equal(list.json().data[0].latest_snapshot, null);
      const detail = await request(`/api/v1/competitors/${target}`, "alice");
      assert.equal(detail.statusCode, 200, detail.body);
      assert.equal(detail.headers["cache-control"], "private, no-store");
      const dto = detail.json().data;
      assert.equal(dto.latest_collection.task_id, "owned-task");
      assert.equal(dto.snapshots[0].id, "competitor_snapshots");
      assert.equal(dto.changes[0].id, "competitor_changes");
      assert.equal(dto.alerts[0].id, "competitor_alerts");
      assert.equal(dto.workspace_id, undefined);
      const rules = await request("/api/v1/competitor-monitor-rules", "alice");
      assert.equal(rules.statusCode, 200, rules.body);
      assert.equal(rules.json().data[0].id, "owned-rule");
      const count = queries.length;
      assert.equal((await request("/api/v1/competitors", "unverified")).statusCode, 403);
      assert.equal(queries.length, count);
    } finally {
      await app.close();
    }
  });
