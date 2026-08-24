import { randomUUID } from "node:crypto";
import { loadPlatformSeedConfig, loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createArgon2PasswordHasher } from "../packages/auth/dist/index.js";
import { SeedAdminService } from "../packages/audit/dist/index.js";
import { MySqlAuditRepository } from "../apps/api/dist/mysql-audit-repository.js";
import { MySqlProviderSourceRepository } from "../apps/api/dist/mysql-provider-source-repository.js";
import { ProviderSourceService } from "../apps/api/dist/provider-source-service.js";
const requestId = randomUUID(),
  traceId = requestId;
let pool;
try {
  const seed = loadPlatformSeedConfig(process.env),
    runtime = loadRuntimeConfig(process.env, "api");
  pool = createDatabasePool(runtime);
  const service = new SeedAdminService(
    new MySqlAuditRepository(pool),
    createArgon2PasswordHasher({
      memoryCost: runtime.auth.argon2MemoryKib,
      timeCost: runtime.auth.argon2TimeCost,
      parallelism: runtime.auth.argon2Parallelism,
    }),
  );
  const result = await service.seed({ ...seed, requestId, traceId });
  const sourceCatalog = await new ProviderSourceService(
    new MySqlProviderSourceRepository(pool),
  ).ensureCatalog();
  console.log(
    JSON.stringify({
      status: result.status,
      module: "M01-06",
      user_id: result.userId,
      forced_password_change: true,
      forced_mfa_enrollment: true,
      source_catalog: sourceCatalog,
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "platform_seed_failed",
      message: error instanceof Error ? error.message : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await pool?.end();
}
