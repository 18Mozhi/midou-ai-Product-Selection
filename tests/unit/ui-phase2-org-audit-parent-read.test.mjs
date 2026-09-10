import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { historicalAuditSource } from "../../scripts/lib/ui-phase2-audit-copy-baseline.mjs";
import { capturedExportDetailHash } from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";

const dir = "output/playwright/p37-parent-read-vue/";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const e = JSON.parse(await text(dir + "evidence.json"));
test("P37 historical parent/child/API client evidence is pinned to its baseline source", async () => {
  for (const name of ["OrganizationAdminCenter.vue", "OrganizationAuditPanel.vue", "api-client.ts"])
    assert.ok(Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + name)));
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(
      capturedExportDetailHash(file, historicalAuditSource(file, await text(file))),
      sha,
      file,
    );
  const script = await text("scripts/verify-ui-phase2-org-audit-parent-read.mjs");
  assert.match(script, /import Parent from '\/src\/components\/OrganizationAdminCenter.vue'/);
  assert.match(script, /req.method\(\) !== "GET" \|\| url.pathname !== endpoint/);
  assert.match(script, /res.statusCode = 418/);
});
test("P37 exact28 actual observation PNG and no extra outputs", async () => {
  const scenes = [
    "initial-loading",
    ...[500, 403, 401, 409, 429, 503].map((s) => `first-${s}`),
    "empty-response",
    ...[500, 403, 401].map((s) => `background-${s}`),
    "history-url-fields-mismatch",
    "late-page-appended",
    "late-copy-wrong-record",
  ];
  const files = [390, 1440].flatMap((w) => scenes.map((s) => `${s}-${w}.png`));
  assert.equal(files.length, 28);
  assert.deepEqual(e.screenshots.map((s) => s.file).sort(), files.sort());
  for (const s of e.screenshots) {
    assert.equal(hash(await readFile(dir + s.file)), s.sha256);
    assert.equal(s.approval, "observation-only-not-design-approval");
  }
  assert.deepEqual((await readdir(dir)).sort(), ["evidence.json", "index.html", ...files].sort());
});
test("P37 four unfixed classes are characterization,not accepted runtime", () => {
  assert.equal(e.acceptanceComplete, false);
  assert.equal(e.browserAndServerClosed, true);
  assert.match(e.scope, /Four unfixed problem classes/);
  assert.equal(e.checks.length, 116);
  for (const width of [390, 1440]) {
    const f = e.findings.filter((v) => v.width === width);
    assert.deepEqual(
      f.map((v) => v.id),
      ["P37-HISTORY-01", "P37-HISTORY-02", "P37-LATE-PAGE", "P37-LATE-COPY"],
    );
    assert.equal(f[0].requestsAdded, 0);
    assert.notEqual(f[0].urlQuery, f[0].visibleQuery);
    assert.notEqual(f[1].urlQuery, f[1].visibleQuery);
    assert.equal(f[2].freshRows, 10);
    assert.equal(f[2].observedRows, 15);
    assert.notEqual(f[3].copiedValue, f[3].displayedValue);
  }
});
test("P37 all reads are exact local audit GET with correlation and error boundaries", () => {
  for (const entry of e.requestEvidence) {
    assert.deepEqual(entry.forbidden, []);
    assert.deepEqual(entry.errors, []);
    assert.ok(
      entry.requests.every(
        (r) =>
          r.method === "GET" &&
          /^\/api\/v1\/organizations\/[a-f0-9-]+\/audit-events$/.test(r.path) &&
          r.requestId &&
          r.traceId,
      ),
    );
    assert.ok(entry.requests.some((r) => r.query.cursor));
    assert.ok(entry.requests.some((r) => r.query.action === "organization.member.invited"));
    const checks = new Set(e.checks.filter((c) => c.width === entry.width).map((c) => c.name));
    for (const s of [500, 403, 401, 409, 429, 503]) {
      assert.ok(checks.has(`first:${s}:attempts`));
      assert.ok(checks.has(`first:${s}:recovers`));
    }
    for (const s of [500, 403, 401]) assert.ok(checks.has(`background:${s}:visible-rows`));
  }
});
