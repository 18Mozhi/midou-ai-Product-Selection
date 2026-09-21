import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

export const accountCaptureStages = Object.freeze({
  filter: Object.freeze({
    revision: "797e8af35a8a1209ce3b007a21e8678ba8d98cc0",
    folder: "output/playwright/p39-filter-preview",
    manifestHash: "b64ac4ba7105947a0766e960cce9ec94fb50ebcfd496e3e8279ee650d8f66dc6",
    driver: "scripts/verify-ui-phase2-account-filter-preview.mjs",
    driverHash: "f5430c5a7292ad4031383bc486fc81174fd8bf0d11beb51a8ab66a2e0b1b5491",
  }),
  create: Object.freeze({
    revision: "6e01d1cfeb22edd7346770d47340e8bd9c9f1d0f",
    folder: "output/playwright/p39-create-user-preview",
    manifestHash: "528b63a2809e22a23a3336bac544c91cdd6c7b1728c4d04013b931a59a043f62",
    driver: "scripts/verify-ui-phase2-account-create-preview.mjs",
    driverHash: "fdde20be1fdef9a9fa6989fe4c8cdc0dd01dffa4f3cfb0cd7a31b79177af9218",
  }),
  page: Object.freeze({
    revision: "4cfea9db0376ef6bc2f1266ecba1961c06e550a0",
    folder: "output/playwright/p39-page-composed",
    manifestHash: "0f18325f05c40035e6cfd94b2340513f1f24d360bba743edf7cb97616590ab1a",
    driver: "scripts/verify-ui-phase2-account-page-preview.mjs",
    driverHash: "ec25ad701c7577d3f30ada275f6701ce25c37743ea63fa5d9d95e4f38b69ded7",
  }),
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (bytes) => bytes.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

// Immutable historical image provenance, NOT current-source acceptance.
export function accountHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(accountCaptureStages, stage), "Unknown historical P39 stage");
  const entry = accountCaptureStages[stage];
  if (!cache.has(stage)) {
    const file = `${entry.folder}/evidence.json`;
    const manifest = normalize(
      execFileSync("git", ["show", `${entry.revision}:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
    );
    assert.equal(hash(manifest), entry.manifestHash, "Original P39 manifest changed");
    assert.equal(normalize(readFileSync(file)), manifest, "Local historical P39 manifest changed");
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
      assert.equal(hash(source), sha, `Original P39 source mismatch: ${file}`);
      sources.set(file, source);
    }
    cache.set(stage, { manifest, sources });
  }
  const { manifest, sources } = cache.get(stage);
  return {
    revision: entry.revision,
    manifest,
    source(file) {
      assert.ok(sources.has(file), `Source absent from original P39 manifest: ${file}`);
      return sources.get(file);
    },
  };
}
