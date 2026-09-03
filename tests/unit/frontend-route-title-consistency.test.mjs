import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Feature Map frontend routes are unique and /me has one PersonalCenter owner", async () => {
  const featureMap = JSON.parse(await readFile("docs/feature-map.json", "utf8"));
  const routes = featureMap.routes.map((route) => route.path);
  assert.equal(new Set(routes).size, routes.length);
  assert.deepEqual(
    featureMap.routes.filter((route) => route.path === "/me"),
    [
      {
        path: "/me",
        view: "PersonalCenter",
        domain: "personal-profile-permissions-security-notifications-assets",
        loading: [
          "profile is loaded and rendered first from the valid account session even without organization context;",
          "authorization, sessions, notifications and assets settle independently in the background with explicit",
          "partial-failure feedback, and tenant-owned sections remain unavailable until a real organization and",
          "workspace are selected",
        ].join(" "),
        status: "implemented",
      },
    ],
  );
});

test("Feature Map frontend routes match the actual navigation dispatch", async () => {
  const [featureMap, catalog, generatedCatalog] = await Promise.all([
    readFile("docs/feature-map.json", "utf8").then(JSON.parse),
    readFile("config/route-catalog.json", "utf8").then(JSON.parse),
    readFile("apps/web/src/route-catalog.generated.json", "utf8").then(JSON.parse),
  ]);
  const mappedRoutes = new Set(featureMap.routes.map((route) => route.path));
  const actualRoutes = new Set(
    catalog.routes
      .filter((route) => route.featureMap)
      .map((route) => route.path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}")),
  );
  assert.deepEqual([...mappedRoutes].sort(), [...actualRoutes].sort());
  assert.deepEqual(generatedCatalog, catalog);
  assert.equal(
    catalog.routes.some((route) => route.path === "/opportunities/:opportunityId"),
    true,
  );
  assert.deepEqual(
    featureMap.routes.find((route) => route.path === "/platform-admin/data"),
    {
      path: "/platform-admin/data",
      view: "PlatformDataCenter",
      domain: "platform-data",
      status: "verified",
      statusDetail: "M06-02_module_verified",
    },
  );
});

test("crawler scheduler menu, page heading and content heading have distinct consistent names", async () => {
  const [catalog, routeState, page] = await Promise.all([
    readFile("config/route-catalog.json", "utf8").then(JSON.parse),
    readFile("apps/web/src/navigation-shell-route-state.ts", "utf8"),
    readFile("apps/web/src/components/CrawlerSchedulerCenter.vue", "utf8"),
  ]);
  assert.equal(
    catalog.routes.find((route) => route.path === "/platform-admin/crawler-scheduler")?.title,
    "采集调度",
  );
  assert.match(routeState, /label: "采集调度"/);
  assert.match(page, /<h2>运行与配额<\/h2>/);
  assert.doesNotMatch(page, /<h2>采集执行器调度<\/h2>/);
});

test("formal routes centralize titles, permissions and breadcrumbs without fallback highlighting", async () => {
  const [router, catalogSource, catalog, shell, permissions, main] = await Promise.all(
    [
      "apps/web/src/router.ts",
      "apps/web/src/route-catalog.ts",
      "config/route-catalog.json",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/navigation-shell-permissions.ts",
      "apps/web/src/main.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(router, /routes:\s*appRoutes/);
  assert.match(router, /document\.title[\s\S]*智能选品/);
  for (const key of ["title", "breadcrumb", "capabilities", "notFound", "surface", "cachePolicy"])
    assert.match(catalogSource, new RegExp(key));
  assert.doesNotMatch(shell, /items\.value\[0\]/);
  assert.match(shell, /routeAllowed/);
  assert.doesNotMatch(main, /addEventListener\(["']click["']/);
  assert.match(permissions, /navigationItemsFor/);
  const routeManifest = JSON.parse(catalog);
  assert.equal(
    new Set(routeManifest.routes.map((route) => route.navigation?.group)).has("高级运维"),
    true,
  );
});

test("development internal views can exercise the real API without changing production routing", async () => {
  const app = await readFile("apps/web/src/App.vue", "utf8");
  assert.match(
    app,
    /import\.meta\.env\.DEV[\s\S]*requestedInternalView[\s\S]*\? requestedInternalView\.value[\s\S]*\?\? \(typeof route\.meta\.view/,
  );
});
