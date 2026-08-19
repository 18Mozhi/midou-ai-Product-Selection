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
  const [featureMap, shell] = await Promise.all([
    readFile("docs/feature-map.json", "utf8").then(JSON.parse),
    readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
  ]);
  const actualRoutes = new Set();
  for (const pattern of [
    /path:\s*"(\/[^"?]+)"/gu,
    /href="(\/[^"?]+)"/gu,
    /routePath(?:\.value)?\s*===\s*["'](\/[^"']+)["']/gu,
  ]) {
    for (const match of shell.matchAll(pattern)) actualRoutes.add(match[1]);
  }
  actualRoutes.delete("/");

  const mappedRoutes = new Set(
    featureMap.routes.map((route) => route.path).filter((path) => !path.includes("{")),
  );
  assert.deepEqual([...mappedRoutes].sort(), [...actualRoutes].sort());
  assert.match(shell, /\^\\\/opportunities\\\/\(\[0-9a-f-\]\{36\}\)\$/);
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
  const [shell, page] = await Promise.all([
    readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
    readFile("apps/web/src/components/CrawlerSchedulerCenter.vue", "utf8"),
  ]);
  assert.match(
    shell,
    /routePath\.value === "\/platform-admin\/crawler-scheduler"[\s\S]*?"采集调度"/,
  );
  assert.match(page, /<h2>运行与配额<\/h2>/);
  assert.doesNotMatch(page, /<h2>采集执行器调度<\/h2>/);
});
