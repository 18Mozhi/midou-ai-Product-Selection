import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  InMemoryMfaRepository,
  LocalAuthService,
  MfaService,
  createArgon2PasswordHasher,
  generateTotp,
} from "../../packages/auth/dist/index.js";

async function fixture(secureCookie = true) {
  const authRepository = new InMemoryAuthRepository();
  const mfaRepository = new InMemoryMfaRepository();
  const hasher = createArgon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
  let now = new Date("2026-08-07T00:00:00Z");
  let sequence = 0;
  let auth;
  const user = {
    id: "00000000-0000-4000-8000-000000000202",
    email: "api-mfa@example.com",
    email_normalized: "api-mfa@example.com",
    password_hash: await hasher.hash("Correct-Horse-42"),
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
    passwordHasher: hasher,
    masterKey: "k".repeat(32),
    policy: {
      issuer: "ScoutOps",
      periodSeconds: 30,
      digits: 6,
      window: 1,
      challengeTtlMinutes: 5,
      maxAttempts: 3,
      recoveryCodeCount: 8,
    },
    now: () => now,
    tokenFactory: () => Buffer.alloc(32, ++sequence).toString("base64url"),
    completeLogin: (userId, ctx) => auth.completeSecondFactorLogin(userId, ctx),
  });
  auth = new LocalAuthService({
    repository: authRepository,
    delivery: new CaptureAuthDelivery(),
    passwordHasher: hasher,
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
  const seen = new Map();
  const execute = async (input, work) => {
    const key = `${input.route}:${input.key}`;
    if (seen.has(key)) return { ...seen.get(key), replayed: true };
    const result = await work();
    seen.set(key, result);
    return result;
  };
  const sensitiveSeen = new Set();
  const executeSensitive = async (input, work) => {
    const key = `${input.route}:${input.key}`;
    if (sensitiveSeen.has(key)) throw new Error("sensitive_response_replay_unavailable");
    const result = await work();
    sensitiveSeen.add(key);
    return result;
  };
  const idempotency = { execute, executeSensitive };
  const app = buildApp({
    localAuth: {
      service: auth,
      mfa,
      idempotency,
      webOrigin: "http://127.0.0.1:5173",
      secureCookie,
    },
  });
  return {
    app,
    user,
    mfa,
    auth,
    advance: (seconds) => {
      now = new Date(now.getTime() + seconds * 1000);
    },
    now: () => now,
  };
}
const headers = (key, cookie) => ({
  origin: "http://127.0.0.1:5173",
  "idempotency-key": key,
  ...(cookie ? { cookie } : {}),
});

test("M01-02.A06/A09/A13 API uses separate HttpOnly challenge before session", async () => {
  const f = await fixture();
  const direct = await f.auth.login(
    { email: f.user.email, password: "Correct-Horse-42" },
    { requestId: "r0", traceId: "t0" },
  );
  const sessionCookie = `__Host-scoutops_session=${direct.token}`;
  const enroll = await f.app.inject({
    method: "POST",
    url: "/api/v1/me/mfa/totp/enrollment",
    headers: headers("enroll", sessionCookie),
    payload: { current_password: "Correct-Horse-42" },
  });
  assert.equal(enroll.statusCode, 201);
  const secret = enroll.json().data.secret;
  const confirm = await f.app.inject({
    method: "POST",
    url: "/api/v1/me/mfa/totp/confirm",
    headers: headers("confirm", sessionCookie),
    payload: { code: generateTotp(secret, f.now().getTime()) },
  });
  assert.equal(confirm.statusCode, 200);
  assert.equal(confirm.json().data.recovery_codes.length, 8);
  f.advance(30);
  const login = await f.app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: f.user.email, password: "Correct-Horse-42" },
  });
  assert.equal(login.statusCode, 202);
  assert.equal(login.json().data.mfa_required, true);
  assert.match(login.headers["set-cookie"], /__Host-scoutops_mfa_challenge=.*HttpOnly.*Secure/);
  assert.doesNotMatch(login.headers["set-cookie"], /__Host-scoutops_session=/);
  const challengeCookie = login.headers["set-cookie"].split(";")[0];
  const verified = await f.app.inject({
    method: "POST",
    url: "/api/v1/auth/mfa/totp/verify",
    headers: headers("verify", challengeCookie),
    payload: { code: generateTotp(secret, f.now().getTime()) },
  });
  assert.equal(verified.statusCode, 200);
  assert.ok(Array.isArray(verified.headers["set-cookie"]));
  assert.match(verified.headers["set-cookie"].join(";"), /__Host-scoutops_session=.*HttpOnly/);
  assert.match(
    verified.headers["set-cookie"].join(";"),
    /__Host-scoutops_mfa_challenge=;.*Max-Age=0/,
  );
  assert.doesNotMatch(JSON.stringify(verified.json()), /token_hash|challenge_token/);
  await f.app.close();
});

test("M01-02.A08/A09 MFA endpoints require current session and idempotency", async () => {
  const f = await fixture(false);
  const unauth = await f.app.inject({ method: "GET", url: "/api/v1/me/mfa" });
  assert.equal(unauth.statusCode, 401);
  const login = await f.auth.login(
    { email: f.user.email, password: "Correct-Horse-42" },
    { requestId: "r", traceId: "t" },
  );
  const cookie = `scoutops_session=${login.token}`;
  const missing = await f.app.inject({
    method: "POST",
    url: "/api/v1/me/mfa/totp/enrollment",
    headers: { origin: "http://127.0.0.1:5173", cookie },
    payload: { current_password: "Correct-Horse-42" },
  });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error.code, "idempotency_key_required");
  await f.app.close();
});
