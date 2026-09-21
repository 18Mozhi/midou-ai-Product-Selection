import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { p47HistoricalSource } from "../../scripts/lib/ui-phase2-adapter-historical-source.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const [folder, kind, checks, images, palette] of [
  [
    "p44-mobile-directory-implementation/current",
    "P44-MOBILE-DIRECTORY-IMPLEMENTATION",
    134,
    30,
    "platform-admin-mobile-tokens",
  ],
  [
    "p44-mobile-controls-implementation/current",
    "P44-MOBILE-CONTROLS-IMPLEMENTATION",
    110,
    16,
    "platform-admin-mobile-tokens",
  ],
  [
    "p44-mobile-results-implementation/current",
    "P44-MOBILE-RESULTS-IMPLEMENTATION",
    234,
    48,
    "platform-admin-mobile-tokens",
  ],
  [
    "p46-approved-structure-implementation/current",
    "P46-APPROVED-STRUCTURE-IMPLEMENTATION-r1",
    452,
    132,
    "provider-registry-tokens",
  ],
  [
    "p46-provider-feedback-implementation/current",
    "P46-APPROVED-FEEDBACK-r1",
    244,
    40,
    "provider-registry-tokens",
  ],
  [
    "p44-mobile-role-facts-implementation/current",
    "P44-MOBILE-ROLE-FACTS-IMPLEMENTATION",
    352,
    24,
    "platform-admin-mobile-tokens",
  ],
]) {
  const p46Historical = folder.startsWith("p46-");
  test(`${folder} ${p46Historical ? "pre-refresh captured" : "current"} evidence binds its imported palette, sources and images`, () => {
    const root = `output/playwright/${folder}`;
    const evidence = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
    if (p46Historical)
      assert.equal(
        hash(readFileSync(`${root}/evidence.json`, "utf8").replaceAll("\r\n", "\n")),
        folder.includes("structure")
          ? "282b1ae5ce61667e3b0ca6b9f0462298e329551c3fd57d6d6e3fc1243e60b329"
          : "d2099b70801be2546809cf21bb3f8e03bab611fd33bdce54b8c92d29ee4ef8e9",
      );
    assert.equal(evidence.kind, kind);
    assert.equal(evidence.processesClosed, true);
    assert.equal(evidence.checks.length, checks);
    assert.equal(evidence.screenshots.length, images);
    assert.ok(evidence.sourceHashes[`apps/web/src/design/${palette}.css`]);
    assert.ok(evidence.sourceHashes["scripts/lib/ui-imported-style-sources.mjs"]);
    for (const [source, expected] of Object.entries(evidence.sourceHashes)) {
      const text = readFileSync(source, "utf8").replaceAll("\r\n", "\n");
      assert.equal(
        hash(p46Historical ? p47HistoricalSource(source, text, "pre-refresh") : text),
        expected,
        source,
      );
    }
    for (const shot of evidence.screenshots)
      assert.equal(hash(readFileSync(`${root}/${shot.file}`)), shot.sha256, shot.file);
  });
}
