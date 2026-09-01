import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createArgon2PasswordHasher } from "../packages/auth/dist/index.js";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  readProtectedRouteCatalog,
  readRouteCatalogManifest,
} from "./production-route-catalog.mjs";

const production = process.argv.includes("--production");
const runId = randomUUID();
const manifest = JSON.parse(
  await readFile("infra/baota/production-acceptance-manifest.json", "utf8"),
);
const routeManifest = await readRouteCatalogManifest();
const protectedRoutes = await readProtectedRouteCatalog();
const openapi = await readFile(manifest.baseline.openapiFile, "utf8");
const pathCount = openapi.split(/\r?\n/).filter((line) => /^  \/[^:]+:$/.test(line)).length;
const operationCount = openapi
  .split(/\r?\n/)
  .filter((line) => /^    (get|post|put|patch|delete):$/.test(line)).length;
if (
  manifest.schemaVersion !== 1 ||
  manifest.productionManager !== "baota" ||
  manifest.task?.daemon !== false ||
  pathCount !== manifest.baseline.pathCount ||
  operationCount !== manifest.baseline.operationCount ||
  protectedRoutes.length !== manifest.baseline.protectedRouteCount ||
  routeManifest.productionAcceptance.roles.length !== manifest.baseline.roleCount
)
  throw new Error("production_acceptance_manifest_drift");
if (!production) {
  console.log(
    JSON.stringify(
      {
        status: "preflight_passed",
        production_verified: false,
        paths: pathCount,
        operations: operationCount,
        protected_routes: protectedRoutes.length,
        roles: routeManifest.productionAcceptance.roles.length,
        request_id: runId,
        trace_id: runId,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const password = process.env.SCOUTOPS_ACCEPTANCE_PASSWORD ?? "";
if (password.length < 12 || password.length > 128)
  throw new Error("SCOUTOPS_ACCEPTANCE_PASSWORD must contain 12-128 characters");
const reportFile = resolve(
  process.env.SCOUTOPS_ACCEPTANCE_REPORT_FILE ??
    ".artifacts/verification/production-acceptance.json",
);
const apiReportFile = resolve(
  process.env.SCOUTOPS_ACCEPTANCE_API_REPORT_FILE ??
    ".artifacts/verification/production-api-coverage.json",
);
const routeReportFile = resolve(
  process.env.SCOUTOPS_QA_REPORT_FILE ??
    ".artifacts/verification/production-product-functional.json",
);
const coreE2eReportFile = resolve(
  process.env.SCOUTOPS_CORE_E2E_REPORT_FILE ?? ".artifacts/verification/production-core-e2e.json",
);
const config = loadRuntimeConfig(process.env, "api");
const pool = createDatabasePool(config);
const roleProfiles = routeManifest.productionAcceptance.roles;
const state = {
  organizationId: randomUUID(),
  workspaceId: randomUUID(),
  opportunityId: randomUUID(),
  taskId: randomUUID(),
  trendTopicId: randomUUID(),
  collectionTaskId: randomUUID(),
  collectionSubqueryId: randomUUID(),
  fileAssetId: randomUUID(),
  rawEvidenceId: randomUUID(),
  normalizedRecordId: randomUUID(),
  sourcingSearchId: randomUUID(),
  sourcingCandidateId: randomUUID(),
  costRuleId: randomUUID(),
  saleCostInputId: randomUUID(),
  purchaseCostInputId: randomUUID(),
  logisticsCostInputId: randomUUID(),
  profitRunId: randomUUID(),
  users: Object.fromEntries(roleProfiles.map((profile) => [profile.key, randomUUID()])),
  memberships: Object.fromEntries(
    roleProfiles
      .filter((profile) => profile.shell !== "platform_admin")
      .map((profile) => [profile.key, randomUUID()]),
  ),
  emails: Object.fromEntries(
    roleProfiles.map((profile) => [
      profile.key,
      `${profile.key}.${runId}@${manifest.tenant.emailDomain}`,
    ]),
  ),
};
state.memberUserId = state.users.member;
state.memberMembershipId = state.memberships.member;

let lockHeld = false;
let cleanupReport = { status: "not_started", tables: [], deleted_rows: 0, remaining_rows: null };
let routeReport = null;
let apiReport = null;
let coreE2eReport = null;
let failure = null;
let cleanupFailure = null;

const placeholders = (values) => values.map(() => "?").join(",");
const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

async function seed() {
  const [[runtime]] = await pool.query(
    "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
  );
  if (
    !String(runtime.version).startsWith("5.7.") ||
    runtime.charset !== "utf8mb4" ||
    runtime.database_name !== "product_scout" ||
    !String(runtime.account_name).startsWith("product_scout@")
  )
    throw new Error("production_acceptance_requires_mysql57_business_account");
  const [[lock]] = await pool.query("SELECT GET_LOCK('scoutops:production-acceptance',0) acquired");
  if (Number(lock.acquired) !== 1) throw new Error("production_acceptance_lock_busy");
  lockHeld = true;
  const roleCodes = roleProfiles.map((profile) => profile.role);
  const [roles] = await pool.query(
    `SELECT code FROM roles WHERE code IN (${placeholders(roleCodes)}) AND status='active'`,
    roleCodes,
  );
  if (roles.length !== roleCodes.length)
    throw new Error("production_acceptance_role_catalog_incomplete");
  const hasher = createArgon2PasswordHasher({
    memoryCost: config.auth.argon2MemoryKib,
    timeCost: config.auth.argon2TimeCost,
    parallelism: config.auth.argon2Parallelism,
  });
  const passwordHash = await hasher.hash(password);
  const now = new Date();
  for (const profile of roleProfiles) {
    const email = state.emails[profile.key];
    await pool.query(
      "INSERT INTO users(id,email,email_normalized,password_hash,status,email_verified_at,failed_login_count,locked_until,password_changed_at,must_change_password,must_enroll_mfa,security_setup_completed_at,version,created_at,updated_at) VALUES(?,?,?,?,'active',?,0,NULL,?,0,0,?,1,?,?)",
      [state.users[profile.key], email, email, passwordHash, now, now, now, now, now],
    );
  }
  const creatorId = state.users.organization_admin;
  await pool.query(
    "INSERT INTO organizations(id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES(?,?,?,'active','Asia/Shanghai',30,NULL,?,1,?,?)",
    [
      state.organizationId,
      `${manifest.tenant.organizationLabel} ${runId.slice(0, 8)}`,
      `scoutops-acceptance-${runId.slice(0, 8)}`,
      creatorId,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO workspaces(id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES(?,?,?,'acceptance','active',?,1,?,?)",
    [state.workspaceId, state.organizationId, manifest.tenant.workspaceLabel, creatorId, now, now],
  );
  await pool.query("UPDATE organizations SET default_workspace_id=? WHERE id=?", [
    state.workspaceId,
    state.organizationId,
  ]);
  for (const profile of roleProfiles.filter((item) => item.shell !== "platform_admin")) {
    const membershipId = state.memberships[profile.key];
    await pool.query(
      "INSERT INTO memberships(id,organization_id,user_id,status,joined_at,version,created_at,updated_at) VALUES(?,?,?,'active',?,1,?,?)",
      [membershipId, state.organizationId, state.users[profile.key], now, now, now],
    );
    await pool.query(
      "INSERT INTO membership_role_assignments(membership_id,role_code,created_by,created_at) VALUES(?,?,?,?)",
      [membershipId, profile.role, creatorId, now],
    );
    const organizationScope = profile.role === "organization_admin";
    await pool.query(
      "INSERT INTO membership_data_scopes(id,membership_id,scope_type,scope_key,workspace_id,team_id,created_by,version,created_at) VALUES(?,?,?,?,?,NULL,?,1,?)",
      [
        randomUUID(),
        membershipId,
        organizationScope ? "organization" : "workspace",
        organizationScope ? "organization" : `workspace:${state.workspaceId}`,
        organizationScope ? null : state.workspaceId,
        creatorId,
        now,
      ],
    );
  }
  for (const profile of roleProfiles.filter((item) => item.shell === "platform_admin"))
    await pool.query(
      "INSERT INTO platform_role_assignments(user_id,role_code,created_by,created_at) VALUES(?,?,?,?)",
      [state.users[profile.key], profile.role, state.users.platform_super_admin, now],
    );
  await pool.query(
    "INSERT INTO trend_topics(id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES(?,?,?,SHA2(?,256),?,'acceptance','US','zh-CN','active',1,1,1,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)",
    [
      state.trendTopicId,
      state.organizationId,
      state.workspaceId,
      `production-acceptance-${runId}`,
      `生产验收趋势 ${runId.slice(0, 8)}`,
      now,
      now,
      now,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO opportunities(id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES(?,?,?,'生产验收机会','US','acceptance','trend_topic',?,?,'ready','observe',72,76,68,'calculated','low','measured',82,1,1,'partial',NULL,NULL,'pending',1,?,?,?)",
    [
      state.opportunityId,
      state.organizationId,
      state.workspaceId,
      state.trendTopicId,
      state.users.selection_manager,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO tasks(id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version,created_at,updated_at) VALUES(?,?,?,'生产验收任务','用于解析真实任务详情路由。','todo','normal',?,'manual',NULL,NULL,NULL,?,1,?,?)",
    [
      state.taskId,
      state.organizationId,
      state.workspaceId,
      state.users.member,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  const [[provider]] = await pool.query(
    "SELECT id FROM providers WHERE status='enabled' ORDER BY updated_at DESC,id LIMIT 1",
  );
  if (!provider?.id) throw new Error("production_acceptance_enabled_provider_missing");
  await pool.query(
    "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,finished_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,last_error_code,request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?,?,'succeeded','complete','normal',?,?,?,1,1,0,0,1,'[]',NULL,?,?,1,?,?,?)",
    [
      state.collectionTaskId,
      state.organizationId,
      state.workspaceId,
      now,
      now,
      now,
      runId,
      runId,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,started_at,finished_at,version,created_at,updated_at) VALUES(?,?,?,?,?,1,'{}',1,'succeeded',1,'[]',NULL,0,?,?,1,?,?)",
    [
      state.collectionSubqueryId,
      state.collectionTaskId,
      state.organizationId,
      state.workspaceId,
      provider.id,
      now,
      now,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO file_assets(id,organization_id,workspace_id,category,relative_path,content_sha256,size_bytes,status,created_by,created_at,updated_at) VALUES(?,?,?,'evidence',?,SHA2(?,256),1,'active',?,?,?)",
    [
      state.fileAssetId,
      state.organizationId,
      state.workspaceId,
      `production-acceptance/${runId}.json`,
      runId,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO raw_evidence(id,organization_id,workspace_id,collection_task_id,collection_subquery_id,provider_id,file_asset_id,source_url,canonical_url,dedupe_key,content_sha256,content_type,size_bytes,captured_at,parser_version,adapter_version,retention_until,status,request_id,trace_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,'https://example.test/acceptance-source','https://example.test/acceptance-source',?,SHA2(?,256),'application/json',1,?,'acceptance-v1','acceptance-v1',DATE_ADD(?,INTERVAL 1 DAY),'active',?,?,?,?)",
    [
      state.rawEvidenceId,
      state.organizationId,
      state.workspaceId,
      state.collectionTaskId,
      state.collectionSubqueryId,
      provider.id,
      state.fileAssetId,
      `acceptance-${runId}`,
      runId,
      now,
      now,
      runId,
      runId,
      state.users.selection_manager,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO normalized_records(id,organization_id,workspace_id,provider_id,raw_evidence_id,record_key,schema_version,record_version,payload_json,supersedes_record_id,correction_reason,status,request_id,trace_id,created_by,created_at) VALUES(?,?,?,?,?,?,'product-supply-csv-v1',1,?,NULL,NULL,'active',?,?,?,?)",
    [
      state.normalizedRecordId,
      state.organizationId,
      state.workspaceId,
      provider.id,
      state.rawEvidenceId,
      `acceptance-${runId}`,
      JSON.stringify({
        fields: {
          external_id: `ACC-${runId.slice(0, 8)}`,
          title: "生产验收便携净水杯",
          price: 12.8,
          currency: "CNY",
          supplier_name: "生产验收供应商",
          moq: 100,
          canonical_url: "https://example.test/acceptance-source",
          observed_at: now.toISOString(),
        },
      }),
      runId,
      runId,
      state.users.selection_manager,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO sourcing_searches(id,organization_id,workspace_id,collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES(?,?,?,?,'opportunity',?,'completed_with_warnings',1,?,?,?,?,?,?)",
    [
      state.sourcingSearchId,
      state.organizationId,
      state.workspaceId,
      state.collectionTaskId,
      state.opportunityId,
      JSON.stringify(["specification", "lead_time_days", "location", "confidence_value"]),
      runId,
      runId,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO sourcing_candidates(id,organization_id,workspace_id,search_id,provider_id,normalized_record_id,raw_evidence_id,external_id,supplier_name,product_title,specification,moq,quoted_price,currency,lead_time_days,location,original_url,observed_at,confidence_value,status,missing_fields_json,created_at) VALUES(?,?,?,?,?,?,?,?,'生产验收供应商','生产验收便携净水杯',NULL,100,12.8,'CNY',NULL,NULL,'https://example.test/acceptance-source',?,NULL,'incomplete',?,?)",
    [
      state.sourcingCandidateId,
      state.organizationId,
      state.workspaceId,
      state.sourcingSearchId,
      provider.id,
      state.normalizedRecordId,
      state.rawEvidenceId,
      `ACC-${runId.slice(0, 8)}`,
      now,
      JSON.stringify(["specification", "lead_time_days", "location", "confidence_value"]),
      now,
    ],
  );
  await pool.query(
    "INSERT INTO cost_rules(id,organization_id,workspace_id,market,platform,version_code,name,status,fee_lines_json,effective_from,revision,submitted_by,submitted_at,published_by,published_at,rollback_target_id,rolled_back_at,created_by,created_at,updated_at) VALUES(?,?,?,'US','amazon',?,'生产验收费用规则','active','[]',CURRENT_DATE(),1,?,?,?,?,NULL,NULL,?,?,?)",
    [
      state.costRuleId,
      state.organizationId,
      state.workspaceId,
      `acceptance-${runId.slice(0, 8)}`,
      state.users.selection_manager,
      now,
      state.users.organization_admin,
      now,
      state.users.selection_manager,
      now,
      now,
    ],
  );
  for (const [id, inputType, amount, currency, sourceRef] of [
    [state.saleCostInputId, "sale_price", 100, "USD", "acceptance-sale"],
    [state.purchaseCostInputId, "purchase_price", 40, "CNY", "acceptance-quote"],
    [state.logisticsCostInputId, "logistics", 5, "USD", "acceptance-logistics"],
  ])
    await pool.query(
      "INSERT INTO opportunity_cost_inputs(id,organization_id,workspace_id,opportunity_id,platform,input_type,amount_value,currency,source_type,source_ref_id,evidence_id,observed_at,input_version,is_current,submitted_by,confirmed_by,request_id,trace_id,created_at) VALUES(?,?,?,?,'amazon',?,?,?,?,?,?,?,1,1,?,?,?,?,?)",
      [
        id,
        state.organizationId,
        state.workspaceId,
        state.opportunityId,
        inputType,
        amount,
        currency,
        "production_acceptance",
        sourceRef,
        state.rawEvidenceId,
        now,
        state.users.selection_manager,
        state.users.organization_admin,
        runId,
        runId,
        now,
      ],
    );
  await pool.query(
    "INSERT INTO opportunity_profit_runs(id,organization_id,workspace_id,opportunity_id,cost_rule_id,rule_version_code,platform,market,status,currency,sale_price,total_cost,net_profit,net_margin_percent,missing_fields_json,input_snapshot_json,exchange_snapshot_json,request_id,trace_id,calculated_at) VALUES(?,?,?,?,?,?,'amazon','US','calculated','USD',100,30.6,69.4,69.4,'[]','{}','{}',?,?,?)",
    [
      state.profitRunId,
      state.organizationId,
      state.workspaceId,
      state.opportunityId,
      state.costRuleId,
      `acceptance-${runId.slice(0, 8)}`,
      runId,
      runId,
      now,
    ],
  );
}

function childEnvironment() {
  const env = {
    ...process.env,
    SCOUTOPS_QA_BASE_URL: process.env.SCOUTOPS_ACCEPTANCE_BASE_URL ?? "https://midouai.medouai.com",
    SCOUTOPS_ACCEPTANCE_BASE_URL:
      process.env.SCOUTOPS_ACCEPTANCE_BASE_URL ?? "https://midouai.medouai.com",
    SCOUTOPS_QA_ORGANIZATION_LABEL: manifest.tenant.organizationLabel,
    SCOUTOPS_QA_WORKSPACE_LABEL: manifest.tenant.workspaceLabel,
    SCOUTOPS_QA_TRACE_ID: runId,
    SCOUTOPS_QA_REPORT_FILE: routeReportFile,
    SCOUTOPS_CORE_E2E_REPORT_FILE: coreE2eReportFile,
    SCOUTOPS_ACCEPTANCE_API_REPORT_FILE: apiReportFile,
    SCOUTOPS_ACCEPTANCE_RESOURCE_IDS: JSON.stringify(state),
  };
  for (const profile of roleProfiles) {
    env[`${profile.credentialPrefix}_EMAIL`] = state.emails[profile.key];
    env[`${profile.credentialPrefix}_PASSWORD`] = password;
  }
  return env;
}

function runChild(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: childEnvironment(),
    encoding: "utf8",
    timeout: 14 * 60_000,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `${script} failed: ${(result.stderr || result.stdout || result.error?.message || "unknown").slice(0, 2000)}`,
    );
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}

async function cleanup() {
  const connection = await pool.getConnection();
  try {
    const userIds = Object.values(state.users);
    const resourceIds = [
      state.opportunityId,
      state.taskId,
      state.collectionTaskId,
      state.sourcingSearchId,
      state.sourcingCandidateId,
      state.profitRunId,
    ];
    const directIds = {
      users: userIds,
      organizations: [state.organizationId],
      workspaces: [state.workspaceId],
      memberships: Object.values(state.memberships),
      trend_topics: [state.trendTopicId],
      opportunities: [state.opportunityId],
      tasks: [state.taskId],
      collection_tasks: [state.collectionTaskId],
      collection_subqueries: [state.collectionSubqueryId],
      file_assets: [state.fileAssetId],
      raw_evidence: [state.rawEvidenceId],
      normalized_records: [state.normalizedRecordId],
      sourcing_searches: [state.sourcingSearchId],
      sourcing_candidates: [state.sourcingCandidateId],
      cost_rules: [state.costRuleId],
      opportunity_cost_inputs: [
        state.saleCostInputId,
        state.purchaseCostInputId,
        state.logisticsCostInputId,
      ],
      opportunity_profit_runs: [state.profitRunId],
    };
    const markerValues = (column, table) => {
      if (column === "organization_id") return [state.organizationId];
      if (column === "workspace_id") return [state.workspaceId];
      if (column === "membership_id") return Object.values(state.memberships);
      if (["task_id", "result_task_id"].includes(column))
        return [state.taskId, state.collectionTaskId];
      if (column === "collection_task_id") return [state.collectionTaskId];
      if (column === "collection_subquery_id") return [state.collectionSubqueryId];
      if (column === "search_id") return [state.sourcingSearchId];
      if (column === "candidate_id") return [state.sourcingCandidateId];
      if (["raw_evidence_id", "evidence_id"].includes(column)) return [state.rawEvidenceId];
      if (column === "file_asset_id") return [state.fileAssetId];
      if (column === "normalized_record_id") return [state.normalizedRecordId];
      if (column === "cost_rule_id") return [state.costRuleId];
      if (column === "cost_input_id")
        return [state.saleCostInputId, state.purchaseCostInputId, state.logisticsCostInputId];
      if (column === "opportunity_id") return [state.opportunityId];
      if (["request_id", "trace_id", "run_id"].includes(column)) return [runId];
      if (["email", "email_normalized"].includes(column)) return Object.values(state.emails);
      if (
        column === "user_id" ||
        column === "actor_id" ||
        column === "owner_id" ||
        column === "assignee_id" ||
        column.endsWith("_by") ||
        column.endsWith("_user_id")
      )
        return userIds;
      if (["resource_id", "source_ref_id"].includes(column)) return resourceIds;
      if (column === "id") return directIds[table] ?? [];
      return [];
    };
    const [columns] = await connection.query(
      "SELECT c.table_name,c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE' WHERE c.table_schema=DATABASE() ORDER BY c.table_name,c.ordinal_position",
    );
    const grouped = new Map();
    for (const row of columns) {
      const values = markerValues(String(row.column_name), String(row.table_name));
      if (!values.length) continue;
      const entry = grouped.get(row.table_name) ?? [];
      entry.push({ column: row.column_name, values: [...new Set(values)] });
      grouped.set(row.table_name, entry);
    }
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    const tables = [];
    for (const [table, entries] of grouped) {
      const clauses = [];
      const values = [];
      for (const entry of entries) {
        clauses.push(`${quoteIdentifier(entry.column)} IN (${placeholders(entry.values)})`);
        values.push(...entry.values);
      }
      const [result] = await connection.query(
        `DELETE FROM ${quoteIdentifier(table)} WHERE ${clauses.join(" OR ")}`,
        values,
      );
      if (Number(result.affectedRows) > 0)
        tables.push({ table, deleted_rows: Number(result.affectedRows) });
    }
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    await connection.commit();
    let remaining = 0;
    for (const [table, entries] of grouped) {
      const clauses = [];
      const values = [];
      for (const entry of entries) {
        clauses.push(`${quoteIdentifier(entry.column)} IN (${placeholders(entry.values)})`);
        values.push(...entry.values);
      }
      const [[row]] = await connection.query(
        `SELECT COUNT(*) count FROM ${quoteIdentifier(table)} WHERE ${clauses.join(" OR ")}`,
        values,
      );
      remaining += Number(row.count);
    }
    cleanupReport = {
      status: remaining === 0 ? "passed" : "failed",
      tables,
      deleted_rows: tables.reduce((sum, table) => sum + table.deleted_rows, 0),
      remaining_rows: remaining,
    };
    if (remaining !== 0) throw new Error(`production_acceptance_cleanup_incomplete:${remaining}`);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
    connection.release();
  }
}

try {
  await seed();
  runChild("scripts/verify-production-api-coverage.mjs");
  apiReport = JSON.parse(await readFile(apiReportFile, "utf8"));
  runChild("scripts/verify-production-product.mjs");
  routeReport = JSON.parse(await readFile(routeReportFile, "utf8"));
  runChild("scripts/verify-production-core-e2e.mjs");
  coreE2eReport = JSON.parse(await readFile(coreE2eReportFile, "utf8"));
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupFailure = error instanceof Error ? error.message : String(error);
    failure = failure ? `${failure}; cleanup failed: ${cleanupFailure}` : cleanupFailure;
  }
  if (lockHeld)
    await pool.query("SELECT RELEASE_LOCK('scoutops:production-acceptance')").catch(() => {});
  await pool.end();
}

const report = {
  schema_version: 1,
  status: failure ? "failed" : "passed",
  run_id: runId,
  trace_id: runId,
  baseline: {
    path_count: pathCount,
    operation_count: operationCount,
    protected_route_count: protectedRoutes.length,
    role_count: roleProfiles.length,
  },
  seed: {
    verified_users: roleProfiles.length,
    single_role_accounts: roleProfiles.length,
    organizations: 1,
    workspaces: 1,
    trends: 1,
    opportunities: 1,
    collection_evidence: 1,
    sourcing_candidates: 1,
    cost_inputs: 3,
    profit_runs: 1,
    tasks: 1,
  },
  api: apiReport
    ? {
        status: apiReport.status,
        operation_count: apiReport.operation_count,
        counts: apiReport.counts,
      }
    : null,
  routes: routeReport
    ? {
        status: routeReport.status,
        route_catalog_count: routeReport.route_catalog_count,
        covered_route_templates: routeReport.covered_route_templates?.length ?? 0,
        matrix_cells: Object.values(routeReport.roles ?? {}).reduce(
          (sum, role) => sum + (role.route_matrix?.length ?? 0),
          0,
        ),
      }
    : null,
  core_e2e: coreE2eReport
    ? {
        status: coreE2eReport.status,
        dependencies: coreE2eReport.dependencies,
        chains: coreE2eReport.chains,
        screenshot_count: coreE2eReport.screenshots?.length ?? 0,
      }
    : null,
  cleanup: cleanupReport,
  cleanup_failure: cleanupFailure,
  failure,
  captured_at: new Date().toISOString(),
};
await mkdir(dirname(reportFile), { recursive: true });
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
await chmod(reportFile, 0o600).catch(() => {});
console.log(
  JSON.stringify(
    {
      status: report.status,
      baseline: report.baseline,
      cleanup: report.cleanup,
      report_file: reportFile,
      request_id: runId,
      trace_id: runId,
    },
    null,
    2,
  ),
);
if (failure) process.exitCode = 2;
