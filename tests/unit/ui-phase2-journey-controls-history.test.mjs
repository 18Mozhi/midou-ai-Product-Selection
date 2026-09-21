import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseJourneyControlsHistoricalManifest,
  verifyJourneyControlsHistory,
} from "../../scripts/lib/ui-phase2-journey-controls-history.mjs";

const manifest = await readFile("output/playwright/p16-c-r2-review/evidence.json");

test("P16 controls history validates 20 sources, 114 original images and 90 recorded states", async () => {
  const evidence = await verifyJourneyControlsHistory(process.cwd());
  assert.deepEqual(evidence, JSON.parse(manifest));
  assert.equal(evidence.checks.length, 170);
  assert.equal(evidence.approval, "pending-controls-review");
});

test("P16 controls history rejects changed sources, images, state matrix and approval", () => {
  const serialize = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
  assert.deepEqual(serialize(JSON.parse(manifest)), manifest);
  for (const change of [
    (e) => delete e.sourceHashes["apps/web/src/components/SelectionJourney.vue"],
    (e) => {
      e.screenshots[0].sha256 = "0".repeat(64);
    },
    (e) => {
      e.controlStates = [];
    },
    (e) => {
      e.approval = "approved";
    },
  ]) {
    const evidence = JSON.parse(manifest);
    change(evidence);
    assert.throws(
      () => parseJourneyControlsHistoricalManifest(serialize(evidence)),
      /must remain unchanged/,
    );
  }
});

test("P16 current driver retains real controls and request assertions after history validation", async () => {
  const driver = await readFile("scripts/verify-ui-phase2-journey-vue.mjs", "utf8");
  assert.ok(
    driver.indexOf("await verifyJourneyControlsHistory(repo)") <
      driver.indexOf("await createServer("),
  );
  assert.match(driver, /hash\(\(await readFile\(path\.join\(repo, file\), "utf8"\)\)\.replaceAll/);
  assert.match(driver, /cases\(controlStates\), expectedCases, "missing\/duplicate control state"/);
  assert.match(
    driver,
    /cases\(previous\.controlStates\),\s*expectedCases,\s*"stale saved control state matrix"/,
  );
  assert.match(driver, /assert\.deepEqual\(write, \{/);
  assert.ok(!driver.includes("execFileSync") && !driver.includes("transformIndexHtml"));
});
