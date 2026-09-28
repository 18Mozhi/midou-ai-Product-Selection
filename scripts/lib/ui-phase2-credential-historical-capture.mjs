import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

const revision = "635e5538a96493fcf62e95938c78fb07aebcc9b7";
const stages = Object.freeze({
  "editor-focus": Object.freeze({
    folder: "output/playwright/p50-credential-editor-focus-review",
    manifestHash: "95784d5bc3148d4064e97150bf785836a22423d1327c9e4d7d727fe50240eab7",
    runner: "scripts/verify-ui-phase2-credential-editor-focus.mjs",
    runnerHash: "b130f62207a69508ba28feed1d2b6b333e7321734010d945973508d6ee1f629e",
  }),
  "login-boundary": Object.freeze({
    folder: "output/playwright/p50-credential-login-boundary-review",
    manifestHash: "1f2bf4b37024640a7f81c7b2c656ddd6acfcc835cd4d33c1d2db6427fd802267",
    runner: "scripts/verify-ui-phase2-credential-login-material.mjs",
    runnerHash: "d2f31dcb6956144491b82228d902f83fce1224a339142cf6b0ad32ccc1a583e2",
  }),
  "login-cache": Object.freeze({
    folder: "output/playwright/p50-credential-login-cache-review",
    manifestHash: "885f37fe1b6bc1bdb42c3143004b817ea270a2cee23f371106cd1d57fc95e9e4",
    runner: "scripts/verify-ui-phase2-credential-login-material.mjs",
    runnerHash: "d2f31dcb6956144491b82228d902f83fce1224a339142cf6b0ad32ccc1a583e2",
  }),
  "login-detached": Object.freeze({
    folder: "output/playwright/p50-credential-login-detached-review",
    manifestHash: "d140bc2a4ba6e2e109e67e23f18dcbe641d9b679549432c600ff3d7204a9c5ef",
    runner: "scripts/verify-ui-phase2-credential-login-material.mjs",
    runnerHash: "d2f31dcb6956144491b82228d902f83fce1224a339142cf6b0ad32ccc1a583e2",
  }),
  "login-lifecycle": Object.freeze({
    folder: "output/playwright/p50-credential-login-lifecycle-review",
    manifestHash: "7551df0b44d4054a0e52d1d27cf9a4fcd4157adebe667eac57406455a902bcc2",
    runner: "scripts/verify-ui-phase2-credential-login-material.mjs",
    runnerHash: "d2f31dcb6956144491b82228d902f83fce1224a339142cf6b0ad32ccc1a583e2",
  }),
  "login-material": Object.freeze({
    folder: "output/playwright/p50-credential-login-material-review",
    manifestHash: "9742a9ae0e2b38b819b41c5150de776ade585d65b16dfb7e2a332a20047cea54",
    runner: "scripts/verify-ui-phase2-credential-login-material.mjs",
    runnerHash: "d2f31dcb6956144491b82228d902f83fce1224a339142cf6b0ad32ccc1a583e2",
  }),
  page: Object.freeze({
    folder: "output/playwright/p50-credential-page-review",
    manifestHash: "3134a3d3682b99feee80dafaf7170350722dd2e1357b94d80116691c45ba97c3",
    runner: "scripts/verify-ui-phase2-credential-assets-page.mjs",
    runnerHash: "8aa63db0290d8c23dfc66a6c98db705468cca26ae0522f77f43b536e40a1064e",
  }),
  "write-ownership": Object.freeze({
    folder: "output/playwright/p50-credential-write-ownership-review",
    manifestHash: "9d0ee4fa034854a86b3a40020b65f6020b33609b931fbf0c0bb4938cd7d14f63",
    runner: "scripts/verify-ui-phase2-credential-write-ownership.mjs",
    runnerHash: "46393345b0a6cbd833b31c28b8e3d3e8a7603fe001c8dbb5e2dea518d40c6a13",
  }),
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical P50 evidence, NOT current-source acceptance. The capture manifests
// include the local verification driver fingerprint, but those exact driver bytes were never
// committed; keep the fingerprint pinned while resolving every application/design source from
// the capture revision. Current behavior remains covered by the live component/unit tests.
export function credentialHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(stages, stage), "Unknown historical P50 credential stage");
  if (!cache.has(stage)) {
    const entry = stages[stage],
      path = `${entry.folder}/evidence.json`,
      manifest = normalize(
        execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 }),
      );
    assert.equal(hash(manifest), entry.manifestHash, "Original P50 manifest changed");
    assert.equal(normalize(readFileSync(path)), manifest, "Local P50 manifest changed");
    const evidence = JSON.parse(manifest),
      sourceHashes = evidence.sourceHashes;
    assert.ok(Object.hasOwn(sourceHashes, entry.runner), "P50 runner fingerprint missing");
    assert.equal(sourceHashes[entry.runner], entry.runnerHash, "P50 runner fingerprint changed");
    const browserBuild = "packages/config/dist/browser.js";
    assert.ok(Object.hasOwn(sourceHashes, browserBuild), "P50 browser build fingerprint missing");
    assert.equal(
      hash(readFileSync(browserBuild)),
      sourceHashes[browserBuild],
      "Original P50 browser build changed",
    );
    const tracked = Object.fromEntries(
        Object.entries(sourceHashes).filter(
          ([file]) => file !== entry.runner && file !== browserBuild,
        ),
      ),
      paths = Object.keys(tracked);
    assert.ok(paths.length > 0 && paths.every((file) => !/[\r\n]/.test(file)));
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((file) => `${revision}:${file}\n`).join(""),
        maxBuffer: 128 * 1024 * 1024,
      }),
      paths,
    );
    const sources = new Map();
    for (const [file, expected] of Object.entries(tracked)) {
      const source = normalize(blobs.get(file));
      assert.equal(hash(source), expected, `Original P50 source mismatch: ${file}`);
      sources.set(file, source);
    }
    cache.set(stage, { manifest, evidence, sources });
  }
  const { manifest, evidence, sources } = cache.get(stage);
  return {
    revision,
    manifest,
    evidence,
    source(file) {
      assert.ok(sources.has(file), `Source absent from original P50 manifest: ${file}`);
      return sources.get(file);
    },
  };
}
