import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

export const userLifecycleReviewCaptureStages = Object.freeze(
  Object.fromEntries(
    Object.entries({
      "create-baseline": {
        revision: "b93caa7fdf587cc36396420ec4df40aa5fedd5de",
        folder: "output/playwright/p43-create-lifecycle/baseline",
        manifestHash: "0cc50fe22a93d9174e433d36269fa118db20f970277a2449e806a0c21d611084",
        driver: "scripts/verify-ui-phase2-user-create-lifecycle.mjs",
        driverHash: "a6bae20c34871d462d689977c643fb913ab9333b8feb090b8cd91cbb4a98a36e",
        sourceRevisions: {
          "apps/web/src/components/PlatformAccountCenter.vue":
            "01af02620bdbb751cc846e6a02081d4a0b735784",
        },
      },
      "create-current": {
        revision: "b93caa7fdf587cc36396420ec4df40aa5fedd5de",
        folder: "output/playwright/p43-create-lifecycle/current",
        manifestHash: "a5022f929c2aaba0d2c6a96aa7782b08915a75c465638d9b2631b76d4727e5c5",
        driver: "scripts/verify-ui-phase2-user-create-lifecycle.mjs",
        driverHash: "a6bae20c34871d462d689977c643fb913ab9333b8feb090b8cd91cbb4a98a36e",
      },
      "password-baseline": {
        revision: "05c5ebe0a9c933fdb8685afa6cb7307eb404df77",
        folder: "output/playwright/p43-password-lifecycle/baseline",
        manifestHash: "c45f67e5555a66b4716b9ac4165ca8be20ba80e1c7649e6fd0f8d425d5462a76",
        driver: "scripts/verify-ui-phase2-user-password-lifecycle.mjs",
        driverHash: "981d1aa1457518a7611d792cddc1ea581b2e6af5e35ac6a1026c59a13d2b5d37",
        sourceRevisions: {
          "apps/web/src/components/PlatformAccountCenter.vue":
            "b93caa7fdf587cc36396420ec4df40aa5fedd5de",
        },
      },
      "password-current": {
        revision: "05c5ebe0a9c933fdb8685afa6cb7307eb404df77",
        folder: "output/playwright/p43-password-lifecycle/current",
        manifestHash: "8ebef8e61e9bbca162eb44a84adc75dd538a39b3ad3e4a9be291a0c4fde006b5",
        driver: "scripts/verify-ui-phase2-user-password-lifecycle.mjs",
        driverHash: "981d1aa1457518a7611d792cddc1ea581b2e6af5e35ac6a1026c59a13d2b5d37",
      },
    }).map(([key, value]) => [
      key,
      Object.freeze({ ...value, sourceRevisions: Object.freeze(value.sourceRevisions ?? {}) }),
    ]),
  ),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical image provenance, NOT current-source acceptance.
export function userLifecycleReviewHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(userLifecycleReviewCaptureStages, stage), "Unknown historical P43 stage");
  const entry = userLifecycleReviewCaptureStages[stage];
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
        input: paths
          .map((path) => `${entry.sourceRevisions[path] ?? entry.revision}:${path}\n`)
          .join(""),
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
