import assert from "node:assert/strict";
import test from "node:test";
import { projectBusinessTaskOnce } from "../../apps/worker/dist/business-task-projection-worker.js";

const config = {
  nodeEnv: "production",
  app: { host: "127.0.0.1", accountScopeMode: "retired" },
  database: { host: "127.0.0.1", name: "product_scout", user: "product_scout" },
};

test("retired task poller consumes the account purchase delivery without old scope columns", async () => {
  let account = "product_scout@localhost";
  let state = "queued";
  let task;
  let ledger;
  let taskWrites = 0;
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args = []) {
      if (sql.startsWith("SELECT DATABASE()")) {
        assert.match(sql, /CURRENT_USER\(\)/);
        return [[{ db: "product_scout", version: "5.7.44", authenticated_as: account }]];
      }
      if (sql.startsWith("SHOW COLUMNS")) {
        return [
          /\b(competitors|collection_tasks|tasks)\b/.test(sql) ? [{ Field: "account_id" }] : [],
        ];
      }
      if (sql.startsWith("SELECT o.*")) return [[]];
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT o.id,o.resource_id")) {
        assert.match(sql, /sourcing\.purchase_task\.account_rehearsal\.queued/);
        return [state === "queued" ? [{ id: "outbox", resource_id: "original-purchase" }] : []];
      }
      if (sql.startsWith("SELECT p.id,p.created_by")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id|\bworkspaces\b/);
        assert.match(sql, /qo.account_id=po.account_id/);
        assert.match(sql, /cto.account_id=po.account_id/);
        assert.deepEqual(args, ["outbox", "original-purchase"]);
        return [
          [
            {
              id: "original-purchase",
              account_id: "primary",
              created_by: "primary",
              ownership_reason: "shared",
              request_id: "original-request",
              trace_id: "original-trace",
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT t.id,t.deleted_at"))
        return [task ? [{ id: task, account_id: "primary", native_account_id: "primary" }] : []];
      if (sql.startsWith("INSERT INTO tasks")) {
        assert.match(sql, /\(id,account_id,/);
        taskWrites++;
        task = args[0];
        assert.equal(args[1], "primary");
        assert.ok(args.includes("original-purchase"));
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO task_events")) {
        assert.deepEqual(args.slice(4, 6), ["original-request", "original-trace"]);
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO account_owned_records")) {
        ledger = args;
        return [{ affectedRows: 2 }];
      }
      if (sql.startsWith("UPDATE sourcing_outbox")) {
        state = args[0];
        return [{ affectedRows: 1 }];
      }
      assert.fail(sql);
    },
  };
  const project = () =>
    projectBusinessTaskOnce({ getConnection: async () => c }, "worker", 60, config);
  account = "root@localhost";
  await assert.rejects(project(), /account_purchase_projection_target_invalid/);
  account = "product_scout@localhost";
  const projected = await project();
  assert.deepEqual(projected, { status: "projected", taskId: task });
  assert.deepEqual(
    ledger.filter((_, i) => i % 3 !== 0),
    ["primary", "shared", "primary", "shared"],
  );
  assert.equal(state, "published");
  state = "queued";
  assert.deepEqual(await project(), projected);
  assert.equal(taskWrites, 1);
});
