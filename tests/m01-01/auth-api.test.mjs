import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  LocalAuthService,
  createArgon2PasswordHasher,
} from "../../packages/auth/dist/index.js";

function appFixture(secureCookie = false) {
  const repository = new InMemoryAuthRepository();
  const delivery = new CaptureAuthDelivery();
  let sequence = 0;
  const service = new LocalAuthService({
    repository,
    delivery,
    passwordHasher: createArgon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    policy: {
      passwordMinLength: 12,
      passwordMaxLength: 128,
      sessionTtlMinutes: 43200,
      actionTokenTtlMinutes: 15,
      maxFailedAttempts: 5,
      lockMinutes: 15,
    },
    now: () => new Date("2026-08-07T00:00:00Z"),
    tokenFactory: () => Buffer.alloc(32, ++sequence).toString("base64url"),
  });
  const seen = new Map();
  const execute = async (input, work) => {
    const key = `${input.scope}:${input.route}:${input.method}:${input.key}`;
    if (seen.has(key)) return { ...seen.get(key), replayed: true };
    const result = await work();
    seen.set(key, result);
    return result;
  };
  const idempotency = { execute, executeSensitive: execute };
  return {
    app: buildApp({
      localAuth: {
        service,
        idempotency,
        webOrigin: "http://127.0.0.1:5173",
        secureCookie,
        sessionTtlMinutes: 43200,
      },
    }),
    delivery,
    repository,
  };
}

const headers = (key) => ({ origin: "http://127.0.0.1:5173", "idempotency-key": key });

test("M01-01.A06/A09/A13 API sets HttpOnly session and never returns opaque token", async () => {
  const { app, delivery } = appFixture();
  const registration = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: headers("register-a"),
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  assert.equal(registration.statusCode, 201);
  assert.doesNotMatch(registration.body, /AQEBAQ|password_hash/);
  const verification = await app.inject({
    method: "POST",
    url: "/api/v1/auth/email-verification/confirm",
    headers: headers("verify-a"),
    payload: { token: delivery.messages[0].token },
  });
  assert.equal(verification.statusCode, 200);
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  assert.equal(login.statusCode, 200);
  assert.doesNotMatch(login.body, /AgICAg|token_hash/);
  const cookie = login.headers["set-cookie"];
  assert.match(cookie, /scoutops_session=.*HttpOnly; SameSite=Strict; Max-Age=2592000/);
  assert.doesNotMatch(cookie, /Secure/);
  const anonymousStatus = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session-status",
  });
  assert.equal(anonymousStatus.statusCode, 200);
  assert.deepEqual(anonymousStatus.json().data, { authenticated: false });
  const authenticatedStatus = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session-status",
    headers: { cookie },
  });
  assert.equal(authenticatedStatus.statusCode, 200);
  assert.deepEqual(authenticatedStatus.json().data, { authenticated: true });
  assert.equal(authenticatedStatus.headers["cache-control"], "no-store");
  const sessions = await app.inject({
    method: "GET",
    url: "/api/v1/me/sessions",
    headers: { cookie },
  });
  assert.equal(sessions.statusCode, 200);
  assert.equal(sessions.json().data.length, 1);
  assert.doesNotMatch(sessions.body, /token_hash/);
  await app.close();
});

test("M01-01.A08/A09/A16 API rejects foreign origin, missing idempotency and replayed action token", async () => {
  const { app, delivery } = appFixture(true);
  const forbidden = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { origin: "https://evil.example", "idempotency-key": "bad-origin" },
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "origin_not_allowed");
  const missing = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error.code, "idempotency_key_required");
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: headers("register-b"),
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  const verify = () =>
    app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      headers: headers("verify-b"),
      payload: { token: delivery.messages[0].token },
    });
  assert.equal((await verify()).statusCode, 200);
  const replay = await verify();
  assert.equal(replay.statusCode, 200);
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: "user@example.com", password: "Correct-Horse-42" },
  });
  assert.match(login.headers["set-cookie"], /__Host-scoutops_session=.*Secure/);
  await app.close();
});

test("login accepts the new identifier field for a unique username and keeps legacy email compatibility", async () => {
  const { app, delivery, repository } = appFixture();
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: headers("register-username"),
    payload: { email: "operator@example.com", password: "Correct-Horse-42" },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/email-verification/confirm",
    headers: headers("verify-username"),
    payload: { token: delivery.messages[0].token },
  });
  repository.users[0].username = "运营.Admin";
  repository.users[0].username_normalized = "运营.admin";
  const usernameLogin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { identifier: "运营.ADMIN", password: "Correct-Horse-42" },
  });
  assert.equal(usernameLogin.statusCode, 200, usernameLogin.body);
  assert.equal(usernameLogin.json().data.user.username, "运营.Admin");
  const missing = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { identifier: "missing-user", password: "Correct-Horse-42" },
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, "invalid_credentials");
  assert.equal(missing.json().error.message, "账号或密码不正确。");
  await app.close();
});
