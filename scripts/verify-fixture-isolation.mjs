import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createRedisProbeConnection } from "../packages/redis/dist/index.js";

const env = process.env,
  marker = env.VERIFY_ISOLATION_ID;
const dedicated = (prefix, standard) => {
  const port = Number(env[`${prefix}_PORT`]);
  return (
    env[`${prefix}_HOST`] === "127.0.0.1" &&
    /^[0-9]{4,5}$/.test(env[`${prefix}_PORT`] ?? "") &&
    port > 1024 &&
    port < 65536 &&
    port !== standard &&
    (env[`${prefix}_PASSWORD`] ?? "").length >= 24
  );
};
if (
  !/^[a-f0-9]{32}$/.test(marker ?? "") ||
  !dedicated("DB", 3306) ||
  !dedicated("REDIS", 6379) ||
  Number(env.DB_PORT) === Number(env.REDIS_PORT) ||
  env.DB_NAME !== "product_scout" ||
  env.DB_USER !== "product_scout" ||
  env.DB_READ_HOST ||
  env.DB_WRITE_HOST
) {
  console.error(JSON.stringify({ status: "blocked", code: "fixture_isolation_config" }));
  process.exit(2);
}
const config = loadRuntimeConfig(env, "api"),
  db = createDatabasePool(config),
  redis = createRedisProbeConnection(config);
redis.on("error", () => {});
try {
  const [[identity]] = await db.query("SELECT VERSION() v, DATABASE() db, CURRENT_USER() account"),
    [markers] = await db.execute("SELECT name FROM schema_migrations WHERE name=?", [
      `scoutops-isolated-${marker}`,
    ]);
  await redis.connect();
  if (
    !String(identity.v).startsWith("5.7.") ||
    identity.db !== "product_scout" ||
    !String(identity.account).startsWith("product_scout@") ||
    markers.length !== 1 ||
    (await redis.get(`scoutops:verify-isolation:${marker}`)) !== marker
  )
    throw Error("fixture store attestation failed");
  console.log(JSON.stringify({ status: "passed", fixture_isolation: "local_loopback_attested" }));
} catch {
  console.error(JSON.stringify({ status: "blocked", code: "fixture_isolation_attestation" }));
  process.exitCode = 2;
} finally {
  try {
    await db.end();
  } finally {
    if (redis.isOpen) await redis.quit();
  }
}
