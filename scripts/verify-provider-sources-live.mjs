import { randomUUID } from "node:crypto";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createRedisConnection, ScopedRedisStore } from "../packages/redis/dist/index.js";
import { ProviderAdapterRegistry } from "../packages/provider-adapters/dist/index.js";
import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  GoogleNewsRssAdapter,
  createProviderSourceFetch,
  parseGoogleNewsRss,
} from "../packages/provider-sources/dist/index.js";
import { ProviderSourceService } from "../apps/api/dist/provider-source-service.js";
import { MySqlProviderSourceRepository } from "../apps/api/dist/mysql-provider-source-repository.js";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const requestId = randomUUID(),
  traceId = randomUUID(),
  now = new Date(),
  config = loadRuntimeConfig(process.env, "worker"),
  providerFetch = createProviderSourceFetch(
    config.providerAdapters.proxy,
    {},
    AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  ),
  pool = createDatabasePool(config),
  redisClient = createRedisConnection(config),
  store = new ScopedRedisStore(redisClient),
  runFile = promisify(execFile);
async function googleXml() {
  const url = "https://news.google.com/rss/search?q=product%20innovation&hl=en-US&gl=US&ceid=US:en";
  try {
    const response = await providerFetch(url, {
      redirect: "error",
      headers: {
        accept: "application/rss+xml, application/xml;q=0.9",
        "user-agent": "ScoutOps/0.1 live-admission",
      },
    });
    if (!response.ok || !/(xml|rss)/i.test(response.headers.get("content-type") ?? ""))
      throw new Error(`google news probe failed ${response.status}`);
    return {
      xml: await response.text(),
      transport: config.providerAdapters.proxy ? "project-http-connect" : "node-fetch",
    };
  } catch (first) {
    if (config.providerAdapters.proxy || process.platform !== "win32") throw first;
    const command = `$ProgressPreference='SilentlyContinue';$r=Invoke-WebRequest -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -Headers @{Accept='application/rss+xml, application/xml;q=0.9';'User-Agent'='ScoutOps/0.1 live-admission'} -Uri '${url}';if($r.StatusCode-ne 200-or $r.RawContentLength-gt 2000000-or $r.Headers['Content-Type']-notmatch 'xml|rss'){throw 'google news contract failed'};[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($r.Content))`;
    const { stdout } = await runFile("powershell", ["-NoProfile", "-Command", command], {
      maxBuffer: 3_000_000,
      timeout: 40000,
    });
    return {
      xml: Buffer.from(stdout.trim(), "base64").toString("utf8"),
      transport: "windows-http",
    };
  }
}
async function ensure() {
  const sql = await readFile("database/migrations/0016g_provider_sources_m03_07.up.sql", "utf8");
  for (const statement of sql
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean)) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    if (!table) throw new Error("unexpected migration statement");
    const [rows] = await pool.query(
      "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (Number(rows[0].count) === 0)
      throw new Error(`required migration table is missing: ${table}`);
  }
}
try {
  const [versions] = await pool.query(
      "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
    ),
    runtime = versions[0];
  if (
    !String(runtime.version).startsWith("5.7.") ||
    runtime.charset !== "utf8mb4" ||
    runtime.database_name !== "product_scout" ||
    !String(runtime.account_name).startsWith("product_scout@")
  )
    throw new Error("requires MySQL57 utf8mb4 product_scout business account");
  await store.connect();
  const health = await store.health(requestId, traceId);
  if (health.status !== "available") throw new Error("redis unavailable");
  await ensure();
  const repository = new MySqlProviderSourceRepository(pool),
    service = new ProviderSourceService(repository, () => now),
    catalog = await service.list(),
    googleSource = catalog.find((item) => item.code === "google_news_search");
  if (!googleSource) throw new Error("google_news_source_unavailable");
  const policyRows = googleSource.provisioned
      ? await pool.query(
          "SELECT terms_review_status,terms_reference_url,terms_version,terms_expires_at FROM providers WHERE id=?",
          [googleSource.provisioned.id],
        )
      : [[]],
    policy = policyRows[0][0],
    termsApproved = Boolean(
      policy &&
      policy.terms_review_status === "approved" &&
      policy.terms_reference_url &&
      policy.terms_version &&
      policy.terms_expires_at &&
      new Date(policy.terms_expires_at) > now,
    ),
    publicExecutionAllowed = googleSource.provisioned?.status === "enabled" && termsApproved;
  let live = null,
    news = [],
    normalized = [];
  if (publicExecutionAllowed) {
    live = await googleXml();
    news = parseGoogleNewsRss(live.xml, 1);
    if (!news.length) throw new Error("google news parser returned empty");
    const registry = new ProviderAdapterRegistry({
      healthTimeoutMs: 10000,
      maxResponseBytes: 5242880,
      maxItemsPerBatch: 500,
    });
    registry.register(
      new GoogleNewsRssAdapter(
        async () =>
          new Response(live.xml, { status: 200, headers: { "content-type": "application/xml" } }),
      ),
    );
    const context = {
        requestId,
        traceId,
        organizationId: randomUUID(),
        workspaceId: randomUUID(),
      },
      batch = await registry.collect({
        ...context,
        provider: {
          id: googleSource.provisioned.id,
          code: googleSource.code,
          accessMode: googleSource.access_mode,
          targetUrl: googleSource.target_url,
          parserVersion: googleSource.parser_version,
          timeoutMs: googleSource.timeout_ms,
          fields: googleSource.fields,
        },
        target: { query: "product innovation" },
        limit: 1,
      });
    if (!batch.records.length) throw new Error("google news adapter returned empty");
    normalized = batch.records.map((record) =>
      registry.normalize(googleSource.code, record, {
        ...context,
        provider: {
          id: googleSource.provisioned.id,
          code: googleSource.code,
          accessMode: googleSource.access_mode,
          targetUrl: googleSource.target_url,
          parserVersion: googleSource.parser_version,
          timeoutMs: googleSource.timeout_ms,
          fields: googleSource.fields,
        },
      }),
    );
  }
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M03-07",
      mysql: runtime.version,
      redis: "available",
      schema_preflight: "read_only",
      google_news_provisioned: Boolean(googleSource.provisioned),
      google_news_status: googleSource.provisioned?.status ?? "not_provisioned",
      google_policy: termsApproved ? "approved" : "owner_review_required",
      public_execution: publicExecutionAllowed ? "passed" : "skipped_policy_gate",
      google_news_endpoint: publicExecutionAllowed ? "reachable_xml" : "not_requested",
      google_news_transport: live?.transport ?? "not_requested",
      google_news_sample_count: news.length,
      google_news_normalized_records: normalized.length,
      database_writes: 0,
      unrelated_tasks_processed: 0,
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "provider_sources_live_failed",
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await store.close();
  await pool.end();
}
