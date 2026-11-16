import assert from "node:assert/strict";
import test from "node:test";
import { appendProviderSourceReplayRun } from "../../packages/database/dist/index.js";
import { MySqlProviderSourceRepository } from "../../apps/api/dist/mysql-provider-source-repository.js";

const input = { runId: "run", organizationId: "org", workspaceId: "workspace", providerId: "provider",
  sourceCode: "manual_product_supply_csv", taskId: "task", inputSha256: "f".repeat(64),
  requestId: "request", traceId: "trace", actorId: "actor", now: new Date(),
  route: "replay:provider", idempotencyKey: "operation-key" };

test("both replay producers can write either complete layout without changing task or provenance", async () => {
  for (const fields of [[], ["organization_id", "workspace_id"], ["workspace_id"]]) {
    const calls = [];
    const connection = { async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return [fields.map((Field) => ({ Field }))];
      calls.push({ sql, args }); return [{ affectedRows: 1 }];
    } };
    if (fields.length === 1) {
      await assert.rejects(appendProviderSourceReplayRun(connection, input), /partial_inherited_scope_schema/);
      assert.deepEqual(calls, []);
      continue;
    }
    await appendProviderSourceReplayRun(connection, input);
    assert.equal(calls.length, 1);
    const [{ sql, args }] = calls;
    assert.equal(sql.includes("organization_id,workspace_id"), fields.length === 2);
    assert.equal((sql.match(/\?/g) ?? []).length, args.length);
    assert.deepEqual(args.slice(1 + fields.length, 8 + fields.length),
      [input.providerId, input.sourceCode, input.taskId, input.inputSha256, input.requestId, input.traceId, input.actorId]);
  }
});

test("cached provider replay checks the original collection task before returning any result", async () => {
  let scope = input.workspaceId;
  let commits = 0, rollbacks = 0;
  const connection = {
    async beginTransaction() {}, async commit() { commits++; }, async rollback() { rollbacks++; }, release() {},
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      assert.match(sql, /JOIN collection_tasks t ON t.id=r.task_id WHERE o.actor_id=\? AND o.route=\? AND o.idempotency_key=\?/);
      assert.deepEqual(args, [input.actorId, input.route, input.idempotencyKey]);
      return [[{ id: "original-run", task_id: "original-task", provider_id: input.providerId,
        source_code: input.sourceCode, status: "succeeded", item_count: 2, created_at: input.now,
        updated_at: input.now, task_organization_id: input.organizationId, task_workspace_id: scope,input_sha256:input.inputSha256 }]];
    },
  };
  const repository = new MySqlProviderSourceRepository({ getConnection: async () => connection });
  assert.equal((await repository.replay(input)).task_id, "original-task");
  await assert.rejects(repository.replay({...input,providerId:"other-provider"}),{code:"provider_source_replay_scope_conflict"});
  scope = "different-workspace";
  await assert.rejects(repository.replay(input),
    { code: "provider_source_replay_scope_conflict", statusCode: 409 });
  assert.deepEqual({ commits, rollbacks }, { commits: 1, rollbacks: 2 });
});
