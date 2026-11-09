import { realpath } from "node:fs/promises";
import { dirname } from "node:path";
import mysql from "mysql2/promise";
import { COLLECTION_CLAIM_PAUSE_FILE, changeCollectionClaimPause } from "@scoutops/database";

async function main() {
  const [action, maintenanceId, ...rest] = process.argv.slice(2);
  if (
    !["pause", "resume", "status"].includes(action) ||
    rest.length ||
    (action === "status" ? maintenanceId !== undefined : !maintenanceId)
  )
    throw new Error("usage: collection-claim-maintenance.mjs status | pause UUID | resume UUID");
  const env = process.env;
  if (
    env.NODE_ENV !== "production" ||
    env.DB_HOST !== "127.0.0.1" ||
    env.DB_NAME !== "product_scout" ||
    env.DB_USER !== "product_scout" ||
    !env.DB_PASSWORD ||
    process.cwd() !== "/www/wwwroot/ai选品/backend" ||
    (await realpath(dirname(COLLECTION_CLAIM_PAUSE_FILE))) !== dirname(COLLECTION_CLAIM_PAUSE_FILE)
  )
    throw new Error("collection_claim_maintenance_identity_mismatch");
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectTimeout: 5000,
  });
  try {
    console.log(
      JSON.stringify({
        action,
        ...(await changeCollectionClaimPause(
          connection,
          COLLECTION_CLAIM_PAUSE_FILE,
          action,
          maintenanceId,
        )),
      }),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    /^collection_claim_/.test(error?.message)
      ? error.message
      : "collection_claim_maintenance_failed",
  );
  process.exitCode = 1;
});
