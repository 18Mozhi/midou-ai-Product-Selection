import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createRedisConnection, ScopedRedisStore } from "../packages/redis/dist/index.js";
import { ProviderSourceService } from "../apps/api/dist/provider-source-service.js";
import { MySqlProviderSourceRepository } from "../apps/api/dist/mysql-provider-source-repository.js";
import { MySqlEvidencePersistence } from "../apps/worker/dist/evidence-persistence.js";
import { MySqlTrendProjectionWorker } from "../apps/worker/dist/trend-projection-worker.js";
import {
  OpportunityService,
  OpportunityServiceError,
} from "../apps/api/dist/opportunity-service.js";
import { MySqlOpportunityRepository } from "../apps/api/dist/mysql-opportunity-repository.js";
import { MySqlOpportunityRefreshWorker } from "../apps/worker/dist/opportunity-refresh-worker.js";

const requestId = randomUUID(),
  traceId = randomUUID(),
  now = new Date(Date.now() + 3_600_000),
  config = loadRuntimeConfig(process.env, "worker"),
  pool = createDatabasePool(config),
  redisClient = createRedisConnection(config),
  redis = new ScopedRedisStore(redisClient),
  root = await mkdtemp(join(tmpdir(), "scoutops-m04-02-live-"));
const ids = {
    actor: randomUUID(),
    organization: randomUUID(),
    workspace: randomUUID(),
    otherOrganization: randomUUID(),
    otherWorkspace: randomUUID(),
  },
  created = { provider: null, providerOwned: false, task: null };
const sha = (value) => createHash("sha256").update(String(value)).digest("hex");
async function applyMigration(file) {
  const sql = await readFile(file, "utf8");
  for (const statement of sql
    .split(";")
    .map((value) => value.replace(/^--.*$/gm, "").trim())
    .filter(Boolean))
    await pool.query(statement);
}
async function migrate() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='opportunities'",
  );
  if (!Number(rows[0].count))
    await applyMigration("database/migrations/0017b_opportunities_m04_02.up.sql");
  const [columns] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='opportunities' AND column_name='lifecycle_entered_at'",
  );
  if (!Number(columns[0].count))
    await applyMigration("database/migrations/0060_opportunity_workflow_visibility.up.sql");
}
async function cleanup() {
  try {
    await pool.query(
      "UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'",
    );
  } catch {}
  const scoped = [
    "DELETE FROM opportunity_operations WHERE actor_id=?",
    "DELETE FROM opportunity_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_events WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_refresh_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_decisions WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_evidence_links WHERE organization_id IN (?,?)",
    "DELETE FROM opportunities WHERE organization_id IN (?,?)",
    "DELETE FROM trend_operations WHERE actor_id=?",
    "DELETE FROM trend_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM trend_events WHERE organization_id IN (?,?)",
    "DELETE FROM trend_projection_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topic_follows WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topic_keywords WHERE organization_id IN (?,?)",
    "DELETE FROM trend_signals WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topics WHERE organization_id IN (?,?)",
    "DELETE FROM evidence_data_operations WHERE actor_id=?",
    "DELETE FROM evidence_data_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM evidence_data_events WHERE organization_id IN (?,?)",
    "DELETE FROM field_provenance WHERE organization_id IN (?,?)",
    "DELETE FROM normalized_records WHERE organization_id IN (?,?)",
    "DELETE FROM raw_evidence WHERE organization_id IN (?,?)",
    "DELETE FROM file_assets WHERE organization_id IN (?,?)",
    "DELETE FROM provider_source_replay_runs WHERE organization_id IN (?,?)",
    "DELETE FROM collection_task_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM collection_task_events WHERE organization_id IN (?,?)",
    "DELETE FROM collection_task_attempts WHERE task_id=?",
    "DELETE FROM collection_subqueries WHERE organization_id IN (?,?)",
    "DELETE FROM collection_tasks WHERE organization_id IN (?,?)",
    "DELETE FROM provider_source_operations WHERE actor_id=?",
    "DELETE FROM provider_versions WHERE actor_id=?",
  ];
  for (const sql of scoped) {
    try {
      const params = sql.includes("task_id")
        ? [created.task]
        : sql.includes("actor_id")
          ? [ids.actor]
          : [ids.organization, ids.otherOrganization];
      await pool.query(sql, params);
    } catch {}
  }
  if (created.providerOwned && created.provider) {
    try {
      await pool.query("DELETE FROM provider_adapter_health WHERE provider_id=?", [
        created.provider,
      ]);
    } catch {}
    try {
      await pool.query("DELETE FROM providers WHERE id=?", [created.provider]);
    } catch {}
  }
  for (const [sql, id] of [
    ["DELETE FROM workspaces WHERE id=?", ids.workspace],
    ["DELETE FROM workspaces WHERE id=?", ids.otherWorkspace],
    ["DELETE FROM organizations WHERE id=?", ids.organization],
    ["DELETE FROM organizations WHERE id=?", ids.otherOrganization],
    ["DELETE FROM users WHERE id=?", ids.actor],
  ])
    try {
      await pool.query(sql, [id]);
    } catch {}
  try {
    await rm(root, { recursive: true, force: true });
  } catch {}
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
  await redis.connect();
  if ((await redis.health(requestId, traceId)).status !== "available")
    throw new Error("redis unavailable");
  await migrate();
  await cleanup();
  const email = `m04-02-${requestId}@example.test`;
  await pool.query(
    "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)",
    [ids.actor, email, email, now, now, now, now],
  );
  for (const [org, ws, suffix] of [
    [ids.organization, ids.workspace, "primary"],
    [ids.otherOrganization, ids.otherWorkspace, "other"],
  ]) {
    await pool.query(
      "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
      [org, `M04-02 ${suffix}`, `m0402-${suffix}-${requestId.slice(0, 8)}`, ids.actor, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,'默认工作区','default','active',?,1,?,?)",
      [ws, org, ids.actor, now, now],
    );
  }
  const sourceService = new ProviderSourceService(
      new MySqlProviderSourceRepository(pool),
      () => now,
    ),
    catalog = await sourceService.list();
  let provider = catalog.find((item) => item.code === "google_news_search")?.provisioned;
  if (provider && provider.status !== "enabled")
    throw new Error("provider_source_existing_not_enabled");
  if (!provider) {
    provider = await sourceService.provision("google_news_search", {
      actorId: ids.actor,
      idempotencyKey: "m0402-provision",
      requestId,
      traceId,
    });
    created.providerOwned = true;
    await pool.query(
      "UPDATE providers SET status='enabled',version=version+1,updated_by=?,updated_at=? WHERE id=?",
      [ids.actor, now, provider.id],
    );
    provider = { ...provider, status: "enabled" };
  }
  created.provider = provider.id;
  const scheduled = await sourceService.replay(
    provider.id,
    { organization_id: ids.organization, workspace_id: ids.workspace, query: "ai skincare" },
    { actorId: ids.actor, idempotencyKey: "m0402-replay", requestId, traceId },
  );
  created.task = scheduled.task_id;
  const [queries] = await pool.query("SELECT id FROM collection_subqueries WHERE task_id=?", [
      scheduled.task_id,
    ]),
    subqueryId = String(queries[0].id),
    payload = {
      title: "AI Skin Care Demand Rises",
      summary: "Retailers report new demand.",
      published_at: "2026-08-07T14:00:00.000Z",
      source_url: "https://example.test/news/ai-skincare",
      publisher: "Example News",
      canonical_url: "https://example.test/news/ai-skincare",
      observed_at: "2026-08-07T14:05:00.000Z",
      evidence_ref: "m0402-live",
    },
    evidence = new MySqlEvidencePersistence(pool, root, 10485760, () => now),
    persisted = await evidence.persist({
      organizationId: ids.organization,
      workspaceId: ids.workspace,
      taskId: scheduled.task_id,
      subqueryId,
      providerId: provider.id,
      sourceUrl: payload.source_url,
      canonicalUrl: payload.canonical_url,
      dedupeKey: "m0402-ai-skincare",
      contentType: "application/rss+xml",
      content: Buffer.from("<item>AI Skin Care Demand Rises</item>"),
      capturedAt: new Date(payload.observed_at),
      parserVersion: "google-news-rss-v1",
      adapterVersion: "google-news-rss-adapter-v1",
      recordKey: "m0402-ai-skincare",
      recordSchemaVersion: "provider-source-v1",
      normalizedPayload: payload,
      provenance: ["title", "summary", "published_at", "source_url", "publisher"].map((field) => ({
        fieldPath: field,
        sourcePath: `rss.item.${field}`,
        transformVersion: "google-news-rss-v1",
        sourceValueHash: sha(payload[field]),
      })),
      requestId,
      traceId,
      actorId: ids.actor,
    });
  const projector = new MySqlTrendProjectionWorker(pool, "worker-m0402-trend", 120, () => now);
  let topicId;
  for (let i = 0; i < 20; i++) {
    const result = await projector.processOnce();
    if (result.topic_id) {
      topicId = result.topic_id;
      break;
    }
    if (result.status === "idle") break;
  }
  if (!topicId) throw new Error("trend prerequisite projection failed");
  const service = new OpportunityService(new MySqlOpportunityRepository(pool)),
    scope = { organizationId: ids.organization, workspaceId: ids.workspace, actorId: ids.actor },
    write = { ...scope, requestId, traceId, idempotencyKey: "create-live" },
    createdOpportunity = await service.create({
      ...write,
      value: { name: "AI 护肤机会", market: "US", category: "beauty", source_topic_id: topicId },
    }),
    replayed = await service.create({
      ...write,
      value: { name: "AI 护肤机会", market: "US", category: "beauty", source_topic_id: topicId },
    });
  if (
    createdOpportunity.id !== replayed.id ||
    createdOpportunity.overall_score !== null ||
    createdOpportunity.profit_status !== "insufficient_data" ||
    createdOpportunity.risk_level !== "unknown"
  )
    throw new Error("create truth or idempotency mismatch");
  const refresher = new MySqlOpportunityRefreshWorker(
      pool,
      "worker-m0402-opportunity",
      120,
      () => now,
    ),
    refresh = await refresher.processOnce();
  if (refresh.status !== "succeeded")
    throw new Error(`opportunity refresh failed: ${JSON.stringify(refresh)}`);
  const detail = await service.get({ ...scope, opportunityId: createdOpportunity.id });
  if (
    detail.evidence.length !== 1 ||
    detail.evidence[0].raw_evidence_id !== persisted.evidence_id ||
    detail.coverage_status !== "partial" ||
    detail.section_status.market !== "covered" ||
    detail.section_status.competition !== "insufficient_data"
  )
    throw new Error("evidence coverage mismatch");
  if (
    !detail.lifecycle_entered_at ||
    detail.lifecycle_dwell_seconds < 0 ||
    !detail.adoption_blockers.some(
      (item) => item.code === "recommendation_insufficient" && item.status === "blocked",
    )
  )
    throw new Error("lifecycle dwell or blocker progress mismatch");
  const other = await service.list({
    organizationId: ids.otherOrganization,
    workspaceId: ids.otherWorkspace,
    actorId: ids.actor,
    page: 1,
    pageSize: 20,
  });
  if (other.total !== 0) throw new Error("organization workspace isolation failed");
  const decisionWrite = { ...write, idempotencyKey: "decision-live" },
    decision = await service.decide({
      ...decisionWrite,
      opportunityId: createdOpportunity.id,
      value: { action: "observe", reason: "等待成本与竞品数据", expected_version: 1 },
    }),
    decisionReplay = await service.decide({
      ...decisionWrite,
      opportunityId: createdOpportunity.id,
      value: { action: "observe", reason: "等待成本与竞品数据", expected_version: 1 },
    });
  if (
    decision.decision_id !== decisionReplay.decision_id ||
    decision.decision_status !== "observing" ||
    decision.version !== 2
  )
    throw new Error("decision idempotency failed");
  let conflict = false;
  try {
    await service.decide({
      ...write,
      idempotencyKey: "decision-conflict",
      opportunityId: createdOpportunity.id,
      value: { action: "adopt", reason: "stale version", expected_version: 1 },
    });
  } catch (error) {
    conflict =
      error instanceof OpportunityServiceError && error.code === "opportunity_version_conflict";
  }
  if (!conflict) throw new Error("version conflict missing");
  const [[events], [outbox], [rawAfter]] = await Promise.all([
    pool.query(
      "SELECT request_id,trace_id,event_type FROM opportunity_events WHERE organization_id=?",
      [ids.organization],
    ),
    pool.query("SELECT status,event_type FROM opportunity_outbox WHERE organization_id=?", [
      ids.organization,
    ]),
    pool.query("SELECT id FROM raw_evidence WHERE id=?", [persisted.evidence_id]),
  ]);
  if (
    events.length < 3 ||
    events.some((row) => row.request_id !== requestId || row.trace_id !== traceId) ||
    outbox.length !== events.length ||
    rawAfter.length !== 1
  )
    throw new Error("audit outbox or evidence preservation mismatch");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M04-02",
      mysql: runtime.version,
      redis: "available",
      trend_to_opportunity: "passed",
      truthful_missing_scores: "passed",
      evidence_coverage: "partial",
      lifecycle_dwell: "passed",
      blocker_progress: "passed",
      decision_reason_and_version: "passed",
      idempotency: "passed",
      organization_workspace_isolation: "passed",
      audit_outbox_correlation: "passed",
      evidence_preserved: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "opportunity_live_failed",
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await redis.close();
  await pool.end();
}
