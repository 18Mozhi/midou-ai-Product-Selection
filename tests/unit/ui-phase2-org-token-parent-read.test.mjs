import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { capturedExportDetailHash } from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";

const output = "output/playwright/p36-parent-read-vue-r2";
const manifest = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("P36 parent read captures source-backed parent, child, client and imported styles", async () => {
  for (const file of [
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationTokenPanel.vue",
    "apps/web/src/api-client.ts",
    "apps/web/src/components/NavigationShell.vue",
    "scripts/verify-ui-phase2-org-token-parent-read.mjs",
  ])
    assert.ok(manifest.sourceHashes[file], `missing ${file}`);
  for (const [file, sha] of Object.entries(manifest.sourceHashes))
    assert.equal(
      capturedExportDetailHash(file, (await readFile(file, "utf8")).replaceAll("\r\n", "\n")),
      sha,
      file,
    );
  assert.equal(manifest.kind, "P36-PARENT-READ-VUE");
  assert.equal(manifest.acceptanceComplete, false);
  assert.equal(manifest.browserAndServerClosed, true);
});

test("P36 actual read picture matrix and permanent gallery remain exact", async () => {
  const scenes = [
    "initial-loading",
    "first-500",
    "first-403",
    "first-401",
    "first-409",
    "first-429",
    "first-503",
    "empty-response",
    "background-loading",
    "background500-notice",
    "background-403",
    "background-401",
    "history-query-restored",
    "history-page-two",
  ];
  assert.deepEqual(
    manifest.screenshots.map((s) => s.file).sort(),
    [390, 1440].flatMap((width) => scenes.map((scene) => `${scene}-${width}.png`)).sort(),
  );
  for (const s of manifest.screenshots) {
    assert.equal(s.approval, "pending; actual fixture observation only");
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
  assert.deepEqual(
    (await readdir(output)).sort(),
    ["evidence.json", "index.html", ...manifest.screenshots.map((s) => s.file)].sort(),
  );
  const html = await readFile(`${output}/index.html`, "utf8");
  assert.equal((html.match(/<img /g) ?? []).length, 28);
  assert.match(html, /不是新 C 设计稿或批准记录/);
  assert.match(html, /整页验收未通过/);
});

test("P36 fixtures contain only two exact GET endpoints with real retry behavior", () => {
  assert.equal(manifest.requestEvidence.length, 2);
  for (const group of manifest.requestEvidence) {
    assert.deepEqual(group.forbidden, []);
    assert.deepEqual(group.errors, []);
    for (const req of group.requests) {
      assert.equal(req.method, "GET");
      assert.ok(["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(req.path));
      assert.equal(req.hasRequestId, true);
      assert.equal(req.hasTraceId, true);
    }
    for (const [status, expected] of [
      [429, 3],
      [503, 3],
    ])
      assert.equal(group.requests.filter((r) => r.status === status).length, expected);
  }
});

test("P36 query regression is resolved without converting it into whole-page acceptance", async () => {
  assert.deepEqual(manifest.findings, []);
  assert.deepEqual(manifest.resolvedFindings, ["P36-HISTORY-01", "P36-HISTORY-02"]);
  const old = JSON.parse(await readFile(manifest.previousEvidence, "utf8"));
  assert.equal(old.findings.length, 4);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(`output/playwright/p36-parent-read-vue/${s.file}`)), s.sha256);
  assert.equal(manifest.acceptanceComplete, false);
});

test("P36 read checks include lifecycle, hidden sensitive UI and local-only safeguards", () => {
  assert.equal(manifest.checks.length, 178);
  for (const width of [390, 1440]) {
    const names = new Set(manifest.checks.filter((c) => c.width === width).map((c) => c.name));
    for (const name of [
      "initial refresh disabled",
      "background500 preserves draft",
      "background500 preserves query",
      "background403 hides old content",
      "background401 hides old content",
      "keepalive reuses actual parent-child nodes",
      "history push restores filter",
      "history push restores actual result",
      "history back restores field",
      "history forward restores field",
      "keepalive return restores URL defaults",
      "history batch retains explicit page two",
      "history batch restores page two result",
      "no external or write requests",
      "no cookies",
      "no storage or clipboard",
    ])
      assert.ok(names.has(name), name);
    assert.equal(names.size, 89);
  }
});
