import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOpenPage } from "../../scripts/lib/platform-open-page-preview.mjs";
import { previewOpenDetails, openDetailGroups } from "../../scripts/lib/open-detail-preview.mjs";
import {
  openDetailCases,
  openDetailSnapshot,
} from "../../scripts/lib/open-detail-verification.mjs";
import { openReviewFixtures } from "../../scripts/lib/open-review-fixtures.mjs";
const original = previewOpenPage(
  await readFile("apps/web/src/components/OpenPlatformCenter.vue", "utf8"),
);
const source = previewOpenDetails(original);
test("P60 detail regrouping does not change the original business script", () => {
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
});
test("P60 detail fields, interpolations, conditional actions and event handlers are preserved", () => {
  for (const pattern of [
    /<dt>[\s\S]*?<\/dt>/g,
    /{{[\s\S]*?}}/g,
    /v-if="[^"]*"/g,
    /@click="[^"]*"/g,
  ])
    assert.deepEqual(source.match(pattern), original.match(pattern));
  assert.equal((source.match(/class="p60-detail-section"/g) || []).length, 6);
  assert.equal((source.match(/class="p60-detail-actions"/g) || []).length, 3);
});
test("P60 desktop and summary slots are untouched", () => {
  for (const kind of ["desktop", "summary"])
    assert.deepEqual(
      source.match(new RegExp("<template #" + kind + "[\\s\\S]*?</template", "g")),
      original.match(new RegExp("<template #" + kind + "[\\s\\S]*?</template", "g")),
    );
});
test("P60 real Vue template compiles after both review transforms", () => {
  const { descriptor, errors } = parse(source, { filename: "OpenPlatformCenter.vue" });
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: "p60" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: "OpenPlatformCenter.vue",
      id: "p60",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
});
test("P60 changed original field order fails closed", () => {
  assert.throws(() => previewOpenDetails(original.replace("<dt>授权范围</dt>", "<dt>other</dt>")));
  assert.deepEqual(
    openDetailGroups.map((group) => group.fields.length),
    [5, 4, 6],
  );
});
test("P60 status samples preserve fixture ownership and do not mutate the E2E baseline", async () => {
  const { fixture } = await openReviewFixtures();
  const baseline = JSON.stringify(fixture);
  for (const scenario of openDetailCases) {
    const sample = openDetailSnapshot(fixture, scenario);
    assert.equal(sample[scenario.view][0].id, fixture[scenario.view][0].id);
    assert.equal(
      sample[scenario.view][0].organization_id,
      fixture[scenario.view][0].organization_id,
    );
    assert.equal(sample.summary.clients.active, sample.clients[0].status === "active" ? 1 : 0);
    assert.equal(Object.hasOwn(sample, "secret"), false);
  }
  assert.equal(JSON.stringify(fixture), baseline);
});
test("P60 status scenarios cover all existing client, webhook and delivery action boundaries", () => {
  assert.equal(openDetailCases.length, 12);
  for (const scenario of openDetailCases) {
    if (scenario.view === "clients" && scenario.patch.status)
      assert.deepEqual(scenario.actions, []);
    if (["queued", "leased", "retry_scheduled"].includes(scenario.patch.status))
      assert.deepEqual(scenario.actions, []);
  }
  const queued = openDetailCases.find((item) => item.key === "delivery-queued");
  assert.equal(queued.patch.attempt_count, 0);
  assert.equal(queued.patch.response_status, null);
  assert.equal(queued.patch.last_error_code, null);
});
test("P60 detail CLI rejects unsafe revisions, incomplete and mixed modes before starting a host", () => {
  for (const args of [
    ["--capture-details", "../r2"],
    ["--capture-details"],
    ["--details", "--capture-review", "r9"],
  ]) {
    const result = spawnSync(process.execPath, ["scripts/verify-open-page-preview.mjs", ...args], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Use no arguments, --details/);
    assert.equal(result.stdout, "");
  }
});
