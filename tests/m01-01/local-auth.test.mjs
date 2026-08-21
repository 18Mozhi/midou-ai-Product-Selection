import test from "node:test";
import assert from "node:assert/strict";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  LocalAuthService,
  createArgon2PasswordHasher,
  EncryptedOutboxAuthDelivery,
  openAuthDelivery,
} from "../../packages/auth/dist/index.js";

const policy = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  sessionTtlMinutes: 43200,
  actionTokenTtlMinutes: 15,
  maxFailedAttempts: 3,
  lockMinutes: 15,
};

function fixture() {
  const repository = new InMemoryAuthRepository();
  const delivery = new CaptureAuthDelivery();
  let sequence = 0;
  const service = new LocalAuthService({
    repository,
    delivery,
    passwordHasher: createArgon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    policy,
    now: () => new Date("2026-08-07T00:00:00.000Z"),
    tokenFactory: () => Buffer.alloc(32, ++sequence).toString("base64url"),
  });
  return { repository, delivery, service };
}

test("M01-01.A02/A04/A12 passwords use Argon2id and registration never exposes verification token", async () => {
  const { repository, delivery, service } = fixture();
  const result = await service.register(
    { email: " User@Example.com ", password: "Correct-Horse-42" },
    { requestId: "request-register", traceId: "trace-register" },
  );
  assert.equal(result.email, "user@example.com");
  assert.equal(result.status, "pending_verification");
  assert.doesNotMatch(JSON.stringify(result), /AQEBAQ/);
  assert.match(repository.users[0].password_hash, /^\$argon2id\$/);
  assert.equal(delivery.messages[0].kind, "email_verification");
  assert.equal(
    await service.verifyEmail(delivery.messages[0].token, {
      requestId: "request-verify",
      traceId: "trace-verify",
    }),
    "verified",
  );
  await assert.rejects(
    () =>
      service.verifyEmail(delivery.messages[0].token, {
        requestId: "request-repeat",
        traceId: "trace-repeat",
      }),
    /invalid_or_expired_token/,
  );
});

test("M01-01.A04/A09/A16 login is generic, locks by policy, hashes sessions and supports revocation", async () => {
  const { repository, delivery, service } = fixture();
  await service.register(
    { email: "user@example.com", password: "Correct-Horse-42" },
    { requestId: "r1", traceId: "t1" },
  );
  await service.verifyEmail(delivery.messages[0].token, { requestId: "r2", traceId: "t2" });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      () =>
        service.login(
          { email: "user@example.com", password: "wrong-password" },
          { requestId: `rf${attempt}`, traceId: `tf${attempt}` },
        ),
      /invalid_credentials/,
    );
  }
  await assert.rejects(
    () =>
      service.login(
        { email: "user@example.com", password: "wrong-password" },
        { requestId: "rf3", traceId: "tf3" },
      ),
    /account_locked/,
  );
  repository.users[0].locked_until = null;
  repository.users[0].failed_login_count = 0;
  const login = await service.login(
    { email: "user@example.com", password: "Correct-Horse-42" },
    { requestId: "rl", traceId: "tl", userAgent: "test-browser" },
  );
  assert.ok(login.token);
  assert.notEqual(repository.sessions[0].token_hash, login.token);
  assert.equal((await service.listSessions(login.token))[0].status, "active");
  await service.revokeSession(login.token, repository.sessions[0].id, {
    requestId: "rr",
    traceId: "tr",
  });
  await assert.rejects(() => service.authenticate(login.token), /session_invalid/);
});

test("M01-01.A04/A08 password reset is enumeration-safe, single-use and revokes sessions", async () => {
  const { delivery, service } = fixture();
  await service.register(
    { email: "user@example.com", password: "Correct-Horse-42" },
    { requestId: "r1", traceId: "t1" },
  );
  await service.verifyEmail(delivery.messages[0].token, { requestId: "r2", traceId: "t2" });
  const before = await service.login(
    { email: "user@example.com", password: "Correct-Horse-42" },
    { requestId: "r3", traceId: "t3" },
  );
  assert.deepEqual(
    await service.requestPasswordReset("missing@example.com", { requestId: "r4", traceId: "t4" }),
    { accepted: true },
  );
  assert.deepEqual(
    await service.requestPasswordReset("user@example.com", { requestId: "r5", traceId: "t5" }),
    { accepted: true },
  );
  const reset = delivery.messages.at(-1);
  await service.resetPassword(reset.token, "New-Correct-Horse-43", {
    requestId: "r6",
    traceId: "t6",
  });
  await assert.rejects(() => service.authenticate(before.token), /session_invalid/);
  await assert.rejects(
    () =>
      service.resetPassword(reset.token, "Another-Horse-44", { requestId: "r7", traceId: "t7" }),
    /invalid_or_expired_token/,
  );
  const after = await service.login(
    { email: "user@example.com", password: "New-Correct-Horse-43" },
    { requestId: "r8", traceId: "t8" },
  );
  assert.ok(after.token);
});

test("M01-01.A05 delivery outbox encrypts email and raw action token", async () => {
  const rows = [];
  const delivery = new EncryptedOutboxAuthDelivery(
    { enqueue: async (row) => rows.push(row) },
    "a".repeat(32),
    () => new Date("2026-08-07T00:00:00Z"),
  );
  const message = {
    userId: "user-a",
    kind: "email_verification",
    email: "user@example.com",
    token: "raw-action-token",
    expiresAt: new Date("2026-08-07T00:15:00Z"),
    requestId: "request-a",
    traceId: "trace-a",
  };
  await delivery.deliver(message);
  assert.equal(rows.length, 1);
  assert.doesNotMatch(rows[0].ciphertext.toString("utf8"), /user@example|raw-action-token/);
  assert.deepEqual(openAuthDelivery(rows[0], "a".repeat(32)), message);
  assert.throws(() => openAuthDelivery(rows[0], "b".repeat(32)), /auth_delivery_payload_invalid/);
});

test("M01-01.A04/A05/A16 failed registration delivery removes partial account and permits retry", async () => {
  const repository = new InMemoryAuthRepository();
  const delivery = new EncryptedOutboxAuthDelivery(
    {
      enqueue: async () => {
        throw new Error("outbox_unavailable");
      },
    },
    "a".repeat(32),
  );
  const service = new LocalAuthService({
    repository,
    delivery,
    passwordHasher: createArgon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    policy,
  });
  await assert.rejects(
    () =>
      service.register(
        { email: "retry@example.com", password: "Correct-Horse-42" },
        { requestId: "request-failed", traceId: "trace-failed" },
      ),
    /outbox_unavailable/,
  );
  assert.equal(repository.users.length, 0);
  assert.equal(repository.actionTokens.length, 0);
  assert.equal(repository.securityEvents.at(-1).event_type, "registration.delivery_blocked");
  assert.equal(repository.securityEvents.at(-1).user_id, null);
});
