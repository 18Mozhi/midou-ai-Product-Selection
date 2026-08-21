import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
test("M01-05.A03/A13 MySQL57 migrations scope grants actions audits and idempotent operations", async () => {
  const names = [
    "0012a_resource_grants_m01_05",
    "0012b_resource_grant_actions_m01_05",
    "0012c_resource_grant_audit_m01_05",
    "0012d_resource_grant_operations_m01_05",
  ];
  for (const name of names) {
    await access(new URL(`../../database/migrations/${name}.up.sql`, import.meta.url));
    await access(new URL(`../../database/migrations/${name}.down.sql`, import.meta.url));
    const sql = await read(`database/migrations/${name}.up.sql`);
    assert.doesNotMatch(sql, /JSON_TABLE|WITH\s+RECURSIVE|CHECK\s*\(|utf8mb4_0900/i);
    assert.match(sql, /InnoDB/);
    assert.match(await read(`database/migrations/${name}.down.sql`), /DROP TABLE/);
  }
  const grants = await read("database/migrations/0012a_resource_grants_m01_05.up.sql");
  for (const field of [
    "organization_id",
    "workspace_id",
    "grantee_membership_id",
    "grantor_id",
    "reason",
    "expires_at",
    "version",
  ])
    assert.match(grants, new RegExp(field));
  const audit = await read("database/migrations/0012c_resource_grant_audit_m01_05.up.sql");
  for (const event of ["created", "extended", "revoked", "expired", "accessed", "access_denied"])
    assert.match(audit, new RegExp(`'${event}'`));
});
test("M01-05.A01/A02/A05/A09 action contract is exact and synchronous", async () => {
  const source = await read("packages/resource-grants/src/index.ts");
  for (const type of ["task", "opportunity", "competitor", "sourcing"])
    assert.match(source, new RegExp(`${type}:\\s*\\[`));
  for (const blocked of ["evidence", "export", "credential", "replay"])
    assert.match(source, new RegExp(`["']${blocked}["']`));
  assert.match(source, /30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /authorizeResourceGrant/);
  assert.match(
    source,
    /event_type:\s*["']created["']\s*\|\s*["']extended["']\s*\|\s*["']revoked["']\s*\|\s*["']expired["']\s*\|\s*["']accessed["']\s*\|\s*["']access_denied["']/,
  );
  assert.doesNotMatch(source, /setInterval|cron|Bull|outbox/i);
});
test("M01-05.A06/A13 OpenAPI DTO and routes lock lifecycle, member target, errors and idempotency", async () => {
  const [openapi, contracts, routes] = await Promise.all([
    read("docs/openapi.yaml"),
    read("packages/contracts/src/index.ts"),
    read("apps/api/src/resource-grant-routes.ts"),
  ]);
  for (const path of [
    "/me/resource-grants:",
    "/org/{organizationId}/resource-grants:",
    "/org/{organizationId}/resource-grant-targets:",
    "resource-grants/{grantId}/expiry:",
    "resource-grants/{grantId}/revoke:",
  ])
    assert.match(openapi, new RegExp(path.replace(/[{}]/g, "\\$&")));
  for (const dto of [
    "ResourceGrantSummary",
    "CreateResourceGrantRequest",
    "ExtendResourceGrantRequest",
    "RevokeResourceGrantRequest",
    "EligibleResourceGrantMember",
  ])
    assert.match(contracts, new RegExp(`interface ${dto}`));
  for (const capability of ["role:read", "role:manage", "membership:read"])
    assert.match(routes, new RegExp(capability));
  assert.match(routes, /Idempotency-Key|idempotency-key/);
  assert.match(
    openapi,
    /Evidence download, export, credential reference and replay actions are excluded/,
  );
});
test("M01-05.A07/A08/A15 UI contains complete responsive states and safe lifecycle controls", async () => {
  const [ui, styles, e2e] = await Promise.all([
    read("apps/web/src/components/ResourceGrantCenter.vue"),
    read("apps/web/src/styles/access-governance.css"),
    read("tests/e2e/m01-05-resource-grants.spec.ts"),
  ]);
  for (const state of ["loading", "ready", "empty", "error", "forbidden", "expired", "blocked"])
    assert.match(ui, new RegExp(`["']${state}["']`));
  for (const copy of ["同组织活动成员", "最长 30 天", "延长授权", "撤销授权", "实际访问"])
    assert.match(ui, new RegExp(copy));
  assert.match(styles, /\.grant-page/);
  assert.match(styles, /@media\s*\(\s*max-width:\s*720px\s*\)/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(e2e, /keyboard\.press\(["']Enter["']\)/);
});
test("M01-05.A10/A11/A17 docs maps env and verification gate cover operations and rollback", async () => {
  const [architecture, runbook, map, env, blueprint, gate, registry] = await Promise.all([
    read("docs/architecture/m01-05-resource-grants.md"),
    read("docs/runbooks/m01-05-resource-grants.md"),
    read("docs/feature-map.json"),
    read("config/env.example"),
    read("new-product-enterprise-blueprint.md"),
    read("scripts/verify-docs.mjs"),
    read("verification/modules/M01-05.json"),
  ]);
  assert.match(architecture, /动作 × 数据范围 × API\/页面/);
  assert.match(runbook, /0012d.*0012c.*0012b.*0012a/s);
  assert.match(map, /"resourceGrants"/);
  assert.match(blueprint, /M01-05 资源临时授权基线/);
  assert.match(gate, /m01-05-resource-grants/);
  assert.doesNotMatch(env, /RESOURCE_GRANT_|GRANT_MAX_DAYS/);
  for (let i = 1; i <= 17; i++)
    assert.match(registry, new RegExp(`M01-05\\.A${String(i).padStart(2, "0")}`));
});
