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

test("P33 three immutable proposal packets retain all 55 source bindings and 574 images", () => {
  let sources = 0,
    images = 0;
  for (const name of packageNames) {
    const capture = teamsHistoricalCapture(name);
    const evidence = JSON.parse(capture.manifest);
    sources += Object.keys(evidence.sourceHashes).length;
    for (const [file, sha] of Object.entries(evidence.sourceHashes))
      assert.equal(hash(capture.source(file)), sha, file);
    for (const shot of evidence.screenshots) {
      assert.equal(hash(readFileSync(`${base}/design/${name}/${shot.file}`)), shot.sha256);
      images++;
    }
    if (name === "teams-direction-c") {
      assert.equal(Object.hasOwn(evidence, "approval"), false);
      assert.match(
        evidence.boundary,
        /not mounted Vue, real API\/MySQL\/permissions\/audit or production proof/,
      );
    } else assert.equal(evidence.approval, "pending-user-review");
  }
  assert.equal(sources, 55);
  assert.equal(images, 574);
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
  assert.throws(
    () => buildTeamsReview(current, packages),
    /stale team source.*AuditedReasonDialog/,
  );
  const archived = Object.fromEntries(
    dependencies.map((file) => [file, teamsHistoricalCapture(packageNames[0]).source(file)]),
  );
  assert.equal(buildTeamsReview(archived, packages).approval, "pending-user-review");
});
