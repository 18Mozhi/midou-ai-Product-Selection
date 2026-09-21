import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Immutable historical evidence only; never substitutes sources for a current capture.
const captures = {
  "detail-preview": [
    "42909c61bc24b99f88ec9f8a0872a047fbac98b4",
    "admin-detail",
    "preview",
    "bdcf8541278ad46e9fc55cf8154f1e6e7a6c0f6b7398a69bbbac9ebb25f86708",
  ],
  "controls-baseline": [
    "67cb00f350037bb7eeee7c6dad76a5334397cdec",
    "controls",
    "baseline",
    "0f38215a198607ec9b413504087452cb8310736392e9f8401e86abf66b0c700b",
  ],
  "controls-implemented": [
    "67cb00f350037bb7eeee7c6dad76a5334397cdec",
    "controls",
    "current",
    "51c35963e68ca4189921ed66a171880ab034b53bf3c1d3444d8cf14a898abfe3",
  ],
  "directory-baseline": [
    "1b8f9ff09d263a3a8b59ad0455144df000e8c4d3",
    "directory",
    "baseline",
    "1eafc79b1d134e547f2fb562ce00737600970b658711ed0e5dcd7eef4d5a32ba",
  ],
  "results-baseline": [
    "66ea2f60b79d17d9148d07a4a468fe07afae5403",
    "results",
    "baseline",
    "035f4077cde18daaa81913fc4e1ee9fd58b9fde6da1e68ef4f54fd3b3bc13191",
  ],
  "results-implemented": [
    "66ea2f60b79d17d9148d07a4a468fe07afae5403",
    "results",
    "current",
    "6385be3ef1e4bebfa2a0b700d7bf59d3460db2e9c094505534ca0c652e55bc37",
  ],
  "role-facts-baseline": [
    "d9a283163183213c6891c17140cd603e09af621a",
    "role-facts",
    "baseline",
    "eb4c7a754607ac2619854482433d07cd3a4999d225be0e5799243970b0c0ef52",
  ],
  "role-facts-implemented": [
    "d9a283163183213c6891c17140cd603e09af621a",
    "role-facts",
    "current",
    "2fffa5404991489216d0ce2f2f8a2a9115b209fed14cab0ba03bf68f5877a2b0",
  ],
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (buffer) => buffer.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();
function blob(revision, path) {
  const key = `${revision}:${path}`;
  if (!cache.has(key))
    cache.set(key, execFileSync("git", ["show", key], { maxBuffer: 16 * 1024 * 1024 }));
  return Buffer.from(cache.get(key));
}

export function adminHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(captures, stage), "Unknown P44 historical capture stage");
  const [revision, kind, mode, manifestHash] = captures[stage];
  const folder =
    kind === "admin-detail"
      ? "output/playwright/p44-admin-detail-vue-preview"
      : `output/playwright/p44-mobile-${kind}-implementation/${mode}`;
  const manifest = normalize(blob(revision, `${folder}/evidence.json`));
  assert.equal(hash(manifest), manifestHash, "Historical P44 manifest must match in full");
  const evidence = JSON.parse(manifest);
  return {
    revision,
    manifest,
    evidence,
    source(file) {
      assert.ok(
        Object.hasOwn(evidence.sourceHashes, file),
        "Source absent from historical P44 capture",
      );
      return normalize(blob(revision, file));
    },
    image(file) {
      const shot = evidence.screenshots.find((shot) => shot.file === file);
      assert.ok(shot, "Image absent from historical P44 capture");
      const bytes = blob(revision, `${folder}/${file}`);
      assert.equal(hash(bytes), shot.sha256, `Historical image: ${file}`);
      return bytes;
    },
    files() {
      return execFileSync("git", ["ls-tree", "--name-only", `${revision}:${folder}`], {
        encoding: "utf8",
      })
        .trim()
        .split("\n");
    },
  };
}
