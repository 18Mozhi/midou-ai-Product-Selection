import test from "node:test";
import assert from "node:assert/strict";
import { PublicRssRecovery } from "../../apps/api/dist/public-rss-recovery.js";
import {
  lan1688RecoveryCandidatesSql,
  lan1688RecoveryTarget,
} from "../../apps/api/dist/lan-1688-recovery.js";
import { pendingTaskRecoveryCandidatesSql } from "../../apps/api/dist/pending-source-recovery-policy.js";
import { createProviderAdapterRuntime } from "../../apps/api/dist/bootstrap/create-provider-adapter-runtime.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";
const actor = "00000000-0000-4000-8000-000000000001",
  now = new Date("2026-10-18T08:00:00Z"),
  opened = new Date(now - 600000);
function fixture(
  status = "ready",
  rows = [{ id: "lan-provider", version: 5, opened_at: opened, collection_task_id: "task" }],
) {
  const calls = [];
  const worker = new PublicRssRecovery(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [rows];
      },
    },
    {
      probe: async (id, context) => {
        calls.push({ probe: id, context });
        return { health_status: status };
      },
    },
    {
      recoverProvider: async (input) => {
        calls.push({ recover: input });
        return { recovered: true };
      },
    },
    { enabled: true, actorId: actor, pollMs: 60000, cooldownMs: 300000 },
    () => now,
    undefined,
    undefined,
    lan1688RecoveryTarget,
  );
  return { worker, calls };
}
test("LAN1688 transient recovery uses existing task/tenant policy and real ready before audited recovery", async () => {
  const f = fixture();
  assert.equal((await f.worker.processOnce()).status, "recovered");
  assert.equal(f.calls[0].sql, lan1688RecoveryCandidatesSql);
  assert.deepEqual(f.calls[0].params, [actor, now, new Date(now - 300000), new Date(now - 300000)]);
  assert.match(f.calls[0].sql, /p.code='1688_search' AND p.access_mode='authenticated_browser'/);
  assert.match(f.calls[0].sql, /t.created_by=recovery_actor.id/);
  assert.match(f.calls[0].sql, /o.status='active'/);
  assert.match(f.calls[0].sql, /w.organization_id=t.organization_id AND w.status='active'/);
  assert.match(f.calls[0].sql, /p.status='enabled'/);
  assert.match(f.calls[0].sql, /q.error_code='source_circuit_open' AND q.available_result_count=0/);
  assert.match(f.calls[0].sql, /pending_search.collection_task_id=t.id/);
  assert.match(f.calls[0].sql, /pending_search.status='queued'/);
  assert.match(f.calls[0].sql, /pending_search.deleted_at IS NULL/);
  assert.match(f.calls[0].sql, /p.terms_review_status='approved'/);
  assert.match(f.calls[0].sql, /h.health_status='blocked'/);
  assert.match(f.calls[1].context.idempotencyKey, /^lan-1688-recovery:/);
  assert.equal(f.calls[1].context.automaticCollectionTaskId, undefined);
  assert.equal(f.calls[1].context.sessionId, undefined);
  assert.deepEqual(f.calls[2].recover.automaticRecovery, { providerVersion: 5, openedAt: opened });
});
for (const status of ["blocked", "degraded", "unknown"])
  test(`LAN1688 ${status} health never clears the circuit`, async () => {
    const f = fixture(status);
    assert.equal((await f.worker.processOnce()).status, status);
    assert.equal(
      f.calls.some((c) => c.recover),
      false,
    );
  });
test("LAN1688 with no actual pending task performs no health request", async () => {
  const f = fixture("ready", []);
  assert.equal((await f.worker.processOnce()).status, "idle");
  assert.equal(f.calls.length, 1);
});
for (const [label, token, enabled, expected] of [
  ["missing token", "", true, "disabled"],
  ["switched off", "fixture-token", false, "disabled"],
  ["configured", "fixture-token", true, "idle"],
])
  test(`LAN1688 runtime factory ${label} gates the timer`, async () => {
    const base = loadRuntimeConfig(
        { NODE_ENV: "test", AUTOMATIC_SOURCE_SYSTEM_ACTOR_ID: actor },
        "api",
      ),
      calls = [];
    const config = {
      ...base,
      nodeEnv: "production",
      providerAdapters: {
        ...base.providerAdapters,
        lan1688Token: token,
        lan1688RecoveryEnabled: enabled,
      },
    };
    const runtime = createProviderAdapterRuntime(
      {
        query: async (sql) => {
          calls.push(sql);
          return [[]];
        },
      },
      config,
      {},
      {},
    );
    try {
      assert.equal((await runtime.publicLan1688Recovery.processOnce()).status, expected);
      assert.equal(calls.length, expected === "idle" ? 1 : 0);
    } finally {
      await runtime.publicLan1688Recovery.stop();
      await runtime.publicAmazonRecovery.stop();
      await runtime.publicRssRecovery.stop();
    }
  });
test("recovery source identifiers are code-owned and reject unknown or inherited names", () => {
  for (const code of ["other", "__proto__", "toString", "1688_search' OR 1=1"])
    assert.throws(() => pendingTaskRecoveryCandidatesSql(code), /policy_invalid/);
});
test("LAN1688 recovery defaults are bounded server-only runtime values", () => {
  const c = loadRuntimeConfig({ NODE_ENV: "test" }, "api");
  assert.equal(c.providerAdapters.lan1688RecoveryEnabled, true);
  assert.equal(c.providerAdapters.lan1688RecoveryPollMs, 60000);
  assert.equal(c.providerAdapters.lan1688RecoveryCooldownMs, 300000);
  assert.equal(
    loadRuntimeConfig({ LAN_1688_AUTO_RECOVERY_ENABLED: "false" }, "api").providerAdapters
      .lan1688RecoveryEnabled,
    false,
  );
  assert.throws(
    () => loadRuntimeConfig({ LAN_1688_AUTO_RECOVERY_POLL_MS: "0" }, "api"),
    /LAN_1688_AUTO_RECOVERY_POLL_MS/,
  );
});
