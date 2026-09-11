import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  root = "output/playwright/p50-credential-login-boundary-review";

test("P50 boundary evidence binds file limits, helper recovery and source identity", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-LOGIN-BOUNDARY-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(evidence.states, [
    "cookie-oversize",
    "archive-invalid",
    "archive-oversize",
    "helper-unavailable",
    "helper-timeout",
    "source-switch",
  ]);
  assert.equal(evidence.runs.length, 24);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    396,
  );
  assert.equal(evidence.screenshots.length, 24);
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
    assert.equal(value("initial source identity"), "登录页来源");
    assert.equal(value("save remains disabled"), true);
    assert.equal(value("three credential data GETs"), 3);
    assert.equal(value("all network requests are GET without bodies"), true);
    assert.equal(value("material values never render"), true);
    assert.equal(value("no material persistence"), true);
    assert.equal(value("no browser cookies created"), 0);
    for (const control of ["source", "mode", "cancel", "save"])
      assert.equal(value(`target44 ${control}`), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("footer actions remain in viewport"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.state === "helper-timeout") {
      assert.equal(value("source unlocked after timeout"), true);
      assert.equal(value("mode unlocked after timeout"), true);
    }
    if (run.state === "source-switch")
      assert.equal(value("source identity changed"), "第二登录来源");
  }
});
