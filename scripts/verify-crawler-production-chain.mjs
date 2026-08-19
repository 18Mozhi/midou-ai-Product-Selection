import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    [
      "apps/crawler/scoutops_crawler/__main__.py",
      "apps/crawler/scoutops_crawler/runtime_client.py",
      "apps/crawler/scoutops_crawler/playwright_bridge.py",
      "apps/crawler/scoutops_crawler/config.py",
      "apps/api/src/crawler-runtime-routes.ts",
      "apps/api/src/mysql-crawler-runtime-repository.ts",
      "apps/api/src/mysql-credential-asset-repository.ts",
      "apps/worker/src/authenticated-browser-job-client.ts",
      "apps/worker/src/provider-source-executor.ts",
      "scripts/run-playwright-crawler.mjs",
      "database/migrations/0048_browser_collection_jobs.up.sql",
      "database/migrations/0049_credential_renewal_auto_replay.up.sql",
      "database/migrations/0050_browser_evidence_artifacts.up.sql",
      "database/migrations/0051a_provider_parser_samples.up.sql",
      "database/migrations/0051b_provider_parser_sample_replay_runs.up.sql",
      "database/migrations/0051c_provider_parser_sample_operations.up.sql",
    ].map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);
const all = Object.values(files).join("\n");
for (const token of [
  "/internal/crawler-runtime/jobs/acquire",
  "/heartbeat",
  "/complete",
  "browser_collection_jobs",
  "collection_subquery_id",
  "PlaywrightBridge(config).run",
  "subprocess.run",
  "run-playwright-crawler.mjs",
  "runWithEncryptedProfile",
  "lease_token",
  "automatically_replayed",
  "task.credential_renewal_completed",
  "browser_evidence_artifacts",
  "dom_fragment",
  "screenshot",
  "parser_version",
  "provider_parser_samples",
  "provider_parser_sample_replay_runs",
  "idempotency_key",
]) {
  if (!all.includes(token)) throw new Error(`crawler_chain_missing:${token}`);
}
if (/event\([^\n]+idle[^\n]+heartbeat/i.test(all))
  throw new Error("crawler_idle_heartbeat_forbidden");
if (/CRAWLER_EXECUTION_REQUEST_FILE|execution_request_file|last_request_digest/.test(all))
  throw new Error("crawler_static_request_forbidden");
console.log("crawler_production_chain_passed");
