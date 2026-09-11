import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const root = "output/playwright/p50-credential-editor-focus-review",
  read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex");

test("P50 credential editor focus evidence binds every state and viewport", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-EDITOR-FOCUS-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, true);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 20);
  assert.equal(evidence.screenshots.length, 20);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 50);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  assert.deepEqual([...new Set(evidence.runs.map((run) => run.width))], [390, 760, 1024, 1440]);
  assert.deepEqual(
    [...new Set(evidence.runs.map((run) => run.state))],
    ["asset-create", "asset-rotate", "profile", "login", "revoke"],
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, shot.file);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, shot.file);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("dialog accessible name"), true);
    assert.equal(value("dialog has no horizontal overflow"), true);
    assert.equal(value("only local GET requests"), true);
    assert.equal(value("three credential data GETs"), 3);
    assert.equal(value("tab loop reaches both boundaries"), true);
    assert.equal(value("escape closes and restores trigger"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.state === "revoke") {
      assert.equal(value("explicit aria modal"), "true");
      assert.equal(value("custom confirmation is not native dialog"), "SECTION");
    } else {
      assert.equal(value("native dialog tag"), "DIALOG");
      assert.equal(value("native dialog open"), true);
      assert.equal(value("native modal top layer"), true);
      assert.equal(value("initial field has visible focus"), true);
    }
    if (run.state === "login") assert.equal(value("backdrop closes and restores trigger"), true);
  }
});
