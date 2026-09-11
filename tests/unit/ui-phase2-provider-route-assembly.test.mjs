import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { providerPagePreview } from "../../scripts/lib/ui-phase2-provider-page-preview.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const folder = "output/playwright/p46-route-assembly-review";
const e = JSON.parse(read(folder + "/evidence.json"));
const widths = [390, 760, 761, 840, 841, 1440];
const registry = read("apps/web/src/components/ProviderRegistry.vue");
const runner = read("scripts/verify-ui-phase2-provider-route-assembly.mjs");

test("P46 full-route evidence binds raw current entry, shell, component and review sources", () => {
  assert.equal(e.kind, "P46-REAL-ROUTE-C-ASSEMBLY-r1");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 168);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  for (const suffix of [
    "index.html",
    "main.ts",
    "router.ts",
    "App.vue",
    "NavigationShell.vue",
    "ProviderRuntimeSurface.vue",
    "ProviderRegistry.vue",
  ])
    assert.ok(
      Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + suffix)),
      suffix,
    );
  assert.equal(e.transformedRegistryHash, hash(providerPagePreview(registry)));
  assert.equal(
    parse(providerPagePreview(registry)).descriptor.scriptSetup.content,
    parse(registry).descriptor.scriptSetup.content,
  );
  assert.match(runner, /proxy: \{\}/);
  assert.match(runner, /"import.meta.env.VITE_API_BASE_URL": JSON.stringify\("\/api\/v1"\)/);
  assert.doesNotMatch(read("apps/web/src/main.ts"), /provider-route-assembly|p46-route-review/);
});

test("P46 104 formal pictures have exact inventory, dimensions and fingerprints", () => {
  assert.equal(e.screenshots.length, 104);
  assert.equal(e.checks.length, 232);
  assert.deepEqual(
    readdirSync(folder).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(bytes.readUInt32BE(16), s.width);
    assert.equal(bytes.readUInt32BE(20), s.height);
    if (!s.fullPage) assert.equal(s.height, 1000);
    assert.equal(hash(bytes), s.sha256, s.file);
  }
  for (const width of widths) {
    const checks = e.checks.filter((c) => c.width === width);
    const value = (name) => checks.find((c) => c.name === name)?.actual;
    assert.equal(value("page title remains one line"), true);
    assert.equal(value("denied navigation does not mount provider"), 0);
    assert.equal(value("denied navigation no provider GET"), 3);
    assert.equal(value("create close returns trigger"), true);
    assert.equal(value("edit close returns record"), true);
    assert.deepEqual(value("no unexpected requests"), []);
    assert.deepEqual(value("no page errors"), []);
    if (width <= 840) {
      assert.equal(value("menu below topbar"), true);
      assert.equal(value("menu toggle unobscured"), true);
    }
    for (const c of checks.filter((c) => c.name.endsWith("no horizontal overflow")))
      assert.equal(c.actual, true);
  }
});

test("P46 real router return preserves cache and query, all writes are rejected fixtures", () => {
  let gets = 0,
    puts = 0;
  for (const width of widths) {
    const returned = e.observations.find(
      (o) => o.width === width && o.case === "real-route-return",
    );
    assert.equal(returned.providerReads, 1);
    assert.equal(returned.query, "?keep=p46-route");
    const o = e.observations.find((o) => o.width === width && o.case === "network-and-focus");
    assert.equal(o.requests.length, 9);
    for (const r of o.requests) {
      if (r.method === "GET") {
        gets++;
        continue;
      }
      assert.equal(r.method, "PUT");
      puts++;
      assert.equal(r.path, "/api/v1/platform/providers/00000000-0000-4000-8000-000000000702");
      assert.equal(r.status, 409);
      assert.equal(r.idempotencyPresent, true);
      assert.equal(r.body.expected_version, 1);
    }
    assert.equal(
      o.requests.some((r) => r.path.includes("session-status")),
      false,
    );
    assert.equal(
      o.requests
        .filter((r) => r.path === "/api/v1/me/navigation")
        .every((r) => r.query === "?shell=platform_admin"),
      true,
    );
  }
  assert.equal(gets, 48);
  assert.equal(puts, 6);
});

test("P46 preserves unresolved Tab escape observation, not complete modal acceptance", () => {
  for (const width of widths) {
    const o = e.observations.find((o) => o.width === width && o.case === "network-and-focus");
    assert.equal(o.focus.length, 1);
    assert.equal(o.focus[0].case, "editor-last-tab");
    assert.equal(
      o.focus[0].inside,
      false,
      "Known missing trap must not be silently labeled passed",
    );
  }
  assert.match(e.scope, /not production, full RBAC, complete modal or all-state acceptance/);
});
