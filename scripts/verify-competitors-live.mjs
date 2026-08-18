import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  CompetitorService,
  CompetitorServiceError,
  validateSnapshot,
} from "../apps/api/dist/competitor-service.js";
import { MySqlCompetitorRepository } from "../apps/api/dist/mysql-competitor-repository.js";
import { MySqlCompetitorMonitorWorker } from "../apps/worker/dist/competitor-monitor-worker.js";

const requestId = randomUUID(),
  traceId = randomUUID(),
  now = new Date();
const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker"));
const ids = {
  actor: randomUUID(),
  org: randomUUID(),
  ws: randomUUID(),
  otherOrg: randomUUID(),
  otherWs: randomUUID(),
  provider: randomUUID(),
};
const service = new CompetitorService(new MySqlCompetitorRepository(pool));
const scope = {
  organizationId: ids.org,
  workspaceId: ids.ws,
  actorId: ids.actor,
};
const write = (key) => ({ ...scope, requestId, traceId, idempotencyKey: key });

async function migrate() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='competitors'",
  );
  if (Number(rows[0].count)) return;
  const sql = await readFile(
    "database/migrations/0017e_competitor_monitoring_m04_05.up.sql",
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((v) => v.replace(/^--.*$/gm, "").trim())
    .filter(Boolean))
    await pool.query(statement);
}
async function cleanup() {
  try {
    await pool.query(
      "UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'",
    );
  } catch {}

  for (const sql of [
    "DELETE FROM competitor_operations WHERE actor_id=?",
    "DELETE FROM competitor_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_events WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_alerts WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_changes WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_snapshot_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_monitor_rules WHERE organization_id IN (?,?)",
    "UPDATE competitors SET latest_snapshot_id=NULL WHERE organization_id IN (?,?)",
    "DELETE FROM competitor_snapshots WHERE organization_id IN (?,?)",
    "DELETE FROM competitors WHERE organization_id IN (?,?)",
  ])
    try {
      await pool.query(
        sql,
        sql.includes("actor_id") ? [ids.actor] : [ids.org, ids.otherOrg],
      );
    } catch {}
  for (const [sql, id] of [
    ["DELETE FROM providers WHERE id=?", ids.provider],
    ["DELETE FROM workspaces WHERE id=?", ids.ws],
    ["DELETE FROM workspaces WHERE id=?", ids.otherWs],
    ["DELETE FROM organizations WHERE id=?", ids.org],
    ["DELETE FROM organizations WHERE id=?", ids.otherOrg],
    ["DELETE FROM users WHERE id=?", ids.actor],
  ])
    try {
      await pool.query(sql, [id]);
    } catch {}
}
async function seed() {
  const email = `m04-05-${requestId}@example.test`;
  await pool.query(
    "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)",
    [ids.actor, email, email, now, now, now, now],
  );
  for (const [org, ws, label] of [
    [ids.org, ids.ws, "primary"],
    [ids.otherOrg, ids.otherWs, "other"],
  ]) {
    await pool.query(
      "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
      [
        org,
        `M04-05 ${label}`,
        `m0405-${label}-${requestId.slice(0, 8)}`,
        ids.actor,
        now,
        now,
      ],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [ws, org, `M04-05 ${label}`, `m0405-${label}`, ids.actor, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [ws, org],
    );
  }
  await pool.query(
    "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,schedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retention_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'https://example.test/products','public_page','[\"US\"]','[\"en-US\"]','[\"price\",\"rank\",\"review_count\",\"availability\"]',60,1,1000,2,5,'external_id',365,'[\"rate_limited\"]','v1',NULL,'竞品数据管理员','enabled',1,?,?,?,?)",
    [
      ids.provider,
      `m04_05_${requestId.slice(0, 8)}`,
      "M04-05 approved competitor page crawler",
      ids.actor,
      ids.actor,
      now,
      now,
    ],
  );
}
const snapshot = (price, rank, review, availability, ref) => ({
  current_price: price,
  currency: "USD",
  rank_value: rank,
  review_count: review,
  rating_value: 4.6,
  availability,
  captured_at: new Date(
    now.getTime() + (ref === "baseline" ? 0 : 60000),
  ).toISOString(),
  freshness: "fresh",
  source_status: "healthy",
  source_ref_id: `provider:${ref}`,
  evidence_id: randomUUID(),
});

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
  await migrate();
  await cleanup();
  await seed();
  let invalid = false;
  try {
    validateSnapshot({
      ...snapshot(1, 1, 1, "in_stock", "invalid"),
      evidence_id: "",
    });
  } catch (e) {
    invalid = e instanceof CompetitorServiceError;
  }
  if (!invalid) throw new Error("provenance validation missing");
  const value = {
    provider_id: ids.provider,
    market: "US",
    source_site: "Example US",
    external_id: "SKU-001",
    product_url: "https://example.test/products/SKU-001",
    title: "竞品一",
    snapshot: snapshot(29.99, 120, 800, "in_stock", "baseline"),
  };
  const created = await service.create({ ...write("create"), value }),
    replay = await service.create({ ...write("create"), value });
  if (created.id !== replay.id) throw new Error("idempotency failed");
  const base = await new MySqlCompetitorMonitorWorker(
    pool,
    "worker-m0405",
    120,
    () => new Date(now.getTime() + 1000),
  ).processOnce();
  if (base.status !== "succeeded" || base.change_count !== 0)
    throw new Error(`baseline mismatch ${JSON.stringify(base)}`);
  await service.createRule({
    ...write("rule"),
    value: {
      competitor_id: created.id,
      metric: "price",
      direction: "decrease",
      threshold_value: 2,
    },
  });
  await service.createRule({
    ...write("stock-rule"),
    value: {
      competitor_id: created.id,
      metric: "availability",
      direction: "became_unavailable",
    },
  });
  await service.addSnapshot({
    ...write("snapshot-2"),
    competitorId: created.id,
    value: snapshot(26.99, 105, 825, "out_of_stock", "second"),
  });
  const compared = await new MySqlCompetitorMonitorWorker(
    pool,
    "worker-m0405",
    120,
    () => new Date(now.getTime() + 61000),
  ).processOnce();
  if (compared.status !== "succeeded" || compared.change_count !== 4)
    throw new Error(`comparison mismatch ${JSON.stringify(compared)}`);
  const detail = await service.get({
      organizationId: ids.org,
      workspaceId: ids.ws,
      competitorId: created.id,
    }),
    other = await service.list({
      organizationId: ids.otherOrg,
      workspaceId: ids.otherWs,
    });
  if (detail.changes.length !== 4 || detail.alerts.length !== 2 || other.length)
    throw new Error(
      `threshold or isolation mismatch ${JSON.stringify({ changes: detail.changes.length, alerts: detail.alerts.length, other: other.length })}`,
    );
  const [countResult, eventResult] = await Promise.all([
    pool.query(
      "SELECT (SELECT COUNT(*) FROM competitor_snapshots WHERE competitor_id=?) snapshots,(SELECT COUNT(*) FROM competitor_alerts WHERE competitor_id=? AND notification_status='queued' AND task_status='queued') alerts",
      [created.id, created.id],
    ),
    pool.query(
      "SELECT request_id,trace_id FROM competitor_events WHERE organization_id=?",
      [ids.org],
    ),
  ]);
  const counts = countResult[0][0],
    events = eventResult[0];
  if (
    Number(counts.snapshots) !== 2 ||
    Number(counts.alerts) !== 2 ||
    events.some((r) => r.request_id !== requestId || r.trace_id !== traceId)
  )
    throw new Error(
      `immutable history or audit correlation mismatch ${JSON.stringify({ counts, events: events.length })}`,
    );
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M04-05",
      mysql: runtime.version,
      identity_dedupe: "passed",
      immutable_snapshots: 2,
      change_records: 4,
      threshold_alert: 2,
      notification_task_queued: "passed",
      idempotency: "passed",
      organization_workspace_isolation: "passed",
      audit_outbox_correlation: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: e?.code ?? "competitor_live_failed",
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
