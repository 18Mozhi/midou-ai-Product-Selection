import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Feature Map uses fixed statuses and completion evidence bindings", async () => {
  const map = JSON.parse(await readFile("docs/feature-map.json", "utf8"));
  const allowed = new Set(["planned", "implemented", "verified", "blocked", "deprecated"]);
  const statuses = [];
  (function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "status") statuses.push(String(item));
      collect(item);
    }
  })(map);
  assert.ok(statuses.length > 100);
  assert.ok(statuses.every((status) => allowed.has(status)));
  assert.deepEqual(new Set(map.statusEnum), allowed);
  assert.deepEqual(map.implementation.verification.completionEvidence.requiredFields, [
    "commitSha",
    "worktreeFingerprint",
    "completedAt",
    "evidenceSummary",
  ]);
});

test("verification state never marks entries complete without reusable evidence fields", async () => {
  const state = JSON.parse(await readFile("verification/state.json", "utf8"));
  for (const [completedKey, evidenceKey] of [
    ["completedModules", "moduleEvidence"],
    ["completedPhases", "phaseEvidence"],
  ]) {
    for (const id of state[completedKey] ?? []) {
      const evidence = state[evidenceKey]?.[id];
      assert.equal(typeof evidence?.commitSha, "string");
      assert.equal(typeof evidence?.worktreeFingerprint, "string");
      assert.equal(typeof evidence?.completedAt, "string");
      assert.equal(evidence?.evidenceSummary?.status, "passed");
    }
  }
});

test("locate_flow_v4 expands Chinese aliases and returns source API and test fields", () => {
  const result = spawnSync(process.execPath, ["scripts/locate_flow_v4.mjs", "发布中心"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.ok(output.expandedTerms.includes("release"));
  assert.ok(output.matches.length > 0);
  for (const match of output.matches) {
    assert.ok(Array.isArray(match.sourceFiles));
    assert.ok(Array.isArray(match.apiFiles));
    assert.ok(Array.isArray(match.apiRoutes));
    assert.ok(Array.isArray(match.testFiles));
  }
});
