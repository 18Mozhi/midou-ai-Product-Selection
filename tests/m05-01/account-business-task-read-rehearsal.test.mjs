import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { BusinessTaskService } from "../../apps/api/dist/business-task-service.js";
import { MySqlBusinessTaskRepository } from "../../apps/api/dist/mysql-business-task-repository.js";

const id = "00000000-0000-4000-8000-000000000123";
const now = new Date("2026-01-01T00:00:00Z");

for (const native of [false, true])
  test(`account tasks preserve assignee and reject foreign details (native=${native})`, async () => {
    const calls = [];
    let owner = "primary";
    const pool = {
      async query(sql, params) {
        calls.push(sql);
        if (sql.startsWith("SHOW COLUMNS FROM tasks"))
          return [
            (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
              Field,
            })),
          ];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /contract_version=25/);
          return [[{ slot: "current" }]];
        }
        if (sql.includes("FROM task_comments") || sql.includes("FROM task_events")) {
          assert.doesNotMatch(sql, /organization_id|workspace_id/);
          assert.deepEqual(params, [id, "primary"]);
          if (sql.includes("FROM task_comments")) {
            assert.match(sql, /ra.source_table='task_comments'/);
            return [
              [{ id: "comment", created_by: "former-assignee", body: "Original", created_at: now }],
            ];
          }
          assert.match(sql, /ra.source_table='task_events'/);
          return [
            [{ id: "event", actor_id: "former-assignee", payload_json: {}, created_at: now }],
          ];
        }
        assert.match(
          sql,
          native
            ? /ra.account_id=tasks.account_id AND tasks.account_id=\?/
            : /ra.source_table='tasks' AND ra.source_id=tasks.id AND ra.account_id=\?/,
        );
        assert.match(sql, /ra.reason='exclusive_owner'.*ra.account_id=cut.primary_account_id/);
        if (sql.includes("GROUP BY status")) {
          assert.deepEqual(params, ["primary", "primary"]);
          return [[{ status: "todo", count: 1, overdue: 0 }]];
        }
        if (sql.startsWith("SELECT COUNT")) {
          assert.deepEqual(params, ["primary", "primary"]);
          return [[{ total: 1 }]];
        }
        if (sql.includes("WHERE id=?")) {
          assert.equal(params[0], id);
          if (params[1] !== owner || owner !== "primary") return [[]];
        } else {
          assert.deepEqual(params.slice(0, 2), ["primary", "primary"]);
        }
        return [
          [
            {
              id,
              status: "todo",
              title: "Owned task",
              assignee_id: "former-assignee",
              organization_id: "org",
              workspace_id: "ws",
              created_at: now,
              updated_at: now,
            },
          ],
        ];
      },
    };
    const app = buildApp({
      businessTasks: {
        accountReadRehearsal: true,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
        service: new BusinessTaskService(new MySqlBusinessTaskRepository(pool)),
        auth: {
          async authenticate(id) {
            return { user: { id, email_verified_at: now }, session: { id: "s" } };
          },
        },
        authorization: {
          async resolveSession() {
            assert.fail("legacy scope called");
          },
        },
      },
    });
    const request = (path, account = "primary") =>
      app.inject({
        url: `/api/v1/tasks${path}`,
        headers: { cookie: `scoutops_session=${account}` },
      });
    try {
      await app.ready();
      assert.equal(app.hasRoute({ method: "GET", url: "/api/v1/tasks/member-options" }), false);
      assert.equal(app.hasRoute({ method: "POST", url: "/api/v1/tasks" }), false);
      assert.equal(app.hasRoute({ method: "GET", url: "/api/v1/tasks" }), true);
      const denied = await request(`/${id}?account_id=primary`, "alice");
      assert.equal(denied.statusCode, 404, denied.body);
      assert.equal(calls.length, 3);
      assert.ok(!calls.some((sql) => /FROM task_comments|FROM task_events/.test(sql)));
      owner = "alice";
      assert.equal((await request(`/${id}`, "alice")).statusCode, 404);
      assert.equal(calls.length, 6);
      assert.ok(!calls.some((sql) => /FROM task_comments|FROM task_events/.test(sql)));
      owner = "primary";
      const detail = await request(`/${id}`);
      assert.equal(detail.statusCode, 200, detail.body);
      assert.equal(detail.headers["cache-control"], "private, no-store");
      assert.equal(detail.json().data.assignee_id, "former-assignee");
      assert.equal(detail.json().data.comments[0].created_by, "former-assignee");
      assert.equal(detail.json().data.events[0].actor_id, "former-assignee");
      const summary = await request("/summary?account_id=alice");
      assert.equal(summary.statusCode, 200, summary.body);
      assert.equal(summary.json().data.todo, 1);
      const list = await request("?mine=true&account_id=alice");
      assert.equal(list.statusCode, 200, list.body);
      assert.equal(list.json().meta.total, 1);
    } finally {
      await app.close();
    }
  });
