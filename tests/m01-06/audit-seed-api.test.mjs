import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import { AuditQueryService, InMemoryAuditRepository } from "../../packages/audit/dist/index.js";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  LocalAuthService,
  digestOpaqueToken,
} from "../../packages/auth/dist/index.js";
const now = new Date("2026-08-07T12:00:00.000Z"),
  actor = "00000000-0000-4000-8000-000000000611",
  org = "00000000-0000-4000-8000-000000000612",
  sessionId = "00000000-0000-4000-8000-000000000613",
  token = "audit-session-token",
  hasher = {
    hash: async (value) => `hash:${value}`,
    verify: async (hash, value) => hash === `hash:${value}`,
  };
function fixture(restricted = false) {
  const authRepo = new InMemoryAuthRepository();
  authRepo.users.push({
    id: actor,
    email: "auditor@example.test",
    email_normalized: "auditor@example.test",
    password_hash: "hash:password",
    status: "active",
    email_verified_at: now,
    failed_login_count: 0,
    locked_until: null,
    password_changed_at: now,
    must_change_password: restricted,
    must_enroll_mfa: restricted,
    security_setup_completed_at: restricted ? null : now,
    version: 1,
    created_at: now,
    updated_at: now,
  });
  authRepo.sessions.push({
    id: sessionId,
    user_id: actor,
    token_hash: digestOpaqueToken(token),
    status: "active",
    device_label: "test",
    user_agent_hash: null,
    ip_hash: null,
    expires_at: new Date(now.getTime() + 3600000),
    last_seen_at: now,
    revoked_at: null,
    created_at: now,
  });
  const auth = new LocalAuthService({
    repository: authRepo,
    delivery: new CaptureAuthDelivery(),
    passwordHasher: hasher,
    policy: {
      passwordMinLength: 12,
      passwordMaxLength: 128,
      sessionTtlMinutes: 60,
      actionTokenTtlMinutes: 15,
      maxFailedAttempts: 5,
      lockMinutes: 15,
    },
    now: () => now,
  });
  const authorizationRepo = new InMemoryAuthorizationRepository();
  authorizationRepo.subjects.set(authorizationRepo.key(actor), {
    actor_id: actor,
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_security_admin"],
    platform_capabilities: ["audit:read"],
  });
  authorizationRepo.subjects.set(authorizationRepo.key(actor, org), {
    actor_id: actor,
    membership_id: "00000000-0000-4000-8000-000000000614",
    membership_active: true,
    role_codes: ["auditor"],
    capabilities: ["audit:read"],
    scopes: [{ scope: "organization" }],
    platform_role_codes: [],
    platform_capabilities: [],
  });
  const auditRepo = new InMemoryAuditRepository();
  auditRepo.events.push(
    {
      id: "00000000-0000-4000-8000-000000000615",
      organization_id: null,
      workspace_id: null,
      actor_id: actor,
      action: "platform_admin.seeded",
      resource_type: "user",
      resource_id: actor,
      outcome: "succeeded",
      request_id: "seed-request",
      trace_id: "seed-trace",
      metadata: { email_hash: "safe" },
      occurred_at: now,
      schema_version: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000616",
      organization_id: org,
      workspace_id: null,
      actor_id: actor,
      action: "membership.role.changed",
      resource_type: "membership",
      resource_id: null,
      outcome: "succeeded",
      request_id: "org-request",
      trace_id: "org-trace",
      metadata: { role_code: "auditor" },
      occurred_at: now,
      schema_version: 1,
    },
  );
  const authorization = new AuthorizationService(authorizationRepo, () => now);
  return buildApp({
    now: () => now,
    localAuth: {
      service: auth,
      idempotency: {
        execute: async (i, w) => await w(),
        executeSensitive: async (i, w) => await w(),
      },
      webOrigin: "http://localhost",
      secureCookie: false,
    },
    audit: { service: new AuditQueryService(auditRepo), authorization, auth, secureCookie: false },
  });
}
const cookie = { cookie: `scoutops_session=${token}` };
test("M01-06.A06/A09/A13 platform and organization audit APIs enforce scope and preserve envelopes", async () => {
  const app = fixture();
  const platform = await app.inject({
    method: "GET",
    url: "/api/v1/platform/audit-events?limit=20",
    headers: cookie,
  });
  assert.equal(platform.statusCode, 200);
  assert.equal(platform.json().data.items[0].action, "platform_admin.seeded");
  const organization = await app.inject({
    method: "GET",
    url: `/api/v1/organizations/${org}/audit-events?outcome=succeeded`,
    headers: cookie,
  });
  assert.equal(organization.statusCode, 200);
  assert.equal(organization.json().data.items[0].organization_id, org);
  assert.ok(organization.headers["x-request-id"]);
  await app.close();
});
test("M01-06.A08/A09 restricted seed session cannot read audit before setup completes", async () => {
  const app = fixture(true),
    response = await app.inject({
      method: "GET",
      url: "/api/v1/platform/audit-events",
      headers: cookie,
    });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "security_setup_required");
  await app.close();
});
