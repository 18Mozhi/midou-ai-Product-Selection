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
      "apps/worker/src/authenticated-browser-job-client.ts",
      "apps/worker/src/provider-source-executor.ts",
      "scripts/run-playwright-crawler.mjs",
      "database/migrations/0048_browser_collection_jobs.up.sql",
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
]) {
  if (!all.includes(token)) throw new Error(`crawler_chain_missing:${token}`);
}
if (/event\([^\n]+idle[^\n]+heartbeat/i.test(all))
  throw new Error("crawler_idle_heartbeat_forbidden");
if (/CRAWLER_EXECUTION_REQUEST_FILE|execution_request_file|last_request_digest/.test(all))
  throw new Error("crawler_static_request_forbidden");
console.log("crawler_production_chain_passed");
