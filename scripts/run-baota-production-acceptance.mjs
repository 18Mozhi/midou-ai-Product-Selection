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
const config = loadRuntimeConfig(process.env, "api");
const pool = createDatabasePool(config);
const roleProfiles = routeManifest.productionAcceptance.roles;
const state = {
  organizationId: randomUUID(),
  workspaceId: randomUUID(),
  opportunityId: randomUUID(),
  taskId: randomUUID(),
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
let failure = null;

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
    "INSERT INTO opportunities(id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES(?,?,?,'生产验收机会','US','acceptance','manual',NULL,?,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'insufficient',NULL,NULL,'pending',1,?,?,?)",
    [
      state.opportunityId,
      state.organizationId,
      state.workspaceId,
      state.users.member,
      state.users.member,
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
}

function childEnvironment() {
  const env = {
    ...process.env,
    SCOUTOPS_QA_BASE_URL: process.env.SCOUTOPS_ACCEPTANCE_BASE_URL ?? "https://midouai.mozhiz.cn",
    SCOUTOPS_ACCEPTANCE_BASE_URL:
      process.env.SCOUTOPS_ACCEPTANCE_BASE_URL ?? "https://midouai.mozhiz.cn",
    SCOUTOPS_QA_ORGANIZATION_LABEL: manifest.tenant.organizationLabel,
    SCOUTOPS_QA_WORKSPACE_LABEL: manifest.tenant.workspaceLabel,
    SCOUTOPS_QA_TRACE_ID: runId,
    SCOUTOPS_QA_REPORT_FILE: routeReportFile,
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
    const rootIds = [
      ...userIds,
      ...Object.values(state.memberships),
      state.organizationId,
      state.workspaceId,
      state.opportunityId,
      state.taskId,
    ];
    const markerValues = (column, table) => {
      if (column === "organization_id") return [state.organizationId];
      if (column === "workspace_id") return [state.workspaceId];
      if (column === "membership_id") return Object.values(state.memberships);
      if (["task_id", "result_task_id"].includes(column)) return [state.taskId];
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
      if (["resource_id", "source_ref_id"].includes(column))
        return [state.opportunityId, state.taskId];
      if (column === "id") {
        const direct = {
          users: userIds,
          organizations: [state.organizationId],
          workspaces: [state.workspaceId],
          memberships: Object.values(state.memberships),
          opportunities: [state.opportunityId],
          tasks: [state.taskId],
        };
        return direct[table] ?? rootIds;
      }
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
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    await cleanup();
  } catch (error) {
    failure ??= error instanceof Error ? error.message : String(error);
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
    opportunities: 1,
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
  cleanup: cleanupReport,
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
