import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import { CredentialAssetService } from "../../apps/api/dist/credential-asset-service.js";

const providerId = "00000000-0000-4000-8000-000000000201";
const assetId = "00000000-0000-4000-8000-000000000202";
const actorId = "00000000-0000-4000-8000-000000000203";
const now = new Date("2026-08-20T00:00:00.000Z");

test("Cookie HTTP write seals plaintext before repository storage and disables response caching", async () => {
  let stored;
  let rotated;
  const summary = {
    id: assetId,
    provider_id: providerId,
    name: "1688 登录状态",
    kind: "cookie_bundle",
    status: "active",
    key_version: "v1",
    fingerprint: "0123456789abcdef",
    expires_at: null,
    rotated_at: null,
    version: 1,
    updated_at: now.toISOString(),
  };
  const repository = {
    listAssets: async () => [],
    listProviderOptions: async () => [
      {
        id: providerId,
        code: "1688",
        name: "1688",
        target_url: "https://s.1688.com/selloffer/offer_search.htm",
        access_mode: "authenticated_browser",
      },
    ],
    listProfiles: async () => [],
    getCipherRecord: async (id) => ({
      assetId: id,
      assetVersion: 1,
      kind: "cookie_bundle",
      keyVersion: "v1",
      ciphertext: stored.sealed.ciphertext,
      nonce: stored.sealed.nonce,
      authTag: stored.sealed.authTag,
      fingerprint: stored.sealed.fingerprint,
      summary: { ...summary, id },
    }),
    createAsset: async (input) => {
      stored = input;
      return { ...summary, id: input.id, fingerprint: input.sealed.fingerprint };
    },
    rotateAsset: async (input) => {
      rotated = input;
      return { ...summary, id: input.id, fingerprint: input.sealed.fingerprint, version: 2 };
    },
    revokeAsset: async (input) => ({ ...summary, id: input.id, status: "revoked", version: 3 }),
    createProfile: async () => {
      throw new Error("unused");
    },
  };
  const service = new CredentialAssetService(repository, "m".repeat(32), "v1", () => now);
  const app = buildApp({
    credentialAssets: {
      service,
      authorization: { authorize: async () => undefined },
      auth: {
        authenticate: async () => ({
          user: { id: actorId },
          session: { id: "00000000-0000-4000-8000-000000000204" },
        }),
      },
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  const cookieValue = "session-cookie-plaintext-never-log";
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/credential-assets",
    headers: {
      cookie: "scoutops_session=test-session",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "cookie-security-boundary",
    },
    payload: {
      provider_id: providerId,
      name: "1688 登录状态",
      kind: "cookie_bundle",
      secret_payload: {
        encoding: "utf8",
        value: JSON.stringify([
          { name: "sid", value: cookieValue, domain: ".1688.com", path: "/" },
        ]),
      },
      expires_at: null,
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.doesNotMatch(response.body, new RegExp(cookieValue));
  assert.ok(stored);
  assert.equal("secret_payload" in stored.value, false);
  assert.equal(stored.sealed.ciphertext.includes(Buffer.from(cookieValue)), false);
  assert.equal(stored.sealed.nonce.length, 12);
  assert.equal(stored.sealed.authTag.length, 16);
  const createdId = response.json().data.id;
  const rotatedCookieValue = "rotated-cookie-plaintext-never-log";
  const rotatedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/platform/credential-assets/${createdId}/rotate`,
    headers: {
      cookie: "scoutops_session=test-session",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "cookie-security-rotate",
    },
    payload: {
      secret_payload: {
        encoding: "utf8",
        value: JSON.stringify([
          { name: "sid", value: rotatedCookieValue, domain: ".1688.com", path: "/" },
        ]),
      },
      expected_version: 1,
      expires_at: null,
    },
  });
  assert.equal(rotatedResponse.statusCode, 200);
  assert.equal(rotatedResponse.headers["cache-control"], "no-store");
  assert.doesNotMatch(rotatedResponse.body, new RegExp(rotatedCookieValue));
  assert.ok(rotated);
  assert.equal(rotated.sealed.ciphertext.includes(Buffer.from(rotatedCookieValue)), false);
  const revokedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/platform/credential-assets/${createdId}/revoke`,
    headers: {
      cookie: "scoutops_session=test-session",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "cookie-security-revoke",
    },
    payload: { expected_version: 2, reason: "测试安全撤销" },
  });
  assert.equal(revokedResponse.statusCode, 200);
  assert.equal(revokedResponse.headers["cache-control"], "no-store");
  await app.close();
});
