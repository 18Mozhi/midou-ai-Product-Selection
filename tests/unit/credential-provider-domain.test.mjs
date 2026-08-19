import test from "node:test";
import assert from "node:assert/strict";
import {
  CredentialAssetError,
  CredentialAssetService,
} from "../../apps/api/dist/credential-asset-service.js";

const providerId = "00000000-0000-4000-8000-000000000101";
const actorId = "00000000-0000-4000-8000-000000000102";
const now = new Date("2026-08-19T00:00:00.000Z");
const summary = {
  id: "00000000-0000-4000-8000-000000000103",
  provider_id: providerId,
  name: "登录 Cookie",
  kind: "cookie_bundle",
  status: "active",
  key_version: "v1",
  fingerprint: "0123456789abcdef",
  expires_at: "2026-09-01T00:00:00.000Z",
  rotated_at: null,
  version: 1,
  updated_at: now.toISOString(),
};
const context = {
  actorId,
  idempotencyKey: "domain-test",
  requestId: "domain-test",
  traceId: "domain-test",
};
function repository() {
  return {
    listAssets: async () => [],
    listProviderOptions: async () => [
      {
        id: providerId,
        code: "source",
        name: "来源",
        target_url: "https://s.1688.com/selloffer/offer_search.htm",
        access_mode: "authenticated_browser",
      },
    ],
    listProfiles: async () => [],
    getCipherRecord: async () => ({ summary }),
    createAsset: async () => summary,
    rotateAsset: async () => summary,
    revokeAsset: async () => summary,
    createProfile: async () => {
      throw new Error("unused");
    },
  };
}
const cookie = (domain) => ({
  encoding: "utf8",
  value: JSON.stringify([{ name: "sid", value: "secret", domain, path: "/" }]),
});

test("Cookie 域必须绑定来源目标站点", async () => {
  const service = new CredentialAssetService(
    repository(),
    "a".repeat(32),
    "v1",
    () => now,
  );
  await assert.rejects(
    () =>
      service.createAsset(
        {
          provider_id: providerId,
          name: "错误域名 Cookie",
          kind: "cookie_bundle",
          secret_payload: cookie("example.com"),
          expires_at: "2026-09-01T00:00:00.000Z",
        },
        context,
      ),
    (error) =>
      error instanceof CredentialAssetError &&
      error.code === "credential_cookie_domain_mismatch",
  );
});

test("Cookie 父域可绑定来源子域", async () => {
  const service = new CredentialAssetService(
    repository(),
    "a".repeat(32),
    "v1",
    () => now,
  );
  const result = await service.createAsset(
    {
      provider_id: providerId,
      name: "1688 Cookie",
      kind: "cookie_bundle",
      secret_payload: cookie(".1688.com"),
      expires_at: "2026-09-01T00:00:00.000Z",
    },
    context,
  );
  assert.equal(result.id, summary.id);
});
