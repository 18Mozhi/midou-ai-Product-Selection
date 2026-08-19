import assert from "node:assert/strict";
import test from "node:test";

test("credential renewal replay is an explicit terminal history transition", async () => {
  const { assertTaskTransition, isTerminalTaskStatus } =
    await import("../../packages/collection-tasks/dist/index.js");
  assert.equal(
    assertTaskTransition("blocked_login", "automatically_replayed"),
    "automatically_replayed",
  );
  assert.equal(isTerminalTaskStatus("automatically_replayed"), true);
  assert.throws(
    () => assertTaskTransition("blocked_captcha", "automatically_replayed"),
    /collection_transition_invalid/,
  );
});

test("credential rotation completes renewal work and clones terminal blocked collection task", async () => {
  const { MySqlCredentialAssetRepository } =
    await import("../../apps/api/dist/mysql-credential-asset-repository.js");
  const now = new Date("2026-08-20T08:00:00.000Z"),
    assetId = "11111111-1111-4111-8111-111111111111",
    profileId = "22222222-2222-4222-8222-222222222222",
    sourceTaskId = "33333333-3333-4333-8333-333333333333",
    statements = [];
  let committed = false,
    rolledBack = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {
      rolledBack = true;
    },
    release: () => {},
    query: async (sql, values = []) => {
      statements.push([sql, values]);
      assert.equal([...sql.matchAll(/\?/g)].length, values.length, `placeholder mismatch: ${sql}`);
      if (sql.includes("FROM credential_asset_operations o")) return [[]];
      if (sql.includes("FROM credential_assets a WHERE a.id=? FOR UPDATE"))
        return [
          [
            {
              id: assetId,
              provider_id: "44444444-4444-4444-8444-444444444444",
              name: "1688 登录凭证",
              kind: "cookie_bundle",
              status: "active",
              key_version: "v1",
              fingerprint: "1234567890abcdef",
              expires_at: new Date("2026-08-19T08:00:00.000Z"),
              rotated_at: null,
              version: 1,
              updated_at: new Date("2026-08-19T08:00:00.000Z"),
            },
          ],
        ];
      if (sql.startsWith("SELECT id FROM crawler_profiles")) return [[{ id: profileId }]];
      if (sql.includes("FROM browser_collection_jobs j"))
        return [
          [
            {
              job_id: "55555555-5555-4555-8555-555555555555",
              collection_task_id: sourceTaskId,
              task_status: "blocked_login",
            },
          ],
        ];
      if (sql.startsWith("SELECT * FROM collection_tasks"))
        return [
          [
            {
              id: sourceTaskId,
              organization_id: "66666666-6666-4666-8666-666666666666",
              workspace_id: "77777777-7777-4777-8777-777777777777",
              status: "blocked_login",
              priority: "critical",
            },
          ],
        ];
      if (sql.startsWith("SELECT * FROM collection_subqueries"))
        return [
          [
            {
              provider_id: "44444444-4444-4444-8444-444444444444",
              ordinal: 0,
              target_json: JSON.stringify({ query: "收纳盒" }),
              is_required: 1,
            },
          ],
        ];
      if (sql.startsWith("SELECT id,organization_id,workspace_id FROM tasks"))
        return [
          [
            {
              id: "88888888-8888-4888-8888-888888888888",
              organization_id: "66666666-6666-4666-8666-666666666666",
              workspace_id: "77777777-7777-4777-8777-777777777777",
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlCredentialAssetRepository({
    getConnection: async () => connection,
  });
  const result = await repository.rotateAsset({
    id: assetId,
    expectedVersion: 1,
    sealed: {
      ciphertext: Buffer.from("ciphertext"),
      nonce: Buffer.alloc(12),
      authTag: Buffer.alloc(16),
      fingerprint: "fedcba0987654321",
    },
    keyVersion: "v2",
    expiresAt: "2026-09-20T08:00:00.000Z",
    actorId: "99999999-9999-4999-8999-999999999999",
    idempotencyKey: "rotate-and-replay",
    requestId: "request-rotate-and-replay",
    traceId: "trace-rotate-and-replay",
    now,
  });

  assert.equal(result.version, 2);
  assert.equal(committed, true);
  assert.equal(rolledBack, false);
  assert.ok(
    statements.some(
      ([sql, values]) =>
        sql.includes("SET status='automatically_replayed'") && values.includes(sourceTaskId),
    ),
  );
  assert.ok(statements.some(([sql]) => sql.includes("INSERT INTO collection_task_outbox")));
  assert.ok(
    statements.some(
      ([sql, values]) =>
        sql.startsWith("UPDATE tasks SET status='completed'") && values.includes(now),
    ),
  );
  assert.ok(
    statements.some(
      ([sql, values]) =>
        sql.includes("INSERT INTO task_events") &&
        values.includes("task.credential_renewal_completed"),
    ),
  );
});

test("credential rotation requeues a blocked browser job while its collection task is still running", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile("apps/api/src/mysql-credential-asset-repository.ts", "utf8"),
  );
  assert.match(source, /\["leased", "running", "parsing", "validating"\]/);
  assert.match(source, /status='queued',crawler_profile_id=NULL,crawler_run_id=NULL/);
  assert.match(source, /status='blocked'/);
});
