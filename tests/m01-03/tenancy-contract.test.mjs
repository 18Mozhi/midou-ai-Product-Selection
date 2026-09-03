import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
test("M01-03.A03/A13 migrations are MySQL57 scoped and reversible in dependency order", async () => {
  const names = [
    "0010a_organizations_m01_03",
    "0010b_workspaces_m01_03",
    "0010c_teams_m01_03",
    "0010d_memberships_m01_03",
    "0010e_session_contexts_m01_03",
    "0010f_tenancy_audit_m01_03",
    "0010g_organization_default_workspace_m01_03",
  ];
  for (const name of names) {
    await access(new URL(`../../database/migrations/${name}.up.sql`, import.meta.url));
    await access(new URL(`../../database/migrations/${name}.down.sql`, import.meta.url));
    const sql = await read(`database/migrations/${name}.up.sql`);
    assert.doesNotMatch(sql, /JSON_TABLE|CHECK\s*\(|WITH\s+RECURSIVE/i);
    if (name !== "0010g_organization_default_workspace_m01_03") assert.match(sql, /InnoDB/);
  }
  const membership = await read("database/migrations/0010d_memberships_m01_03.up.sql");
  assert.match(membership, /UNIQUE KEY `uq_memberships_org_user`/);
  assert.doesNotMatch(membership, /role|data_scope/i);
});

test("M01-03.A06/A09 OpenAPI and DTOs lock membership-first session context routes", async () => {
  const [openapi, contracts, routes, repository] = await Promise.all([
    read("docs/openapi.yaml"),
    read("packages/contracts/src/index.ts"),
    read("apps/api/src/tenancy-routes.ts"),
    read("apps/api/src/mysql-tenancy-repository.ts"),
  ]);
  for (const path of [
    "/org/memberships:",
    "/org/{organizationId}/workspaces:",
    "/org/{organizationId}/teams:",
    "/auth/context:",
  ])
    assert.match(openapi, new RegExp(path.replace(/[{}]/g, "\\$&")));
  for (const dto of [
    "OrganizationMembershipSummary",
    "WorkspaceSummary",
    "TeamSummary",
    "SelectedTenancyContext",
  ])
    assert.match(contracts, new RegExp(`interface ${dto}`));
  assert.match(routes, /options\.auth\.authenticate/);
  assert.match(routes, /Idempotency-Key|requireIdempotencyKey/);
  assert.doesNotMatch(routes, /provisionOrganization|actor_id|session_id/);
  assert.match(repository, /m\.status='active' AND o\.status='active'/);
});

test("M01-03.A07/A08/A15 UI implements reference-backed desktop and 390 states", async () => {
  const [component, apiClient, styles, e2e] = await Promise.all([
    read("apps/web/src/components/TenancyChooser.vue"),
    read("apps/web/src/api-client.ts"),
    read("apps/web/src/styles.css"),
    read("tests/e2e/m01-03-tenancy.spec.ts"),
  ]);
  for (const state of [
    "loading",
    "empty",
    "error",
    "forbidden",
    "expired",
    "selecting",
    "selected",
  ])
    assert.match(component, new RegExp(`["']${state}["']`));
  assert.match(component, /createApiClient/);
  assert.match(apiClient, /credentials\s*:\s*["']include["']/);
  assert.match(styles, /@media\s*\(\s*max-width:\s*720px\s*\)/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(e2e, /keyboard\.press\(["']Enter["']\)/);
});

test("M01-03.A01/A05/A10/A11/A17 docs and machine map state exact non-goals and operations", async () => {
  const [architecture, runbook, map, env, blueprint, docsGate, registry] = await Promise.all([
    read("docs/architecture/m01-03-tenancy-context.md"),
    read("docs/runbooks/m01-03-tenancy-context.md"),
    read("docs/feature-map.json"),
    read("config/env.example"),
    read("new-product-enterprise-blueprint.md"),
    read("scripts/verify-docs.mjs"),
    read("verification/modules/M01-03.json"),
  ]);
  assert.match(architecture, /M01-04/);
  assert.match(architecture, /不适用/);
  assert.match(runbook, /0010g.*0010f.*0010e.*0010d.*0010c.*0010b.*0010a/s);
  assert.match(runbook, /宝塔/);
  assert.match(map, /tenancyContext/);
  assert.match(blueprint, /M01-03 组织与工作区上下文基线/);
  assert.match(docsGate, /m01-03-tenancy-context/);
  assert.doesNotMatch(env, /M01_03|TENANCY_|ORGANIZATION_DEFAULT/);
  for (let index = 1; index <= 17; index++)
    assert.match(registry, new RegExp(`M01-03\\.A${String(index).padStart(2, "0")}`));
});
