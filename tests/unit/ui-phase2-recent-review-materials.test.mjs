import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { buildRecentReviewMaterials } from "../../scripts/lib/ui-phase2-recent-review-materials.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const entry = {
    id: "p47-sample",
    page: "P47",
    title: "样例",
    directory: "output/sample",
    report: "report.md",
    scope: "局部非验收",
    previews: [{ file: "sample.png", label: "手机" }],
  };
  const manifest = {
    sourceHashes: { "apps/page.vue": hash("source\n") },
    screenshots: [{ file: "sample.png", sha256: hash("image fixture") }],
  };
  const files = new Map([
    ["apps/page.vue", "source\r\n"],
    ["output/sample/sample.png", "image fixture"],
    ["output/sample/index.html", "gallery"],
    ["report.md", "scope"],
  ]);
  let reads = 0;
  const read = async (file) => {
    reads++;
    const key = path.relative(process.cwd(), file).split(path.sep).join("/");
    if (key === "output/sample/evidence.json") return Buffer.from(JSON.stringify(manifest));
    if (!files.has(key)) throw Object.assign(new Error("missing fixture"), { code: "ENOENT" });
    return Buffer.from(files.get(key));
  };
  return {
    entry,
    manifest,
    files,
    build: () => buildRecentReviewMaterials(process.cwd(), [entry], read),
    read,
    reads: () => reads,
  };
}

test("review supplement validates LF provenance and original image bytes without promoting acceptance", async () => {
  const f = fixture();
  const result = await f.build();
  assert.equal(result.materials[0].sourceStatus, "source-matched-at-index-build");
  assert.equal(result.materials[0].approval, "not-full-page-acceptance");
  assert.equal(result.materials[0].packetImages, 1);
  assert.equal(result.materials[0].manifestSha256, hash(JSON.stringify(f.manifest)));
});
for (const missing of [false, true])
  test(`source ${missing ? "missing" : "changed"} remains explicitly historical, not silently rebound`, async () => {
    const f = fixture();
    if (missing) f.files.delete("apps/page.vue");
    else f.files.set("apps/page.vue", "changed");
    const item = (await f.build()).materials[0];
    assert.equal(item.sourceStatus, "historical-source-differs");
    assert.equal(item.sourceDifferences[0].expected, hash("source\n"));
    assert.equal(item.sourceDifferences[0].actual, missing ? null : hash("changed"));
    assert.equal(f.manifest.sourceHashes["apps/page.vue"], hash("source\n"));
  });
for (const change of [
  "image",
  "preview",
  "duplicate-image",
  "report",
  "provenance",
  "escape",
  "page",
])
  test(`review supplement fails closed on ${change}`, async () => {
    const f = fixture();
    if (change === "image") f.files.set("output/sample/sample.png", "changed image");
    if (change === "preview") f.entry.previews[0].file = "unknown.png";
    if (change === "duplicate-image") f.manifest.screenshots.push(f.manifest.screenshots[0]);
    if (change === "report") f.files.delete("report.md");
    if (change === "provenance") f.manifest.sourceHashes = {};
    if (change === "escape") f.manifest.sourceHashes = { "../outside": hash("secret") };
    if (change === "page") f.entry.page = "P74";
    await assert.rejects(f.build());
  });
test("duplicate catalog identities are rejected", async () => {
  const f = fixture();
  await assert.rejects(
    buildRecentReviewMaterials(process.cwd(), [f.entry, f.entry], f.read),
    /Duplicate material/,
  );
});
test("an explicit in-repository gallery report works without mutating an immutable image packet", async () => {
  const f = fixture();
  f.files.delete("output/sample/index.html");
  f.entry.galleryFile = "report.md";
  f.entry.galleryLabel = "完整图包目录与审核记录";
  const item = (await f.build()).materials[0];
  assert.equal(item.gallery, "../../report.md");
  assert.equal(item.galleryLabel, f.entry.galleryLabel);
  f.entry.galleryFile = "../outside.md";
  await assert.rejects(f.build(), /Out-of-repository/);
});
test("all fourteen packets retain original506 and add37 images without promoting acceptance", async () => {
  const result = await buildRecentReviewMaterials(process.cwd());
  assert.equal(result.materials.length, 14);
  assert.equal(
    result.materials.reduce((n, m) => n + m.packetImages, 0),
    543,
  );
  const original = result.materials.filter((m) => !["P34", "P57", "P58"].includes(m.page));
  assert.equal(original.length, 8);
  assert.equal(
    original.reduce((sum, item) => sum + item.packetImages, 0),
    406,
  );
  assert.equal(original.flatMap((item) => item.previews).length, 15);
  assert.deepEqual(
    [...new Set(result.materials.map((m) => m.page))],
    ["P57", "P58", "P34", "P44", "P46", "P47"],
  );
  assert.equal(result.materials.flatMap((m) => m.previews).length, 34);
  const p34 = result.materials.filter((m) => m.page === "P34");
  assert.equal(p34.length, 2);
  // Historical packets keep their old hashes; later shared/source edits must stay visible.
  assert.ok(
    p34.every(
      (m) => m.sourceStatus === "historical-source-differs" && m.sourceDifferences.length > 0,
    ),
  );
  assert.ok(p34[0].scope.includes("后三张") && p34[1].scope.includes("待视觉审核"));
  const box = { window: {} };
  vm.runInNewContext(
    await readFile("design-plans/ui-phase-2-2026-09-07/review-recent-materials.js", "utf8"),
    box,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(box.window.SCOUTOPS_PHASE2_RECENT_MATERIALS)), result);
  assert.ok(result.materials.every((m) => m.approval === "not-full-page-acceptance"));
});

test("raw manifest explicitly preserves byte hashes rather than normalizing CRLF", async () => {
  const f = fixture();
  f.entry.manifestFormat = "raw-sources-images";
  f.manifest.sources = { "apps/page.vue": hash("source\r\n") };
  f.manifest.images = f.manifest.screenshots;
  delete f.manifest.sourceHashes;
  delete f.manifest.screenshots;
  assert.equal((await f.build()).materials[0].sourceStatus, "source-matched-at-index-build");
  f.files.set("apps/page.vue", "source\n");
  assert.equal((await f.build()).materials[0].sourceDifferences.length, 1);
});
test("explicit manifest formats reject unknown formats, path traversal, and implicit field fallback", async () => {
  const f = fixture();
  f.entry.manifestFormat = "unknown";
  await assert.rejects(f.build(), /Unknown manifest format/);
  f.entry.manifestFormat = "lf-evidence";
  f.entry.manifestFile = "../manifest.json";
  await assert.rejects(f.build());
  delete f.entry.manifestFile;
  f.entry.manifestFormat = "raw-sources-images";
  await assert.rejects(f.build(), /Missing source provenance/);
});
