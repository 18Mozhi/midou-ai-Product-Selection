import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  teamsHistoricalCapture,
  assertTeamsCurrentSources,
} from "../../scripts/lib/ui-phase2-teams-historical-capture.mjs";
import {
  base,
  dependencies,
  packageNames,
  buildTeamsReview,
} from "../../scripts/build-ui-phase2-teams-review.mjs";
import { assertOrganizationReasonContract } from "../../scripts/lib/ui-phase2-organization-reason-contract.mjs";

const read = (file) => readFileSync(file, "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("P33 immutable historical packets stay in Git while current packets bind their own sources and images", () => {
  let sources = 0,
    images = 0,
    currentSources = 0,
    currentImages = 0;
  for (const name of packageNames) {
    const capture = teamsHistoricalCapture(name);
    const historical = JSON.parse(capture.manifest);
    sources += Object.keys(historical.sourceHashes).length;
    for (const [file, sha] of Object.entries(historical.sourceHashes))
      assert.equal(hash(capture.source(file)), sha, file);
    for (const shot of historical.screenshots) {
      assert.equal(hash(capture.image(shot.file)), shot.sha256);
      images++;
    }
    const current = JSON.parse(read(`${base}/design/${name}/evidence.json`));
    for (const [file, sha] of Object.entries(current.sourceHashes)) {
      assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
      currentSources++;
    }
    for (const shot of current.screenshots) {
      assert.equal(hash(readFileSync(`${base}/design/${name}/${shot.file}`)), shot.sha256);
      currentImages++;
    }
    if (name === "teams-direction-c") {
      assert.equal(Object.hasOwn(historical, "approval"), false);
      assert.match(
        historical.boundary,
        /not mounted Vue, real API\/MySQL\/permissions\/audit or production proof/,
      );
    } else assert.equal(historical.approval, "pending-user-review");
  }
  assert.equal(sources, 55);
  assert.equal(images, 574);
  assert.equal(currentSources, 55);
  assert.equal(currentImages, 602);
});

test("P33 current-source boundary checks every dependency, not only the changed shared dialog", () => {
  for (const name of packageNames) {
    assertTeamsCurrentSources(name);
    const evidence = JSON.parse(teamsHistoricalCapture(name).manifest);
    for (const changed of Object.keys(evidence.sourceHashes))
      assert.throws(
        () =>
          assertTeamsCurrentSources(name, (file) => read(file) + (file === changed ? "\n" : "")),
        /Unverified current P33 source/,
        changed,
      );
    assertTeamsCurrentSources(name, (file) =>
      read(file).replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    );
  }
  assert.throws(() => teamsHistoricalCapture("unknown"), /Unknown P33 capture/);
  assert.throws(() => teamsHistoricalCapture(packageNames[0]).source("unknown.vue"), /absent/);
});

test("P33 actual organization caller still renders no reason maximum; optional cap remains opt-in", async () => {
  assert.deepEqual(
    await assertOrganizationReasonContract(read(dependencies[2]), read(dependencies[0])),
    {
      defaultMaximum: null,
      explicitMaximum: 500,
      minimum: 2,
      required: true,
    },
  );
});

test("P33 builder still rejects current sources paired with historical proposal evidence", () => {
  const packages = new Map(
    packageNames.map((name) => [name, JSON.parse(teamsHistoricalCapture(name).manifest)]),
  );
  const current = Object.fromEntries(dependencies.map((file) => [file, read(file)]));
  assert.throws(() => buildTeamsReview(current, packages), /stale team source/);
  const archived = Object.fromEntries(
    dependencies.map((file) => [file, teamsHistoricalCapture(packageNames[0]).source(file)]),
  );
  assert.throws(
    () => buildTeamsReview(archived, packages),
    /missing representative control create-read-traces for OG-T-CREATE-READ-TRACE/,
  );
});
