import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";
import { accountReleaseReceipts } from "./account-release-receipts.js";

type AccountCutoverConfig = {
  nodeEnv: string;
  app: Pick<RuntimeConfig["app"], "host">;
  database: Pick<RuntimeConfig["database"], "name" | "host" | "readHost" | "writeHost"> & {
    user?: string;
  };
};

export async function assertAccountCutoverReady(
  config: AccountCutoverConfig,
  db: Pick<Pool, "query">,
  primaryApproverEmail: string,
): Promise<void> {
  if (
    config.nodeEnv !== "production" ||
    config.app.host !== "127.0.0.1" ||
    config.database.name !== "product_scout" ||
    config.database.user !== "product_scout" ||
    config.database.host !== "127.0.0.1" ||
    config.database.readHost ||
    config.database.writeHost
  )
    throw new Error("account_cutover_target_invalid");
  let state: RowDataPacket | undefined;
  try {
    const receiptPairs = accountReleaseReceipts.map(() => "(?,?)").join(",");
    [[state]] = await db.query<RowDataPacket[]>(
      `SELECT
        BINARY DATABASE()=BINARY 'product_scout' AND SUBSTRING_INDEX(VERSION(),'.',2)='5.7' AND (
          SELECT COUNT(*) FROM schema_migrations
          WHERE (BINARY name, BINARY checksum) IN (${receiptPairs})
        ) = ? migration_ready,
        EXISTS (SELECT 1 FROM account_ownership_cutover c
          JOIN account_retirement_runs r ON r.id=c.source_run_id AND r.primary_account_id=c.primary_account_id
          JOIN users u ON u.id=c.primary_account_id
          WHERE c.slot='current' AND c.contract_version=25 AND u.status='active'
            AND u.email_verified_at IS NOT NULL AND BINARY u.email_normalized=BINARY ?) cutover_ready,
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
          AND TABLE_NAME IN ('organizations','workspaces')) runtime_roots,
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
          AND TABLE_NAME IN ('historical_organizations','historical_workspaces')) archive_roots,
        (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
          AND COLUMN_NAME IN ('organization_id','workspace_id')
          AND NOT (TABLE_NAME='historical_workspaces' AND COLUMN_NAME='organization_id')) legacy_columns,
        EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
          AND TABLE_NAME='historical_workspaces' AND COLUMN_NAME='organization_id') verified_archive_column,
        (EXISTS (SELECT 1 FROM crawler_browser_runs run
          LEFT JOIN browser_collection_jobs job ON job.crawler_run_id=run.id
          WHERE run.status='running' AND job.id IS NULL)
          OR EXISTS (SELECT 1 FROM crawler_profile_leases lease
            LEFT JOIN browser_collection_jobs job ON job.crawler_run_id=lease.run_id
            WHERE lease.expires_at>UTC_TIMESTAMP(3) AND job.id IS NULL)) standalone_crawler_inflight`,
      [...accountReleaseReceipts.flat(), accountReleaseReceipts.length, primaryApproverEmail],
    );
  } catch {
    throw new Error("account_cutover_not_ready");
  }
  if (
    !state ||
    Number(state.migration_ready) !== 1 ||
    Number(state.cutover_ready) !== 1 ||
    Number(state.runtime_roots) !== 0 ||
    Number(state.archive_roots) !== 2 ||
    Number(state.legacy_columns) !== 0 ||
    Number(state.verified_archive_column) !== 1
  )
    throw new Error("account_cutover_not_ready");
  if (Number(state.standalone_crawler_inflight) !== 0)
    throw new Error("account_cutover_standalone_crawler_not_drained");
}
