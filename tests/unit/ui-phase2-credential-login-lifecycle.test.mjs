import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  root = "output/playwright/p50-credential-login-lifecycle-review";

test("P50 lifecycle evidence binds material ownership, write locks and unknown outcomes", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-LOGIN-LIFECYCLE-IMPLEMENTATION-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, true);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(evidence.states, [
    "source-cleared",
    "file-late-ignored",
    "helper-late-ignored",
    "saving-asset",
    "asset-unknown",
    "profile-unknown",
    "profile-rejected",
  ]);
  assert.equal(evidence.runs.length, 28);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    500,
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
    const value = (name) => run.checks.find((check) => check.name === name)?.actual,
      expectedWrites = ["profile-unknown", "profile-rejected"].includes(run.state)
        ? 2
        : ["saving-asset", "asset-unknown"].includes(run.state)
          ? 1
          : 0;
    assert.equal(value("initial source identity"), "登录页来源");
    assert.equal(value("three credential data GETs"), 3);
    assert.equal(value("all network requests are GET without bodies"), true);
    assert.equal(value("expected isolated writes"), expectedWrites);
    assert.equal(value("writes carry bodies and idempotency keys"), true);
    assert.equal(value("material values never render"), true);
    assert.equal(value("no material persistence"), true);
    assert.equal(value("no browser cookies created"), 0);
    for (const control of ["source", "mode", "cancel", "save"])
      assert.equal(value(`target44 ${control}`), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("footer actions remain in viewport"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.state === "source-cleared") {
      assert.equal(value("source identity changed"), "第二登录来源");
      assert.equal(value("prepared material cleared"), true);
    }
    if (run.state === "file-late-ignored") {
      assert.equal(value("late file result ignored"), true);
      assert.equal(value("reopened source identity"), "第二登录来源");
    }
    if (run.state === "helper-late-ignored") {
      assert.equal(value("late helper result ignored"), true);
      assert.equal(value("reopened source identity"), "第二登录来源");
    }
    if (run.state === "saving-asset") {
      assert.equal(value("header close locked while saving"), true);
      assert.equal(value("cancel locked while saving"), true);
      assert.equal(value("source locked while saving"), true);
      assert.equal(value("mode locked while saving"), true);
    }
    if (run.state === "asset-unknown") assert.equal(value("unknown asset resubmit locked"), true);
    if (run.state === "profile-unknown")
      assert.equal(value("unknown profile resubmit locked"), true);
    if (run.state === "profile-rejected")
      assert.equal(value("rejected profile resubmit locked"), true);
  }
});
