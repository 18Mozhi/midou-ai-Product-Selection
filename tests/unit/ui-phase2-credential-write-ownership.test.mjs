import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  root = "output/playwright/p50-credential-write-ownership-review";

test("P50 generic write evidence binds pending locks and detached settlement ownership", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-WRITE-OWNERSHIP-IMPLEMENTATION-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, true);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(evidence.states, [
    "detached-create-pending",
    "detached-create-success",
    "detached-rotate-unknown",
    "detached-profile-conflict",
    "profile-current-conflict",
    "revoke-pending",
    "revoke-conflict",
  ]);
  assert.equal(evidence.runs.length, 28);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    352,
  );
  assert.equal(evidence.screenshots.length, 28);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 50);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, shot.file);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, shot.file);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("one isolated write"), 1);
    assert.equal(value("write has a body"), true);
    assert.equal(value("write has an idempotency key"), true);
    assert.equal(value("secret values never render"), true);
    assert.equal(value("no secret persistence"), true);
    assert.equal(value("no browser cookies created"), 0);
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.state === "detached-create-pending") {
      assert.equal(value("mutation controls locked while detached write is pending"), true);
      assert.equal(value("pending notice is informational"), "info");
    }
    if (run.state === "detached-create-success")
      assert.equal(value("confirmed write refreshes facts once"), 2);
    if (run.state === "detached-rotate-unknown")
      assert.equal(value("unknown write rereads facts once"), 2);
    if (run.state === "detached-profile-conflict")
      assert.equal(value("known detached failure does not reread facts"), 1);
    if (run.state === "profile-current-conflict")
      assert.equal(value("profile editor remains open after failure"), true);
    if (run.state === "revoke-pending") {
      assert.equal(value("revoke cancel locked"), true);
      assert.equal(value("revoke confirmation locked"), true);
    }
    if (run.state.startsWith("revoke"))
      assert.equal(value("revoke dialog remains for a retry decision"), true);
  }
});
