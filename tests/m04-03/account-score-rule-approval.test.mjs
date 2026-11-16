import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerScoringRoutes } from "../../apps/api/dist/scoring-routes.js";
import { ScoringService } from "../../apps/api/dist/scoring-service.js";
import { MySqlScoringRepository } from "../../apps/api/dist/mysql-scoring-repository.js";
import { assertNoAccountScoreDecisions } from "../../scripts/apply-deployment-migrations.mjs";
import { readFile } from "node:fs/promises";

const id = "00000000-0000-4000-8000-000000000182";
const request = {
  method: "POST",
  url: `/api/v1/opportunity-score-rules/${id}/actions`,
  headers: {
    origin: "https://scout.example",
    cookie: "scoutops_session=token",
    "idempotency-key": "decision-1",
  },
  payload: { action: "approve", reason: "核对原规则", expected_revision: 1 },
};

test("account preview filters out foreign evidence before projection and never writes", async () => {
  const calls = [];
  const db = {
    async query(sql, args) {
      calls.push([sql, args]);
      if (/^(SET|START) TRANSACTION/.test(sql)) return [{}];
      if (sql.includes("FROM account_ownership_cutover"))
        return [[{ primary_account_id: "primary" }]];
      if (sql.includes("FROM score_rules"))
        return [
          [
            {
              id,
              status: "draft",
              version_code: "v2",
              dimensions_json: [
                { code: "market_demand", evidence_group: "market", weight: 100, required: true },
              ],
              thresholds_json: { recommend_min: 80, observe_min: 60 },
            },
          ],
        ];
      if (sql.startsWith("SELECT COUNT")) return [[{ total: 1 }]];
      if (sql.includes("FROM opportunity_score_inputs"))
        return [
          [
            {
              opportunity_id: id,
              id: "input",
              dimension_code: "market_demand",
              evidence_group: "market",
              score_value: 95,
              evidence_ids_json: ["foreign-evidence"],
              missing_fields_json: [],
            },
          ],
        ];
      if (sql.includes("FROM raw_evidence")) return [[]];
      if (sql.includes("FROM opportunities"))
        return [
          [
            {
              id,
              name: "本账号选品",
              lifecycle_status: "ready",
              recommendation_status: "insufficient_data",
            },
          ],
        ];
      assert.fail(sql);
    },
    async rollback() {},
    release() {},
  };
  const repo = new MySqlScoringRepository({ getConnection: async () => db });
  const preview = await repo.preview({ accountId: "primary", ruleId: id, page: 1, pageSize: 20 });
  assert.equal(preview.items[0].projected_score, null);
  assert.equal(preview.items[0].projected_coverage_percent, 0);
  assert.equal(preview.read_only, true);
  assert.match(calls[1][0], /WITH CONSISTENT SNAPSHOT, READ ONLY/);
  assert.ok(
    calls.every(
      ([sql]) =>
        !/^\s*(INSERT|UPDATE|DELETE)/i.test(sql) && !/organization_id|workspace_id/.test(sql),
    ),
  );
  assert.ok(
    calls.some(
      ([sql, args]) =>
        sql.includes("FROM raw_evidence") &&
        args.includes("primary") &&
        args.includes("foreign-evidence"),
    ),
  );
});

test("account score decisions accept only a verified session and ignore supplied scope", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  app.addHook("onRequest", async (r) => {
    r.headers["x-request-id"] = "req";
    r.headers["x-trace-id"] = "trace";
  });
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error.statusCode ?? 500).send({ code: error.code }),
  );
  let verified = true;
  const calls = [];
  registerScoringRoutes(app, {
    service: new ScoringService({
      accountDecision: async (input) => (calls.push(input), { status: "approved" }),
    }),
    auth: {
      authenticate: async () => ({
        user: { id: "session-user", email_verified_at: verified ? new Date() : null },
      }),
    },
    authorization: { resolveSession: async () => assert.fail("no workspace") },
    accountReadRehearsal: true,
    webOrigin: "https://scout.example",
    secureCookie: false,
  });
  assert.equal(
    (await app.inject({ ...request, payload: { ...request.payload, account_id: "other" } }))
      .statusCode,
    200,
  );
  assert.equal(calls[0].actorId, "session-user");
  assert.equal(calls[0].ruleId, id);
  assert.equal("organizationId" in calls[0], false);
  assert.equal(
    (await app.inject({ ...request, payload: { ...request.payload, action: "activate" } }))
      .statusCode,
    200,
  );
  assert.equal(calls[1].action, "activate");
  assert.equal(
    (await app.inject({ ...request, payload: { ...request.payload, action: "submit" } }))
      .statusCode,
    200,
  );
  assert.equal(calls[2].action, "submit");
  assert.equal(
    (await app.inject({ ...request, payload: { ...request.payload, action: "rollback" } }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        ...request,
        headers: { ...request.headers, origin: "https://foreign.example" },
      })
    ).statusCode,
    403,
  );
  verified = false;
  assert.equal((await app.inject(request)).statusCode, 403);
  assert.equal(calls.length, 3);
});

test("account decisions lock ownership before replay and write history, outbox and ledger atomically", async () => {
  const input = {
    ruleId: id,
    actorId: "primary",
    action: "approve",
    reason: "核对原规则",
    expectedRevision: 1,
    idempotencyKey: "decision-1",
    requestId: "req",
    traceId: "trace",
  };
  const queries = [];
  let allowed = true,
    owned = true,
    cached,
    failOutbox = false,
    resulting = "approved";
  const pending = {
    id,
    version_code: "v1",
    status: "pending_approval",
    revision: 1,
    dimensions_json: "[]",
    thresholds_json: '{"recommend_min":80,"observe_min":60}',
    ownership_reason: "shared",
  };
  const c = {
    beginTransaction: async () => queries.push("begin"),
    commit: async () => queries.push("commit"),
    rollback: async () => queries.push("rollback"),
    release: () => queries.push("release"),
    async query(sql, args) {
      queries.push(sql);
      if (sql.includes("FROM account_ownership_cutover"))
        return [allowed ? [{ primary_account_id: "primary" }] : []];
      if (sql.includes("FROM score_rules") && sql.includes("FOR UPDATE"))
        return [owned ? [pending] : []];
      if (sql.includes("FROM score_rule_operations"))
        return [cached ? [{ result_json: cached }] : []];
      if (sql.startsWith("SELECT * FROM score_rules"))
        return [[{ ...pending, status: resulting, revision: 2 }]];
      if (failOutbox && sql.startsWith("INSERT INTO opportunity_outbox"))
        throw Error("outbox failed");
      if (sql.startsWith("INSERT INTO score_rule_operations")) cached = args[5];
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlScoringRepository({ getConnection: async () => c });
  allowed = false;
  await assert.rejects(() => repository.accountDecision(input), {
    code: "score_rule_approval_forbidden",
  });
  assert.equal(
    queries.some((x) => x.includes("score_rule_operations")),
    false,
  );
  allowed = true;
  failOutbox = true;
  await assert.rejects(() => repository.accountDecision(input), /outbox failed/);
  assert.equal(queries.at(-2), "rollback");
  assert.equal(cached, undefined);
  failOutbox = false;
  queries.length = 0;
  assert.equal((await repository.accountDecision(input)).status, "approved");
  assert.equal(queries.at(-2), "commit");
  for (const table of [
    "score_rule_actions",
    "opportunity_events",
    "opportunity_outbox",
    "account_owned_records",
    "score_rule_operations",
  ])
    assert.ok(
      queries.some((sql) => sql.startsWith(`INSERT INTO ${table}`)),
      table,
    );
  assert.ok(queries.every((sql) => !/organization_id|workspace_id/.test(sql)));
  queries.length = 0;
  assert.equal((await repository.accountDecision(input)).status, "approved");
  assert.equal(
    queries.some((x) => x.startsWith("UPDATE")),
    false,
  );
  await assert.rejects(() => repository.accountDecision({ ...input, reason: "different" }), {
    code: "score_rule_idempotency_conflict",
  });
  owned = false;
  await assert.rejects(() => repository.accountDecision(input), { code: "score_rule_not_found" });
  owned = true;
  cached = undefined;
  resulting = "rejected";
  queries.length = 0;
  await assert.rejects(() => repository.accountDecision({ ...input, expectedRevision: 99 }), {
    code: "score_rule_revision_conflict",
  });
  assert.equal(
    queries.some((x) => x.startsWith("UPDATE")),
    false,
  );
  queries.length = 0;
  const rejected = await repository.accountDecision({ ...input, action: "reject" });
  assert.equal(rejected.status, "rejected");
  assert.ok(queries.some((x) => x.startsWith("UPDATE score_rules SET status='rejected'")));
  assert.ok(
    queries
      .filter((x) => x.startsWith("UPDATE"))
      .every((x) => !/thresholds_json|dimensions_json/.test(x)),
  );
});

test("account decision history prevents old-schema rollback before persistent DDL", async () => {
  const db = (has_decisions) => ({
    async query(sql) {
      assert.match(sql, /^SELECT EXISTS.*score_rule_operations .*actions:account/);
      assert.match(sql, /OR route='POST:\/api\/v1\/opportunity-score-rules:account'/);
      return [[{ has_decisions }]];
    },
  });
  await assertNoAccountScoreDecisions(db(0));
  await assert.rejects(
    () => assertNoAccountScoreDecisions(db(1)),
    /rollback_would_invalidate_account_score_approval_history/,
  );
  const runner = await readFile(
    new URL("../../scripts/apply-deployment-migrations.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    runner,
    /await assertNoAccountScoreDecisions\(db\);[\s\S]*?const results = \[\];[\s\S]*?await executeMigrationStatement/,
  );
});

test("account draft creation checks primary identity before replay and records exclusive ownership", async () => {
  const input = {
    id,
    actorId: "primary",
    requestId: "req",
    traceId: "trace",
    idempotencyKey: "draft",
    value: {
      version_code: "v2",
      name: "draft",
      dimensions: [],
      thresholds: { recommend_min: 80, observe_min: 60 },
    },
  };
  let primary = false,
    saved,
    duplicate = false,
    stillOwned = true;
  const calls = [];
  const c = {
    beginTransaction: async () => {},
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release() {},
    async query(sql, args) {
      calls.push([sql, args]);
      if (sql.includes("FROM account_ownership_cutover"))
        return [primary ? [{ primary_account_id: "primary" }] : []];
      if (sql.includes("FROM score_rule_operations"))
        return [saved ? [{ result_json: saved }] : []];
      if (sql.startsWith("SELECT r.id FROM score_rules")) {
        assert.deepEqual(args, [id, "primary"]);
        assert.match(sql, /o.account_id=r.account_id/);
        return [stillOwned ? [{ id }] : []];
      }
      if (duplicate && sql.startsWith("INSERT INTO score_rules"))
        throw Object.assign(new Error("duplicate uq_score_rule_account_version"), {
          code: "ER_DUP_ENTRY",
        });
      if (sql.startsWith("INSERT INTO score_rule_operations")) saved = args[5];
      if (sql.startsWith("SELECT * FROM score_rules"))
        return [
          [{ id, status: "draft", revision: 1, dimensions_json: "[]", thresholds_json: "{}" }],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlScoringRepository({ getConnection: async () => c });
  await assert.rejects(() => repo.accountCreate(input), { code: "score_rule_approval_forbidden" });
  assert.ok(!calls.some(([sql]) => sql.includes("score_rule_operations")));
  primary = true;
  duplicate = true;
  await assert.rejects(() => repo.accountCreate(input), { code: "score_rule_version_conflict" });
  duplicate = false;
  assert.equal((await repo.accountCreate(input)).status, "draft");
  const [, [owners]] = calls.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
  assert.deepEqual(owners[0], ["score_rules", id, "primary", "exclusive_owner"]);
  assert.ok(calls.every(([sql]) => !/organization_id|workspace_id/.test(sql)));
  calls.length = 0;
  assert.equal((await repo.accountCreate({ ...input, id: "retry" })).id, id);
  assert.ok(calls.every(([sql]) => !sql.startsWith("INSERT")));
  stillOwned = false;
  await assert.rejects(() => repo.accountCreate(input), {
    code: "score_rule_idempotency_conflict",
  });
  await assert.rejects(
    () => repo.accountCreate({ ...input, value: { ...input.value, name: "changed" } }),
    { code: "score_rule_idempotency_conflict" },
  );
});

test("account activation and rollback queue owned recalculation in the state transaction", async () => {
  const base = {
    ruleId: id,
    actorId: "primary",
    reason: "保留阈值",
    expectedRevision: 1,
    requestId: "req",
    traceId: "trace",
    idempotencyKey: "key",
  };
  for (const [action, native] of [
    ["activate", false],
    ["rollback", false],
    ["activate", true],
    ["rollback", true],
  ]) {
    const calls = [];
    let targetOwned = true;
    let activeOwned = true;
    let duplicateActive = false;
    const targetRuleId = "00000000-0000-4000-8000-000000000183";
    const selected = action === "activate" ? id : targetRuleId;
    const c = {
      beginTransaction: async () => {},
      commit: async () => calls.push(["commit"]),
      rollback: async () => calls.push(["rollback"]),
      release() {},
      async query(sql, args) {
        calls.push([sql, args]);
        if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
          return [
            (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.includes("FROM account_ownership_cutover"))
          return [[{ primary_account_id: "primary" }]];
        if (sql.startsWith("SELECT r.*"))
          return [
            [
              {
                id,
                revision: 1,
                status: action === "activate" ? "approved" : "active",
                ownership_reason: "shared",
              },
            ],
          ];
        if (sql.startsWith("SELECT r.id,own.account_id")) {
          assert.match(sql, /LEFT JOIN account_owned_records/);
          return [
            [
              {
                id: action === "rollback" ? id : "previous",
                sealed_owner: activeOwned ? "primary" : null,
              },
              ...(duplicateActive ? [{ id: "another", sealed_owner: "primary" }] : []),
            ],
          ];
        }
        if (sql.startsWith("SELECT r.id")) return [targetOwned ? [{ id: targetRuleId }] : []];
        if (sql.includes("FROM score_rule_operations")) return [[]];
        if (sql.startsWith("SELECT o.id,ow.reason"))
          return [[{ id: "owned-opportunity", reason: "unassigned" }]];
        if (sql.startsWith("SELECT * FROM score_rules"))
          return [
            [
              {
                id: selected,
                revision: 2,
                status: "active",
                dimensions_json: "[]",
                thresholds_json: "{}",
              },
            ],
          ];
        return [{ affectedRows: 1 }];
      },
    };
    const repository = new MySqlScoringRepository({ getConnection: async () => c });
    const input = { ...base, action, ...(action === "rollback" ? { targetRuleId } : {}) };
    activeOwned = false;
    await assert.rejects(() => repository.accountDecision(input), {
      code: "score_rule_active_ownership_conflict",
    });
    assert.ok(calls.every(([sql]) => !sql.startsWith("UPDATE")));
    activeOwned = true;
    duplicateActive = true;
    await assert.rejects(() => repository.accountDecision(input), {
      code: "score_rule_active_ownership_conflict",
    });
    assert.ok(calls.every(([sql]) => !sql.startsWith("UPDATE")));
    duplicateActive = false;
    calls.length = 0;
    if (action === "rollback") {
      targetOwned = false;
      await assert.rejects(() => repository.accountDecision(input), {
        code: "score_rule_rollback_target_invalid",
      });
      assert.ok(calls.every(([sql]) => !sql.startsWith("UPDATE")));
      targetOwned = true;
      calls.length = 0;
    }
    assert.equal((await repository.accountDecision(input)).id, selected);
    assert.match(calls[0][0], /FOR UPDATE$/);
    const [retire, retireArgs] = calls.find(([sql]) =>
      sql.includes(action === "activate" ? "SET status='retired'" : "SET status='rolled_back'"),
    );
    if (action === "activate") {
      assert.equal(retireArgs[1], "primary");
      assert.match(retire, /WHERE account_id=\?/);
    } else assert.equal(retireArgs[0], targetRuleId);
    const [read, readArgs] = calls.find(([sql]) => sql.startsWith("SELECT o.id,ow.reason"));
    assert.match(read, /ow.account_id=\?.*NOT IN \('archived','deleted'\)/);
    assert.deepEqual(readArgs, ["primary"]);
    assert.equal(read.includes("o.account_id=ow.account_id"), native);
    const [, [jobs]] = calls.find(([sql]) => sql.startsWith("INSERT INTO opportunity_score_jobs"));
    assert.deepEqual(jobs[0].slice(1, 5), ["owned-opportunity", selected, "queued", 0]);
    assert.ok(
      calls.some(
        ([sql, args]) =>
          sql.startsWith("INSERT INTO account_owned_records") &&
          args[0].some(
            (row) =>
              JSON.stringify(row) ===
              JSON.stringify(["opportunity_score_jobs", jobs[0][0], "primary", "unassigned"]),
          ),
      ),
    );
    assert.ok(
      calls.some(
        ([sql, args]) =>
          sql.startsWith("INSERT INTO automatic_selection_evaluations") &&
          sql.includes("ra.account_id=?") &&
          args.at(-1) === "primary",
      ),
    );
    if (native) {
      const [sql, args] = calls.find(([sql]) =>
        sql.startsWith("INSERT INTO automatic_selection_evaluations"),
      );
      assert.doesNotMatch(sql, /\.(organization_id|workspace_id)\b/);
      assert.match(sql, /o\.account_id=\?/);
      assert.match(sql, /lp_owner_0\.account_id=\?/);
      assert.equal((sql.replace(/'(?:''|[^'])*'/g, "").match(/\?/g) ?? []).length, args.length);
      assert.ok(args.slice(3).every((value) => value === "primary"));
    }
    assert.equal(calls.at(-1)[0], "commit");
  }
});
