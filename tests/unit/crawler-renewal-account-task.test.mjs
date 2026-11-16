import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";

test("browser renewal uses the exact collection owner and native task key, not the actor or original assignee", async () => {
  const repo = new MySqlCrawlerRuntimeRepository({});
  const input = { profileId: "profile", actorId: "worker", assigneeId: "original-assignee",
    collectionTaskId: "collection", requestId: "request", traceId: "trace", now: new Date(), reason: "blocked_login" };
  const ledger = { contract_version: 25, primary_account_id: "owner", account_id: "owner", reason: "shared", owner_user_id: "owner" };
  let existing, parentAccount = "owner", inserts = 0;
  const conn = { async query(sql, args = []) {
    assert.equal((sql.match(/\?/g) ?? []).length, args.length);
    if (sql.startsWith("SHOW COLUMNS FROM tasks")) return [[{ Field: "account_id" }]];
    if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{ Field: "account_id" }]];
    if (sql.startsWith("SELECT cut.contract_version")) return [[ledger]];
    if (sql.startsWith("SELECT account_id FROM collection_tasks")) return [[{ account_id: parentAccount }]];
    assert.doesNotMatch(sql, /organization_id|workspace_id|workspaces/);
    if (sql.startsWith("SELECT id,status FROM tasks")) {
      assert.deepEqual(args, ["owner", "profile"]); return [existing ? [existing] : []];
    }
    if (sql.startsWith("INSERT INTO tasks")) {
      assert.deepEqual(args.slice(4, 7), ["original-assignee", "profile", "collection"]);
      existing = { id: args[0], status: "todo" }; inserts++; return [{}];
    }
    if (sql.startsWith("UPDATE tasks")) return [{}];
    if (sql.startsWith("INSERT INTO task_events")) {
      assert.equal(args[1], existing.id); assert.equal(args[3], "worker");
      assert.deepEqual(args.slice(5, 7), ["request", "trace"]); return [{}];
    }
    if (sql.startsWith("INSERT INTO account_owned_records")) {
      assert.ok(args[0].every(row => row[2] === "owner" && row[3] === "shared")); return [{}];
    }
    assert.fail(sql);
  } };
  await repo.renewalTask(conn, input, true);
  await repo.renewalTask(conn, input, true);
  assert.equal(inserts, 1);
  parentAccount = "foreign";
  await assert.rejects(repo.renewalTask(conn, input, true), { code: "crawler_runtime_conflict" });
  assert.equal(inserts, 1);
});
