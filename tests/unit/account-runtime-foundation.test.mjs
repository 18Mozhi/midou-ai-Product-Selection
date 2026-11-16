import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PRIMARY_COST_APPROVER_EMAIL } from "@scoutops/auth";
import { loadRuntimeConfig } from "@scoutops/config";
import {
  accountReportScope,
  assertAccountCutoverReady,
  collectionTaskScope,
  fileAssetAccountStorage,
  insertScheduledHighCollectionTask,
} from "@scoutops/database";
import { accountReleaseReceipts } from "../../packages/database/dist/account-release-receipts.js";
import {
  planAccountRetirementProduction,
  renderAccountReleaseReceipts,
} from "../../scripts/plan-account-retirement-production.mjs";

const prod = {
  nodeEnv: "production",
  app: { host: "127.0.0.1" },
  database: { host: "127.0.0.1", name: "product_scout", user: "product_scout" },
};
const ready = {
  migration_ready: 1,
  cutover_ready: 1,
  runtime_roots: 0,
  archive_roots: 2,
  legacy_columns: 0,
  verified_archive_column: 1,
  standalone_crawler_inflight: 0,
};

test("runtime receipts are byte-identical to the compiled release plan", async () => {
  const plan = await planAccountRetirementProduction();
  const receiptSource = await readFile(
    new URL("../../packages/database/src/account-release-receipts.ts", import.meta.url),
    "utf8",
  );
  assert.equal(receiptSource.replaceAll("\r\n", "\n"), renderAccountReleaseReceipts(plan));
  assert.equal(accountReleaseReceipts.length, 121);
});

test("runtime refuses to start on the wrong database, live legacy roots, or unsealed approvals", async () => {
  const proof = (facts) => ({
    async query(sql, args) {
      assert.match(sql, /^SELECT/);
      assert.match(sql, /u\.email_verified_at IS NOT NULL/);
      assert.deepEqual(args, [...accountReleaseReceipts.flat(), 121, PRIMARY_COST_APPROVER_EMAIL]);
      return [[facts]];
    },
  });
  await assertAccountCutoverReady(prod, proof(ready), PRIMARY_COST_APPROVER_EMAIL);
  for (const changed of [{ migration_ready: 0 }, { cutover_ready: 0 }, { runtime_roots: 2 }]) {
    await assert.rejects(
      assertAccountCutoverReady(prod, proof({ ...ready, ...changed }), PRIMARY_COST_APPROVER_EMAIL),
      /not_ready/,
    );
  }
  await assert.rejects(
    assertAccountCutoverReady(
      { ...prod, database: { ...prod.database, user: "root" } },
      {
        query() {
          assert.fail("foreign database must not be queried");
        },
      },
      PRIMARY_COST_APPROVER_EMAIL,
    ),
    /target_invalid/,
  );
  const legacy = loadRuntimeConfig({ NODE_ENV: "test" }, "api");
  assert.equal(legacy.app.accountScopeMode, undefined);
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "test", ACCOUNT_SCOPE_MODE: "retired" }, "api"),
    { key: "ACCOUNT_SCOPE_MODE" },
  );
});

test("native evidence, topics and scheduled tasks use account scope, rejecting mixed storage", async () => {
  const columns = (...fields) => ({ query: async () => [fields.map((Field) => ({ Field }))] });
  assert.equal(await fileAssetAccountStorage(columns("account_id", "historical_context")), true);
  assert.equal(await collectionTaskScope(columns("account_id")), "account");
  await assert.rejects(
    fileAssetAccountStorage(columns("account_id", "organization_id")),
    /scope_schema_invalid/,
  );
  await assert.rejects(collectionTaskScope(columns("account_id", "workspace_id")), /scope_schema/);
  const topics = await accountReportScope(columns("account_id"), "trend_topics");
  assert.match(topics, /o.account_id=trend_topics.account_id/);
  assert.match(
    topics,
    /o.reason IN \('shared','unassigned'\) AND o.account_id=cut.primary_account_id/,
  );
  const start = new Date("2026-01-01T00:00:00Z");
  await insertScheduledHighCollectionTask(
    {
      async query(sql, args) {
        assert.match(sql, /^INSERT INTO collection_tasks \(id,account_id,/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.deepEqual(args.slice(0, 2), ["task", "account"]);
        return [{ affectedRows: 1 }];
      },
    },
    {
      id: "task",
      actorId: "actor",
      requestId: "req",
      traceId: "trace",
      now: start,
      scope: { kind: "account", accountId: "account" },
    },
  );
});
