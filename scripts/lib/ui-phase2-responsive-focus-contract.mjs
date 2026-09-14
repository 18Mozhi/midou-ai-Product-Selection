import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const responsiveFocusRevision = Object.freeze({
  file: "apps/web/src/components/ResponsiveDataView.vue",
  baseline: "ea005452",
  before: "28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa",
  focusAfter: "b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99",
  after: "52738f13651a70aab3601928e163fe32fb88cc992d0b09dfe67297754e44b39c",
  governanceBaseline: "6c8ebaa63dc0f1a3ac0e9946dafc019f5ec130b6",
  governanceAfter: "739ac85b109ec7c2557909d1f267d1b67a8384aa385afb80f2fd512502d17f7a",
  contentBaseline: "388b311d8e470a8f54467da4c38f14c051d350de",
  contentAfter: "6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac",
  paletteBaseline: "af239b08b69f7d97cd0372f9840a70009eeef0c7",
  paletteAfter: "8669cbd3ecba514b449a3f4ec992e7b17fe45335cb6d2f40a1eae7032affdccf",
  paletteFile: "apps/web/src/design/platform-overlay-tokens.css",
  paletteBeforeNotifications: "92238301dcc6212a6c8f498bba7b2d35e75770bc968c894df8e46df7e33b4c9b",
  paletteSha256: "1ac279a72962b120c1f5153a9abb30e258e84be9c1519df1b7944f7190dd69b5",
  focusCapture: "635e5538a96493fcf62e95938c78fb07aebcc9b7",
  reasonFile: "apps/web/src/components/AuditedReasonDialog.vue",
  reasonAfter: "3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a",
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const at = (revision, file) =>
  execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }).replaceAll(
    "\r\n",
    "\n",
  );

export function verifyResponsivePalette(source = read) {
  const revision = responsiveFocusRevision,
    current = source(revision.file),
    palette = source(revision.paletteFile);
  assert.equal(hash(current), revision.paletteAfter, "unreviewed current responsive source");
  assert.equal(hash(palette), revision.paletteSha256, "unreviewed overlay palette");
  // Only add the omitted notification scope; retain every prior selector and color byte.
  assert.equal(
    hash(palette.replace(",\n.responsive-filter-drawer--notifications", "")),
    revision.paletteBeforeNotifications,
    "notification scope must preserve the prior palette",
  );
  const values = new Map(
    [...palette.matchAll(/(--so-workspace-overlay-[\w-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  const imported = '@import "../design/platform-overlay-tokens.css";\n\n';
  assert.equal(current.split(imported).length, 2, "one explicit palette import");
  const expanded = current
    .replace(imported, "")
    .replace(/var\((--so-workspace-overlay-[\w-]+)\)/g, (_, name) => {
      assert.ok(values.has(name), `missing palette role ${name}`);
      return values.get(name);
    });
  assert.equal(
    hash(expanded),
    revision.contentAfter,
    "palette extraction must preserve full prior source",
  );
  assert.equal(hash(at(revision.paletteBaseline, revision.file)), revision.contentAfter);
  return revision.paletteAfter;
}

export function verifyResponsiveFocusDependencies(source = read) {
  const revision = responsiveFocusRevision,
    manifest = "output/playwright/responsive-data-view-focus/evidence.json",
    evidence = JSON.parse(read(manifest));
  assert.deepEqual(evidence, JSON.parse(at(revision.focusCapture, manifest)));
  for (const [file, fingerprint] of Object.entries(evidence.sourceHashes)) {
    assert.equal(hash(at(revision.focusCapture, file)), fingerprint, `${file}: capture source`);
    const currentExpected =
      file === revision.file
        ? revision.paletteAfter
        : file === revision.reasonFile
          ? revision.reasonAfter
          : fingerprint;
    assert.equal(hash(source(file)), currentExpected, `${file}: unreviewed current dependency`);
  }
  return Object.keys(evidence.sourceHashes).length;
}

// Historical contract tables stay untouched. Permit only this explicitly tested revision,
// not arbitrary future source drift; every proposal still must recapture current source hashes.
export function responsiveFocusContractHash(file, expected) {
  const revision = responsiveFocusRevision;
  if (file !== revision.file) return expected;
  if (expected === revision.contentAfter) return verifyResponsivePalette();
  if (expected === revision.governanceAfter) {
    assert.equal(
      hash(
        execFileSync("git", ["show", `${revision.contentBaseline}:${file}`], {
          encoding: "utf8",
        }).replaceAll("\r\n", "\n"),
      ),
      revision.governanceAfter,
    );
    return verifyResponsivePalette();
  }
  if (expected === revision.after) {
    assert.equal(
      hash(
        execFileSync("git", ["show", `${revision.governanceBaseline}:${file}`], {
          encoding: "utf8",
        }).replaceAll("\r\n", "\n"),
      ),
      revision.after,
    );
    return verifyResponsivePalette();
  }
  assert.equal(expected, revision.before, "unknown historical responsive-view contract");
  assert.equal(
    hash(
      execFileSync("git", ["show", `${revision.baseline}:${file}`], {
        encoding: "utf8",
      }).replaceAll("\r\n", "\n"),
    ),
    revision.before,
  );
  const currentHash = verifyResponsivePalette();
  assert.match(read(file), /<slot name="desktop" :show="show"/);
  const lifecycle = JSON.parse(read("output/playwright/p38-shell-lifecycle/current/evidence.json"));
  assert.equal(lifecycle.mode, "current-regression");
  assert.equal(lifecycle.sourceHashes[file], revision.focusAfter);
  assert.equal(lifecycle.processesClosed, true);
  assert.equal(lifecycle.observations.length, 8);
  assert.ok(lifecycle.observations.every((v) => v.dialogs === 0 && v.appInert === false));
  const evidence = JSON.parse(read("output/playwright/responsive-data-view-focus/evidence.json"));
  assert.deepEqual(
    evidence,
    JSON.parse(
      at(revision.focusCapture, "output/playwright/responsive-data-view-focus/evidence.json"),
    ),
  );
  assert.equal(evidence.sourceHashes[file], revision.focusAfter);
  assert.equal(evidence.checks.length, 10);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.approval, "pending");
  verifyResponsiveFocusDependencies();
  for (const shot of evidence.screenshots)
    assert.equal(
      hash(readFileSync(`output/playwright/responsive-data-view-focus/${shot.file}`)),
      shot.sha256,
      shot.file,
    );
  return currentHash;
}
