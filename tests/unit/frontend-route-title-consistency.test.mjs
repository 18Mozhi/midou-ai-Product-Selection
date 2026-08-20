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
          "profile is loaded and rendered first; authorization, sessions, notifications and assets",
          "settle independently in the background with explicit partial-failure feedback",
        ].join(" "),
        status: "implemented",
      },
    ],
  );
});

test("Feature Map frontend routes match the actual navigation dispatch", async () => {
  const [featureMap, catalog, shell] = await Promise.all([
    readFile("docs/feature-map.json", "utf8").then(JSON.parse),
    readFile("apps/web/src/route-catalog.ts", "utf8"),
    readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
  ]);
  const mappedRoutes = new Set(featureMap.routes.map((route) => route.path));
  const actualRoutes = new Set();
  for (const match of catalog.matchAll(
    /(?:route|member|organization|platform)\(\s*"(\/[^"?]+)"/gu,
  )) {
    const normalized = match[1].replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
    if (mappedRoutes.has(normalized)) actualRoutes.add(normalized);
  }
  assert.deepEqual([...mappedRoutes].sort(), [...actualRoutes].sort());
  assert.match(catalog, /\/opportunities\/:opportunityId/);
  assert.deepEqual(
    featureMap.routes.find((route) => route.path === "/platform-admin/data"),
    {
      path: "/platform-admin/data",
      view: "PlatformDataCenter",
      domain: "platform-data",
      status: "M06-02_module_verified",
    },
  );
});

test("crawler scheduler menu, page heading and content heading have distinct consistent names", async () => {
  const [catalog, shell, page] = await Promise.all([
    readFile("apps/web/src/route-catalog.ts", "utf8"),
    readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
    readFile("apps/web/src/components/CrawlerSchedulerCenter.vue", "utf8"),
  ]);
  assert.match(catalog, /"\/platform-admin\/crawler-scheduler"[\s\S]*?"采集调度"/);
  assert.match(shell, /label: "采集调度"/);
  assert.match(page, /<h2>运行与配额<\/h2>/);
  assert.doesNotMatch(page, /<h2>采集执行器调度<\/h2>/);
});

test("formal routes centralize titles, permissions and breadcrumbs without fallback highlighting", async () => {
  const [router, catalog, shell, main] = await Promise.all(
    [
      "apps/web/src/router.ts",
      "apps/web/src/route-catalog.ts",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/main.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(router, /routes:\s*appRoutes/);
  assert.match(router, /document\.title[\s\S]*智能选品/);
  for (const key of ["title", "breadcrumb", "capabilities", "notFound"])
    assert.match(catalog, new RegExp(key));
  assert.doesNotMatch(shell, /items\.value\[0\]/);
  assert.match(shell, /routeAllowed/);
  assert.match(main, /closest<HTMLAnchorElement>\("a\[href\]"\)[\s\S]*router\.push/);
  assert.equal(
    new Set([...shell.matchAll(/group: "([^"]+)"/g)].map((match) => match[1])).has("系统运维"),
    true,
  );
});
