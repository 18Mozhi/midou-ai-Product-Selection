import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";
import {
  projectAccountPurchaseOnce,
  projectBusinessTaskOnce,
  shouldProjectAccountPurchase,
} from "../../apps/worker/dist/business-task-projection-worker.js";

for (const [legacy, nativeTask, nativeBusiness, retired = false] of [
  [true, false, false],
  [false, false, false],
  [false, true, false],
  [false, true, true],
  [false, true, true, true],
])
  test(`account purchase preserves ownership and MOQ (legacy delivery=${legacy}, native collection=${nativeTask}, native business=${nativeBusiness}, retired=${retired})`, async () => {
    const quote = "00000000-0000-4000-8000-000000000abc";
    const origin = "http://127.0.0.1:5173";
    const config = {
      nodeEnv: "test",
      app: { host: "127.0.0.1" },
      database: { host: "127.0.0.1", name: "product_scout_scope_rehearsal" },
    };
    assert.equal(shouldProjectAccountPurchase(config), true);
    assert.equal(shouldProjectAccountPurchase({ ...config, nodeEnv: "production" }), false);
    assert.equal(
      shouldProjectAccountPurchase({
        ...config,
        database: { ...config.database, readHost: "127.0.0.1" },
      }),
      false,
    );
    let database = "product_scout";
    let databaseAccount = "product_scout@localhost";
    let ownsPurchase = true;
    let existingTaskState = "owned";
    let current = true;
    let saved;
    let purchase;
    let event;
    let outbox;
    let task;
    let taskEvent;
    let taskWrites = 0;
    let workerReads = 0;
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql, args) {
        if (sql.includes("FROM information_schema.COLUMNS"))
          return [
            ["raw_evidence", "normalized_records"].map((table_name) => ({
              table_name,
              column_name: "account_id",
            })),
          ];
        assert.equal((sql.match(/\?/g) ?? []).length, args?.length ?? 0, sql);
        if (retired && sql.startsWith("SHOW COLUMNS FROM competitor_outbox")) return [[]];
        if (retired && sql.startsWith("SHOW COLUMNS FROM competitors"))
          return [[{ Field: "account_id" }]];
        if (retired && sql.startsWith("SELECT o.*")) return [[]];
        if (/^SHOW COLUMNS FROM sourcing_(outbox|events)/.test(sql))
          return [(legacy ? ["organization_id", "workspace_id"] : []).map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
          return [
            (nativeTask ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.startsWith("SHOW COLUMNS FROM tasks"))
          return [
            (nativeBusiness ? ["account_id"] : ["organization_id", "workspace_id"]).map(
              (Field) => ({ Field }),
            ),
          ];
        if (sql.startsWith("SELECT DATABASE()"))
          return [[{ db: database, version: "5.7.44", authenticated_as: databaseAccount }]];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [[{ slot: "current" }]];
        }
        if (sql.startsWith("SELECT q.moq")) {
          assert.match(sql, /qe.account_id=qo.account_id/);
          assert.match(sql, /qn.account_id=qo.account_id AND qr.account_id=qo.account_id/);
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.match(sql, /qe.id=q.evidence_id/);
          assert.match(sql, /qc.id=q.candidate_id/);
          assert.match(
            sql,
            /ra.source_table='sourcing_searches' AND ra.source_id=qs.id AND ra.account_id=qo.account_id/,
          );
          assert.match(sql, /qn.raw_evidence_id=qc.raw_evidence_id/);
          assert.match(sql, /quote_task\.id=qs\.collection_task_id/);
          assert.equal(sql.includes("quote_task.account_id=qo.account_id"), nativeTask);
          return [
            args[0] === quote && args[1] === "primary"
              ? [
                  {
                    moq: 100,
                    is_current: Number(current),
                    organization_id: "org",
                    workspace_id: "ws",
                    ownership_reason: "shared",
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.deepEqual(args, [
            "primary",
            `POST:/api/v1/sourcing/purchase-tasks/${quote}:account`,
            "purchase-fixture-key",
          ]);
          assert.match(sql, /FOR UPDATE$/);
          return [saved ? [{ result_json: saved }] : []];
        }
        if (sql.startsWith("SELECT p.quantity")) {
          assert.deepEqual(args, [purchase[0], quote, "primary"]);
          return [[{ quantity: purchase[2], reason: purchase[3] }]];
        }
        if (
          sql.startsWith("SELECT id,resource_id") ||
          sql.startsWith("SELECT o.id,o.resource_id")
        ) {
          assert.match(sql, /sourcing.purchase_task.account_rehearsal.queued/);
          assert.equal(
            sql.includes("JOIN sourcing_events e ON e.id=o.id AND e.resource_id=o.resource_id"),
            !legacy,
          );
          assert.doesNotMatch(sql, /JOIN sourcing_searches/);
          return [outbox?.status === "queued" ? [outbox] : []];
        }
        if (sql.startsWith("SELECT p.id,p.created_by")) {
          workerReads++;
          assert.match(sql, /qo.account_id=po.account_id/);
          assert.match(sql, /ct.id=qs.collection_task_id/);
          assert.match(sql, /cto.account_id=po.account_id/);
          if (nativeBusiness)
            assert.doesNotMatch(
              sql,
              /organization_id|workspace_id|workspaces|account_retirement_records/,
            );
          else if (nativeTask) {
            assert.doesNotMatch(sql, /ct\.(organization_id|workspace_id)/);
            assert.match(sql, /ct.account_id=cto.account_id/);
            assert.match(
              sql,
              /cr.run_id=cut.source_run_id AND cr.source_table='collection_tasks' AND cr.source_id=ct.id/,
            );
            assert.match(sql, /cs.account_id=cto.account_id AND cs.reason=cto.reason/);
            assert.match(sql, /cto.account_id=cut.primary_account_id/);
            assert.match(
              sql,
              /work.id=cr.legacy_workspace_id AND work.organization_id=cr.legacy_org_id/,
            );
          } else assert.match(sql, /ct.organization_id,ct.workspace_id/);
          if (!legacy) assert.doesNotMatch(sql, /qs\.(organization_id|workspace_id)/);
          assert.match(sql, /oo.account_id=po.account_id/);
          assert.match(sql, /eo.account_id=po.account_id/);
          assert.match(sql, /so.source_id=qs.id AND so.account_id=po.account_id/);
          assert.match(sql, /co.source_id=qc.id AND co.account_id=po.account_id/);
          assert.match(sql, /no.source_id=qn.id AND no.account_id=po.account_id/);
          assert.match(sql, /ro.source_id=qr.id AND ro.account_id=po.account_id/);
          assert.match(sql, /qeo.source_id=qe.id AND qeo.account_id=po.account_id/);
          assert.match(sql, /qc.id=q.candidate_id/);
          assert.equal(
            sql.includes("e.organization_id=qs.organization_id AND e.workspace_id=qs.workspace_id"),
            legacy,
          );
          assert.doesNotMatch(sql, /p\.(organization_id|workspace_id)/);
          assert.deepEqual(args, [event, purchase[0], ...(legacy ? ["org", "ws"] : [])]);
          return [
            ownsPurchase
              ? [
                  {
                    id: purchase[0],
                    created_by: "primary",
                    account_id: "primary",
                    ownership_reason: "shared",
                    organization_id: "org",
                    workspace_id: "ws",
                    request_id: purchase[5],
                    trace_id: purchase[6],
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT t.id,t.deleted_at")) {
          assert.deepEqual(args, [purchase[0]]);
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.match(
            sql,
            /source_type='sourcing_purchase' AND t.source_ref_id=\? ORDER BY t.id LIMIT 2 FOR UPDATE/,
          );
          const rows = task
            ? [
                {
                  id: task[0],
                  account_id: existingTaskState === "foreign" ? "other" : "primary",
                  native_account_id: existingTaskState === "divergent" ? "other" : "primary",
                  deleted_at: existingTaskState === "deleted" ? new Date() : null,
                  workspace_id: "old-workspace",
                },
              ]
            : [];
          if (existingTaskState === "duplicate") rows.push({ ...rows[0], id: "other-task" });
          return [rows];
        }
        if (sql.startsWith("INSERT INTO sourcing_purchase_tasks")) {
          assert.deepEqual(args.slice(1, 5), [quote, 100, "Fixture reason", "primary"]);
          purchase = args;
        } else if (sql.startsWith("INSERT INTO sourcing_events")) {
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          assert.deepEqual(args.slice(1, legacy ? 6 : 4), [
            ...(legacy ? ["org", "ws"] : []),
            "sourcing.purchase_task.account_rehearsal.queued",
            purchase[0],
            "primary",
          ]);
          event = args[0];
        } else if (sql.startsWith("INSERT INTO sourcing_outbox")) {
          assert.equal(args[0], event);
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          outbox = {
            id: args[0],
            organization_id: legacy ? args[1] : "org",
            workspace_id: legacy ? args[2] : "ws",
            resource_id: args[legacy ? 4 : 2],
            status: "queued",
          };
        } else if (sql.startsWith("INSERT INTO sourcing_operations")) {
          saved = args[5];
        } else if (sql.startsWith("INSERT INTO tasks")) {
          assert.equal(sql.includes("id,account_id,title"), nativeBusiness);
          assert.deepEqual(args.slice(nativeBusiness ? 4 : 5, nativeBusiness ? 7 : 8), [
            "primary",
            purchase[0],
            "primary",
          ]);
          task = args;
          taskWrites++;
        } else if (sql.startsWith("INSERT INTO task_events")) {
          taskEvent = args;
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 3), [task[0], "primary"]);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          if (sql.includes("'sourcing_purchase_tasks'"))
            assert.deepEqual(args, [purchase[0], "primary", "shared"]);
          else if (sql.includes("'sourcing_outbox'"))
            assert.deepEqual(args, [event, "primary", "shared", event, "primary", "shared"]);
          else
            assert.deepEqual(args, [
              task[0],
              "primary",
              "shared",
              taskEvent[0],
              "primary",
              "shared",
            ]);
        } else if (sql.startsWith("UPDATE sourcing_outbox")) {
          assert.equal(args[1], outbox.id);
          outbox.status = args[0];
        } else assert.fail(sql);
        return [[]];
      },
    };
    const pool = {
      async getConnection() {
        return connection;
      },
    };
    const app = buildApp({
      sourcing: {
        service: new SourcingService(new MySqlSourcingRepository(pool)),
        accountReadRehearsal: true,
        secureCookie: false,
        webOrigin: origin,
        auth: {
          async authenticate(id) {
            return { user: { id, email_verified_at: new Date() } };
          },
        },
        authorization: {
          async resolveSession() {
            assert.fail("legacy workspace was consulted");
          },
        },
      },
    });
    const post = ({ actor = "primary", quantity = 100, quote_id = quote, ...headers } = {}) =>
      app.inject({
        method: "POST",
        url: "/api/v1/sourcing/purchase-tasks",
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": "purchase-fixture-key",
          ...headers,
        },
        payload: { quote_id, quantity, reason: "Fixture reason", organization_id: "forged" },
      });
    try {
      await assert.rejects(projectAccountPurchaseOnce(pool), /mysql57_rehearsal_database_required/);
      database = retired ? "product_scout" : "product_scout_scope_rehearsal";
      const project = () =>
        retired
          ? projectBusinessTaskOnce(pool, "worker", 120, {
              nodeEnv: "production",
              app: { host: "127.0.0.1", accountScopeMode: "retired" },
              database: { host: "127.0.0.1", name: "product_scout", user: "product_scout" },
            })
          : projectAccountPurchaseOnce(pool);
      if (retired) {
        databaseAccount = "root@localhost";
        await assert.rejects(project(), /account_purchase_projection_target_invalid/);
        databaseAccount = "product_scout@localhost";
      }
      assert.equal((await post({ actor: "other" })).statusCode, 404);
      assert.equal((await post({ quantity: 99 })).statusCode, 409);
      const submitted = await post();
      if (legacy) {
        assert.equal(submitted.statusCode, 503);
        assert.equal(submitted.json().error.code, "account_sourcing_delivery_schema_not_ready");
        assert.equal(saved, undefined);
        assert.equal(outbox, undefined);
        assert.equal(taskWrites, 0);
        return;
      }
      assert.equal(submitted.statusCode, 202, submitted.body);
      assert.equal(submitted.json().data.status, "queued");
      current = false;
      assert.deepEqual(
        (await post({ quote_id: quote.toUpperCase() })).json().data,
        submitted.json().data,
      );
      assert.equal((await post({ quantity: 101 })).statusCode, 409);
      assert.equal(taskWrites, 0);
      const projected = await project();
      assert.deepEqual(projected, { status: "projected", taskId: task[0] });
      assert.equal(outbox.status, "published");
      assert.deepEqual(await project(), { status: "idle" });
      outbox.status = "queued"; // Simulate delivery replay for the same purchase.
      assert.deepEqual(await project(), projected);
      assert.equal(taskWrites, 1);
      for (const [state, reason] of [
        ["foreign", "purchase_projection_ownership_conflict"],
        ["deleted", "purchase_projection_ownership_conflict"],
        ["duplicate", "purchase_projection_duplicate_source"],
        ...(nativeBusiness ? [["divergent", "purchase_projection_ownership_conflict"]] : []),
      ]) {
        existingTaskState = state;
        outbox.status = "queued";
        assert.equal((await project()).reason, reason);
        assert.equal(outbox.status, "dead_letter");
        assert.equal(taskWrites, 1);
      }
      outbox.status = "queued";
      ownsPurchase = false;
      assert.equal((await project()).reason, "purchase_task_scope_invalid");
      assert.equal(outbox.status, "dead_letter");
      assert.equal(taskWrites, 1);
      assert.equal(workerReads, nativeBusiness ? 7 : 6);
    } finally {
      await app.close();
    }
  });
