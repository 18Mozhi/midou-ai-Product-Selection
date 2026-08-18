import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

// Regression: ISSUE-001 — the production root rendered the M00 foundation harness
// Found by repository and live-browser QA on 2026-08-17.
test("production root resolves the authenticated role landing instead of the foundation harness", async () => {
  const [html, app, shell] = await Promise.all([
    read("apps/web/index.html"),
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
  ]);

  assert.match(html, /<title>ai选品<\/title>/);
  assert.doesNotMatch(html, /ScoutOps|FOUNDATION|M00-01/);
  assert.match(
    app,
    /<LandingRedirect\s+v-if="routePath === '\/' && !selectedView"/,
  );
  assert.doesNotMatch(app, /FOUNDATION\s*\/\s*M00-01/);
  assert.doesNotMatch(app, />自动验收</);
  assert.match(
    shell,
    /routePath\s*===\s*['"]\/['"]\s*\|\|\s*routePath\s*===\s*['"]\/home['"]/,
  );
  assert.doesNotMatch(shell, /\{\{\s*phaseLabel\s*\}\}/);
});

// Regression: ISSUE-002 — one product was deployed as API, Worker, canary and Python projects
// Found by BaoTa topology inspection on 2026-08-17.
test("BaoTa exposes exactly one foreground backend named ai选品", async () => {
  const manifest = JSON.parse(await read("infra/baota/service-manifest.json"));
  const nodeProjects = manifest.objects.filter(
    (item) => item.kind === "baota-node-project",
  );
  const pythonProjects = manifest.objects.filter(
    (item) => item.kind === "baota-python-project",
  );

  assert.equal(manifest.target.deployRoot, "/www/wwwroot/ai选品");
  assert.equal(nodeProjects.length, 1);
  assert.equal(nodeProjects[0].name, "ai选品");
  assert.equal(
    nodeProjects[0].startCommand,
    "node apps/backend/dist/server.js",
  );
  assert.equal(nodeProjects[0].processMode, "foreground");
  assert.equal(pythonProjects.length, 0);
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

  assert.equal(
    packageJson.scripts["build:backend"],
    "tsc -p apps/backend/tsconfig.json",
  );
  assert.match(packageJson.scripts.build, /build:backend/);
  assert.equal(backendPackage.name, "@scoutops/backend");
  assert.match(supervisor, /restart/i);
  assert.match(`${supervisor}\n${server}`, /SIGTERM/);
  assert.match(`${supervisor}\n${server}`, /SIGINT/);
});

// Regression: ISSUE-005 — visible navigation linked to phase placeholders rather than features
// Found by route-to-component audit on 2026-08-17.
test("every visible production navigation entry resolves to a real feature surface", async () => {
  const [shell, identity, app] = await Promise.all([
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/LocalIdentity.vue"),
    read("apps/web/src/App.vue"),
  ]);

  for (const placeholder of [
    "VERIFIED NAVIGATION",
    "当前只交付导航",
    "壳层已就绪",
    "FOUNDATION / M00-01",
  ]) {
    assert.doesNotMatch(shell, new RegExp(placeholder));
  }

  for (const speculativeRoute of [
    "/platform-admin/organizations",
    "/platform-admin/admins",
  ]) {
    assert.doesNotMatch(
      shell,
      new RegExp(speculativeRoute.replaceAll("/", "\\/")),
    );
  }

  assert.doesNotMatch(app, /['"]\/me['"]\s*:\s*['"]local-identity['"]/);
  assert.match(app, /['"]\/me['"]/);
  assert.doesNotMatch(shell, /isAccountCenter|import LocalIdentity/);
  assert.doesNotMatch(identity, /['"]\/me['"]\s*:\s*['"]sessions['"]/);
  assert.match(identity, /pathModes\[window\.location\.pathname\]/);
  assert.match(shell, /PlatformManagementCenter/);
});

// Regression: ISSUE-006 — production authentication depended on internal ?view= harnesses
// Found by public-route audit on 2026-08-17.
test("production identity and onboarding use real routes while harness views stay development-only", async () => {
  const [app, shell, identity] = await Promise.all([
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/LocalIdentity.vue"),
  ]);

  assert.match(app, /import\.meta\.env\.DEV/);
  assert.match(app, /routePath === '\/' && !selectedView/);
  assert.match(app, /['"]\/login['"]\s*:\s*['"]local-identity['"]/);
  assert.match(app, /['"]\/select-context['"]\s*:\s*['"]tenancy['"]/);
  assert.match(identity, /['"]\/register['"]\s*:\s*['"]register['"]/);
  assert.doesNotMatch(
    `${shell}\n${identity}`,
    /\?view=local-identity|\?view=tenancy/,
  );
});

// Regression: ISSUE-007 — interrupted live checks left organizations and workspaces in production
// because cleanup attempted to delete the referenced workspace before clearing default_workspace_id.
test("every live verifier that creates organizations clears the default workspace before deletion", async () => {
  const files = (await readdir("scripts")).filter((name) =>
    /^verify.*-live\.mjs$/.test(name),
  );
  const offenders = [];
  for (const file of files) {
    const source = await read(`scripts/${file}`);
    const createsOrganization = source.includes("INSERT INTO organizations");
    const deletesWorkspace = /DELETE FROM workspaces|\[.workspaces./.test(
      source,
    );
    if (
      createsOrganization &&
      deletesWorkspace &&
      !source.includes("default_workspace_id=NULL")
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});

// Regression: ISSUE-008 — production QA navigated before tenant selection had been persisted.
test("production product QA waits for the selected tenant context and never embeds QA credentials", async () => {
  const source = await read("scripts/verify-production-product.mjs");
  assert.match(
    source,
    /getByText\("工作范围已就绪", \{ exact: true \}\)\.waitFor\(\)/,
  );
  assert.match(source, /SCOUTOPS_QA_ADMIN_EMAIL/);
  assert.match(source, /SCOUTOPS_QA_MEMBER_EMAIL/);
  assert.doesNotMatch(
    source,
    /qa\.platform\.20260818|qa\.member\.20260818|Qa-Platform|Qa-Member/,
  );
});

// Regression: ISSUE-009 — BaoTa reported a successful restart while the shared
// launcher kept the previous release BUILD_SHA, so the version gate could not
// prove which code was actually running.
test("BaoTa launcher derives release identity from the current symlink", async () => {
  const [launcher, manifest, attributes] = await Promise.all([
    read("infra/baota/start-backend.sh"),
    read("infra/baota/service-manifest.json").then(JSON.parse),
    read(".gitattributes"),
  ]);

  assert.match(launcher, /readlink -f .*\/current/);
  assert.match(launcher, /basename/);
  assert.match(launcher, /export BUILD_SHA=/);
  assert.doesNotMatch(launcher, /BUILD_SHA=[a-f0-9]{40}/);
  assert.ok(
    launcher.indexOf('. "$ROOT/shared/config/product_scout.env"') <
      launcher.indexOf('BUILD_SHA="$(basename "$CURRENT")"'),
    "the restricted environment must load before the current release overrides BUILD_SHA",
  );
  assert.match(attributes, /\*\.sh\s+text\s+eol=lf/);
  assert.equal(
    manifest.objects.find((item) => item.kind === "baota-node-project")
      ?.launcher,
    "infra/baota/start-backend.sh",
  );
});
