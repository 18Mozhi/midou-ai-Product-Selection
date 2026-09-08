import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Derive proposal navigation from the actual catalog/helpers; no production mutations.
export async function buildShellDesignData(repo) {
  const read = (file) => readFile(path.join(repo, file), "utf8");
  const catalog = JSON.parse(await read("config/route-catalog.json"));
  const routes = catalog.routes.filter((entry) => entry.acceptance !== "internal");
  const navigationItemsFor = (shell) =>
    routes
      .filter((entry) => entry.shell === shell && entry.navigation)
      .map((entry) => ({
        ...entry.navigation,
        path: entry.path,
        capabilities: entry.capabilities,
      }));
  const evaluateModule = (text, imports = {}) => {
    const context = {
      exports: {},
      require: (name) => {
        assert.ok(Object.hasOwn(imports, name), name);
        return imports[name];
      },
    };
    vm.runInNewContext(
      ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
      context,
    );
    return context.exports;
  };
  const permissions = evaluateModule(await read("apps/web/src/navigation-shell-permissions.ts"), {
    "./route-catalog": { navigationItemsFor },
  });
  const routeState = evaluateModule(await read("apps/web/src/navigation-shell-route-state.ts"));
  const fixtureText = await read("tests/e2e/m02-03-navigation-shell.spec.ts");
  const fixtureAst = ts.createSourceFile("fixture.ts", fixtureText, ts.ScriptTarget.Latest, true);
  let summaryText;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(fixtureAst) === "summary")
      summaryText = node.initializer.getText(fixtureAst);
    ts.forEachChild(node, find);
  }
  find(fixtureAst);
  assert.ok(summaryText);
  const summary = evaluateModule(`export const summary = ${summaryText};`).summary;
  const profiles = {};
  for (const shell of ["member", "organization_admin", "platform_admin"])
    profiles[shell] = { guard: summary(shell), kind: "M02-03 summary fixture" };
  profiles.member_platform = {
    guard: { ...summary("member"), platform_roles: ["platform_super_admin"] },
    kind: "M02-03 platform-return fixture override",
  };
  profiles.platform_security = {
    guard: {
      ...summary("platform_admin"),
      platform_roles: ["platform_security_admin"],
      platform_capabilities: ["platform:secure"],
    },
    kind: "M02-03 unit security-only subject capability projection",
  };
  profiles.organization_auditor = {
    guard: { ...summary("organization_admin"), roles: ["auditor"], capabilities: ["audit:read"] },
    kind: "Explicit derived capability boundary; not a real session",
  };
  for (const profile of Object.values(profiles)) {
    const { guard } = profile;
    const capabilities = permissions.shellCapabilities(guard.shell, guard);
    profile.items = permissions.authorizedNavigation(guard.shell, capabilities, guard.roles);
    profile.roleLabel = permissions.shellRoleSummary(guard.shell, guard);
    profile.allowedPaths = routes
      .filter(
        (entry) =>
          entry.shell === guard.shell &&
          permissions.canOpenRoute(entry.capabilities, capabilities, guard.shell, guard.roles),
      )
      .map((entry) => entry.path);
  }
  return JSON.parse(
    JSON.stringify({
      profiles,
      routes: routes.map((entry) => ({
        path: entry.path,
        title: entry.title,
        shell: entry.shell,
        surface: entry.surface,
        parent: routeState.navigationParentPath(entry.path),
        breadcrumb: routeState.breadcrumbTrail(entry.breadcrumb, entry.path),
      })),
      operations: routeState.platformOperationsNavigation,
    }),
  );
}
