import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

const revision = "df4b7263b1684e94e4ecc8d46c856c202fd9ee7b";
const base = "design-plans/ui-phase-2-2026-09-07/design";
const manifests = Object.freeze({
  "teams-direction-c": "6e0c46f381fbb064bc6b289dee6e958838708f2435aef1a6b3966f845af6b684",
  "teams-controls-direction-c": "b208df4321f013f4d1f51f4c155b4f5914e5948ececebd2fbf30c4ab4538d239",
  "teams-fields-direction-c": "4f9ce8529347282c71384f223654f7d5349a46b3e0b476b03770cd1ba1a5a547",
});
const dialog = "apps/web/src/components/AuditedReasonDialog.vue";
const currentDialogHash = "3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a";
const normalize = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cache = new Map();

// Test-only provenance for offline proposals. Never substitute this source in the app.
export function teamsHistoricalCapture(name) {
  assert.ok(Object.hasOwn(manifests, name), "Unknown P33 capture");
  const file = `${base}/${name}/evidence.json`;
  const local = normalize(readFileSync(file));
  assert.equal(hash(local), manifests[name], "Original P33 manifest changed");
  if (!cache.has(name)) {
    const manifest = normalize(
      execFileSync("git", ["show", `${revision}:${file}`], { maxBuffer: 8 * 1024 * 1024 }),
    );
    assert.equal(manifest, local, "P33 manifest does not match the fixed Git revision");
    const evidence = JSON.parse(manifest);
    const paths = Object.keys(evidence.sourceHashes);
    assert.ok(paths.length > 0 && paths.every((path) => !/[\r\n]/.test(path)));
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((path) => `${revision}:${path}\n`).join(""),
        maxBuffer: 16 * 1024 * 1024,
      }),
      paths,
    );
    const sources = new Map();
    for (const [path, sha] of Object.entries(evidence.sourceHashes)) {
      const source = normalize(blobs.get(path));
      assert.equal(hash(source), sha, `Original P33 source mismatch: ${path}`);
      sources.set(path, source);
    }
    cache.set(name, { manifest, sources });
  }
  const { manifest, sources } = cache.get(name);
  return {
    revision,
    manifest,
    source(path) {
      assert.ok(sources.has(path), `Source absent from P33 capture: ${path}`);
      return sources.get(path);
    },
  };
}

// Current checks remain separate: every source still matches, except the exact opt-in
// maximumLength revision. Its default and caller contract is rendered in a separate test.
export function assertTeamsCurrentSources(name, read = (file) => readFileSync(file)) {
  const evidence = JSON.parse(teamsHistoricalCapture(name).manifest);
  for (const [file, capturedHash] of Object.entries(evidence.sourceHashes)) {
    assert.equal(
      hash(normalize(read(file))),
      file === dialog ? currentDialogHash : capturedHash,
      `Unverified current P33 source: ${file}`,
    );
  }
}
