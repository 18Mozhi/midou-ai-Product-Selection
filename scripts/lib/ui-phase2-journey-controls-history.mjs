import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const packet = "output/playwright/p16-c-r2-review";
const manifestHash = "4cb80b9e75aee2d4cb355ca8897a2e0960e66c82b398f720ef10cf1b4ac532ac";
const sourceVersions = new Map([
  ["apps/web/src/components/SelectionJourney.vue", "af239b08b69f7d97cd0372f9840a70009eeef0c7"],
  ["apps/web/src/components/NavigationShell.vue", "af239b08b69f7d97cd0372f9840a70009eeef0c7"],
  ["scripts/verify-ui-phase2-journey-vue.mjs", "af239b08b69f7d97cd0372f9840a70009eeef0c7"],
  ["apps/web/src/signal-ledger.css", "0c5c48ee4959d24238af106ae6d2610a48aa9b9c"],
  ["apps/web/src/styles/onboarding-navigation.css", "6e7dfd93d245e06d5a549584ec14e34f425c8a5f"],
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function parseJourneyControlsHistoricalManifest(bytes) {
  assert.equal(hash(bytes), manifestHash, "Historical P16 controls manifest must remain unchanged");
  return JSON.parse(bytes);
}

export async function verifyJourneyControlsHistory(repo) {
  const evidence = parseJourneyControlsHistoricalManifest(
    await readFile(path.join(repo, packet, "evidence.json")),
  );
  assert.equal(Object.keys(evidence.sourceHashes).length, 20);
  for (const file of sourceVersions.keys()) assert.ok(Object.hasOwn(evidence.sourceHashes, file));
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    const version = sourceVersions.get(file);
    const source = version
      ? execFileSync("git", ["show", `${version}:${file}`], { cwd: repo, encoding: "utf8" })
      : await readFile(path.join(repo, file), "utf8");
    assert.equal(hash(source.replaceAll("\r\n", "\n")), expected, file);
  }
  assert.equal(evidence.screenshots.length, 114);
  assert.equal(evidence.controlStates.length, 90);
  for (const shot of evidence.screenshots) {
    assert.match(shot.file, /^(1440|390)-[a-z-]+\.png$/);
    assert.equal(hash(await readFile(path.join(repo, packet, shot.file))), shot.sha256, shot.file);
  }
  return evidence;
}
