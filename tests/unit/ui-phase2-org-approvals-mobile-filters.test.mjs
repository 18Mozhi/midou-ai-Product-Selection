import test from "node:test";
import { beforeP34OwnerPath } from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import { assertP34LegacySourceHash } from "../../scripts/lib/ui-phase2-org-approvals-shared-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { assertRetainedProposalSources } from "../../scripts/lib/ui-phase2-org-approvals-retained-sources.mjs";

const output = "output/playwright/p34-mobile-template-filters";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const component = "apps/web/src/components/OrganizationApprovalPanel.vue";
test("P34 historical mobile script excludes only search ref and subsequent owner-path fix", () => {
  const current = parse(beforeP34OwnerPath(component, readFileSync(component, "utf8"))).descriptor;
  const baseline = parse(
    execFileSync("git", ["show", `${e.baselineCommit}:${component}`], { encoding: "utf8" }),
  ).descriptor;
  assert.equal(
    current.scriptSetup.content
      .replaceAll("\r\n", "\n")
      .replace("\nconst templateSearchInput = ref<HTMLInputElement>();\n", ""),
    baseline.scriptSetup.content.replaceAll("\r\n", "\n"),
  );
  assert.equal(current.styles.length, 2);
  assert.equal(current.styles[0].src, "../design/approval-filter-tokens.css");
  assert.equal(current.styles[1].scoped, true);
  assert.match(current.styles[1].content, /@media \(max-width: 760px\)/);
  assert.match(current.template.content, /org-approval-toolbar org-approval-template-filters-c/);
  assert.equal((current.template.content.match(/class="org-approval-toolbar"/g) || []).length, 1);
});
test("P34 mounted mobile filter evidence covers four widths and preserves adjacent views", () => {
  assert.equal(e.checks.length, 120);
  assert.deepEqual([...new Set(e.checks.map((c) => c.width))], [390, 760, 761, 1440]);
  assert.equal(e.checks.filter((c) => c.name.includes("pixel identical")).length, 16);
  assert.equal(e.screenshots.length, 7);
  assert.deepEqual(
    e.screenshots.map((s) => s.scene),
    [
      "default",
      "matching",
      "no-result",
      "empty-region",
      "reset-focus",
      "reset-result",
      "empty-clear-focus",
    ],
  );
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assertP34LegacySourceHash(file, readFileSync(file, "utf8"), sha);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
});
test("P34 empty implementation evidence separates no-match from no-catalog and restores focus", () => {
  for (const name of [
    "keyboard clear restores existing defaults",
    "removed empty action returns focus to persistent search",
    "clear preserves other view and unrelated query",
    "pointer clear restores results",
    "pointer clear also returns focus",
  ])
    assert.deepEqual(
      e.checks.filter((c) => c.name === name).map((c) => c.width),
      [390, 760],
    );
  assert.equal(
    e.checks.filter((c) => c.name === "no catalog has no misleading clear-filter action").length,
    4,
  );
  assert.equal(e.checks.filter((c) => c.name === "desktop empty clear stays hidden").length, 2);
  assert.equal(e.baselineCommit, "bae3cbe722ecfee23b6b8331fd9104599ffa22a2");
});
test("P34 source refresh rejects changed proposal renderers and removed inputs", () => {
  const vue = component,
    renderer = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-direction-c/approvals.js";
  assert.doesNotThrow(() =>
    assertRetainedProposalSources(
      { [vue]: "old", [renderer]: "same" },
      { [vue]: "new", [renderer]: "same" },
    ),
  );
  assert.throws(
    () => assertRetainedProposalSources({ [renderer]: "old" }, { [renderer]: "new" }),
    /Cannot refresh/,
  );
  assert.throws(() => assertRetainedProposalSources({ [renderer]: "old" }, {}), /Cannot refresh/);
  for (const name of ["c", "controls-c", "fields-c"]) {
    const source = readFileSync(`scripts/verify-ui-phase2-org-approvals-${name}.mjs`, "utf8");
    assert.match(source, /assertRetainedProposalSources\(previous.sourceHashes, sourceHashes\)/);
    assert.match(source, /previous.screenshots/);
    assert.match(source, /if \(refreshSources\)/);
  }
});
