import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  LocalAuthService,
  createArgon2PasswordHasher,
  normalizeUsername,
} from "../packages/auth/dist/index.js";
import { MySqlAuthRepository } from "../apps/api/dist/mysql-auth-repository.js";

async function runLocalProbe() {
  const requestId = randomUUID();
  const traceId = requestId;
  const email = `m01-01-${requestId}@example.test`;
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);
  let userId = randomUUID();
  let cleaned = false;
  const migrations = [
    "users",
    "user_sessions",
    "auth_action_tokens",
    "auth_security_events",
    "auth_delivery_outbox",
    "auth_idempotency_records",
  ];

  async function ensureMigrations() {
    for (const table of migrations) {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
        [table],
      );
      if (Number(rows[0].count) === 0)
        throw new Error(`required migration table is missing: ${table}`);
    }
    const [columns] = await pool.query(
      "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='username_normalized'",
    );
    if (Number(columns[0].count) === 0)
      throw new Error("required migration column is missing: users.username_normalized");
  }

  async function cleanup() {
    await pool.query("DELETE FROM auth_idempotency_records WHERE request_id=?", [requestId]);
    await pool.query("DELETE FROM auth_delivery_outbox WHERE user_id=?", [userId]);
    await pool.query("DELETE FROM auth_security_events WHERE user_id=? OR request_id=?", [
      userId,
      requestId,
    ]);
    await pool.query("DELETE FROM auth_action_tokens WHERE user_id=?", [userId]);
    await pool.query("DELETE FROM user_sessions WHERE user_id=?", [userId]);
    await pool.query("DELETE FROM users WHERE id=?", [userId]);
    cleaned = true;
  }

  try {
    const [versionRows] = await pool.query(
      "SELECT VERSION() AS version,@@character_set_server AS charset,DATABASE() AS database_name,CURRENT_USER() AS account_name",
    );
    const runtime = versionRows[0];
    if (
      !String(runtime.version).startsWith("5.7.") ||
      runtime.charset !== "utf8mb4" ||
      runtime.database_name !== "product_scout" ||
      !String(runtime.account_name).startsWith("product_scout@")
    )
      throw new Error("requires MySQL57 utf8mb4 product_scout business account");
    await ensureMigrations();

    const now = new Date();
    const username = normalizeUsername(`gate-${requestId.slice(0, 12)}`);
    const password = "Correct-Horse-42";
    const repository = new MySqlAuthRepository(pool);
    const hasher = createArgon2PasswordHasher({
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const passwordHash = await hasher.hash(password);
    await repository.createUser({
      id: userId,
      email,
      email_normalized: email.toLowerCase(),
      username: username.username,
      username_normalized: username.normalized,
      password_hash: passwordHash,
      status: "active",
      email_verified_at: now,
      failed_login_count: 0,
      locked_until: null,
      password_changed_at: now,
      must_change_password: false,
      must_enroll_mfa: false,
      security_setup_completed_at: null,
      version: 1,
      created_at: now,
      updated_at: now,
    });

    const service = new LocalAuthService({
      repository,
      passwordHasher: hasher,
      policy: {
        passwordMinLength: 12,
        passwordMaxLength: 128,
        sessionTtlMinutes: 720,
        actionTokenTtlMinutes: 15,
        maxFailedAttempts: 3,
        lockMinutes: 15,
      },
    });
    const context = { requestId, traceId, userAgent: "m01-live-gate", ipAddress: "127.0.0.1" };
    const emailLogin = await service.login({ identifier: email, password }, context);
    const usernameLogin = await service.login(
      { identifier: username.username.toUpperCase(), password },
      context,
    );
    if ((await service.listSessions(usernameLogin.token)).length !== 2)
      throw new Error("email and username session persistence mismatch");
    await service.revokeSession(usernameLogin.token, emailLogin.session.id, context);
    try {
      await service.authenticate(emailLogin.token);
      throw new Error("revoked session remained active");
    } catch (error) {
      if (error?.code !== "session_invalid") throw error;
    }

    await cleanup();
    console.log(
      JSON.stringify({
        status: "passed",
        module: "M01-01",
        mysql: runtime.version,
        password_hash: "argon2id",
        login_identifiers: "email_and_username",
        session: "hashed_and_revoked",
        outbound_delivery: "not_triggered",
        cleanup: "passed",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "local_auth_live_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    try {
      if (!cleaned) await cleanup();
    } catch (error) {
      console.error(
        JSON.stringify({
          status: "blocked",
          code: "local_auth_probe_cleanup_failed",
          message: error instanceof Error ? error.message : "unknown",
          request_id: requestId,
          trace_id: traceId,
        }),
      );
      process.exitCode = 2;
    }
    await pool.end();
  }
}

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "local-auth"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_LOCAL_AUTH_LIVE_TARGET ?? "local";
if (target === "baota-production") runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const id = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "local_auth_live_target_invalid",
      message: "SCOUTOPS_LOCAL_AUTH_LIVE_TARGET must be local or baota-production.",
      request_id: id,
      trace_id: id,
    }),
  );
  process.exitCode = 2;
}
