import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseJourneyFieldsHistoricalManifest,
  verifyJourneyFieldsHistory,
} from "../../scripts/lib/ui-phase2-journey-fields-history.mjs";

const manifest = await readFile("output/playwright/p16-c-r2-fields-review/evidence.json");

test("P16 field history validates original Git versions, remaining sources and 24 immutable images", async () => {
  const evidence = await verifyJourneyFieldsHistory(process.cwd());
  assert.equal(Object.keys(evidence.sourceHashes).length, 23);
  assert.equal(evidence.screenshots.length, 24);
  assert.equal(evidence.checks.length, 96);
  assert.deepEqual(evidence, JSON.parse(manifest));
});

test("P16 field history rejects changed source, screenshot, checks or boundary metadata", () => {
  const serialize = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
  assert.deepEqual(serialize(JSON.parse(manifest)), manifest);
  for (const change of [
    (e) => delete e.sourceHashes["apps/web/src/components/SelectionJourney.vue"],
    (e) => {
      e.screenshots[0].sha256 = "0".repeat(64);
    },
    (e) => {
      e.checks = [];
    },
    (e) => {
      e.boundary = "production approved";
    },
  ]) {
    const evidence = JSON.parse(manifest);
    change(evidence);
    assert.throws(
      () => parseJourneyFieldsHistoricalManifest(serialize(evidence)),
      /must remain unchanged/,
    );
  }
});

test("P16 historical proof is not injected into current source hashing or browser rendering", async () => {
  const driver = await readFile("scripts/verify-ui-phase2-journey-fields.mjs", "utf8");
  assert.match(driver, /hash\(\(await readFile\(path\.join\(repo, f\), "utf8"\)\)\.replaceAll/);
  assert.match(
    driver,
    /else if \(!smoke && !current\) assert\.deepEqual\(previous\.checks, checks\)/,
  );
  assert.equal((driver.match(/await verifyJourneyFieldsHistory\(repo\)/g) ?? []).length, 1);
  assert.ok(
    driver.indexOf("await verifyJourneyFieldsHistory(repo)") <
      driver.indexOf("await createServer("),
  );
  assert.ok(!driver.includes("transformIndexHtml") && !driver.includes("execFileSync"));
});
