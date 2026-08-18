import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { PlatformAccountError, PlatformAccountService } from "../apps/api/dist/platform-account-service.js";
import { MySqlPlatformAccountRepository } from "../apps/api/dist/mysql-platform-account-repository.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "api"));
const requestId = randomUUID();
const traceId = randomUUID();
const now = new Date();
const ids = { actor: randomUUID(), target: randomUUID() };
let organizationId = "";

async function ensureMigration() {
  const sql = await readFile("database/migrations/0036_automatic_hotspot_sources.up.sql", "utf8");
  for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    if (!table) throw new Error("unexpected_0036_migration_statement");
    const [rows] = await pool.query("SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [table]);
    if (Number(rows[0].count) === 0) await pool.query(statement);
  }
}

async function cleanup() {
  try {
    await pool.query("DELETE FROM platform_account_operations WHERE actor_id=?", [ids.actor]);
    await pool.query("DELETE FROM platform_audit_events WHERE actor_id=?", [ids.actor]);
    await pool.query("DELETE FROM user_sessions WHERE user_id IN (?,?)", [ids.actor, ids.target]);
    await pool.query("DELETE FROM platform_role_assignments WHERE user_id IN (?,?) OR created_by=?", [ids.actor, ids.target, ids.actor]);
    if (organizationId) {
      await pool.query("DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE organization_id=?)", [organizationId]);
      await pool.query("DELETE FROM membership_role_assignments WHERE membership_id IN (SELECT id FROM memberships WHERE organization_id=?)", [organizationId]);
      await pool.query("DELETE FROM memberships WHERE organization_id=?", [organizationId]);
      await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE id=?", [organizationId]);
      await pool.query("DELETE FROM workspaces WHERE organization_id=?", [organizationId]);
      await pool.query("DELETE FROM organizations WHERE id=?", [organizationId]);
    }
    await pool.query("DELETE FROM users WHERE id IN (?,?)", [ids.actor, ids.target]);
  } catch {
    // The normal path verifies that no live-test data remains.
  }
}

async function assertCleanup() {
  for (const [table, column, value] of [
    ["platform_account_operations", "actor_id", ids.actor],
    ["platform_audit_events", "actor_id", ids.actor],
    ["users", "id", ids.actor],
    ["users", "id", ids.target],
  ]) {
    const [rows] = await pool.query(`SELECT COUNT(*) count FROM ${table} WHERE ${column}=?`, [value]);
    if (Number(rows[0].count) !== 0) throw new Error(`live_cleanup_failed:${table}`);
  }
}

try {
  const [runtimeRows] = await pool.query("SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name");
  const runtime = runtimeRows[0];
  if (!String(runtime.version).startsWith("5.7.") || runtime.charset !== "utf8mb4" || runtime.database_name !== "product_scout" || !String(runtime.account_name).startsWith("product_scout@")) throw new Error("requires_mysql57_utf8mb4_product_scout_business_account");
  await ensureMigration();
  await cleanup();
  for (const [userId, label] of [[ids.actor, "actor"], [ids.target, "target"]]) {
    const email = `platform-${label}-${requestId.slice(0, 8)}@example.test`;
    await pool.query("INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)", [userId, email, email, now, now, now, now]);
  }
  await pool.query("INSERT INTO platform_role_assignments (user_id,role_code,created_by,created_at) VALUES (?,'platform_super_admin',?,?)", [ids.actor, ids.actor, now]);
  await pool.query("INSERT INTO user_sessions (id,user_id,token_hash,status,device_label,user_agent_hash,ip_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,'active','live-verification',?,?,?, ?,NULL,?)", [randomUUID(), ids.target, "a".repeat(64), "b".repeat(64), "c".repeat(64), new Date(now.getTime() + 86_400_000), now, now]);

  const service = new PlatformAccountService(new MySqlPlatformAccountRepository(pool), () => now);
  const context = (key) => ({ actorId: ids.actor, idempotencyKey: key, requestId, traceId });
  const overview = await service.overview("", "");
  if (!overview || typeof overview !== "object") throw new Error("platform_overview_failed");

  const slug = `platform-${requestId.slice(0, 8)}`;
  const created = await service.createOrganization({ name: "平台账号真实验收", slug }, context("create-organization"));
  const replay = await service.createOrganization({ name: "不会重复创建", slug: `${slug}-replay` }, context("create-organization"));
  organizationId = created.id;
  const workspaceId = created.default_workspace_id;
  if (created.id !== replay.id || !workspaceId) throw new Error("organization_creation_idempotency_failed");
  const [scopeRows] = await pool.query("SELECT o.default_workspace_id,w.organization_id FROM organizations o JOIN workspaces w ON w.id=o.default_workspace_id WHERE o.id=?", [organizationId]);
  if (scopeRows[0]?.default_workspace_id !== workspaceId || scopeRows[0]?.organization_id !== organizationId) throw new Error("default_workspace_relationship_failed");
  const [adminScopeRows] = await pool.query("SELECT m.status,ra.role_code,ds.scope_type FROM memberships m JOIN membership_role_assignments ra ON ra.membership_id=m.id JOIN membership_data_scopes ds ON ds.membership_id=m.id WHERE m.organization_id=? AND m.user_id=?", [organizationId, ids.actor]);
  if (adminScopeRows.length !== 1 || adminScopeRows[0]?.status !== "active" || adminScopeRows[0]?.role_code !== "organization_admin" || adminScopeRows[0]?.scope_type !== "organization") throw new Error("organization_admin_scope_failed");

  const granted = await service.platformRole(ids.target, { role_code: "platform_operations_admin", enabled: true, reason: "真实数据库验收" }, context("grant-role"));
  const grantReplay = await service.platformRole(ids.target, { role_code: "platform_operations_admin", enabled: true, reason: "幂等重放" }, context("grant-role"));
  if (!granted.enabled || granted.id !== grantReplay.id) throw new Error("platform_role_idempotency_failed");
  await service.userStatus(ids.target, { status: "disabled", reason: "真实数据库验收" }, context("disable-user"));
  const [sessionRows] = await pool.query("SELECT status,revoked_at FROM user_sessions WHERE user_id=?", [ids.target]);
  if (sessionRows[0]?.status !== "revoked" || !sessionRows[0]?.revoked_at) throw new Error("disabled_user_session_not_revoked");
  await service.userStatus(ids.target, { status: "active", reason: "恢复真实验收账号" }, context("restore-user"));
  await service.platformRole(ids.target, { role_code: "platform_operations_admin", enabled: false, reason: "结束真实数据库验收" }, context("revoke-role"));
  await service.organizationStatus(organizationId, { status: "archived", reason: "结束真实数据库验收" }, context("archive-organization"));

  let selfDisableGuard = false;
  let selfRevokeGuard = false;
  try { await service.userStatus(ids.actor, { status: "disabled", reason: "验证自停用保护" }, context("self-disable")); } catch (error) { selfDisableGuard = error instanceof PlatformAccountError && error.code === "cannot_disable_self"; }
  try { await service.platformRole(ids.actor, { role_code: "platform_super_admin", enabled: false, reason: "验证自撤权保护" }, context("self-revoke")); } catch (error) { selfRevokeGuard = error instanceof PlatformAccountError && error.code === "cannot_revoke_self_superadmin"; }
  const [auditRows] = await pool.query("SELECT COUNT(*) count,COUNT(DISTINCT action) actions FROM platform_audit_events WHERE actor_id=? AND request_id=? AND trace_id=?", [ids.actor, requestId, traceId]);
  if (!selfDisableGuard || !selfRevokeGuard || Number(auditRows[0].count) < 6 || Number(auditRows[0].actions) < 4) throw new Error("platform_guards_or_audit_failed");

  await cleanup();
  await assertCleanup();
  console.log(JSON.stringify({ status: "passed", module: "M06-01", mysql: runtime.version, overview: "passed", organization_default_workspace: "passed", organization_admin_scope: "passed", idempotency: "passed", user_session_revocation: "passed", role_grant_revoke: "passed", self_disable_guard: "passed", self_revoke_guard: "passed", platform_audit: "passed", cleanup: "passed", request_id: requestId, trace_id: traceId }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "blocked", code: error?.code ?? "platform_accounts_live_failed", message: error instanceof Error ? error.message : "unknown", request_id: requestId, trace_id: traceId }));
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
