import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const root = "output/playwright/p47-route-lifecycle";
const read = (file) =>
  historicalAdapterCSource(file, readFileSync(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${root}/evidence.json`));

test("P47 lifecycle evidence uses current actual App sources and unchanged preserve route", () => {
  assert.equal(evidence.kind, "P47-PRESERVE-CACHE-LIFECYCLE-r1");
  assert.equal(evidence.productionUntransformed, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(Object.keys(evidence.sourceHashes).length, 166);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  for (const file of [
    "apps/web/src/App.vue",
    "apps/web/src/components/ProviderAdapterCenter.vue",
    "apps/web/src/components/ProviderRegistry.vue",
    "apps/web/src/components/ProviderRuntimeSurface.vue",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "config/route-catalog.json",
  ])
    assert.ok(evidence.sourceHashes[file], file);
  const routes = JSON.parse(read("config/route-catalog.json")).routes;
  const route = routes.find((entry) => entry.path === "/platform-admin/providers/adapters");
  assert.equal(route.cachePolicy, "preserve");
  assert.equal(route.name, "platform-provider-adapters");
  assert.match(evidence.scope, /Not unmount\/cache eviction/);
  assert.match(evidence.fixtureBoundary, /All API locally fulfilled/);
});

for (const width of [390, 760, 1440]) {
  test(`P47 ${width}px preserves request ownership and focus across all eight cached transitions`, () => {
    const runs = evidence.runs.filter((run) => run.width === width);
    assert.equal(runs.length, 8);
    for (const action of ["read", "probe"])
      for (const outcome of ["success", "failure"])
        for (const timing of ["away", "returned"]) {
          const matches = runs.filter((run) => run.scenario === `${action}-${outcome}-${timing}`);
          assert.equal(matches.length, 1);
          const run = matches[0];
          assert.equal(run.action, action);
          assert.equal(run.outcome, outcome);
          assert.equal(run.timing, timing);
          const check = (name) => {
            const matches = run.checks.filter((item) => item.name === name);
            assert.equal(matches.length, 1, name);
            return matches[0].actual;
          };
          assert.equal(check("background released after browser Back"), true);
          assert.equal(
            check(
              timing === "away"
                ? "late response leaves new page and focus untouched"
                : "completion does not steal return-page focus",
            ),
            true,
          );
          if (timing === "returned")
            assert.equal(check("pending lock retained after return"), true);
          const expectedReads = action === "read" ? 2 : 1;
          assert.equal(check("cached return does not request another list"), expectedReads);
          assert.equal(check("exact adapter GET count"), expectedReads);
          assert.equal(check("no probe replay"), action === "probe" ? 1 : 0);
          assert.equal(check("drawer stays closed on return"), 0);
          assert.equal(
            check("cached result remains source-owned"),
            outcome === "failure"
              ? "本次请求未完成，请核对后再试。"
              : action === "probe"
                ? "公开趋势 RSS 健康检查通过"
                : "已刷新 2 个来源适配器状态",
          );
          if (width <= 760) {
            assert.equal(check("explicit close restores source trigger"), true);
            if (action === "probe")
              assert.equal(check("reopened same-source feedback and trace"), true);
          }
          assert.equal(check("no request bodies"), true);
          assert.deepEqual(check("no unexpected network"), []);
          assert.deepEqual(check("no browser errors"), []);
          assert.equal(
            run.requests.filter((req) => req.key === "GET /api/v1/platform/provider-adapters")
              .length,
            expectedReads,
          );
          const writes = run.requests.filter((req) => req.key.startsWith("POST "));
          assert.equal(writes.length, action === "probe" ? 1 : 0);
          assert.ok(
            writes.every(
              (req) =>
                req.key ===
                "POST /api/v1/platform/provider-adapters/00000000-0000-4000-8000-000000000741/health-check",
            ),
          );
          assert.ok(run.requests.every((req) => req.body === null));
        }
  });
}

test("P47 lifecycle review pack has exact12 mobile captures and no unlisted artifacts", () => {
  assert.equal(evidence.runs.length, 24);
  assert.equal(
    evidence.runs.reduce((count, run) => count + run.checks.length, 0),
    276,
  );
  assert.equal(evidence.screenshots.length, 12);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["index.html", "evidence.json", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    assert.equal(shot.width, 390);
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), 390);
    assert.equal(bytes.readUInt32BE(20), 1000);
    assert.equal(shot.pixelWidth, 390);
    assert.equal(shot.pixelHeight, 1000);
  }
  for (const run of evidence.runs.filter((run) => run.width === 390)) {
    const shots = evidence.screenshots.filter((shot) => shot.scenario === run.scenario);
    assert.equal(shots.length, run.action === "probe" ? 2 : 1);
    assert.ok(shots.some((shot) => shot.state === "returned"));
    if (run.action === "probe") assert.ok(shots.some((shot) => shot.state === "reopened-feedback"));
  }
});
