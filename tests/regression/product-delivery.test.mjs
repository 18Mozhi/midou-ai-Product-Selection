import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

// Regression: ISSUE-001 — the production root rendered the M00 foundation harness
// Found by repository and live-browser QA on 2026-08-17.
test("production root resolves the authenticated role landing instead of the foundation harness", async () => {
  const [html, app, shell, catalog, routeAdapter] = await Promise.all([
    read("apps/web/index.html"),
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("config/route-catalog.json").then(JSON.parse),
    read("apps/web/src/route-catalog.ts"),
  ]);

  assert.match(html, /<title>智能选品<\/title>/);
  assert.doesNotMatch(html, /ScoutOps|FOUNDATION|M00-01/);
  assert.match(app, /<LandingRedirect\s+v-if="selectedView === 'landing'"/);
  assert.doesNotMatch(app, /FOUNDATION\s*\/\s*M00-01/);
  assert.doesNotMatch(app, />自动验收</);
  const landing = catalog.routes.find((route) => route.path === "/");
  assert.equal(landing?.name, "landing");
  assert.equal(landing?.title, "正在进入");
  assert.equal(landing?.view, "landing");
  assert.equal(catalog.routes.find((route) => route.path === "/home")?.title, "今日行动");
  assert.match(routeAdapter, /route-catalog\.generated\.json/);
  assert.doesNotMatch(shell, /\{\{\s*phaseLabel\s*\}\}/);
});

// Regression: ISSUE-002 — API, Worker and canary were split into hard-to-maintain
// projects while the required Python runtime was not deployed with BaoTa.
test("BaoTa exposes fixed Node and Python projects without duplicate backends", async () => {
  const manifest = JSON.parse(await read("infra/baota/service-manifest.json"));
  const nodeProjects = manifest.objects.filter((item) => item.kind === "baota-node-project");
  const pythonProjects = manifest.objects.filter((item) => item.kind === "baota-python-project");

  assert.equal(manifest.target.deployRoot, "/www/wwwroot/ai选品");
  assert.equal(nodeProjects.length, 1);
  assert.equal(nodeProjects[0].name, "ai选品");
  assert.match(nodeProjects[0].startCommand, /^node --env-file=/);
  assert.equal(nodeProjects[0].workingDirectory, "/www/wwwroot/ai选品/backend");
  assert.equal(nodeProjects[0].processMode, "foreground");
  assert.equal(pythonProjects.length, 1);
  assert.equal(pythonProjects[0].name, "ai选品-python");
  assert.equal(pythonProjects[0].workingDirectory, "/www/wwwroot/ai选品/python");
  assert.doesNotMatch(
    JSON.stringify(manifest.objects),
    /product-scout-api-canary|product-scout-worker|product-scout-crawler/,
  );
});

// Regression: ISSUE-003 — functional verification skipped the deployment contract
// Found by verification-runner inspection on 2026-08-17.
test("full functional verification includes the production deployment contract", async () => {
  const [verifier, deploymentTest] = await Promise.all([
    read("scripts/verify-functional.mjs"),
    read("tests/m07-03/baota-deployment.test.mjs"),
  ]);
  assert.doesNotMatch(verifier, /excludedNodeTests/);
  assert.doesNotMatch(verifier, /tests\/m07-03\/baota-deployment\.test\.mjs/);
  assert.match(deploymentTest, /SCOUTOPS_REQUIRE_PRODUCTION_EVIDENCE/);
  assert.match(deploymentTest, /--preflight/);
});

// Regression: ISSUE-004 — BaoTa managed short-lived shell wrappers instead of one app lifecycle
// Found by live process and startup-script inspection on 2026-08-17.
test("unified backend build and lifecycle contracts are registered", async () => {
  const [packageJson, backendPackage, supervisor, server] = await Promise.all([
    read("package.json").then(JSON.parse),
    read("apps/backend/package.json").then(JSON.parse),
    read("apps/backend/src/supervisor.ts"),
    read("apps/backend/src/server.ts"),
  ]);

  assert.equal(packageJson.scripts["build:backend"], "tsc -p apps/backend/tsconfig.json");
  assert.equal(packageJson.scripts.build, "node scripts/build-workspaces.mjs");
  assert.equal(backendPackage.name, "@scoutops/backend");
  assert.match(supervisor, /restart/i);
  assert.match(`${supervisor}\n${server}`, /SIGTERM/);
  assert.match(`${supervisor}\n${server}`, /SIGINT/);
});

// Regression: ISSUE-005 — visible navigation linked to phase placeholders rather than features
// Found by route-to-component audit on 2026-08-17.
test("every visible production navigation entry resolves to a real feature surface", async () => {
  const [shell, identity, app, catalog, routeAdapter] = await Promise.all([
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/LocalIdentity.vue"),
    read("apps/web/src/App.vue"),
    read("config/route-catalog.json").then(JSON.parse),
    read("apps/web/src/route-catalog.ts"),
  ]);

  for (const placeholder of [
    "VERIFIED NAVIGATION",
    "当前只交付导航",
    "壳层已就绪",
    "FOUNDATION / M00-01",
  ]) {
    assert.doesNotMatch(shell, new RegExp(placeholder));
  }

  for (const accountRoute of ["/platform-admin/organizations", "/platform-admin/admins"]) {
    assert.ok(catalog.routes.some((route) => route.path === accountRoute));
  }

  assert.equal(catalog.routes.find((route) => route.path === "/me")?.view, "account");
  assert.match(routeAdapter, /manifest\.routes\.map/);
  assert.doesNotMatch(shell, /isAccountCenter|import LocalIdentity/);
  assert.doesNotMatch(identity, /['"]\/me['"]\s*:\s*['"]sessions['"]/);
  assert.match(identity, /pathModes\[window\.location\.pathname\]/);
  assert.match(shell, /PlatformManagementCenter/);
});

// Regression: ISSUE-006 — production authentication depended on internal ?view= harnesses
// Found by public-route audit on 2026-08-17.
test("production identity and onboarding use real routes while harness views stay development-only", async () => {
  const [app, shell, identity, catalog] = await Promise.all([
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/LocalIdentity.vue"),
    read("config/route-catalog.json").then(JSON.parse),
  ]);

  assert.match(app, /import\.meta\.env\.DEV/);
  assert.match(app, /selectedView === 'landing'/);
  assert.equal(catalog.routes.find((route) => route.path === "/login")?.view, "local-identity");
  assert.equal(catalog.routes.find((route) => route.path === "/select-context")?.view, "tenancy");
  assert.match(identity, /['"]\/register['"]\s*:\s*['"]register['"]/);
  assert.doesNotMatch(`${shell}\n${identity}`, /\?view=local-identity|\?view=tenancy/);
});

// Regression: ISSUE-007 — interrupted live checks left organizations and workspaces in production
// because cleanup attempted to delete the referenced workspace before clearing default_workspace_id.
test("every live verifier that creates organizations clears the default workspace before deletion", async () => {
  const files = (await readdir("scripts")).filter((name) => /^verify.*-live\.mjs$/.test(name));
  const offenders = [];
  for (const file of files) {
    const source = await read(`scripts/${file}`);
    const createsOrganization = source.includes("INSERT INTO organizations");
    const deletesWorkspace = /DELETE FROM workspaces|\[.workspaces./.test(source);
    if (createsOrganization && deletesWorkspace && !source.includes("default_workspace_id=NULL")) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});

// Regression: ISSUE-008 — production QA navigated before tenant selection had been persisted.
test("production product QA waits for the selected tenant context and never embeds QA credentials", async () => {
  const [source, catalog] = await Promise.all([
    read("scripts/verify-production-product.mjs"),
    read("config/route-catalog.json").then(JSON.parse),
  ]);
  assert.match(source, /getByText\("工作范围已就绪", \{ exact: true \}\)\.waitFor\(\)/);
  assert.match(source, /readRouteCatalogManifest/);
  assert.match(source, /credentials\(profile\.credentialPrefix\)/);
  assert.equal(catalog.productionAcceptance.roles.length, 6);
  assert.deepEqual(
    catalog.productionAcceptance.roles.map((profile) => profile.credentialPrefix),
    [
      "SCOUTOPS_QA_MEMBER",
      "SCOUTOPS_QA_SELECTION_MANAGER",
      "SCOUTOPS_QA_ORGANIZATION_ADMIN",
      "SCOUTOPS_QA_PLATFORM_OPERATIONS",
      "SCOUTOPS_QA_PLATFORM_SECURITY",
      "SCOUTOPS_QA_ADMIN",
    ],
  );
  assert.match(source, /readProtectedRouteCatalog/);
  assert.match(source, /roleRouteMatrix/);
  assert.match(source, /authorized route catalog is not fully covered/);
  assert.doesNotMatch(source, /visibleRoutes/);
  assert.doesNotMatch(source, /qa\.platform\.20260818|qa\.member\.20260818|Qa-Platform|Qa-Member/);
});

test("production route QA derives every protected route from the frontend route catalog", async () => {
  const {
    authorizedRoutesFor,
    readProtectedRouteCatalog,
    readRouteCatalogManifest,
    roleRouteMatrix,
  } = await import("../../scripts/production-route-catalog.mjs");
  const [catalog, manifest, authorization] = await Promise.all([
    readProtectedRouteCatalog(),
    readRouteCatalogManifest(),
    import("../../packages/authorization/dist/index.js"),
  ]);
  assert.equal(
    catalog.length,
    manifest.routes.filter((route) => route.acceptance === "protected").length,
  );
  assert.deepEqual(
    Object.fromEntries(
      ["member", "organization_admin", "platform_admin"].map((shell) => [
        shell,
        catalog.filter((route) => route.shell === shell).length,
      ]),
    ),
    Object.fromEntries(
      ["member", "organization_admin", "platform_admin"].map((shell) => [
        shell,
        manifest.routes.filter((route) => route.acceptance === "protected" && route.shell === shell)
          .length,
      ]),
    ),
  );
  assert.deepEqual(
    catalog.filter((route) => route.dynamic).map((route) => route.path),
    manifest.routes
      .filter((route) => route.acceptance === "protected" && route.path.includes(":"))
      .map((route) => route.path),
  );
  assert.equal(authorizedRoutesFor(catalog, "platform_admin", ["platform:secure"]).length, 1);
  for (const profile of manifest.productionAcceptance.roles) {
    const role = authorization.BUILTIN_ROLES.find((candidate) => candidate.code === profile.role);
    assert.ok(role, `missing built-in role ${profile.role}`);
    const matrix = roleRouteMatrix(catalog, profile.shell, role.capabilities);
    assert.equal(matrix.length, catalog.length);
    assert.equal(
      matrix.filter((entry) => entry.decision === "allow").length,
      authorizedRoutesFor(catalog, profile.shell, role.capabilities).length,
    );
    assert.equal(
      matrix.filter((entry) => entry.decision === "allow").length +
        matrix.filter((entry) => entry.decision === "deny").length,
      catalog.length,
    );
  }
});

// Regression: ISSUE-009 — release identity and service paths must no longer
// depend on a server-side Git checkout, current symlink or custom Bash launcher.
test("BaoTa deployment uploads a bounded fixed-layout runtime package", async () => {
  const [deployer, manifest] = await Promise.all([
    read("scripts/deploy-baota.py"),
    read("infra/baota/service-manifest.json").then(JSON.parse),
  ]);

  assert.match(deployer, /PROJECT_ROOT = "\/www\/wwwroot\/ai选品"/);
  assert.match(deployer, /TemporaryDirectory/);
  assert.match(deployer, /BUILD_SHA=/);
  assert.doesNotMatch(deployer, /git (pull|clone|checkout)/);
  assert.doesNotMatch(deployer, /root\s*\/\s*["'](?:current|releases)["']/);
  assert.match(deployer, /project root contains unsupported entries/);
  const node = manifest.objects.find((item) => item.kind === "baota-node-project");
  assert.equal(node?.workingDirectory, "/www/wwwroot/ai选品/backend");
  assert.match(node?.startCommand ?? "", /^node --env-file=/);
  assert.equal(
    manifest.objects.find((item) => item.kind === "baota-python-project")?.workingDirectory,
    "/www/wwwroot/ai选品/python",
  );
});
