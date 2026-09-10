import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  exportDetailStyle,
  exportDetailTokens,
  undoExportDetailTokens,
  capturedExportDetailHash,
} from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";

const text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n"),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  baseline = "c380b995b3a6d55d7f1742dc42baf9479be0e8e7",
  old = (f) =>
    execFileSync("git", ["show", `${baseline}:${f}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    ),
  dir = "output/playwright/p35-export-token-equivalence",
  e = JSON.parse(text(`${dir}/evidence.json`));
test("P35 palette extraction is byte-exact when expanded and keeps production Vue unchanged", () => {
  const css = text(exportDetailStyle);
  assert.equal(undoExportDetailTokens(css), old(exportDetailStyle));
  assert.notEqual(
    undoExportDetailTokens(css.replace("gap: 0", "gap: 4px")),
    old(exportDetailStyle),
  );
  assert.throws(() => undoExportDetailTokens(css.replace("export-detail-tokens.css", "other.css")));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.equal(
    text("apps/web/src/components/OrganizationDataPanel.vue"),
    old("apps/web/src/components/OrganizationDataPanel.vue"),
  );
  assert.equal(capturedExportDetailHash(exportDetailStyle, css), hash(old(exportDetailStyle)));
  assert.equal(capturedExportDetailHash("unrelated.css", "body{}"), hash("body{}"));
});
test("P35 current mounted Vue proof binds140 exact pixel comparisons at four boundary widths", () => {
  assert.equal(e.kind, "P35-EXACT-TOKEN-EXTRACTION");
  assert.equal(e.baselineCommit, baseline);
  assert.equal(e.appearanceChanged, false);
  assert.equal(e.acceptanceComplete, false);
  assert.equal(e.browserAndServerClosed, true);
  assert.equal(e.checks.length, 144);
  assert.equal(
    e.checks.filter((c) => c.name === "pixel-identical to pre-token current Vue").length,
    140,
  );
  for (const width of [390, 760, 761, 1440])
    for (const scene of [
      "normal",
      "zero",
      "unknown",
      "queued",
      "retry_scheduled",
      "succeeded",
      "dead_letter",
    ])
      assert.deepEqual(
        e.checks.filter((c) => c.width === width && c.scene === scene).map((c) => c.state),
        ["closed", "open", "focus", "hover", "pressed"],
      );
  assert.ok(e.sourceHashes[exportDetailTokens]);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(text(f)), sha, f);
});
test("P35 four comparison images are durable without replacing approved historical images", () => {
  assert.deepEqual(e.screenshots.map((s) => s.file).sort(), [
    "390-normal-open.png",
    "390-zero-open.png",
    "760-normal-open.png",
    "760-zero-open.png",
  ]);
  assert.deepEqual(
    readdirSync(dir).sort(),
    ["evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  const prior = JSON.parse(text("output/playwright/p35-export-detail-vue/evidence.json"));
  assert.equal(prior.screenshots.length, 24);
  for (const s of prior.screenshots)
    assert.equal(hash(readFileSync(`output/playwright/p35-export-detail-vue/${s.file}`)), s.sha256);
});
