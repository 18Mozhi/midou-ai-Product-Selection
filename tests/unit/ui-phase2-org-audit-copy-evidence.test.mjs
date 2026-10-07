import test from "node:test";
import { historicalTokenCopySource } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { capturedExportDetailHash } from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";
import ts from "typescript";
import {
  auditCopyFile,
  auditCopyRevisions,
  historicalAuditSource,
} from "../../scripts/lib/ui-phase2-audit-copy-baseline.mjs";
import {
  p37SourceAt,
  p37SourceMatchingHash,
} from "../../scripts/lib/ui-phase2-p37-historical-source.mjs";

const text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const dir = "output/playwright/p37-copy-ownership-vue-r3/";
const e = JSON.parse(text(dir + "evidence.json"));
test("P37 exact copy-only change preserves template, filters and every unrelated script statement", () => {
  const current = p37SourceAt("capture", auditCopyFile),
    baseline = historicalAuditSource(auditCopyFile, current);
  assert.equal(current.split("<template>")[1], baseline.split("<template>")[1]);
  const statements = (source) => {
    const ast = ts.createSourceFile(
      "s.ts",
      source.split(/<script setup[^>]*>/)[1].split("</script>")[0],
      ts.ScriptTarget.Latest,
      true,
    );
    return ast.statements
      .map((n) => n.getText(ast))
      .filter((s) => !s.startsWith("import {") || !s.endsWith('from "vue";'))
      .filter(
        (s) =>
          !/^(const copyOwnerPath|let copyGeneration|function (invalidateCopy|suspendCopy)|onActivated\(|onDeactivated\(|onBeforeUnmount\(|async function copy\()/.test(
            s,
          ),
      )
      .filter((s) => !s.startsWith("watch(\n  [\n    selectedEvent,"))
      .map((s) =>
        s.startsWith("function choose(")
          ? s.replace("invalidateCopy();", 'copyState.value = "";')
          : s,
      );
  };
  assert.deepEqual(statements(current), statements(baseline));
  assert.throws(
    () => historicalAuditSource(auditCopyFile, current.replace('flush: "sync"', 'flush: "post"')),
    /Unreviewed P37 source delta/,
  );
});
test("P37 actual current parent/child/browser evidence binds62 checks and exact16 PNG", () => {
  assert.equal(e.kind, "P37-CURRENT-COPY-OWNERSHIP-VUE-r3");
  assert.equal(e.acceptanceComplete, false);
  assert.equal(e.browserAndServerClosed, true);
  assert.equal(e.checks.length, 62);
  assert.equal(e.screenshots.length, 16);
  const captureTransform = (file, source) =>
    capturedExportDetailHash(file, historicalTokenCopySource(file, source));
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(text(f)), sha, f);
  for (const s of e.screenshots) {
    assert.equal(hash(readFileSync(dir + s.file)), s.sha256);
    assert.equal(s.approval, "runtime-observation-not-C-design-approval");
  }
  assert.deepEqual(
    readdirSync(dir).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const width of [390, 1440]) {
    const names = e.checks.filter((c) => c.width === width).map((c) => c.name);
    for (const name of [
      "actual-parent:old-copy-does-not-label-new-record",
      "newer-trace-survives-older-request-failure",
      "actual-parent:A-B-A-rejects-old-result",
      "actual-parent:cached-return-ignores-old-result",
      "actual-parent:remount-no-old-feedback",
      "actual-child:search-fallback-ignores-old-result",
      "actual-child:list-return-no-old-feedback",
    ])
      assert.ok(names.includes(name), name);
  }
  const script = text("scripts/verify-ui-phase2-org-audit-copy.mjs");
  assert.match(script, /import Parent from '\/src\/components\/OrganizationAdminCenter.vue'/);
  assert.match(script, /import Child from '\/src\/components\/OrganizationAuditPanel.vue'/);
  assert.doesNotMatch(script, /transform\(source|historicalAuditSource\(/);
  assert.equal(e.requests.length, 4);
  assert.ok(e.requests.every((r) => r.method === "GET" && r.path.endsWith("/audit-events")));
});
test("P37314 design PNG retain historical observations and unchanged approval under explicit source association", () => {
  let count = 0;
  for (const folder of [
    "design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c/",
    "output/playwright/p37-fields-review/",
    "output/playwright/p37-controls-review/",
  ]) {
    const current = JSON.parse(text(folder + "evidence.json")),
      old = structuredClone(current),
      a = old.sourceAssociation;
    assert.equal(text(folder + "evidence.json"), p37SourceAt("capture", folder + "evidence.json"));
    assert.equal(a.kind, "copy-feedback-only-current-source-historical-design-evidence");
    assert.equal(hash(text(a.proof)), a.proofHash);
    assert.equal(a.approval, "unchanged");
    old.sourceHashes = a.historicalSourceHashes;
    if (old.retainedManifest) old.retainedManifest = a.historicalRetainedManifest;
    if (old.retained) old.retained = a.historicalRetained;
    delete old.sourceAssociation;
    const historicalSource = (file, source) =>
      capturedExportDetailHash(
        file,
        historicalAuditSource(file, historicalTokenCopySource(file, source)),
      );
    assert.equal(hash(JSON.stringify(old, null, 2) + "\n"), a.originalManifestHash);
    const unresolvedHistoricalSources = [];
    for (const [f, sha] of Object.entries(old.sourceHashes)) {
      try {
        assert.equal(
          hash(historicalSource(f, p37SourceMatchingHash(f, sha, historicalSource))),
          sha,
          f,
        );
      } catch (error) {
        if (!String(error.message).includes("P37 source fingerprint has no unique Git snapshot"))
          throw error;
        unresolvedHistoricalSources.push(f);
      }
    }
    assert.deepEqual(unresolvedHistoricalSources, [
      "design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c/index.html",
    ]);
    for (const s of old.screenshots) {
      count++;
      assert.equal(hash(readFileSync(folder + s.file)), s.sha256);
    }
  }
  assert.equal(count, 314);
  const p36Dir = "output/playwright/p36-parent-read-vue-r2/",
    p36 = JSON.parse(text(p36Dir + "evidence.json")),
    association = p36.sourceAssociation;
  assert.equal(text(p36Dir + "evidence.json"), p37SourceAt("capture", p36Dir + "evidence.json"));
  assert.equal(association.kind, "unrendered-P37-import-copy-only");
  assert.equal(hash(text(association.proof)), association.proofHash);
  p36.sourceHashes = association.historicalSourceHashes;
  delete p36.sourceAssociation;
  assert.equal(hash(JSON.stringify(p36, null, 2) + "\n"), association.originalManifestHash);
  for (const s of p36.screenshots) assert.equal(hash(readFileSync(p36Dir + s.file)), s.sha256);
  const readDir = "output/playwright/p36-read-states-review/",
    read = JSON.parse(text(readDir + "evidence.json"));
  assert.equal(text(readDir + "evidence.json"), p37SourceAt("capture", readDir + "evidence.json"));
  const paging = JSON.parse(
    text("design-plans/ui-phase-2-2026-09-07/P37-PAGINATION-SOURCE-ASSOCIATIONS.json"),
  );
  const entry = paging.entries.find((v) => v.file === readDir + "evidence.json");
  assert.equal(hash(text(entry.file)), entry.afterHash);
  for (const change of entry.changes) {
    let target = read;
    for (const key of change.keys.slice(0, -1)) target = target[key];
    target[change.keys.at(-1)] = change.before;
  }
  assert.equal(hash(JSON.stringify(read, null, 2) + "\n"), entry.beforeHash);
  const readAssociation = read.sourceAssociation;
  assert.equal(readAssociation.kind, "retained-P36-parent-import-association-only");
  read.retained = readAssociation.historicalRetained;
  delete read.sourceAssociation;
  assert.equal(hash(JSON.stringify(read, null, 2) + "\n"), readAssociation.originalManifestHash);
  for (const s of read.screenshots) assert.equal(hash(readFileSync(readDir + s.file)), s.sha256);
});
