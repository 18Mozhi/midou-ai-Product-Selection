import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";
import { OpportunityService } from "../../apps/api/dist/opportunity-service.js";

for (const [native, nativeOpportunity] of [
  [false, false],
  [true, false],
  [true, true],
])
  test(`account adoption checks ownership and quality before creating a task (${native}/${nativeOpportunity})`, async () => {
    const target = "00000000-0000-4000-8000-000000000abc";
    const origin = "http://127.0.0.1:5173";
    let ready = false;
    let ownsTarget = true;
    let ownsReplay = true;
    let riskPass = false;
    let updateRows = 1;
    let saved;
    let decisionId;
    let taskId;
    let taskEventId;
    let eventId, outboxId;
    let commits = 0;
    let rollbacks = 0;
    let maps = 0;
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
        if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
          return [
            (nativeOpportunity ? ["account_id"] : ["organization_id", "workspace_id"]).map(
              (Field) => ({ Field }),
            ),
          ];
        if (sql.startsWith("SHOW COLUMNS FROM tasks"))
          return [
            (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_events"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SELECT slot")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SELECT o.name,o.decision_status")) {
          if (nativeOpportunity) {
            assert.doesNotMatch(sql, /\b\w+\.(organization_id|workspace_id)\b/);
            assert.match(sql, /o.account_id=oo.account_id/);
            assert.match(sql, /c_sample.account_id=\?/);
            assert.match(sql, /scope_record.source_id=o.id/);
            assert.match(sql, /source_table='opportunity_events'/);
            assert.match(sql, /JSON_CONTAINS/);
            assert.match(sql, /decision_raw.account_id=\? AND decision_origin.account_id=\?/);
            assert.ok(args.slice(0, -2).every((owner) => owner === args.at(-1)));
            assert.match(sql, /sr_latest.opportunity_id=o.id ORDER BY sr_latest.scored_at DESC/);
          }
          assert.doesNotMatch(sql, /account_retirement_scopes/);
          assert.match(sql, /receipt.contract_version=25/);
          assert.match(
            sql,
            /oo.reason IN \('shared','unassigned'\) AND oo.account_id=receipt.primary_account_id/,
          );
          assert.match(sql, /WHERE o.id=\? AND oo.account_id=\?/);
          assert.match(sql, /LIMIT 1 FOR UPDATE$/);
          assert.match(sql, /risk_gate_passed/);
          return [
            ownsTarget && args.at(-2) === target && args.at(-1) === "primary"
              ? [
                  {
                    name: "Fixture selection",
                    organization_id: "legacy-org",
                    workspace_id: "legacy-ws",
                    ownership_reason: "shared",
                    decision_status: "pending",
                    version: 7,
                    candidate_ready: 1,
                    recommendation_status: "recommend",
                    coverage_status: "complete",
                    overall_score: 90,
                    score_rule_version: "rule",
                    trend_score: 80,
                    competition_score: 80,
                    profit_status: "calculated",
                    competition_gate_passed: 1,
                    risk_gate_passed: Number(riskPass),
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(args, [
            "primary",
            `POST:/api/v1/opportunities/${target}/decisions:account`,
            "decision-fixture-key",
          ]);
          return [saved ? [{ result_json: saved }] : []];
        }
        if (sql.startsWith("SELECT d.id FROM opportunity_decisions")) {
          assert.equal(sql.includes("t.account_id=?"), native);
          assert.match(sql, /t.source_ref_id=d.id AND t.source_type='selection_verification'/);
          assert.match(sql, /d.opportunity_id=\?/);
          assert.match(sql, /source_table='opportunity_decisions'.*source_table='tasks'/);
          assert.deepEqual(args, [
            decisionId,
            taskId,
            target,
            "primary",
            "primary",
            ...(native ? ["primary"] : []),
          ]);
          return [ownsReplay ? [{ id: decisionId }] : []];
        }
        assert.equal((sql.match(/\?/g) ?? []).length, args.length);
        if (sql.startsWith("INSERT INTO opportunity_decisions")) {
          decisionId = args[0];
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 8), [
            target,
            "adopt",
            "Fixture reason",
            "pending",
            "adopted",
            8,
            "primary",
          ]);
        } else if (sql.startsWith("UPDATE opportunities")) {
          assert.equal(args[0], "adopted");
          assert.deepEqual(args.slice(nativeOpportunity ? -4 : -3), [
            target,
            7,
            "primary",
            ...(nativeOpportunity ? ["primary"] : []),
          ]);
          assert.match(sql, /WHERE id=\? AND version=\? AND EXISTS/);
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          return [{ affectedRows: updateRows }];
        } else if (sql.startsWith("INSERT INTO tasks ")) {
          taskId = args[0];
          assert.equal(sql.includes("(id,account_id,title"), native);
          assert.deepEqual(
            args.slice(1, native ? 2 : 3),
            native ? ["primary"] : ["legacy-org", "legacy-ws"],
          );
          assert.deepEqual(args.slice(native ? 4 : 5, native ? 6 : 7), ["primary", decisionId]);
        } else if (sql.startsWith("INSERT INTO task_events")) {
          taskEventId = args[0];
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 4), [taskId, "task.created", "primary"]);
        } else if (sql.startsWith("INSERT INTO opportunity_events")) {
          eventId = args[0];
          assert.equal(args[nativeOpportunity ? 1 : 3], "opportunity.decision.changed");
          assert.deepEqual(args.slice(nativeOpportunity ? 3 : 6, nativeOpportunity ? 5 : 8), [
            "user",
            "primary",
          ]);
        } else if (sql.startsWith("INSERT INTO opportunity_outbox")) {
          outboxId = args[0];
          assert.notEqual(outboxId, eventId);
          assert.equal(args[nativeOpportunity ? 2 : 3], "opportunity.decision.changed");
          if (nativeOpportunity) assert.equal(args[1], eventId);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.match(
            sql,
            /'opportunity_decisions'.*'tasks'.*'task_events'.*'opportunity_events'.*'opportunity_outbox'/,
          );
          assert.deepEqual(
            args,
            [decisionId, taskId, taskEventId, eventId, outboxId].flatMap((id) => [
              id,
              "primary",
              "shared",
            ]),
          );
          maps++;
        } else if (sql.startsWith("INSERT INTO opportunity_operations")) {
          saved = args[5];
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      opportunities: {
        service: new OpportunityService(
          new MySqlOpportunityRepository({
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
    const post = ({ actor = "primary", id = target, expected_version = 7, ...headers } = {}) =>
      app.inject({
        method: "POST",
        url: `/api/v1/opportunities/${id}/decisions`,
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": "decision-fixture-key",
          ...headers,
        },
        payload: {
          action: "adopt",
          reason: "Fixture reason",
          expected_version,
          accountOwnedDecision: true,
        },
      });
    try {
      await app.ready();
      for (const [method, url] of [
        ["POST", "/api/v1/opportunities"],
        ["GET", "/api/v1/opportunities/member-options"],
        ["POST", "/api/v1/opportunities/batch"],
        ["POST", "/api/v1/opportunities/:id/evidence-completion-tasks"],
        ["POST", "/api/v1/opportunities/:id/operating-feedback"],
      ])
        assert.equal(app.hasRoute({ method, url }), false, `${method} ${url}`);
      assert.equal(
        app.hasRoute({ method: "POST", url: "/api/v1/opportunities/:id/decisions" }),
        true,
      );
      assert.equal((await post()).statusCode, 503);
      ready = true;
      assert.equal((await post({ actor: "other" })).statusCode, 404);
      assert.equal((await post({ actor: "unverified" })).statusCode, 403);
      assert.equal((await post({ origin: "https://other.invalid" })).statusCode, 403);
      assert.equal((await post({ "idempotency-key": "" })).statusCode, 400);
      assert.equal((await post({ expected_version: 6 })).statusCode, 409);
      assert.equal((await post()).json().error.code, "opportunity_adopt_evidence_insufficient");
      assert.equal(maps, 0);
      riskPass = true;
      updateRows = 0;
      assert.equal((await post()).statusCode, 409);
      assert.equal(maps, 0);
      updateRows = 1;
      const adopted = await post();
      assert.equal(adopted.statusCode, 200, adopted.body);
      assert.deepEqual(adopted.json().data, {
        opportunity_id: target,
        decision_status: "adopted",
        version: 8,
        decision_id: decisionId,
        verification_task_id: taskId,
      });
      assert.deepEqual((await post({ id: target.toUpperCase() })).json().data, adopted.json().data);
      ownsReplay = false;
      const replayDenied = await post();
      assert.equal(replayDenied.statusCode, 409);
      assert.equal(replayDenied.json().error.code, "opportunity_decision_replay_not_available");
      ownsTarget = false;
      assert.equal((await post()).statusCode, 404);
      assert.equal(maps, 1);
      assert.equal(commits, 2);
      assert.equal(rollbacks, 7);
    } finally {
      await app.close();
    }
  });
