import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { BusinessTaskService } from "../../apps/api/dist/business-task-service.js";
import { MySqlBusinessTaskRepository } from "../../apps/api/dist/mysql-business-task-repository.js";

const task = "00000000-0000-4000-8000-000000000abc";
const second = "00000000-0000-4000-8000-000000000def";
const origin = "http://127.0.0.1:5173";
const assignee = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";

for (const native of [false, true])
  test(`account edit and soft delete preserve ownership (native=${native})`, async () => {
    let version = 1,
      deleted = false,
      currentOwner = owner;
    const writes = [],
      receipts = new Map();
    const conn = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT slot FROM account_ownership_cutover"))
          return [[{ slot: "current" }]];
        if (sql.startsWith("SHOW COLUMNS FROM tasks"))
          return [
            (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.startsWith("SELECT t.*,ow.reason")) {
          assert.match(sql, /ow.account_id=\?.*FOR UPDATE/);
          assert.equal(sql.includes("ow.account_id=t.account_id"), native);
          if (sql.includes("AND t.deleted_at IS NULL") && deleted) return [[]];
          return [
            args[0] === task && args[1] === currentOwner
              ? [
                  {
                    id: task,
                    version,
                    deleted_at: deleted ? new Date() : null,
                    assignee_id: assignee,
                    ...(native
                      ? { account_id: owner }
                      : { organization_id: "org", workspace_id: "ws" }),
                    ownership_reason: "shared",
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          const result_json = receipts.get(args.join("/"));
          return [result_json ? [{ result_json }] : []];
        }
        if (sql.startsWith("UPDATE tasks SET title=")) {
          assert.equal(args[3], assignee);
          version = args[5];
        } else if (sql.startsWith("UPDATE tasks SET deleted_at=")) {
          assert.equal(args[1], owner);
          version = args[2];
          deleted = true;
        } else if (sql.startsWith("INSERT INTO task_operations")) {
          assert.equal(args[4], task);
          receipts.set(args.slice(1, 4).join("/"), args[5]);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.deepEqual(args.slice(2), [owner, "shared"]);
          writes.push(args[0]);
        } else if (native && sql.startsWith("INSERT INTO audit_logs")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(JSON.parse(args[1]), { account_id: owner });
        } else if (native && sql.startsWith("INSERT INTO outbox_events")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.equal(JSON.parse(args[2]).task_account_contract, 25);
        } else if (!/^INSERT INTO (task_events|audit_logs|outbox_events) /.test(sql))
          assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      businessTasks: {
        service: new BusinessTaskService(
          new MySqlBusinessTaskRepository({
            async getConnection() {
              return conn;
            },
          }),
        ),
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
            assert.fail("legacy membership was consulted");
          },
        },
      },
    });
    const send = (
      method,
      payload,
      { actor = owner, id = task, key = "task-edit-delete-test" } = {},
    ) =>
      app.inject({
        method,
        url: `/api/v1/tasks/${id}`,
        payload,
        headers: { origin, cookie: `scoutops_session=${actor}`, "idempotency-key": key },
      });
    const edit = {
      title: "Edit",
      description: "",
      priority: "normal",
      reason: "fixture",
      expected_version: 1,
    };
    const remove = { reason: "fixture", expected_version: 2 };
    try {
      assert.equal((await send("PATCH", edit, { actor: assignee })).statusCode, 404);
      assert.equal((await send("PATCH", { ...edit, assignee_id: owner })).statusCode, 409);
      assert.equal((await send("PATCH", { ...edit, expected_version: 4 })).statusCode, 409);
      const changed = await send("PATCH", edit);
      assert.equal(changed.statusCode, 200, changed.body);
      assert.equal(changed.json().data.version, 2);
      assert.deepEqual(
        (await send("PATCH", edit, { id: task.toUpperCase() })).json().data,
        changed.json().data,
      );
      assert.equal((await send("PATCH", edit, { id: second })).statusCode, 404);
      const removed = await send("DELETE", remove);
      assert.equal(removed.statusCode, 200, removed.body);
      assert.deepEqual(removed.json().data, { id: task, deleted: true, version: 3 });
      assert.deepEqual((await send("DELETE", remove)).json().data, removed.json().data);
      assert.equal((await send("DELETE", remove, { key: "fresh-delete-key" })).statusCode, 404);
      currentOwner = assignee;
      assert.equal((await send("DELETE", remove)).statusCode, 404);
      assert.deepEqual(writes, ["task_events", "outbox_events", "task_events", "outbox_events"]);
    } finally {
      await app.close();
    }
  });

for (const ruleNativeOwnerMatches of [false, true])
  test(`owned task writes preserve assignee, version, audit and task-specific replay (rule owner matches=${ruleNativeOwnerMatches})`, async () => {
    let ready = false;
    let account = "primary";
    let reason = "shared";
    let sourceOwned = false;
    let sourceNativeOwnerMatches = false;
    let partialRuleSchema = true;
    let state = "todo";
    let version = 1;
    let source = "manual";
    let commits = 0;
    let rollbacks = 0;
    const stored = new Map();
    const mapped = [];
    const history = new Map();
    const events = [];
    const conn = {
      async beginTransaction() {},
      async commit() {
        commits++;
      },
      async rollback() {
        rollbacks++;
      },
      release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT slot FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25.*LOCK IN SHARE MODE/);
          return [ready ? [{ slot: "current" }] : []];
        }
        if (sql.startsWith("SHOW COLUMNS FROM tasks"))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [[{ Field: "account_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM score_rules"))
          return [
            (partialRuleSchema ? ["account_id", "organization_id"] : ["account_id"]).map(
              (Field) => ({ Field }),
            ),
          ];
        if (sql.startsWith("SELECT t.*,ow.reason")) {
          assert.match(
            sql,
            /ow.source_table='tasks'.*ow.account_id=\? AND t.deleted_at IS NULL.*ow.account_id=cut.primary_account_id.*FOR UPDATE/,
          );
          return [
            args[1] === account &&
            (reason === "exclusive_owner" || account === "primary") &&
            [task, second].includes(args[0])
              ? [
                  {
                    id: args[0],
                    status: state,
                    version,
                    source_type: source,
                    source_ref_id: "opportunity",
                    assignee_id: "original-assignee",
                    organization_id: "org",
                    workspace_id: "ws",
                    ownership_reason: reason,
                  },
                ]
              : [],
          ];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.match(sql, /FOR UPDATE$/);
          const result_json = stored.get(args.join("/"));
          return [result_json ? [{ result_json }] : []];
        }
        if (sql.startsWith("SELECT p.id,ow.reason AS ownership_reason FROM opportunities")) {
          assert.match(sql, /p.account_id=ow.account_id/);
          assert.match(
            sql,
            /ow.source_table='opportunities'.*ow.account_id=\?.*ow.account_id=cut.primary_account_id.*FOR UPDATE/,
          );
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args, ["opportunity", "primary"]);
          return [
            sourceOwned && sourceNativeOwnerMatches
              ? [{ id: "opportunity", ownership_reason: "unassigned" }]
              : [],
          ];
        }
        if (sql.startsWith("SELECT s.id FROM score_rules")) {
          assert.match(sql, /s.account_id=ow.account_id/);
          assert.match(sql, /ow.source_table='score_rules'.*ow.account_id=\?/);
          assert.match(
            sql,
            /ow.account_id=cut.primary_account_id.*ORDER BY s.activated_at DESC,s.id DESC LIMIT 1 FOR UPDATE/,
          );
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args, ["primary"]);
          return [ruleNativeOwnerMatches ? [{ id: "score-rule" }] : []];
        }
        if (sql.startsWith("UPDATE tasks SET")) {
          assert.equal(args[1], "original-assignee");
          state = args[0];
          version = args[7];
        } else if (sql.startsWith("INSERT INTO task_comments")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(args.slice(1, 4), [task, "fixture comment", "primary"]);
          history.set(args[0], "task_comments");
        } else if (sql.startsWith("INSERT INTO task_events")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.equal(args[1], task);
          assert.equal(args[3], "primary");
          history.set(args[0], "task_events");
          events.push(args[2]);
        } else if (sql.startsWith("INSERT INTO audit_logs")) {
          assert.equal(args[3], "primary");
        } else if (sql.startsWith("INSERT INTO outbox_events")) {
          assert.equal(history.get(args[0]), "task_events");
        } else if (sql.startsWith("INSERT INTO opportunity_score_jobs")) {
          assert.match(sql, /\(id,opportunity_id,score_rule_id,trigger_task_id,/);
          assert.deepEqual(args.slice(1, 4), ["opportunity", "score-rule", task]);
          history.set(args[0], "opportunity_score_jobs");
        } else if (sql.startsWith("UPDATE opportunities")) {
          assert.match(sql, /WHERE id=\? AND account_id=\?/);
          assert.deepEqual(args.slice(2), ["opportunity", "primary"]);
        } else if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.equal(history.get(args[1]), args[0] === "outbox_events" ? "task_events" : args[0]);
          assert.deepEqual(args.slice(2), [
            "primary",
            args[0] === "opportunity_score_jobs" ? "unassigned" : "shared",
          ]);
          mapped.push(args[0]);
        } else if (sql.startsWith("INSERT INTO task_operations")) {
          stored.set(args.slice(1, 4).join("/"), args[5]);
        } else assert.fail(sql);
        return [[]];
      },
    };
    const app = buildApp({
      businessTasks: {
        service: new BusinessTaskService(
          new MySqlBusinessTaskRepository({
            async getConnection() {
              return conn;
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
    const post = (
      type,
      payload,
      { actor = "primary", id = task, key = "task-mutation-key", ...headers } = {},
    ) =>
      app.inject({
        method: "POST",
        url: `/api/v1/tasks/${id}/${type}`,
        headers: {
          origin,
          cookie: `scoutops_session=${actor}`,
          "idempotency-key": key,
          ...headers,
        },
        payload,
      });
    const start = { action: "start", expected_version: 1, accountOwnedMutation: true };
    try {
      assert.equal((await post("actions", start)).statusCode, 503);
      ready = true;
      assert.equal((await post("actions", start, { actor: "other" })).statusCode, 404);
      assert.equal((await post("actions", start, { actor: "unverified" })).statusCode, 403);
      assert.equal(
        (await post("actions", start, { origin: "https://other.invalid" })).statusCode,
        403,
      );
      assert.equal((await post("actions", start, { key: "" })).statusCode, 400);
      assert.equal(
        (
          await post("actions", {
            action: "transfer",
            expected_version: 1,
            reason: "fixture",
            assignee_id: second,
          })
        ).statusCode,
        403,
      );
      const started = await post("actions", start);
      assert.equal(started.statusCode, 200, started.body);
      assert.equal(started.json().data.status, "in_progress");
      assert.equal(started.json().data.assignee_id, "original-assignee");
      assert.deepEqual(
        (await post("actions", start, { id: task.toUpperCase() })).json().data,
        started.json().data,
      );
      assert.equal((await post("actions", start, { id: second })).statusCode, 409);
      account = "other";
      assert.equal((await post("actions", start)).statusCode, 404);
      assert.equal((await post("actions", start, { actor: "other" })).statusCode, 404);
      assert.equal(
        (await post("comments", { body: "must not write" }, { actor: "other" })).statusCode,
        404,
      );
      account = "primary";
      const comment = await post("comments", { body: "fixture comment" });
      assert.equal(comment.statusCode, 201, comment.body);
      assert.deepEqual(
        (await post("comments", { body: "fixture comment" })).json().data,
        comment.json().data,
      );
      source = "evidence_completion";
      const complete = { action: "complete", expected_version: 2 };
      const partial = await post("actions", complete, { key: "complete-fixture-key" });
      assert.equal(partial.statusCode, 503, partial.body);
      assert.equal(state, "in_progress");
      partialRuleSchema = false;
      assert.equal(
        (await post("actions", complete, { key: "complete-fixture-key" })).statusCode,
        409,
      );
      assert.equal(state, "in_progress");
      sourceOwned = true;
      assert.equal(
        (await post("actions", complete, { key: "complete-fixture-key" })).statusCode,
        409,
      );
      assert.equal(state, "in_progress");
      assert.deepEqual(events, ["task.start", "task.comment.created"]);
      sourceNativeOwnerMatches = true;
      const finished = await post("actions", complete, { key: "complete-fixture-key" });
      assert.equal(finished.statusCode, 200, finished.body);
      assert.equal(finished.json().data.status, "completed");
      assert.equal(
        finished.json().data.auto_score_status,
        ruleNativeOwnerMatches ? "queued" : "waiting_for_active_rule",
      );
      assert.deepEqual(events, ["task.start", "task.comment.created", "task.complete"]);
      assert.deepEqual(mapped, [
        "task_events",
        "outbox_events",
        "task_comments",
        "task_events",
        "outbox_events",
        ...(ruleNativeOwnerMatches ? ["opportunity_score_jobs"] : []),
        "task_events",
        "outbox_events",
      ]);
      assert.equal(commits, 5);
      assert.equal(rollbacks, 9);
    } finally {
      await app.close();
    }
  });
