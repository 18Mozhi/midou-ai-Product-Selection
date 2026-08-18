import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  ProfitService,
  ProfitServiceError,
  validateCostRule,
} from "../apps/api/dist/profit-service.js";
import { MySqlProfitRepository } from "../apps/api/dist/mysql-profit-repository.js";
import { MySqlOpportunityProfitWorker } from "../apps/worker/dist/opportunity-profit-worker.js";

const requestId = randomUUID(),
  traceId = randomUUID(),
  now = new Date(),
  pool = createDatabasePool(loadRuntimeConfig(process.env, "worker"));
const ids = {
  actor: randomUUID(),
  organization: randomUUID(),
  workspace: randomUUID(),
  opportunity: randomUUID(),
  provider: randomUUID(),
  otherOrganization: randomUUID(),
  otherWorkspace: randomUUID(),
  otherOpportunity: randomUUID(),
};
const service = new ProfitService(new MySqlProfitRepository(pool)),
  scope = {
    organizationId: ids.organization,
    workspaceId: ids.workspace,
    actorId: ids.actor,
    roleCodes: ["selection_manager", "organization_admin"],
  };
const write = (key) => ({ ...scope, requestId, traceId, idempotencyKey: key });
const fee_lines = [
  {
    type: "platform_fee",
    mode: "percentage_of_sale",
    value: 10,
    currency: null,
  },
  { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
  { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
  { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
];

async function migrate() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cost_rules'",
  );
  if (Number(rows[0].count)) return;
  const sql = await readFile(
    "database/migrations/0017d_profit_cost_m04_04.up.sql",
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean))
    await pool.query(statement);
}
async function cleanup() {
  try {
    await pool.query(
      "UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'",
    );
  } catch {}

  const orgs = [ids.organization, ids.otherOrganization];
  for (const sql of [
    "DELETE FROM cost_operations WHERE actor_id=?",
    "DELETE FROM opportunity_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_events WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_profit_components WHERE profit_run_id IN (SELECT id FROM opportunity_profit_runs WHERE organization_id IN (?,?))",
    "DELETE FROM opportunity_profit_runs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_profit_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_cost_inputs WHERE organization_id IN (?,?)",
    "DELETE FROM exchange_rate_quotes WHERE organization_id IN (?,?)",
    "DELETE FROM cost_rule_approvals WHERE organization_id IN (?,?)",
    "UPDATE cost_rules SET rollback_target_id=NULL WHERE organization_id IN (?,?)",
    "DELETE FROM cost_rules WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_refresh_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_decisions WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_evidence_links WHERE organization_id IN (?,?)",
    "DELETE FROM opportunities WHERE organization_id IN (?,?)",
  ])
    try {
      await pool.query(sql, sql.includes("actor_id") ? [ids.actor] : orgs);
    } catch {}
  for (const [sql, id] of [
    ["DELETE FROM providers WHERE id=?", ids.provider],
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
  const email = `m04-04-${requestId}@example.test`;
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
      [
        org,
        `M04-04 ${suffix}`,
        `m0404-${suffix}-${requestId.slice(0, 8)}`,
        ids.actor,
        now,
        now,
      ],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [ws, org, `M04-04 ${suffix}`, `m0404-${suffix}`, ids.actor, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [ws, org],
    );
  }
  for (const [id, org, ws, name] of [
    [ids.opportunity, ids.organization, ids.workspace, "primary"],
    [ids.otherOpportunity, ids.otherOrganization, ids.otherWorkspace, "other"],
  ])
    await pool.query(
      "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'test','manual',NULL,?,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'insufficient',NULL,NULL,'pending',1,?,?,?)",
      [id, org, ws, `M04-04 ${name}`, "US", ids.actor, ids.actor, now, now],
    );
  await pool.query(
    "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,schedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retention_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'https://example.test/rates','public_page','[\"US\"]','[\"en-US\"]','[\"exchange_rate\"]',1440,1,1000,2,5,'source_ref_id',365,'[\"rate_limited\"]','v1',NULL,'财务数据管理员','enabled',1,?,?,?,?)",
    [
      ids.provider,
      `m04_04_rate_${requestId.slice(0, 8)}`,
      "M04-04 approved exchange page crawler",
      ids.actor,
      ids.actor,
      now,
      now,
    ],
  );
}
async function approveAndPublish(rule, key) {
  let value = await service.actRule({
    ...write(`${key}-submit`),
    ruleId: rule.id,
    value: {
      action: "submit",
      reason: "费用明细已复核",
      expected_revision: rule.revision,
    },
  });
  value = await service.actRule({
    ...write(`${key}-selection`),
    ruleId: rule.id,
    value: {
      action: "approve",
      approval_role: "selection_manager",
      reason: "选品经理确认",
      expected_revision: value.revision,
    },
  });
  value = await service.actRule({
    ...write(`${key}-admin`),
    ruleId: rule.id,
    value: {
      action: "approve",
      approval_role: "organization_admin",
      reason: "组织管理员确认",
      expected_revision: value.revision,
    },
  });
  return service.actRule({
    ...write(`${key}-publish`),
    ruleId: rule.id,
    value: {
      action: "publish",
      reason: "双审批完成后发布",
      expected_revision: value.revision,
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
  await migrate();
  await cleanup();
  await seed();
  let invalid = false;
  try {
    validateCostRule({
      market: "US",
      platform: "amazon",
      version_code: "bad",
      name: "bad",
      effective_from: now.toISOString().slice(0, 10),
      fee_lines: fee_lines.slice(0, 3),
    });
  } catch (error) {
    invalid =
      error instanceof ProfitServiceError &&
      error.code === "cost_rule_fee_lines_invalid";
  }
  if (!invalid) throw new Error("explicit fee validation missing");
  const draft = await service.createRule({
      ...write("rule-v1-create"),
      value: {
        market: "US",
        platform: "amazon",
        version_code: "US-AMZ-2026-01",
        name: "美国站费用规则一",
        effective_from: now.toISOString().slice(0, 10),
        fee_lines,
      },
    }),
    replay = await service.createRule({
      ...write("rule-v1-create"),
      value: {
        market: "US",
        platform: "amazon",
        version_code: "US-AMZ-2026-01",
        name: "美国站费用规则一",
        effective_from: now.toISOString().slice(0, 10),
        fee_lines,
      },
    });
  if (draft.id !== replay.id) throw new Error("rule idempotency failed");
  let version = 1;
  for (const [value, key] of [
    [
      {
        input_type: "sale_price",
        amount_value: 100,
        currency: "USD",
        source_ref_id: "sale-confirmation",
      },
      "sale",
    ],
    [
      {
        input_type: "purchase_price",
        amount_value: 40,
        currency: "CNY",
        source_ref_id: "supplier-quote",
      },
      "purchase",
    ],
    [
      {
        input_type: "logistics",
        amount_value: 5,
        currency: "USD",
        source_ref_id: "logistics-quote",
      },
      "logistics",
    ],
  ]) {
    const result = await service.recordCost({
      ...write(`cost-${key}`),
      opportunityId: ids.opportunity,
      value: {
        platform: "amazon",
        ...value,
        source_type: "verified_probe",
        evidence_id: randomUUID(),
        observed_at: now.toISOString(),
        expected_version: version,
      },
    });
    version = result.version;
  }
  const active = await approveAndPublish(draft, "v1");
  if (active.status !== "active" || active.approvals.length !== 2)
    throw new Error("dual approval publish failed");
  const worker = new MySqlOpportunityProfitWorker(
      pool,
      "worker-m0404-profit",
      120,
      () => new Date(now.getTime() + 1000),
    ),
    partial = await worker.processOnce();
  if (
    partial.status !== "completed_with_warnings" ||
    partial.profit_status !== "insufficient_data"
  )
    throw new Error(`missing rate must block ROI: ${JSON.stringify(partial)}`);
  let analysis = await service.getAnalysis({
    organizationId: ids.organization,
    workspaceId: ids.workspace,
    opportunityId: ids.opportunity,
  });
  if (
    analysis.latest_run?.net_profit !== null ||
    !analysis.latest_run?.missing_fields.includes("exchange_rate.CNY_USD")
  )
    throw new Error("insufficient run truth mismatch");
  await service.recordRate({
    ...write("rate-cny-usd"),
    value: {
      provider_id: ids.provider,
      base_currency: "CNY",
      quote_currency: "USD",
      rate_value: 0.14,
      quote_date: now.toISOString().slice(0, 10),
      observed_at: now.toISOString(),
      source_ref_id: "historical-cny-usd",
      evidence_id: randomUUID(),
    },
  });
  const [[current]] = await pool.query(
    "SELECT version FROM opportunities WHERE id=?",
    [ids.opportunity],
  );
  await service.queue({
    ...write("profit-rerun"),
    opportunityId: ids.opportunity,
    value: { platform: "amazon", expected_version: Number(current.version) },
  });
  const complete = await new MySqlOpportunityProfitWorker(
    pool,
    "worker-m0404-profit",
    120,
    () => new Date(now.getTime() + 2000),
  ).processOnce();
  if (
    complete.status !== "succeeded" ||
    complete.profit_status !== "calculated"
  )
    throw new Error(`complete profit failed: ${JSON.stringify(complete)}`);
  analysis = await service.getAnalysis({
    organizationId: ids.organization,
    workspaceId: ids.workspace,
    opportunityId: ids.opportunity,
  });
  if (
    analysis.latest_run?.net_profit !== 69.4 ||
    analysis.latest_run?.net_margin_percent !== 69.4 ||
    analysis.latest_run?.total_cost !== 30.6 ||
    analysis.latest_run.components.length !== 7
  )
    throw new Error(
      `profit formula mismatch: ${JSON.stringify(analysis.latest_run)}`,
    );
  const second = await service.createRule({
      ...write("rule-v2-create"),
      value: {
        market: "US",
        platform: "amazon",
        version_code: "US-AMZ-2026-02",
        name: "美国站费用规则二",
        effective_from: now.toISOString().slice(0, 10),
        fee_lines: fee_lines.map((item) =>
          item.type === "platform_fee" ? { ...item, value: 11 } : item,
        ),
      },
    }),
    secondActive = await approveAndPublish(second, "v2");
  const rolled = await service.actRule({
    ...write("v2-rollback"),
    ruleId: secondActive.id,
    value: {
      action: "rollback",
      reason: "第二版验证未达预期",
      expected_revision: secondActive.revision,
      target_rule_id: draft.id,
    },
  });
  if (rolled.id !== draft.id || rolled.status !== "active")
    throw new Error("cost rule rollback failed");
  const [[counts], [events], [otherRules]] = await Promise.all([
    pool.query(
      "SELECT (SELECT COUNT(*) FROM opportunity_profit_runs WHERE opportunity_id=?) runs,(SELECT COUNT(*) FROM opportunity_profit_components c JOIN opportunity_profit_runs r ON r.id=c.profit_run_id WHERE r.opportunity_id=?) components",
      [ids.opportunity, ids.opportunity],
    ),
    pool.query(
      "SELECT request_id,trace_id FROM opportunity_events WHERE organization_id=? AND (event_type LIKE 'cost_rule.%' OR event_type LIKE 'exchange_rate.%' OR event_type LIKE 'opportunity.profit.%')",
      [ids.organization],
    ),
    pool.query("SELECT id FROM cost_rules WHERE organization_id=?", [
      ids.otherOrganization,
    ]),
  ]);
  if (
    Number(counts[0]?.runs) !== 2 ||
    Number(counts[0]?.components) !== 14 ||
    events.length < 12 ||
    events.some(
      (row) => row.request_id !== requestId || row.trace_id !== traceId,
    ) ||
    otherRules.length
  )
    throw new Error(
      `history audit correlation or isolation mismatch: ${JSON.stringify({ counts: counts[0], events: events.length, otherRules: otherRules.length })}`,
    );
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M04-04",
      mysql: runtime.version,
      explicit_fee_values: "passed",
      dual_approval: "passed",
      approved_exchange_provider: "passed",
      missing_input_guard: "passed",
      net_profit: 69.4,
      net_margin_percent: 69.4,
      historical_runs_preserved: "passed",
      rollback: "passed",
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
      code: error?.code ?? "profit_live_failed",
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
