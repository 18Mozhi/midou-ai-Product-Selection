import test from "node:test";
import assert from "node:assert/strict";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  InMemoryMfaRepository,
  LocalAuthService,
  MfaService,
  createArgon2PasswordHasher,
  encodeBase32,
  generateTotp,
  identityAdapterCapabilities,
} from "../../packages/auth/dist/index.js";

const policy = {
  issuer: "ScoutOps",
  periodSeconds: 30,
  digits: 6,
  window: 1,
  challengeTtlMinutes: 5,
  maxAttempts: 3,
  recoveryCodeCount: 8,
};
const context = { requestId: "request-mfa", traceId: "trace-mfa", userAgent: "test-browser" };
async function fixture() {
  const authRepository = new InMemoryAuthRepository();
  const mfaRepository = new InMemoryMfaRepository();
  const passwordHasher = createArgon2PasswordHasher({
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  let now = new Date("2026-08-07T00:00:00Z");
  let sequence = 0;
  let localAuth;
  const user = {
    id: "00000000-0000-4000-8000-000000000102",
    email: "mfa@example.com",
    email_normalized: "mfa@example.com",
    password_hash: await passwordHasher.hash("Correct-Horse-42"),
    status: "active",
    email_verified_at: now,
    failed_login_count: 0,
    locked_until: null,
    password_changed_at: now,
    version: 1,
    created_at: now,
    updated_at: now,
  };
  authRepository.users.push(user);
  const mfa = new MfaService({
    repository: mfaRepository,
    authRepository,
    passwordHasher,
    masterKey: "m".repeat(32),
    policy,
    now: () => now,
    tokenFactory: () => Buffer.alloc(32, ++sequence).toString("base64url"),
    completeLogin: (userId, ctx) => localAuth.completeSecondFactorLogin(userId, ctx),
  });
  localAuth = new LocalAuthService({
    repository: authRepository,
    delivery: new CaptureAuthDelivery(),
    passwordHasher,
    secondFactorGate: mfa,
    policy: {
      passwordMinLength: 12,
      passwordMaxLength: 128,
      sessionTtlMinutes: 720,
      actionTokenTtlMinutes: 15,
      maxFailedAttempts: 3,
      lockMinutes: 15,
    },
    now: () => now,
    tokenFactory: () => Buffer.alloc(32, ++sequence).toString("base64url"),
  });
  return {
    authRepository,
    mfaRepository,
    passwordHasher,
    user,
    mfa,
    localAuth,
    get now() {
      return now;
    },
    advance(seconds) {
      now = new Date(now.getTime() + seconds * 1000);
    },
  };
}

test("M01-02.A02/A12 RFC6238 SHA1 vectors remain exact", () => {
  const secret = encodeBase32(Buffer.from("12345678901234567890"));
  for (const [seconds, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])
    assert.equal(generateTotp(secret, seconds * 1000, 30, 8), expected);
});

test("M01-02.A04/A09/A12 enrolls encrypted TOTP, gates login and rejects replay", async () => {
  const f = await fixture();
  const enrollment = await f.mfa.startEnrollment(f.user, "Correct-Horse-42", context);
  assert.match(enrollment.otpauth_uri, /^otpauth:\/\/totp\//);
  assert.doesNotMatch(
    f.mfaRepository.factors[0].secret_ciphertext.toString(),
    new RegExp(enrollment.secret),
  );
  const firstCode = generateTotp(enrollment.secret, f.now.getTime());
  const confirmed = await f.mfa.confirmEnrollment(f.user.id, firstCode, context);
  assert.equal(confirmed.recovery_codes.length, 8);
  f.advance(30);
  const login = await f.localAuth.login(
    { identifier: f.user.email, password: "Correct-Horse-42" },
    context,
  );
  assert.equal(login.mfa_required, true);
  assert.equal(f.authRepository.sessions.length, 0);
  const code = generateTotp(enrollment.secret, f.now.getTime());
  const completed = await f.mfa.verifyLogin(login.challenge_token, code, context);
  assert.ok(completed.token);
  assert.equal(f.authRepository.sessions.length, 1);
  await assert.rejects(
    () => f.mfa.verifyLogin(login.challenge_token, code, context),
    /mfa_challenge_invalid/,
  );
});

test("M01-02.A08/A12/A16 recovery codes are single-use and attempts lock a challenge", async () => {
  const f = await fixture();
  const enrollment = await f.mfa.startEnrollment(f.user, "Correct-Horse-42", context);
  const confirmed = await f.mfa.confirmEnrollment(
    f.user.id,
    generateTotp(enrollment.secret, f.now.getTime()),
    context,
  );
  f.advance(30);
  const first = await f.localAuth.login(
    { identifier: f.user.email, password: "Correct-Horse-42" },
    context,
  );
  for (let i = 0; i < 2; i += 1)
    await assert.rejects(
      () => f.mfa.verifyLogin(first.challenge_token, "000000", context),
      /mfa_code_invalid/,
    );
  await assert.rejects(
    () => f.mfa.verifyLogin(first.challenge_token, "000000", context),
    /mfa_challenge_locked/,
  );
  const second = await f.localAuth.login(
    { identifier: f.user.email, password: "Correct-Horse-42" },
    context,
  );
  await f.mfa.verifyLogin(second.challenge_token, confirmed.recovery_codes[0], context);
  const third = await f.localAuth.login(
    { identifier: f.user.email, password: "Correct-Horse-42" },
    context,
  );
  await assert.rejects(
    () => f.mfa.verifyLogin(third.challenge_token, confirmed.recovery_codes[0], context),
    /mfa_code_invalid/,
  );
});

test("M01-02.A01/A13/A16 identity adapters cannot activate an unapproved provider", async () => {
  assert.deepEqual(
    identityAdapterCapabilities().map(({ protocol, status }) => [protocol, status]),
    [
      ["oidc", "adapter_ready"],
      ["saml2", "reserved_disabled"],
      ["scim2", "reserved_disabled"],
    ],
  );
});
