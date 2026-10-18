import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";
import { anonymousAmazonFingerprint } from "../../packages/provider-sources/dist/index.js";

const profileId = "00000000-0000-4000-8000-000000000481";
const now = new Date("2026-10-18T04:30:00Z");
async function scopeQuery(
  healthProfile = "",
  requestedProfile = profileId,
  leaseOwner = "amazon-public-health",
) {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      calls.push({ sql, values });
      return [[]];
    },
  };
  const repository = new MySqlCrawlerRuntimeRepository(
    { getConnection: async () => connection },
    profileId,
    healthProfile,
  );
  await assert.rejects(
    () =>
      repository.acquire({
        actorId: "actor",
        organizationId: "org",
        workspaceId: "workspace",
        profileId: requestedProfile,
        leaseOwner,
        now,
        expiresAt: new Date(now.getTime() + 60000),
        runId: "run",
        leaseId: "lease",
        leaseTokenHash: "hash",
        idempotencyKey: "key",
        requestId: "request",
        traceId: "trace",
      }),
    (error) => error.code === "crawler_profile_unavailable",
  );
  assert.ok(calls.some((call) => call.sql.includes("slot_type='crawler' FOR UPDATE")));
  return calls.find((call) => call.sql.startsWith("SELECT p.provider_id"));
}

test("only the private canonical Amazon health repository may lease a disabled approved empty profile", async () => {
  const q = await scopeQuery(profileId);
  for (const gate of [
    "v.status='disabled'",
    "v.code='amazon_product'",
    "v.access_mode='public_page'",
    "a.kind='browser_profile'",
    "a.fingerprint=?",
    "v.terms_review_status='approved'",
    "CHAR_LENGTH(v.terms_version)>0",
    "v.terms_expires_at>?",
    "FOR UPDATE",
  ])
    assert.ok(q.sql.includes(gate), gate);
  assert.deepEqual(q.values, [
    "workspace",
    "org",
    profileId,
    profileId,
    anonymousAmazonFingerprint(),
    now,
  ]);
});

test("ordinary leases, wrong profile and a copied owner label cannot unlock disabled providers", async () => {
  for (const args of [
    [""],
    [profileId, "different-profile"],
    [profileId, profileId, "ordinary-crawler"],
  ]) {
    const q = await scopeQuery(...args);
    assert.ok(q.sql.includes("v.status='enabled'"));
    assert.ok(!q.sql.includes("v.status='disabled'"));
    assert.equal(q.values.length, 3);
  }
});
