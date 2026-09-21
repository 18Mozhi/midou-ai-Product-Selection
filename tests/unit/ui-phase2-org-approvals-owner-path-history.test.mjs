import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  ownerPathParent,
  ownerPathPanel,
  beforeP34OwnerPath,
  assertP34HistoricalSourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const baseline = "af239b08b69f7d97cd0372f9840a70009eeef0c7";
const old = JSON.parse(read("output/playwright/p34-read-order-vue-c-r1/evidence.json"));
const current = JSON.parse(read("output/playwright/p34-route-lifecycle-vue-c-r1/evidence.json"));

test("historical and current manifests remain pinned and every listed screenshot is intact", () => {
  const manifests = {
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-controls-direction-c":
      "89018220b46583fb794728eafd02c92a88437cf06cbd229afc27dc7124e3cd50",
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-fields-direction-c":
      "a3e853929804b3ff62a5e61a81063c6d143ef982e5a9577372d6dd94624daa59",
    "output/playwright/p34-mobile-template-filters":
      "5f8afd90d4e31e1f5ab83ebe8a622c475bb153ad5c870485074535ef5ae47e6b",
    "output/playwright/p34-rate-limit-vue":
      "75ba85c1dd9a2533d59657ebca39804b4443a2abd29ed8b476f4eaa3e258e388",
    "output/playwright/p34-approvals-vue-c-r4":
      "964863ad52207745c61d701db6dab99c02917d85c59f4cabea6819cc78b430a4",
    "output/playwright/p34-parent-current-c-r3":
      "b4bc20a5f58b10d030d155fdc8d64b87cd1d9bb9cb9188bb04d3fa3fe39e4d7c",
    "output/playwright/p34-permission-vue-c-r1":
      "cc3e8b561550e9094620b644fe01ceb0a39d8ce81791ab4641102115e0b2db6f",
    "output/playwright/p34-expired-vue-c-r1":
      "006fa7192ddcc8f7c817cb69234326a536019b61cfb7c37d52e8d63604c23d53",
    "output/playwright/p34-read-feedback-vue-c-r1":
      "c9077f463708bb86aa8d634b8ba4be670d8310b8783079a189d9cc0d0deb1543",
    "output/playwright/p34-loading-vue-c-r2":
      "ba90d1428752817ab59b5a8f52391feedfc38b58f3df585f2ef856872afee779",
    "output/playwright/p34-read-order-vue-c-r1":
      "bce22066453e91a4d4cfb5bd77167df376b6c63a3ac63996af11bf6256ef0abf",
    "output/playwright/p34-route-lifecycle-vue-c-r1":
      "538626c99477684ef094e663c70eb049bafa407c57bf920456386518222e9375",
  };
  for (const [folder, expected] of Object.entries(manifests)) {
    const bytes = readFileSync(folder + "/evidence.json");
    assert.equal(hash(bytes), expected, folder);
    for (const image of JSON.parse(bytes).screenshots)
      assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256, image.file);
  }
});

test("historical inversion equals the pinned pre-fix Git files and unchanged manifest hashes", () => {
  for (const file of [ownerPathParent, ownerPathPanel]) {
    const source = read(file),
      reconstructed = beforeP34OwnerPath(file, source);
    assert.equal(
      reconstructed,
      execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
    );
    assertP34HistoricalSourceHash(file, source, old.sourceHashes[file]);
    assert.equal(hash(source), current.sourceHashes[file]);
    assert.notEqual(hash(source), old.sourceHashes[file]);
  }
});

test("missing, duplicated, partial or altered owner-path changes cannot be reconstructed", () => {
  const cases = [
    [ownerPathParent, '        :owner-path="props.routePath"\n'],
    [ownerPathPanel, "  ownerPath?: string;\n"],
    [ownerPathPanel, "const queryOwnerPath = props.ownerPath ?? route.path,"],
  ];
  for (const [file, token] of cases) {
    const source = read(file);
    for (const mutated of [
      source.replace(token, ""),
      source.replace(token, token + token),
      source.replace(token, token.replace("Path", "OtherPath")),
    ])
      assert.throws(() => assertP34HistoricalSourceHash(file, mutated, old.sourceHashes[file]));
  }
});

test("unrelated edits in either production file still fail the complete historical hash", () => {
  for (const file of [ownerPathParent, ownerPathPanel]) {
    const source = read(file);
    for (const mutated of [
      source + "\n<!-- extra -->",
      source.replace("templates", "otherTemplates"),
      source.replace("<script setup", "<script other"),
    ])
      assert.throws(
        () => assertP34HistoricalSourceHash(file, mutated, old.sourceHashes[file]),
        /differs beyond/,
      );
  }
});

test("other paths and new evidence are not silently rebased", () => {
  const file = "apps/web/src/components/NavigationShell.vue",
    source = read(file);
  assert.equal(beforeP34OwnerPath(file, source), source);
  assertP34HistoricalSourceHash(file, source, hash(source));
  assert.throws(() => assertP34HistoricalSourceHash(file, source + "\n", hash(source)));
  for (const path of [ownerPathParent, ownerPathPanel])
    assert.throws(() =>
      assertP34HistoricalSourceHash(path, read(path), current.sourceHashes[path]),
    );
});

test("current query and lifecycle tests continue to bind actual source without historical inversion", () => {
  for (const file of [
    "tests/unit/ui-phase2-org-approvals-query.test.mjs",
    "tests/unit/ui-phase2-org-approvals-route-lifecycle-vue.test.mjs",
  ])
    assert.doesNotMatch(
      read(file),
      /owner-path-history|beforeP34OwnerPath|assertP34HistoricalSourceHash/,
    );
});
