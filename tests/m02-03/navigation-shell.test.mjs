import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
import { buildApp } from "../../apps/api/dist/app.js";

const actor = "00000000-0000-4000-8000-000000000101";
const session = "00000000-0000-4000-8000-000000000102";
const org = "00000000-0000-4000-8000-000000000103";
const workspace = "00000000-0000-4000-8000-000000000104";
const read = (path) => readFile(path, "utf8");
const orgSubject = (role = "member") => ({
  actor_id: actor,
  membership_id: "00000000-0000-4000-8000-000000000105",
  membership_active: true,
  role_codes: [role],
  capabilities:
    role === "organization_admin"
      ? ["task:read", "organization:manage"]
      : ["task:read", "trend:read"],
  scopes: [{ scope: "organization" }],
  platform_role_codes: [],
  platform_capabilities: [],
});

test("M02-03.A02/A04/A09/A11/A12 server guards three shells and audits allow or deny", async () => {
  const repo = new InMemoryAuthorizationRepository();
  repo.contexts.set(session, { user_id: actor, organization_id: org, workspace_id: workspace });
  repo.subjects.set(repo.key(actor, org), orgSubject("organization_admin"));
  const service = new AuthorizationService(repo, () => new Date("2026-08-07T00:00:00.000Z"));
  const ids = { requestId: "m02-03-request", traceId: "m02-03-trace" };
  assert.equal((await service.guardNavigationShell(actor, session, "member", ids)).shell, "member");
  assert.equal(
    (await service.guardNavigationShell(actor, session, "organization_admin", ids)).guard_reason,
    "navigation_organization_admin_allowed",
  );
  await assert.rejects(
    () => service.guardNavigationShell(actor, session, "platform_admin", ids),
    (error) => error.code === "navigation_shell_forbidden" && error.statusCode === 403,
  );
  assert.deepEqual(
    repo.decisions.map((item) => item.outcome),
    ["allowed", "allowed", "denied"],
  );
  assert.ok(
    repo.decisions.every(
      (item) => item.request_id === ids.requestId && item.trace_id === ids.traceId,
    ),
  );
});

test("M02-03.A03/A05/A09 platform shell works without organization context and creates no persistence schema", async () => {
  const repo = new InMemoryAuthorizationRepository();
  repo.subjects.set(repo.key(actor), {
    ...orgSubject(),
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_security_admin"],
    platform_capabilities: ["platform:secure"],
  });
  const result = await new AuthorizationService(repo).guardNavigationShell(
    actor,
    session,
    "platform_admin",
    { requestId: "request", traceId: "trace" },
  );
  assert.equal(result.organization_id, null);
  assert.equal(result.workspace_id, null);
  assert.deepEqual(result.platform_roles, ["platform_security_admin"]);
  const migrations = await readdir("database/migrations");
  assert.equal(migrations.filter((name) => name.includes("m02_03")).length, 0);
});

test("M02-03 regression: preferred landing sends platform and organization admins to their operation panels", async () => {
  const platformRepo = new InMemoryAuthorizationRepository();
  platformRepo.subjects.set(platformRepo.key(actor), {
    ...orgSubject(),
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_super_admin"],
    platform_capabilities: ["platform:superadmin"],
  });
  const platform = await new AuthorizationService(platformRepo).resolveLanding(actor, session, {
    requestId: "landing-platform",
    traceId: "landing-platform",
  });
  assert.deepEqual(platform, {
    shell: "platform_admin",
    route: "/platform-admin",
    reason: "landing_platform_admin",
  });

  const securityRepo = new InMemoryAuthorizationRepository();
  securityRepo.subjects.set(securityRepo.key(actor), {
    ...orgSubject(),
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_security_admin"],
    platform_capabilities: ["platform:secure"],
  });
  const security = await new AuthorizationService(securityRepo).resolveLanding(actor, session, {
    requestId: "landing-security",
    traceId: "landing-security",
  });
  assert.deepEqual(security, {
    shell: "platform_admin",
    route: "/platform-admin/security",
    reason: "landing_platform_security",
  });

  const organizationRepo = new InMemoryAuthorizationRepository();
  organizationRepo.contexts.set(session, {
    user_id: actor,
    organization_id: org,
    workspace_id: workspace,
  });
  organizationRepo.subjects.set(organizationRepo.key(actor, org), orgSubject("organization_admin"));
  const organization = await new AuthorizationService(organizationRepo).resolveLanding(
    actor,
    session,
    { requestId: "landing-organization", traceId: "landing-organization" },
  );
  assert.deepEqual(organization, {
    shell: "organization_admin",
    route: "/org-admin",
    reason: "landing_organization_admin",
  });
});

test("M02-03 shell presents business labels grouped search and collapsed failure identifiers", async () => {
  const [shell, permissions, catalog] = await Promise.all([
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/navigation-shell-permissions.ts"),
    read("apps/web/src/route-catalog.ts"),
  ]);
  assert.match(`${shell}\n${permissions}`, /普通成员[\s\S]*平台超级管理员/);
  assert.match(shell, /搜索导航菜单[\s\S]*没有匹配的菜单或分组/);
  assert.match(shell, /role-gate-technical[\s\S]*故障详情[\s\S]*关联编号/);
  assert.match(catalog, /业务运营[\s\S]*采集与数据[\s\S]*治理与安全[\s\S]*高级运维/);
});

test("M02-03.A06/A13 authenticated API validates shell and preserves error contract", async () => {
  const repo = new InMemoryAuthorizationRepository();
  repo.contexts.set(session, { user_id: actor, organization_id: org, workspace_id: workspace });
  repo.subjects.set(repo.key(actor, org), orgSubject());
  const service = new AuthorizationService(repo);
  const auth = { authenticate: async () => ({ user: { id: actor }, session: { id: session } }) };
  const app = buildApp({ authorization: { service, auth, secureCookie: false } });
  const ok = await app.inject({
    method: "GET",
    url: "/api/v1/me/navigation?shell=member",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "route-request",
      "x-trace-id": "route-trace",
    },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().data.organization_id, org);
  const invalid = await app.inject({
    method: "GET",
    url: "/api/v1/me/navigation?shell=unknown",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(invalid.statusCode, 400);
  const landing = await app.inject({
    method: "GET",
    url: "/api/v1/me/landing",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "landing-request",
      "x-trace-id": "landing-trace",
    },
  });
  assert.equal(landing.statusCode, 200);
  assert.equal(landing.json().data.route, "/home");
  await app.close();
});

test("M02-03.A01/A07/A08/A10/A15/A16/A17 frontend and delivery contracts stay explicit", async () => {
  const [
    component,
    permissions,
    routeState,
    shellTheme,
    discovery,
    navigationMemory,
    routeCatalog,
    main,
    apiClient,
    app,
    landingRedirect,
    styles,
    openapi,
    env,
    architecture,
    runbook,
    feature,
    e2e,
  ] = await Promise.all(
    [
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/navigation-shell-permissions.ts",
      "apps/web/src/navigation-shell-route-state.ts",
      "apps/web/src/use-navigation-shell-theme.ts",
      "apps/web/src/use-navigation-discovery.ts",
      "apps/web/src/navigation-memory.ts",
      "apps/web/src/route-catalog.ts",
      "apps/web/src/main.ts",
      "apps/web/src/api-client.ts",
      "apps/web/src/App.vue",
      "apps/web/src/components/LandingRedirect.vue",
      "apps/web/src/styles/onboarding-navigation.css",
      "docs/openapi.yaml",
      "config/env.example",
      "docs/architecture/m02-03-navigation-shells.md",
      "docs/runbooks/m02-03-navigation-shells.md",
      "docs/feature-map.json",
      "tests/e2e/m02-03-navigation-shell.spec.ts",
    ].map(read),
  );
  const componentEvidence = [component, permissions, routeState, shellTheme, discovery].join("\n");
  for (const shell of ["member", "organization_admin", "platform_admin"])
    assert.match(componentEvidence + openapi, new RegExp(shell));
  for (const path of ["/home", "/org-admin", "/platform-admin"])
    assert.match(app + componentEvidence, new RegExp(path.replaceAll("/", "\\/")));
  for (const state of [
    "loading",
    "expired",
    "forbidden",
    "context_required",
    "rate_limited",
    "blocked",
  ])
    assert.match(component, new RegExp(state));
  assert.match(styles, /\.role-mobile-nav/);
  assert.match(styles, /@media\s*\(\s*max-width:\s*840px\s*\)/);
  assert.match(
    styles,
    /role-mobile-nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(component, /v-for="item in primaryItems"/);
  assert.match(component, /aria-controls="role-navigation"[\s\S]*?<span>更多<\/span>/);
  assert.doesNotMatch(component, /class="role-mobile-nav"[\s\S]*?<span>新建组织<\/span>/);
  assert.doesNotMatch(component, /class="role-mobile-nav"[\s\S]*?<span>邀请成员<\/span>/);
  assert.doesNotMatch(component, /class="role-mobile-nav"[\s\S]*?<span>创建选品<\/span>/);
  assert.match(component, /aria-current/);
  assert.match(componentEvidence, /navigationItemsFor/);
  assert.doesNotMatch(componentEvidence, /const\s+(memberMenu|orgMenu|platformMenu)/);
  assert.match(routeCatalog, /navigationCatalog/);
  assert.match(routeCatalog, /surfaceAliases/);
  assert.match(routeCatalog, /cachePolicy/);
  assert.match(component, /selectedSurfaceComponent/);
  assert.match(component, /surfaceCacheKey/);
  assert.doesNotMatch(component, /<HomeDashboard\s+v-if|<PlatformDashboard\s+v-else-if/);
  assert.match(routeCatalog, /\/platform-admin\/organizations/);
  assert.match(routeCatalog, /\/platform-admin\/users/);
  assert.match(routeCatalog, /\/platform-admin\/admins/);
  assert.doesNotMatch(main, /addEventListener\(["']click["']/);
  assert.match(component, /rememberMemberRoute/);
  assert.match(navigationMemory, /getLastMemberRoute/);
  assert.match(navigationMemory, /getLastValidRoute/);
  assert.match(navigationMemory, /getRecentOrganizationIds/);
  assert.match(navigationMemory, /localStorage/);
  assert.match(navigationMemory, /scoutops:navigation:last-member-route/);
  assert.match(component, /breadcrumbTrail/);
  assert.match(component, /申请权限或联系管理员/);
  assert.match(component, /createApiClient/);
  assert.match(apiClient, /credentials\s*:\s*["']include["']/);
  assert.match(landingRedirect, /\/me\/landing/);
  assert.match(openapi, /\/me\/landing:/);
  assert.match(e2e, /keyboard\.press/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.doesNotMatch(env, /NAVIGATION_SHELL_|SHELL_GUARD_/);
  assert.match(architecture, /不新增数据库迁移|无需新增数据库迁移/);
  assert.match(runbook, /宝塔.*ai选品/s);
  assert.match(feature, /navigationShells/);
});

test("M02-03 each role shell keeps its role-specific primary action in the top bar", async () => {
  const component = await read("apps/web/src/components/NavigationShell.vue");
  const platformCreatePattern = [
    `v-if="shell === 'platform_admin' && allCapabilities\\.includes\\('platform:superadmin'\\)"`,
    `\\s+class="role-create"\\s+to="/platform-admin/organizations/new"[\\s\\S]*?新建组织`,
  ].join("");
  assert.match(component, new RegExp(platformCreatePattern));
  assert.match(
    component,
    /v-else-if="shell === 'organization_admin'"\s+class="role-create"\s+to="\/org-admin\/members"[\s\S]*?邀请成员/,
  );
  assert.match(
    component,
    /v-else-if="shell === 'member'"\s+type="button"\s+class="role-create"[\s\S]*?创建选品/,
  );
});

test("M02-03 context selection stays outside the cached shell boundary", async () => {
  const [app, chooser, shell] = await Promise.all([
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/TenancyChooser.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
  ]);
  assert.match(app, /TenancyChooser v-else-if="selectedView === 'tenancy'"/);
  assert.match(app, /NavigationShell v-else-if="navigationShell"/);
  assert.match(shell, /<KeepAlive :max="12">/);
  assert.match(chooser, /<RouterLink :to="safeReturnTo">/);
  assert.doesNotMatch(app, /<KeepAlive[\s\S]*TenancyChooser/);
});
