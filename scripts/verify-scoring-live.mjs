import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createRedisConnection, ScopedRedisStore } from "../packages/redis/dist/index.js";
import {
  ScoringService,
  ScoringServiceError,
  validateScoreRule,
} from "../apps/api/dist/scoring-service.js";
import { MySqlScoringRepository } from "../apps/api/dist/mysql-scoring-repository.js";
import { OpportunityService } from "../apps/api/dist/opportunity-service.js";
import { MySqlOpportunityRepository } from "../apps/api/dist/mysql-opportunity-repository.js";
import { MySqlOpportunityScoringWorker } from "../apps/worker/dist/opportunity-scoring-worker.js";
const requestId = randomUUID(),
  traceId = randomUUID(),
  now = new Date(),
  config = loadRuntimeConfig(process.env, "worker"),
  pool = createDatabasePool(config),
  redisClient = createRedisConnection(config),
  redis = new ScopedRedisStore(redisClient),
  ids = {
    actor: randomUUID(),
    organization: randomUUID(),
    workspace: randomUUID(),
    otherOrganization: randomUUID(),
    otherWorkspace: randomUUID(),
    opportunity: randomUUID(),
    otherOpportunity: randomUUID(),
  },
  repo = new MySqlScoringRepository(pool),
  service = new ScoringService(repo),
  opportunities = new OpportunityService(new MySqlOpportunityRepository(pool));
const scope = { organizationId: ids.organization, workspaceId: ids.workspace, actorId: ids.actor },
  write = (key) => ({ ...scope, requestId, traceId, idempotencyKey: key });
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
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='score_rules'",
  );
  if (!Number(rows[0].count))
    await applyMigration("database/migrations/0017c_scoring_rules_m04_03.up.sql");
  const [columns] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='opportunity_score_jobs' AND column_name='trigger_task_id'",
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
  for (const sql of [
    "DELETE FROM score_rule_operations WHERE actor_id=?",
    "DELETE FROM opportunity_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_events WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_score_components WHERE score_run_id IN (SELECT id FROM opportunity_score_runs WHERE organization_id IN (?,?))",
    "DELETE FROM opportunity_score_runs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_score_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_score_inputs WHERE organization_id IN (?,?)",
    "DELETE FROM score_rule_actions WHERE organization_id IN (?,?)",
    "UPDATE score_rules SET rollback_target_id=NULL WHERE organization_id IN (?,?)",
    "DELETE FROM score_rules WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_refresh_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_decisions WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_evidence_links WHERE organization_id IN (?,?)",
    "DELETE FROM opportunities WHERE organization_id IN (?,?)",
  ]) {
    try {
      await pool.query(
        sql,
        sql.includes("actor_id") ? [ids.actor] : [ids.organization, ids.otherOrganization],
      );
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
}
async function seed() {
  const email = `m04-03-${requestId}@example.test`;
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
      [org, `M04-03 ${suffix}`, `m0403-${suffix}-${requestId.slice(0, 8)}`, ids.actor, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [ws, org, `M04-03 ${suffix}`, `m0403-${suffix}`, ids.actor, now, now],
    );
    await pool.query("UPDATE organizations SET default_workspace_id=? WHERE id=?", [ws, org]);
  }
  for (const [id, org, ws] of [
    [ids.opportunity, ids.organization, ids.workspace],
    [ids.otherOpportunity, ids.otherOrganization, ids.otherWorkspace],
  ])
    await pool.query(
      "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'test','manual',NULL,?,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'insufficient',NULL,NULL,'pending',1,?,?,?)",
      [
        id,
        org,
        ws,
        `M04-03 ${id === ids.opportunity ? "primary" : "other"}`,
        "US",
        ids.actor,
        ids.actor,
        now,
        now,
      ],
    );
}
const dimensions = [
    {
      code: "market_demand",
      label: "市场需求",
      weight: 40,
      required: true,
      evidence_group: "market",
    },
    {
      code: "competition",
      label: "竞争",
      weight: 30,
      required: true,
      evidence_group: "competition",
    },
    { code: "profit", label: "利润", weight: 30, required: true, evidence_group: "cost" },
  ],
  thresholds = { recommend_min: 75, observe_min: 55 };
async function input(dimension_code, evidence_group, score_value, expected_version, key) {
  return service.recordInput({
    ...write(key),
    opportunityId: ids.opportunity,
    value: {
      dimension_code,
      evidence_group,
      score_value,
      source_type: "verified_probe",
      source_ref_id: `probe:${dimension_code}`,
      evidence_ids: [randomUUID()],
      missing_fields: [],
      observed_at: now.toISOString(),
      expected_version,
    },
  });
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
  await seed();
  let invalid = false;
  try {
    validateScoreRule({
      version_code: "bad",
      name: "bad",
      dimensions: dimensions.map((item) => ({ ...item, weight: 20 })),
      thresholds,
    });
  } catch (error) {
    invalid = error instanceof ScoringServiceError && error.code === "score_rule_weight_invalid";
  }
  if (!invalid) throw new Error("weight sum validation missing");
  const first = await service.create({
      ...write("rule-v1-create"),
      value: { version_code: "org-v1", name: "首个经批准评分规则", dimensions, thresholds },
    }),
    replay = await service.create({
      ...write("rule-v1-create"),
      value: { version_code: "org-v1", name: "首个经批准评分规则", dimensions, thresholds },
    });
  if (first.id !== replay.id || first.status !== "draft")
    throw new Error("rule idempotency failed");
  let version = 1;
  version = (await input("market_demand", "market", 82, version, "input-market")).version;
  version = (await input("competition", "competition", 70, version, "input-competition")).version;
  let rule = await service.action({
    ...write("rule-v1-submit"),
    ruleId: first.id,
    value: { action: "submit", reason: "维度和阈值已复核", expected_revision: 1 },
  });
  rule = await service.action({
    ...write("rule-v1-approve"),
    ruleId: first.id,
    value: { action: "approve", reason: "批准进入启用候选", expected_revision: rule.revision },
  });
  rule = await service.action({
    ...write("rule-v1-activate"),
    ruleId: first.id,
    value: { action: "activate", reason: "启用首个明确版本", expected_revision: rule.revision },
  });
  const worker = new MySqlOpportunityScoringWorker(
      pool,
      "worker-m0403-score",
      120,
      () => new Date(now.getTime() + 1000),
    ),
    partial = await worker.processOnce();
  if (partial.status !== "completed_with_warnings" || partial.coverage_percent !== 66.67)
    throw new Error(`partial score truth failed: ${JSON.stringify(partial)}`);
  let detail = await opportunities.get({ ...scope, opportunityId: ids.opportunity });
  if (
    detail.recommendation_status === "recommend" ||
    detail.latest_score_run?.coverage_percent !== 66.67 ||
    detail.latest_score_run?.missing_fields.every((item) => !item.startsWith("profit."))
  )
    throw new Error("partial score must not recommend");
  version = detail.version;
  version = (await input("profit", "cost", 88, version, "input-cost")).version;
  const complete = await worker.processOnce();
  if (complete.status !== "succeeded" || complete.coverage_percent !== 100)
    throw new Error(`complete score failed: ${JSON.stringify(complete)}`);
  detail = await opportunities.get({ ...scope, opportunityId: ids.opportunity });
  if (
    detail.recommendation_status !== "recommend" ||
    detail.overall_score !== 80.2 ||
    detail.score_components.length !== 3 ||
    detail.confidence.score !== 100
  )
    throw new Error("weighted score or explanation mismatch");
  const second = await service.create({
    ...write("rule-v2-create"),
    value: {
      version_code: "org-v2",
      name: "候选规则二",
      dimensions,
      thresholds: { recommend_min: 78, observe_min: 58 },
    },
  });
  const [[beforePreviewRuns], [beforePreviewJobs], [beforePreviewOpportunity]] = await Promise.all([
      pool.query("SELECT COUNT(*) count FROM opportunity_score_runs WHERE organization_id=?", [
        ids.organization,
      ]),
      pool.query("SELECT COUNT(*) count FROM opportunity_score_jobs WHERE organization_id=?", [
        ids.organization,
      ]),
      pool.query("SELECT version FROM opportunities WHERE id=?", [ids.opportunity]),
    ]),
    preview = await service.preview({
      ...scope,
      ruleId: second.id,
      page: 1,
      pageSize: 20,
    }),
    [[afterPreviewRuns], [afterPreviewJobs], [afterPreviewOpportunity]] = await Promise.all([
      pool.query("SELECT COUNT(*) count FROM opportunity_score_runs WHERE organization_id=?", [
        ids.organization,
      ]),
      pool.query("SELECT COUNT(*) count FROM opportunity_score_jobs WHERE organization_id=?", [
        ids.organization,
      ]),
      pool.query("SELECT version FROM opportunities WHERE id=?", [ids.opportunity]),
    ]);
  if (
    preview.read_only !== true ||
    preview.items[0]?.projected_score !== 80.2 ||
    Number(beforePreviewRuns[0].count) !== Number(afterPreviewRuns[0].count) ||
    Number(beforePreviewJobs[0].count) !== Number(afterPreviewJobs[0].count) ||
    Number(beforePreviewOpportunity[0].version) !== Number(afterPreviewOpportunity[0].version)
  )
    throw new Error("score preview must reuse calculation without writes");
  let secondState = await service.action({
    ...write("rule-v2-submit"),
    ruleId: second.id,
    value: { action: "submit", reason: "提交第二版", expected_revision: 1 },
  });
  secondState = await service.action({
    ...write("rule-v2-approve"),
    ruleId: second.id,
    value: { action: "approve", reason: "批准第二版", expected_revision: secondState.revision },
  });
  secondState = await service.action({
    ...write("rule-v2-activate"),
    ruleId: second.id,
    value: {
      action: "activate",
      reason: "灰度前启用第二版",
      expected_revision: secondState.revision,
    },
  });
  const rolled = await service.action({
    ...write("rule-v2-rollback"),
    ruleId: second.id,
    value: {
      action: "rollback",
      reason: "第二版验证未达预期",
      expected_revision: secondState.revision,
      target_rule_id: first.id,
    },
  });
  if (rolled.id !== first.id || rolled.status !== "active")
    throw new Error("rollback target activation failed");
  const [[runs], [events], [outbox], [otherRules]] = await Promise.all([
    pool.query("SELECT id FROM opportunity_score_runs WHERE opportunity_id=?", [ids.opportunity]),
    pool.query(
      "SELECT request_id,trace_id FROM opportunity_events WHERE organization_id=? AND event_type LIKE 'score_rule.%'",
      [ids.organization],
    ),
    pool.query(
      "SELECT id FROM opportunity_outbox WHERE organization_id=? AND event_type LIKE 'score_rule.%'",
      [ids.organization],
    ),
    pool.query("SELECT id FROM score_rules WHERE organization_id=?", [ids.otherOrganization]),
  ]);
  if (
    runs.length !== 2 ||
    events.length < 8 ||
    events.some((row) => row.request_id !== requestId || row.trace_id !== traceId) ||
    outbox.length !== events.length ||
    otherRules.length
  )
    throw new Error("history audit outbox or isolation mismatch");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M04-03",
      mysql: runtime.version,
      redis: "available",
      explicit_rule_values: "passed",
      weighted_score: 80.2,
      partial_coverage_guard: "passed",
      complete_core_evidence: "passed",
      approval_activation_rollback: "passed",
      historical_runs_preserved: "passed",
      pre_publish_preview_read_only: "passed",
      idempotency: "passed",
      organization_workspace_isolation: "passed",
      audit_outbox_correlation: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "scoring_live_failed",
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
