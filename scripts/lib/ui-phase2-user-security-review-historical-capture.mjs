import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

export const userSecurityReviewCaptureStages = Object.freeze(
  Object.fromEntries(
    Object.entries({
      password: {
        revision: "01af02620bdbb751cc846e6a02081d4a0b735784",
        folder: "output/playwright/p43-password-vue-preview",
        manifestHash: "fd8bd17fe5ab0059ded3a1869b88d1e236c249e8821739b76cb620520f6887c5",
        driver: "scripts/verify-ui-phase2-user-password-preview.mjs",
        driverHash: "9f65e55d2a8f40b222995327a53e1087d50082cfef269d0ea9991f641e9941d9",
      },
      reasons: {
        revision: "01af02620bdbb751cc846e6a02081d4a0b735784",
        folder: "output/playwright/p43-reasons-vue-preview",
        manifestHash: "22bbba05db79b6d17ec90ce5dfc1f1473b2b1f812dab0528020039c1bbc00c3a",
        driver: "scripts/verify-ui-phase2-user-reasons-preview.mjs",
        driverHash: "3b795148705eec1f6eb0d858b1df74cc6e291b5296aaf7c893b52d6062188885",
      },
    }).map(([key, value]) => [key, Object.freeze(value)]),
  ),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical image provenance, NOT current-source acceptance.
export function userSecurityReviewHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(userSecurityReviewCaptureStages, stage), "Unknown historical P43 stage");
  const entry = userSecurityReviewCaptureStages[stage];
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
