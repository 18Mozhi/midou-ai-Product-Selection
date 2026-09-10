import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const output = "output/playwright/technical-copy-feedback";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const e = JSON.parse(read(`${output}/evidence.json`));

test("shared copy change leaves all 15 direct consumer source files untouched", () => {
  for (const name of [
    "BackupRecoveryCenter",
    "CapacityBoundaryCenter",
    "CollectionOperationsConsole",
    "CollectionRuntimeCenter",
    "CommercialOperationsCenter",
    "CrawlerSchedulerCenter",
    "FileResilienceCenter",
    "MySqlResilienceCenter",
    "PlatformDashboard",
    "PlatformDataCenter",
    "PlatformGovernanceCenter",
    "RedisResilienceCenter",
    "ReleaseRolloutCenter",
    "RuntimeTopologyCenter",
    "SecurityOperationsCenter",
  ]) {
    const file = `apps/web/src/components/${name}.vue`;
    assert.equal(
      read(file),
      execFileSync("git", ["show", `e704cd24:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
      file,
    );
  }
});

test("current recapture chain accepts only 29 measured differences across 13 proposals and 3 P38 preview sets", () => {
  const review = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/technical-copy-capture-review.json"),
  );
  assert.equal(review.baselineCommit, "e704cd24");
  assert.equal(review.approvedByUser, false);
  assert.equal(review.manifests.length, 16);
  assert.equal(review.differences.length, 29);
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const changed = [];
  const lifecycleReview = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/detail-lifecycle-capture-review.json"),
  );
  for (const manifest of review.manifests) {
    const previous = JSON.parse(
      execFileSync("git", ["show", `e704cd24:${manifest}`], { encoding: "utf8" }),
    );
    const current = JSON.parse(read(manifest));
    assert.deepEqual(
      current.screenshots.map((s) => s.file),
      previous.screenshots.map((s) => s.file),
    );
    for (const shot of previous.screenshots) {
      const file = `${path.posix.dirname(manifest)}/${shot.file}`;
      const currentBytes = readFileSync(file),
        currentFingerprint = hash(currentBytes);
      assert.equal(
        current.screenshots.find((s) => s.file === shot.file).sha256,
        currentFingerprint,
      );
      const lifecycle = lifecycleReview.differences.find((item) => item.file === file);
      if (lifecycle) assert.equal(currentFingerprint, lifecycle.afterSha256);
      const bytes = lifecycle
        ? execFileSync("git", ["show", `3023a030:${file}`], { maxBuffer: 20_000_000 })
        : currentBytes;
      const fingerprint = hash(bytes);
      if (lifecycle) assert.equal(fingerprint, lifecycle.beforeSha256);
      if (fingerprint === shot.sha256) continue;
      changed.push(file);
      const entry = review.differences.find((d) => d.file === file);
      assert.ok(entry, file);
      assert.equal(entry.beforeSha256, shot.sha256);
      assert.equal(entry.afterSha256, fingerprint);
      const a = PNG.sync.read(
          execFileSync("git", ["show", `e704cd24:${file}`], { maxBuffer: 20_000_000 }),
        ),
        b = PNG.sync.read(bytes);
      assert.deepEqual([a.width, a.height], entry.dimensions);
      assert.deepEqual([b.width, b.height], entry.dimensions);
      let pixels = 0,
        delta = 0,
        x0 = a.width,
        y0 = a.height,
        x1 = 0,
        y1 = 0;
      for (let p = 0; p < a.width * a.height; p++) {
        let different = false;
        for (let c = 0; c < 4; c++) {
          const d = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
          different ||= d > 0;
          delta = Math.max(delta, d);
        }
        if (different) {
          pixels++;
          const x = p % a.width,
            y = Math.floor(p / a.width);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      assert.equal(pixels, entry.changedPixels);
      assert.equal(delta, entry.maxChannelDelta);
      assert.deepEqual([x0, y0, x1, y1], entry.bounds);
    }
  }
  assert.deepEqual(changed.sort(), review.differences.map((d) => d.file).sort());
});
test("shared clipboard evidence binds actual source, historical normal parity and all 8 images", () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  assert.equal(
    hash(
      execFileSync("git", ["show", `${e.baseline.commit}:${e.baseline.file}`], {
        encoding: "utf8",
      }).replaceAll("\r\n", "\n"),
    ),
    e.baseline.sha256,
  );
  assert.equal(e.screenshots.length, 8);
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${output}/${s.file}`);
    assert.equal(hash(bytes), s.sha256);
    assert.equal(s.kind, "vue-isolated");
    assert.equal(s.buildSha, null);
    assert.equal(s.approval, "pending");
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
  }
  assert.equal(e.comparisons.length, 4);
  for (const c of e.comparisons) assert.equal(c.current, c.baseline);
});
test("shared clipboard checks distinguish real Vue, synthetic clipboard and pending visual approval", () => {
  assert.equal(e.checks.length, 16);
  for (const width of [390, 760, 761, 1440])
    assert.equal(e.checks.filter((c) => c.width === width).length, 4);
  assert.equal(e.processesClosed, true);
  assert.equal(e.approval, "pending");
  assert.match(e.scope, /no OS clipboard, API, RBAC, full page or production acceptance/);
  const current = read(e.baseline.file),
    prior = execFileSync("git", ["show", `${e.baseline.commit}:${e.baseline.file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
  // Normal markup/styles are exactly retained apart from the conditional feedback node/rule.
  assert.equal(
    current
      .split("</script>")[1]
      .replace(
        /\n    <p v-if="copyError" role="status" class="technical-copy-feedback">\{\{ copyError \}\}<\/p>/,
        "",
      )
      .replace(
        /\n\.technical-copy-feedback \{\n  margin: 0\.65rem 0 0;\n  overflow-wrap: anywhere;\n\}/,
        "",
      ),
    prior.split("</script>")[1],
  );
});
