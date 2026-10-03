import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createArgon2PasswordHasher } from "../packages/auth/dist/index.js";
import { AuditQueryService, SeedAdminService } from "../packages/audit/dist/index.js";
import { MySqlAuditRepository } from "../apps/api/dist/mysql-audit-repository.js";

async function runLocalProbe() {
  const requestId = randomUUID();
  const traceId = requestId;
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);

  async function assertSchema() {
    const [tables] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() " +
        "AND table_name IN ('platform_audit_events','platform_role_assignments','platform_seed_runs','user_mfa_factors')",
    );
    const tableNames = new Set(tables.map((row) => String(row.table_name)));
    for (const name of [
      "platform_audit_events",
      "platform_role_assignments",
      "platform_seed_runs",
      "user_mfa_factors",
    ]) {
      if (!tableNames.has(name)) throw new Error("M01-06 migrations are not deployed");
    }

    const [columns] = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() " +
        "AND table_name='users' AND column_name IN " +
        "('must_change_password','must_enroll_mfa','security_setup_completed_at')",
    );
    if (columns.length !== 3) throw new Error("M01-06 user-security columns are not deployed");
  }

  try {
    const [versionRows] = await pool.query(
      "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
    );
    const runtime = versionRows[0];
    if (
      !String(runtime.version).startsWith("5.7.") ||
      runtime.charset !== "utf8mb4" ||
      runtime.database_name !== "product_scout" ||
      !String(runtime.account_name).startsWith("product_scout@")
    ) {
      throw new Error("requires MySQL57 utf8mb4 product_scout business account");
    }

    await assertSchema();
    const [seedRows] = await pool.query(
      "SELECT status,user_id,email_hash,request_id,trace_id,completed_at " +
        "FROM platform_seed_runs WHERE seed_key='platform-super-admin-v1'",
    );
    const seed = seedRows[0];
    if (!seed || seed.status !== "completed" || !seed.user_id)
      throw new Error("production platform seed is not completed; no seed write was attempted");
    if (
      !/^[0-9a-f]{64}$/i.test(String(seed.email_hash ?? "")) ||
      !seed.request_id ||
      !seed.trace_id ||
      !seed.completed_at
    ) {
      throw new Error("completed platform seed metadata is incomplete");
    }

    const repository = new MySqlAuditRepository(pool);
    const seedService = new SeedAdminService(
      repository,
      createArgon2PasswordHasher({
        memoryCost: config.auth.argon2MemoryKib,
        timeCost: config.auth.argon2TimeCost,
        parallelism: config.auth.argon2Parallelism,
      }),
    );
    const replay = await seedService.seed({
      email: "read-only-seed-probe@example.test",
      password: "Not-Persisted-ReadOnly-123!",
      requestId,
      traceId,
    });
    if (replay.status !== "already_seeded" || replay.userId !== String(seed.user_id))
      throw new Error("completed platform seed did not remain idempotent");

    const [userRows] = await pool.query(
      "SELECT status,must_change_password,must_enroll_mfa,security_setup_completed_at " +
        "FROM users WHERE id=?",
      [seed.user_id],
    );
    const user = userRows[0];
    if (!user || user.status !== "active") throw new Error("seed administrator is not active");
    const mustChangePassword = Number(user.must_change_password) === 1;
    const mustEnrollMfa = Number(user.must_enroll_mfa) === 1;
    const setupCompleted = user.security_setup_completed_at !== null;
    const [mfaRows] = await pool.query(
      "SELECT COUNT(*) count FROM user_mfa_factors WHERE user_id=? AND status='enabled'",
      [seed.user_id],
    );
    const enabledMfaFactors = Number(mfaRows[0]?.count ?? 0);
    const setupIsConsistent = setupCompleted
      ? !mustChangePassword && !mustEnrollMfa && enabledMfaFactors === 1
      : mustChangePassword && mustEnrollMfa && enabledMfaFactors === 0;
    if (!setupIsConsistent) throw new Error("seed security setup state is inconsistent");

    const [roleRows] = await pool.query(
      "SELECT role_code FROM platform_role_assignments WHERE user_id=?",
      [seed.user_id],
    );
    if (roleRows.length !== 1 || roleRows[0].role_code !== "platform_super_admin")
      throw new Error("completed seed must have exactly one platform super-admin role");

    const auditPage = await new AuditQueryService(repository).list({
      action: "platform_admin.seeded",
      requestId: String(seed.request_id),
      traceId: String(seed.trace_id),
      limit: 10,
    });
    const events = auditPage.items.filter((item) => item.actor_id === String(seed.user_id));
    const event = events[0];
    if (
      events.length !== 1 ||
      !event ||
      event.outcome !== "succeeded" ||
      event.organization_id !== null ||
      event.workspace_id !== null ||
      event.metadata.email_hash !== seed.email_hash ||
      event.metadata.role_code !== "platform_super_admin" ||
      event.metadata.forced_security_setup !== true ||
      JSON.stringify(event.metadata).includes("@") ||
      JSON.stringify(event.metadata).toLowerCase().includes("password")
    ) {
      throw new Error("completed seed lacks one sanitized correlated audit event");
    }

    console.log(
      JSON.stringify({
        status: "passed",
        module: "M01-06",
        mysql: runtime.version,
        seed: "completed_read_only_idempotent",
        security_setup: setupCompleted ? "password_and_totp_complete" : "required_before_access",
        audit: "sanitized_cursor_query",
        writes: 0,
        request_id: requestId,
        trace_id: traceId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: error?.code ?? "audit_seed_live_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "audit-seed"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_AUDIT_SEED_LIVE_TARGET ?? "local";
if (target === "baota-production") runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const id = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "audit_seed_live_target_invalid",
      message: "SCOUTOPS_AUDIT_SEED_LIVE_TARGET must be local or baota-production.",
      request_id: id,
      trace_id: id,
    }),
  );
  process.exitCode = 2;
}
