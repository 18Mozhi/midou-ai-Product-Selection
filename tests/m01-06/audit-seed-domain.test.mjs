import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditQueryService,
  InMemoryAuditRepository,
  SeedAdminService,
} from "../../packages/audit/dist/index.js";
import {
  BUILTIN_ROLES,
  InMemoryAuthorizationRepository,
  AuthorizationService,
} from "../../packages/authorization/dist/index.js";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  LocalAuthService,
  AuthError,
} from "../../packages/auth/dist/index.js";
const now = new Date("2026-08-07T12:00:00.000Z"),
  context = { requestId: "seed-request", traceId: "seed-trace" },
  actor = "00000000-0000-4000-8000-000000000601";
const hasher = {
  hash: async (value) => `hash:${value}`,
  verify: async (hash, value) => hash === `hash:${value}`,
};
test("M01-06.A01/A04/A10/A11/A12 creates one super administrator without retaining plaintext secret", async () => {
  const repository = new InMemoryAuditRepository(),
    service = new SeedAdminService(repository, hasher, () => now),
    first = await service.seed({
      email: "Root@Example.Test",
      password: "Seed-password-123!",
      ...context,
    }),
    second = await service.seed({
      email: "other@example.test",
      password: "Another-password-123!",
      ...context,
    });
  assert.equal(first.status, "created");
  assert.equal(second.status, "already_seeded");
  assert.equal(first.userId, second.userId);
  assert.equal(repository.events.length, 1);
  const serialized = JSON.stringify(repository.events);
  assert.doesNotMatch(serialized, /Seed-password|Root@Example/);
  assert.match(serialized, /email_hash/);
  assert.equal(repository.events[0].action, "platform_admin.seeded");
});
test("M01-06.A08/A12 validates seed input and cursor query boundaries", async () => {
  const repository = new InMemoryAuditRepository(),
    service = new SeedAdminService(repository, hasher, () => now);
  await assert.rejects(
    () => service.seed({ email: "invalid", password: "Seed-password-123!", ...context }),
    (error) => error.code === "seed_email_invalid",
  );
  await assert.rejects(
    () => service.seed({ email: "root@example.test", password: "short", ...context }),
    (error) => error.code === "seed_password_invalid",
  );
  const query = new AuditQueryService(repository);
  assert.throws(
    () => query.list({ limit: 101 }),
    (error) => error.code === "audit_limit_invalid",
  );
  assert.throws(
    () => query.list({ occurredFrom: new Date("2026-08-08"), occurredTo: new Date("2026-08-07") }),
    (error) => error.code === "audit_range_invalid",
  );
  for (const [filter, code] of [
    [{ outcome: "unknown" }, "audit_outcome_invalid"],
    [{ occurredFrom: new Date("invalid") }, "audit_time_invalid"],
    [{ cursor: "not-a-uuid" }, "audit_cursor_invalid"],
    [{ requestId: "x".repeat(129) }, "audit_request_id_invalid"],
  ])
    assert.throws(
      () => query.list(filter),
      (error) => error.code === code,
    );
});
test("M01-06 organization audit cursor is scoped and does not skip the next record", async () => {
  const repository = new InMemoryAuditRepository(),
    query = new AuditQueryService(repository),
    org = "00000000-0000-4000-8000-000000000701";
  repository.events.push(
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(710 + index).padStart(12, "0")}`,
      organization_id: org,
      workspace_id: null,
      actor_id: actor,
      action: "organization.member.updated",
      resource_type: "membership",
      resource_id: null,
      outcome: "succeeded",
      request_id: `request-${index}`,
      trace_id: `trace-${index}`,
      metadata: {},
      occurred_at: new Date(now.getTime() - index * 1000),
      schema_version: 1,
    })),
  );
  const first = await query.list({ organizationId: org, limit: 2 });
  assert.equal(first.items.length, 2);
  assert.equal(first.nextCursor, first.items[1].id);
  const second = await query.list({ organizationId: org, limit: 2, cursor: first.nextCursor });
  assert.deepEqual(
    second.items.map((item) => item.id),
    [repository.events[2].id],
  );
  await assert.rejects(
    () =>
      query.list({
        organizationId: org,
        cursor: "00000000-0000-4000-8000-000000000799",
      }),
    (error) => error.code === "audit_cursor_invalid",
  );
});
test("M01-06.A09/A12 auditor role is read-only and platform audit needs platform capability", async () => {
  const auditor = BUILTIN_ROLES.find((role) => role.code === "auditor");
  assert.ok(auditor.capabilities.includes("audit:read"));
  for (const denied of [
    "collection:replay",
    "platform_token:manage",
    "key_rotation:manage",
    "role:manage",
  ])
    assert.ok(!auditor.capabilities.includes(denied));
  const repo = new InMemoryAuthorizationRepository();
  repo.subjects.set(repo.key(actor), {
    actor_id: actor,
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [],
    platform_role_codes: [],
    platform_capabilities: [],
  });
  const authz = new AuthorizationService(repo, () => now);
  await assert.rejects(
    () =>
      authz.authorize({
        actorId: actor,
        capability: "audit:read",
        surface: "api",
        requestId: "r",
        traceId: "t",
      }),
    (error) => error.code === "permission_denied",
  );
});
test("M01-06.A04/A08/A12 restricted seed session exposes setup state but blocks ordinary authenticated calls", async () => {
  const repository = new InMemoryAuthRepository(),
    auth = new LocalAuthService({
      repository,
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
      tokenFactory: () => "seed-session-token",
    });
  repository.users.push({
    id: actor,
    email: "root@example.test",
    email_normalized: "root@example.test",
    username: null,
    username_normalized: null,
    password_hash: "hash:Seed-password-123!",
    status: "active",
    email_verified_at: now,
    failed_login_count: 0,
    locked_until: null,
    password_changed_at: now,
    must_change_password: true,
    must_enroll_mfa: true,
    security_setup_completed_at: null,
    version: 1,
    created_at: now,
    updated_at: now,
  });
  const login = await auth.login(
    { identifier: "root@example.test", password: "Seed-password-123!" },
    context,
  );
  assert.equal(login.security_setup.required, true);
  await assert.rejects(
    () => auth.authenticate(login.token),
    (error) => error instanceof AuthError && error.code === "security_setup_required",
  );
  assert.equal((await auth.securitySetupStatus(login.token)).must_change_password, true);
  await auth.changePassword(login.token, "Seed-password-123!", "Long-term-password-456!", context);
  assert.equal(repository.users[0].must_change_password, false);
  assert.equal(repository.users[0].must_enroll_mfa, true);
});
