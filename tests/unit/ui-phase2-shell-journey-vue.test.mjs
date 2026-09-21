import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewShellVue } from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";
import {
  buildShellJourneyFixture,
  journeyCompositionCss,
  previewShellJourney,
} from "../../scripts/lib/ui-phase2-shell-journey-vue-data.mjs";
const historicalSourceCommit = "af239b08b69f7d97cd0372f9840a70009eeef0c7";
const historicalSourceFiles = new Set([
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/web/src/components/OrganizationApprovalPanel.vue",
  "apps/web/src/components/SelectionJourney.vue",
]);
test("r3 capture binds three exact Git snapshots, unchanged remaining sources and original images", async () => {
  const root = "output/playwright/shell-journey-vue-c-r3";
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const manifest = await readFile(`${root}/evidence.json`);
  assert.equal(hash(manifest), "57ce771050ae29a19f19d6563095995489b6774168c8b75fbf1bf4c560ddf168");
  const evidence = JSON.parse(manifest);
  assert.equal(evidence.kind, "SHELL-JOURNEY-ACTUAL-VUE-C-r3");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(
    evidence.runs.map((run) => `${run.mode}/${run.width}`),
    ["baseline/390", "baseline/1440", "review/390", "review/840", "review/841", "review/1440"],
  );
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    242,
  );
  assert.equal(evidence.screenshots.length, 48);
  assert.equal(Object.keys(evidence.sourceHashes).length, 166);
  for (const file of historicalSourceFiles) assert.ok(Object.hasOwn(evidence.sourceHashes, file));
  for (const [file, sha] of Object.entries(evidence.sourceHashes)) {
    // These three source versions exist in Git. Never substitute historical code at runtime.
    const source = historicalSourceFiles.has(file)
      ? execFileSync("git", ["show", `${historicalSourceCommit}:${file}`], { encoding: "utf8" })
      : await readFile(file, "utf8");
    assert.equal(hash(source.replaceAll("\r\n", "\n")), sha, file);
  }
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    const actual = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.ok(
      run.requests.every((request) => request.key.startsWith("GET ") && request.body === null),
    );
    assert.equal(
      run.requests.filter((request) => request.key.includes("/selection-journeys/")).length,
      6,
    );
    assert.equal(actual("qualified adoption available"), true);
    assert.equal(actual("last action reachable above fixed navigation"), true);
    for (const gate of ["score", "market", "competition", "cost", "risk"]) {
      assert.equal(actual(`${gate} alone blocks adoption despite aggregate true`), true);
      assert.equal(actual(`${gate} shows four actual passed gates`), 4);
      if (run.mode === "review")
        assert.equal(
          evidence.screenshots.filter(
            (shot) =>
              shot.mode === run.mode &&
              shot.width === run.width &&
              shot.scene === `missing-${gate}`,
          ).length,
          1,
        );
    }
  }
  assert.ok(
    (await readFile("scripts/verify-ui-phase2-shell-journey-vue-c.mjs", "utf8")).includes(
      "Gate crop must be unobscured by fixed navigation",
    ),
  );
});
test("actual-App journey fixture preserves existing role projection and qualified candidate", async () => {
  const { journey, navigation, storageKey } = await buildShellJourneyFixture();
  assert.equal(storageKey, "scoutops.selection-journey.active-id");
  assert.equal(navigation.organization_id, journey.organization_id);
  assert.equal(navigation.workspace_id, journey.workspace_id);
  assert.deepEqual(navigation.roles, ["member"]);
  assert.deepEqual(navigation.capabilities, [
    "task:create",
    "opportunity:read",
    "opportunity:decide",
  ]);
  assert.deepEqual(navigation.platform_capabilities, []);
  assert.equal(journey.results.length, 2);
  assert.equal(journey.results[0].quality_gates.all_passed, false);
  assert.equal(journey.results[1].quality_gates.all_passed, true);
  for (const gate of ["score", "market", "competition", "cost", "risk"])
    assert.equal(journey.results[1].quality_gates[gate], true);
});
test("member composition only changes mobile active indicator beyond the existing shell preview", async () => {
  const file = "apps/web/src/components/NavigationShell.vue";
  const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
  const before = parse(previewShellVue(source)).descriptor;
  const after = parse(previewShellJourney(source)).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.equal(
    after.template.content.replace("!moreActive && activeItem?.path ===", "activeItem?.path ==="),
    before.template.content,
  );
  const script = compileScript(after, { id: "member-shell" });
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: file,
      id: "member-shell",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
  assert.throws(() =>
    previewShellJourney(
      source.replace('v-for="item in primaryItems"', 'v-for="item in changedItems"'),
    ),
  );
});
test("composition stays review-scoped and preserves original production stage layout", async () => {
  const css = await readFile(journeyCompositionCss, "utf8");
  assert.ok(
    css.includes("html body.shell-journey-vue-c:has(#app) #app .role-shell.role-shell--review"),
  );
  assert.ok(css.includes("grid-auto-flow: column"));
  assert.ok(!css.includes("!important"));
  assert.ok(
    (await readFile("apps/web/src/selection-journey.css", "utf8")).includes(
      "grid-template-columns: 208px minmax(0, 1fr)",
    ),
  );
  assert.ok(
    !(await readFile("apps/web/src/components/SelectionJourney.vue", "utf8")).includes(
      "shell-journey-vue",
    ),
  );
});
