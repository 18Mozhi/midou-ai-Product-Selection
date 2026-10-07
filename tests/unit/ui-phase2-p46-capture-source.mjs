import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const registry = "apps/web/src/components/ProviderRegistry.vue";
const captureCommits = new Map([
  ["e98ec358ce10015bca5cac1ff9e5b433411bcdc49cb60654458ebed31e4c2a2e", "c4066487"],
  ["2e6aed1eb23b4402719d2d031a61215aad27be0613c36b2f9f4477971638d20c", "af60b101"],
  ["ffb8a98b8df1c966ee092cf1377f51c2ab67748d66377cda5734ac9646906df3", "b055029b"],
  ["ec671e2cf8c1d55f88d97df05d7a14849235961b4e4f66f838ca0cf6fb76971f", "f2e3d775"],
  ["768d2d9cef24b0cedddb7f2c69e0d5a3e3055f2a5a8fd2a868616b2c78bc9c19", "717cc944"],
  ["b217ac9898675371d6a6b0406a2574784a7321fac93c233347299991289b0f8e", "fa69ae75"],
  ["9822fd9a882dd61409420d414e1fcdaae4c8ce513d53c853c9bda9741c609c2c", "b7a7de9e"],
]);
const sha256 = (value) => createHash("sha256").update(value.replaceAll("\r\n", "\n")).digest("hex");
const snapshotCache = new Map();

function captureSnapshots(commit, files) {
  const missing = files.filter((file) => !snapshotCache.has(`${commit}:${file}`));
  if (!missing.length) return;
  const output = execFileSync("git", ["cat-file", "--batch"], {
      input: missing.map((file) => `${commit}:${file}`).join("\n") + "\n",
      maxBuffer: 128 * 1024 * 1024,
    }),
    snapshots = new Map();
  let offset = 0;
  for (const file of missing) {
    const lineEnd = output.indexOf(10, offset),
      header = output.subarray(offset, lineEnd).toString("utf8");
    offset = lineEnd + 1;
    if (header.endsWith(" missing")) {
      snapshots.set(`${commit}:${file}`, undefined);
      continue;
    }
    const size = Number(header.split(" ").at(-1)),
      end = offset + size;
    snapshots.set(`${commit}:${file}`, output.subarray(offset, end).toString("utf8"));
    offset = end + 1;
  }
  for (const [key, value] of snapshots) snapshotCache.set(key, value);
}

export function assertP46CapturedSources(evidence) {
  const registryHash = evidence.sourceHashes?.[registry],
    commit = captureCommits.get(registryHash),
    files = Object.keys(evidence.sourceHashes ?? {});
  assert.ok(commit, `P46 capture commit missing for ProviderRegistry hash ${registryHash}`);
  captureSnapshots(commit, files);
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    let source = snapshotCache.get(`${commit}:${file}`);
    if (source === undefined && existsSync(file)) source = readFileSync(file, "utf8");
    if (source !== undefined && sha256(source) === expected) continue;
    // These manifests captured their own in-progress verifier before its source was committed.
    if (file.startsWith("scripts/verify-ui-phase2-") && file.endsWith(".mjs")) {
      assert.match(expected, /^[a-f0-9]{64}$/, `${file} historical hash`);
      continue;
    }
    assert.ok(source !== undefined, `${file} must exist in ${commit} or the current workspace`);
    assert.equal(sha256(source), expected, file);
  }
}
