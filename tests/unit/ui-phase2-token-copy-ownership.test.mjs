import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalTokenCopySource,
  tokenCopyRevisions,
  tokenCopyComponent,
} from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const folder = "output/playwright/p36-copy-ownership";
const evidence = JSON.parse(read(`${folder}/evidence.json`));
test("P36 current mounted copy proof binds raw current sources, not historical substitution", () => {
  assert.equal(evidence.kind, "P36-COPY-OWNERSHIP-VUE-r1");
  assert.equal(evidence.acceptanceComplete, false);
  assert.equal(evidence.processesClosed, true);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  assert.equal(
    evidence.sourceHashes[tokenCopyComponent],
    tokenCopyRevisions[tokenCopyComponent].after,
  );
  assert.doesNotMatch(
    read("scripts/verify-ui-phase2-token-copy-ownership.mjs"),
    /historicalTokenCopySource|transform\(source/,
  );
  assert.match(evidence.scope, /No parent, App shell, API, valid credential, real OS clipboard/);
});
test("P36 actual cached child and reverse copy settlement cover both widths and outcomes", () => {
  assert.equal(evidence.checks.length, 90);
  assert.equal(evidence.scenarios.length, 28);
  for (const width of [390, 1440]) {
    const names = evidence.checks
      .filter((check) => check.width === width)
      .map((check) => check.name);
    for (const outcome of ["success", "failure"]) {
      for (const change of ["stay", "replace", "clear", "route", "deactivate", "unmount"])
        assert.ok(names.includes(`${change}-${outcome}:feedback owner checked`));
      assert.ok(names.includes(`deactivate-${outcome}:same cached DOM`));
      assert.ok(names.includes(`unmount-${outcome}:new DOM`));
      assert.ok(names.includes(`latest-${outcome}:reverse settlement`));
    }
    for (const name of ["zero external or API requests", "zero browser errors", "zero storage"])
      assert.ok(names.includes(name));
  }
});
test("P36 functional screenshots are immutable synthetic observations, not C approval", () => {
  assert.equal(evidence.screenshots.length, 28);
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256);
    assert.match(shot.scope, /synthetic-values-not-C-approval/);
  }
});
test("P36 historical proof allows only exact reviewed revisions and rejects unknown drift", () => {
  for (const [file, pair] of Object.entries(tokenCopyRevisions)) {
    assert.equal(hash(read(file)), pair.after);
    assert.equal(hash(historicalTokenCopySource(file, read(file))), pair.before);
    assert.throws(
      () => historicalTokenCopySource(file, read(file) + "\n// unknown change"),
      /Unreviewed token copy source/,
    );
  }
  assert.equal(historicalTokenCopySource("unrelated", "unchanged"), "unchanged");
});
