import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

export const userReviewCaptureStages = Object.freeze(
  Object.fromEntries(
    Object.entries({
      page: {
        revision: "07c492963f56e266864143cfadaa1e6f6ef5627d",
        folder: "output/playwright/p43-page-vue-preview",
        manifestHash: "cfd4beb9c921d855cda44ab2bee0d6337d3a97cccef388e838853417ebe89e30",
        driver: "scripts/verify-ui-phase2-user-page-preview.mjs",
        driverHash: "67daca188fc90425ea9d9bff5a20e42bfc59067d5f31922f0041ce17f454219c",
      },
      create: {
        revision: "01af02620bdbb751cc846e6a02081d4a0b735784",
        folder: "output/playwright/p43-create-user-preview",
        manifestHash: "47d87e30f5841975e8c450f055ef8a04ef74f34297cab34c8e13e0578d75aee6",
        driver: "scripts/verify-ui-phase2-user-create-preview.mjs",
        driverHash: "d005a163eb7f779e698bb974e4305e4ba97dfd02cc0f15289d18f6e67bb48cdb",
      },
    }).map(([key, value]) => [key, Object.freeze(value)]),
  ),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical image provenance, NOT current-source acceptance.
export function userReviewHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(userReviewCaptureStages, stage), "Unknown historical P43 stage");
  const entry = userReviewCaptureStages[stage];
  if (!cache.has(stage)) {
    const file = `${entry.folder}/evidence.json`;
    const manifest = normalize(
      execFileSync("git", ["show", `${entry.revision}:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
    );
    assert.equal(hash(manifest), entry.manifestHash, "Original P43 manifest changed");
    assert.equal(normalize(readFileSync(file)), manifest, "Local historical P43 manifest changed");
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
      assert.equal(hash(source), sha, `Original P43 source mismatch: ${file}`);
      sources.set(file, source);
    }
    cache.set(stage, { manifest, sources });
  }
  const { manifest, sources } = cache.get(stage);
  return {
    revision: entry.revision,
    manifest,
    source(file) {
      assert.ok(sources.has(file), `Source absent from original P43 manifest: ${file}`);
      return sources.get(file);
    },
  };
}
