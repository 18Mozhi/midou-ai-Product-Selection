import test from "node:test";
import assert from "node:assert/strict";
import { sealCredential } from "../../packages/credentials/dist/index.js";
import { AmazonCookieSessionService } from "../../apps/api/dist/amazon-cookie-session-service.js";
import { ApiError } from "../../apps/api/dist/api-foundation.js";
import { buildApp } from "../../apps/api/dist/app.js";
const profileId = "00000000-0000-4000-8000-000000000811",
  assetId = "00000000-0000-4000-8000-000000000812",
  providerId = "00000000-0000-4000-8000-000000000813",
  actorId = "00000000-0000-4000-8000-000000000814",
  master = "owned-test-master-key-at-least-32-characters",
  now = new Date("2026-11-26T08:00:00Z");
const cookie = (n) => ({
  name: n,
  value: "DO-NOT-EXPOSE",
  domain: ".amazon.com",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
});
function fixture(change = {}) {
  const sealed = sealCredential(
    {
      encoding: "utf8",
      value: JSON.stringify({
        format: "scoutops-cookie-bundle-v1",
        cookies: change.cookies ?? [cookie("at-main"), cookie("sess-at-main")],
      }),
    },
    master,
    { assetId, assetVersion: 1, kind: "cookie_bundle", keyVersion: "v1" },
  );
  const p = {
    id: profileId,
    provider_id: providerId,
    credential_asset_id: "old",
    version: 1,
    status: "active",
    code: "owned",
    name: "Owned profile",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    browser_family: "chromium",
    ...change.profile,
  };
  const a = {
    id: assetId,
    provider_id: providerId,
    kind: "cookie_bundle",
    version: 1,
    status: "active",
    expires_at: null,
    name: "Owned login",
    fingerprint: sealed.fingerprint,
    key_version: "v1",
    payload_ciphertext: sealed.ciphertext,
    payload_nonce: sealed.nonce,
    payload_auth_tag: sealed.authTag,
    ...change.asset,
  };
  const writes = [],
    operations = [];
  let rolledBack = false;
  const c = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {
      rolledBack = true;
    },
    release() {},
    query: async (sql, values = []) => {
      if (sql.startsWith("SELECT crawler_profile_id")) return [operations];
      if (sql.startsWith("SELECT p.*")) return [[p]];
      if (sql.startsWith("SELECT run_id"))
        return [change.busy ? [{ run_id: "owned-running" }] : []];
      if (sql.startsWith("SELECT * FROM credential_assets"))
        return [[a].filter((a) => a.provider_id === values[1] && a.status === "active")];
      writes.push({ sql, values });
      if (sql.startsWith("UPDATE crawler_profiles")) {
        p.credential_asset_id = values[0];
        p.version = values[1];
      }
      if (sql.startsWith("INSERT INTO crawler_profile_operations"))
        operations.push({ crawler_profile_id: profileId, result_version: p.version });
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    getConnection: async () => c,
    query: async () => [
      [
        {
          ...p,
          profile_version: p.version,
          profile_status: p.status,
          asset_id: a.id,
          asset_version: a.version,
          asset_status: a.status,
          asset_name: a.name,
          kind: a.kind,
          fingerprint: a.fingerprint,
          expires_at: a.expires_at,
        },
      ],
    ],
  };
  return {
    service: new AmazonCookieSessionService(pool, profileId, master, () => now),
    writes,
    p,
    a,
    get rolledBack() {
      return rolledBack;
    },
  };
}
const input = { asset_id: assetId, expected_asset_version: 1, expected_profile_version: 1 },
  context = {
    actorId,
    idempotencyKey: "owned-bind",
    requestId: "owned-request",
    traceId: "owned-trace",
  };
test("explicit binding is versioned, idempotent, metadata-only and never replays or enables source", async () => {
  const f = fixture(),
    summary = await f.service.activate(input, context);
  assert.equal(summary.mode, "administrator_cookie");
  assert.equal(summary.profile_version, 2);
  assert.doesNotMatch(JSON.stringify(summary), /DO-NOT-EXPOSE|payload_ciphertext|nonce|auth_tag/);
  const count = f.writes.length;
  await f.service.activate(input, context);
  assert.equal(f.writes.length, count);
  assert.ok(
    f.writes.some(
      (w) =>
        w.sql.includes("crawler_profile_versions") &&
        JSON.stringify(w.values).includes("owned-trace"),
    ),
  );
  assert.ok(
    f.writes.every((w) =>
      /^(UPDATE crawler_profiles|INSERT INTO crawler_profile_versions|INSERT INTO crawler_profile_operations)/.test(
        w.sql,
      ),
    ),
  );
});
for (const [name, change, override] of [
  ["busy", { busy: true }, {}],
  ["profile conflict", {}, { expected_profile_version: 2 }],
  ["asset conflict", { asset: { version: 2 } }, {}],
  ["expired", { asset: { expires_at: new Date(0) } }, {}],
  ["revoked", { asset: { status: "revoked" } }, {}],
  ["foreign provider", { asset: { provider_id: "foreign" } }, {}],
  [
    "foreign domain",
    { cookies: [{ ...cookie("at-main"), domain: ".com" }, cookie("sess-at-main")] },
    {},
  ],
  ["missing login", { cookies: [cookie("session-id")] }, {}],
]) {
  test(`binding rejects ${name} without mutation`, async () => {
    const f = fixture(change);
    await assert.rejects(f.service.activate({ ...input, ...override }, context));
    assert.equal(f.writes.length, 0);
    assert.equal(f.rolledBack, true);
  });
}
test("session routes retain permission, origin and idempotency enforcement", async () => {
  const calls = [],
    service = fixture().service;
  const app = buildApp({
    credentialAssets: {
      service: {},
      amazonSessions: service,
      authorization: { authorize: async (x) => calls.push(x) },
      auth: { authenticate: async () => ({ user: { id: actorId }, session: { id: "owned" } }) },
      secureCookie: false,
      webOrigin: "http://owned.test",
    },
  });
  try {
    let r = await inject(app, { method: "GET", url: "/api/v1/platform/amazon-session" });
    assert.equal(r.statusCode, 200);
    assert.equal(calls[0].capability, "key_rotation:manage");
    assert.match(r.headers["cache-control"], /no-store/);
    r = await inject(app, {
      method: "POST",
      url: "/api/v1/platform/amazon-session",
      headers: { origin: "http://evil.test", "idempotency-key": "owned" },
      payload: input,
    });
    assert.equal(r.statusCode, 403);
    r = await inject(app, {
      method: "POST",
      url: "/api/v1/platform/amazon-session",
      headers: { origin: "http://owned.test" },
      payload: input,
    });
    assert.equal(r.statusCode, 400);
    r = await inject(app, {
      method: "POST",
      url: "/api/v1/platform/amazon-session",
      headers: { origin: "http://owned.test", "idempotency-key": "owned" },
      payload: input,
    });
    assert.equal(r.statusCode, 200);
    assert.doesNotMatch(r.body, /DO-NOT-EXPOSE|payload_ciphertext/);
  } finally {
    await app.close();
  }
});
test("ordinary users cannot read or switch administrator session", async () => {
  const app = buildApp({
    credentialAssets: {
      service: {},
      amazonSessions: fixture().service,
      authorization: {
        authorize: async () => {
          throw new ApiError(403, "capability_forbidden", "无权限", "使用平台管理员账号。");
        },
      },
      auth: { authenticate: async () => ({ user: { id: actorId } }) },
      secureCookie: false,
      webOrigin: "http://owned.test",
    },
  });
  try {
    for (const method of ["GET", "POST"]) {
      const r = await inject(app, {
        method,
        url: "/api/v1/platform/amazon-session",
        headers: { origin: "http://owned.test", "idempotency-key": "owned" },
        ...(method === "POST" ? { payload: input } : {}),
      });
      assert.equal(r.statusCode, 403);
      assert.doesNotMatch(r.body, /Owned login|DO-NOT-EXPOSE/);
    }
  } finally {
    await app.close();
  }
});

function inject(app, options) {
  return app.inject({
    ...options,
    headers: { cookie: "scoutops_session=owned", ...options.headers },
  });
}
