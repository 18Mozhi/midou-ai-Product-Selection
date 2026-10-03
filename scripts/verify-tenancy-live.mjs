import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { TenancyService } from "../packages/tenancy/dist/index.js";
import { MySqlTenancyRepository } from "../apps/api/dist/mysql-tenancy-repository.js";

async function runLocalProbe() {
  const requestId = randomUUID();
  const traceId = requestId;
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);
  const users = [randomUUID(), randomUUID()];
  const sessions = [randomUUID(), randomUUID()];
  const organizations = [];
  const requiredSchema = [
    "organizations",
    "workspaces",
    "teams",
    "memberships",
    "user_session_contexts",
    "tenancy_audit_events",
  ];
  async function assertSchemaReady() {
    for (const name of requiredSchema) {
      const [rows] = await pool.query(
        "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
        [name],
      );
      if (Number(rows[0].count) === 0)
        throw new Error(`required tenancy table is missing: ${name}`);
    }
    const [rows] = await pool.query(
      "SELECT COUNT(*) count FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME=?",
      ["fk_organizations_default_workspace"],
    );
    if (Number(rows[0].count) === 0)
      throw new Error("required tenancy constraint is missing: fk_organizations_default_workspace");
  }
  async function seedUsers() {
    const now = new Date();
    for (let index = 0; index < users.length; index++) {
      await pool.query(
        "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,failed_login_count,locked_until,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,?, 'active',?,0,NULL,?,1,?,?)",
        [
          users[index],
          `m01-03-${requestId}-${index}@example.test`,
          `m01-03-${requestId}-${index}@example.test`,
          "$argon2id$live-probe-only",
          now,
          now,
          now,
          now,
        ],
      );
      await pool.query(
        "INSERT INTO user_sessions (id,user_id,token_hash,status,device_label,user_agent_hash,ip_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,'active','m01-03-live',NULL,NULL,?, ?,NULL,?)",
        [
          sessions[index],
          users[index],
          `m01-03-${requestId}-${index}`,
          new Date(now.getTime() + 3600000),
          now,
          now,
        ],
      );
    }
  }
  async function cleanup() {
    await pool.query("DELETE FROM user_session_contexts WHERE session_id IN (?,?)", sessions);
    for (const organization of organizations) {
      for (const table of [
        "membership_role_assignments",
        "membership_data_scopes",
        "team_memberships",
      ]) {
        const [rows] = await pool.query(
          "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
          [table],
        );
        if (Number(rows[0].count) > 0)
          await pool.query(
            `DELETE child FROM ${table} child JOIN memberships m ON m.id=child.membership_id WHERE m.organization_id=?`,
            [organization.id],
          );
      }
      await pool.query("DELETE FROM tenancy_audit_events WHERE organization_id=?", [
        organization.id,
      ]);
      await pool.query("DELETE FROM teams WHERE organization_id=?", [organization.id]);
      await pool.query("DELETE FROM memberships WHERE organization_id=?", [organization.id]);
      await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE id=?", [
        organization.id,
      ]);
      await pool.query("DELETE FROM workspaces WHERE organization_id=?", [organization.id]);
      await pool.query("DELETE FROM organizations WHERE id=?", [organization.id]);
    }
    await pool.query("DELETE FROM user_sessions WHERE id IN (?,?)", sessions);
    await pool.query("DELETE FROM auth_security_events WHERE user_id IN (?,?)", users);
    await pool.query("DELETE FROM users WHERE id IN (?,?)", users);
  }

  try {
    const [versionRows] = await pool.query(
      "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
    );
    const runtime = versionRows[0];
    if (
      !String(runtime.version).startsWith("5.7.") ||
      runtime.charset !== "utf8mb4" ||
      runtime.database_name !== "product_scout" ||
      !String(runtime.account_name).startsWith("product_scout@")
    )
      throw new Error("requires MySQL57 utf8mb4 product_scout business account");
    await assertSchemaReady();
    await seedUsers();
    const repository = new MySqlTenancyRepository(pool),
      service = new TenancyService(repository);
    const context = (actorId, index) => ({ actorId, requestId, traceId: `${traceId}-${index}` });
    const first = await service.provisionOrganization(
      {
        name: "M01-03 主组织",
        slug: `m01-03-${requestId.slice(0, 8)}-a`,
        timezone: "Asia/Shanghai",
        dataRetentionDays: 365,
        defaultWorkspaceName: "默认工作区",
        defaultWorkspaceSlug: "default",
      },
      context(users[0], 0),
    );
    organizations.push(first.organization);
    const second = await service.provisionOrganization(
      {
        name: "M01-03 隔离组织",
        slug: `m01-03-${requestId.slice(0, 8)}-b`,
        timezone: "Asia/Shanghai",
        dataRetentionDays: 365,
        defaultWorkspaceName: "隔离工作区",
        defaultWorkspaceSlug: "default",
      },
      context(users[1], 1),
    );
    organizations.push(second.organization);
    await pool.query(
      "INSERT INTO teams (id,organization_id,name,status,created_by,version,created_at,updated_at) VALUES (?,?,?,'active',?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
      [randomUUID(), first.organization.id, "真实数据库团队", users[0]],
    );
    if ((await service.listOrganizations(users[0])).length !== 1)
      throw new Error("membership list isolation mismatch");
    if ((await service.listTeams(users[0], first.organization.id)).length !== 1)
      throw new Error("team organization scope mismatch");
    try {
      await service.listWorkspaces(users[0], second.organization.id);
      throw new Error("cross organization read accepted");
    } catch (error) {
      if (error?.code !== "organization_forbidden") throw error;
    }
    try {
      await service.selectContext(
        { organizationId: first.organization.id, workspaceId: second.workspace.id },
        { ...context(users[0], 2), sessionId: sessions[0] },
      );
      throw new Error("cross organization workspace accepted");
    } catch (error) {
      if (error?.code !== "workspace_not_found") throw error;
    }
    await service.selectContext(
      { organizationId: first.organization.id, workspaceId: first.workspace.id },
      { ...context(users[0], 3), sessionId: sessions[0] },
    );
    const [contextRows] = await pool.query(
      "SELECT organization_id,workspace_id FROM user_session_contexts WHERE session_id=?",
      [sessions[0]],
    );
    const [auditRows] = await pool.query(
      "SELECT organization_id,workspace_id,request_id,trace_id FROM tenancy_audit_events WHERE organization_id=? AND action='context.selected'",
      [first.organization.id],
    );
    if (
      contextRows.length !== 1 ||
      contextRows[0].organization_id !== first.organization.id ||
      contextRows[0].workspace_id !== first.workspace.id
    )
      throw new Error("session context persistence mismatch");
    if (
      auditRows.length !== 1 ||
      auditRows[0].workspace_id !== first.workspace.id ||
      auditRows[0].request_id !== requestId
    )
      throw new Error("tenancy audit scope mismatch");
    await cleanup();
    console.log(
      JSON.stringify({
        status: "passed",
        module: "M01-03",
        mysql: runtime.version,
        membership: "isolated",
        workspace: "organization_guarded",
        context: "session_scoped",
        audit: "organization_workspace_request_trace",
        async: "not_applicable_synchronous_security_path",
        cleanup: "passed",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "tenancy_live_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      console.error(
        JSON.stringify({
          status: "blocked",
          code: "tenancy_live_cleanup_failed",
          message: error instanceof Error ? error.message : "unknown",
          request_id: requestId,
          trace_id: traceId,
        }),
      );
      process.exitCode = 2;
    }
    await pool.end();
  }
}

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "tenancy"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_TENANCY_LIVE_TARGET ?? "local";
if (target === "baota-production") runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const id = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "tenancy_live_target_invalid",
      message: "SCOUTOPS_TENANCY_LIVE_TARGET must be local or baota-production.",
      request_id: id,
      trace_id: id,
    }),
  );
  process.exitCode = 2;
}
