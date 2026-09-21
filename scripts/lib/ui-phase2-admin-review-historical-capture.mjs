import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

export const adminReviewCaptureStages = Object.freeze(
  Object.fromEntries(
    Object.entries({
      comparison: {
        revision: "c489ebf0bde888150595b7bddcd9a2ab8d4622a5",
        folder: "output/playwright/p44-comparison-vue-preview",
        manifestHash: "319993ce87c8f73138ca7c4457d898fcc17410d8756e5e6e92274680b73cac62",
        driver: "scripts/verify-ui-phase2-admin-comparison-preview.mjs",
        driverHash: "b9d0d02aa8e56a5bfab4bac0caa424924eb9adce5fe7da5292e348d25f082a0c",
      },
      create: {
        revision: "3ad9030fa68c6e542be59cf596f7ae2117dbc396",
        folder: "output/playwright/p44-create-admin-preview",
        manifestHash: "d00be2288ca1ac90609ce6b097009593419d1b1458225add77731ce164189384",
        driver: "scripts/verify-ui-phase2-admin-create-preview.mjs",
        driverHash: "120b9617baa68359da0573bb8f4b92097b502cb6a34b22feef47f58d0ee007d3",
      },
      page: {
        revision: "c489ebf0bde888150595b7bddcd9a2ab8d4622a5",
        folder: "output/playwright/p44-page-vue-preview",
        manifestHash: "20fa452fdf43fed52e2f8911379d2209b2e1c3604248e6eb4d30b7900071b79a",
        driver: "scripts/verify-ui-phase2-admin-page-preview.mjs",
        driverHash: "42e77e24f093bb123f8d348a5b5525e5571f49f0295f0456c121819170099151",
      },
      assembly: {
        revision: "4bbf11938cde81aedfd16bda97567332789034d3",
        folder: "output/playwright/p44-page-assembly-vue-preview",
        manifestHash: "d245103e09bce5431b0944d90abdaec4d64442142b060b1deb837d9b984610f3",
        driver: "scripts/verify-ui-phase2-admin-page-assembly-preview.mjs",
        driverHash: "d71a4474956c8fe56caaf3abfb26ab18c132e379ecfaf5f1205324228e0f1ddf",
      },
      "boundary-baseline": {
        revision: "cd040baf890fbce1160250e5108f3a01862dcf6d",
        folder: "output/playwright/p44-page-boundary-vue-baseline",
        manifestHash: "2b3a963491bce29c160049e96042adcd56737d57bccd36d21f8c370118e80cd1",
        driver: "scripts/verify-ui-phase2-admin-page-boundary-preview.mjs",
        driverHash: "4cc86eb31330f206e3ca4a62cad534d4762a13704e13987097d2611b63d79f42",
      },
      "boundary-preview": {
        revision: "cd040baf890fbce1160250e5108f3a01862dcf6d",
        folder: "output/playwright/p44-page-boundary-vue-preview",
        manifestHash: "45221f157d7f03d78e5c6c9c5ab30c64f78b606531df2a8a3349d29bff79eeff",
        driver: "scripts/verify-ui-phase2-admin-page-boundary-preview.mjs",
        driverHash: "4cc86eb31330f206e3ca4a62cad534d4762a13704e13987097d2611b63d79f42",
      },
    }).map(([key, value]) => [key, Object.freeze(value)]),
  ),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical image provenance, NOT current-source acceptance.
export function adminReviewHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(adminReviewCaptureStages, stage), "Unknown historical P44 stage");
  const entry = adminReviewCaptureStages[stage];
  if (!cache.has(stage)) {
    const file = `${entry.folder}/evidence.json`;
    const manifest = normalize(
      execFileSync("git", ["show", `${entry.revision}:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
    );
    assert.equal(hash(manifest), entry.manifestHash, "Original P44 manifest changed");
    assert.equal(normalize(readFileSync(file)), manifest, "Local historical P44 manifest changed");
    const evidence = JSON.parse(manifest),
      paths = Object.keys(evidence.sourceHashes);
    assert.ok(paths.length > 0 && paths.every((path) => !/[\r\n]/.test(path)));
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((path) => `${entry.revision}:${path}\n`).join(""),
        maxBuffer: 64 * 1024 * 1024,
      }),
      paths,
    );
    const sources = new Map();
    for (const [file, sha] of Object.entries(evidence.sourceHashes)) {
      const source = normalize(blobs.get(file));
      assert.equal(hash(source), sha, `Original P44 source mismatch: ${file}`);
      sources.set(file, source);
    }
    cache.set(stage, { manifest, sources });
  }
  const { manifest, sources } = cache.get(stage);
  return {
    revision: entry.revision,
    manifest,
    source(file) {
      assert.ok(sources.has(file), `Source absent from original P44 manifest: ${file}`);
      return sources.get(file);
    },
  };
}
