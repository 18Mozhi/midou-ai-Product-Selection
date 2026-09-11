import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  root = "output/playwright/p50-credential-login-detached-review";

test("P50 detached login evidence binds one owned chain and authoritative reconciliation", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-LOGIN-DETACHED-IMPLEMENTATION-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, true);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(evidence.states, [
    "detached-login-pending",
    "detached-login-success",
    "detached-login-asset-unknown",
    "detached-login-profile-unknown",
    "detached-login-profile-rejected",
  ]);
  assert.equal(evidence.runs.length, 20);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    344,
  );
  assert.equal(evidence.screenshots.length, 20);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 170);
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
    assert.equal(value("initial source identity"), "登录页来源");
    assert.equal(value("mutation controls locked while detached login is pending"), true);
    assert.equal(value("login asset is submitted once"), 1);
    assert.equal(
      value("login profile is submitted at most once"),
      run.state === "detached-login-asset-unknown" ? 0 : 1,
    );
    assert.equal(value("detached result rereads assets once"), 2);
    assert.equal(value("detached result rereads profiles once"), 2);
    assert.equal(value("six credential data GETs"), 6);
    assert.equal(value("expected isolated writes"), run.state.endsWith("asset-unknown") ? 1 : 2);
    assert.equal(value("writes carry bodies and idempotency keys"), true);
    assert.equal(value("material values never render"), true);
    assert.equal(value("no material persistence"), true);
    assert.equal(value("no browser cookies created"), 0);
    assert.equal(value("target44 configure login"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.state === "detached-login-pending")
      assert.equal(value("pending notice is informational"), "info");
  }
});
