import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Original evidence only. Never substitute these bytes in a current-source test or runtime.
const stages = {
  "feedback-baseline": [
    "f2e3d775e27e178f15507f97632539c7a9118694",
    "p46-provider-feedback-implementation/baseline",
    "04b5959629dc88cc4a12ba1dcda1908575e54f22d29210177dcca753f3d34ec0",
  ],
  "feedback-current": [
    "f2e3d775e27e178f15507f97632539c7a9118694",
    "p46-provider-feedback-implementation/current",
    "baee8446a732eef963e548754c01d7d7506d6a37a4ad4d560ecc4a9087a0bd5e",
  ],
  "structure-baseline": [
    "52099bc3e489b5224d3bd3553d7dac3ec3136ae6",
    "p46-approved-structure-implementation/baseline",
    "498638fda3eafc42a8e146754c711436fe14e5dc4f0aa5300bb85bd4e149d74d",
  ],
  "structure-current": [
    "52099bc3e489b5224d3bd3553d7dac3ec3136ae6",
    "p46-approved-structure-implementation/current",
    "d71fc9a51fee4ce3100a7f3cf6997d366ca0c41609ac8b933b0e6ed3083f14d3",
  ],
};
const cache = new Map();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const text = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
export function parseProviderCaptureBlobs(bytes, paths) {
  let offset = 0;
  const result = new Map();
  for (const file of paths) {
    const end = bytes.indexOf(10, offset);
    assert.ok(end >= offset, "Missing Git header");
    const match = /^[0-9a-f]{40,64} blob ([0-9]+)$/.exec(
      bytes.subarray(offset, end).toString("ascii"),
    );
    assert.ok(match, "Missing or invalid Git blob");
    const size = Number(match[1]),
      start = end + 1,
      finish = start + size;
    assert.ok(
      Number.isSafeInteger(size) && finish < bytes.length && bytes[finish] === 10,
      "Truncated Git blob",
    );
    result.set(file, Buffer.from(bytes.subarray(start, finish)));
    offset = finish + 1;
  }
  assert.equal(offset, bytes.length, "Unexpected trailing Git bytes");
  return result;
}
export function providerHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(stages, stage), "Unknown P46 capture stage");
  if (!cache.has(stage)) {
    const [revision, directory, sha] = stages[stage];
    const folder = `output/playwright/${directory}`;
    const manifest = text(
      execFileSync("git", ["show", `${revision}:${folder}/evidence.json`], {
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
    assert.equal(hash(manifest), sha, "Original P46 manifest must match in full");
    const evidence = JSON.parse(manifest);
    const extra = stage.startsWith("structure-")
      ? ["scripts/lib/ui-phase2-provider-keyboard-baseline.mjs"]
      : [];
    const paths = [
      ...new Set([
        ...Object.keys(evidence.sourceHashes),
        ...extra,
        ...evidence.screenshots.map((shot) => `${folder}/${shot.file}`),
      ]),
    ];
    assert.ok(paths.every((file) => !/[\r\n]/.test(file)));
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((file) => `${revision}:${file}\n`).join(""),
        maxBuffer: 128 * 1024 * 1024,
      }),
      paths,
    );
    cache.set(stage, { revision, folder, manifest, blobs });
  }
  const { revision, folder, manifest, blobs } = cache.get(stage);
  const evidence = JSON.parse(manifest);
  return {
    revision,
    manifest,
    evidence,
    source(file) {
      assert.ok(
        Object.hasOwn(evidence.sourceHashes, file) ||
          (stage.startsWith("structure-") &&
            file === "scripts/lib/ui-phase2-provider-keyboard-baseline.mjs"),
        "Source absent from P46 capture",
      );
      return text(blobs.get(file));
    },
    image(file) {
      const shot = evidence.screenshots.find((shot) => shot.file === file);
      assert.ok(shot, "Image absent from P46 capture");
      const bytes = Buffer.from(blobs.get(`${folder}/${file}`));
      assert.equal(hash(bytes), shot.sha256, file);
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
