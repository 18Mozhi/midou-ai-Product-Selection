import {
  historicalAdminResultsSource,
  adminResultsRevisions,
} from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { adminDirectoryRevision } from "../../scripts/lib/ui-phase2-admin-directory-baseline.mjs";
import { adminControlsRevision } from "../../scripts/lib/ui-phase2-admin-controls-baseline.mjs";
import { passwordRevision } from "../../scripts/lib/ui-phase2-password-baseline.mjs";
import {
  historicalUserCreationSource,
  userCreationRevisions,
} from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
import {
  historicalFilterResetSource,
  filterResetRevision,
} from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { reviewHash } from "../../scripts/lib/ui-phase2-vue-review-host.mjs";
import {
  historicalOrganizationActionSource,
  organizationActionRevisions,
  organizationActionParent,
} from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import { organizationListPreview } from "../../scripts/lib/ui-phase2-organization-list-preview.mjs";
import { tokenCopyRevisions } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
const read = (f) =>
  historicalAdminResultsSource(f, readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
const evidence = (mode) =>
  JSON.parse(read(`output/playwright/p42-write-ownership/${mode}/evidence.json`));
test("current and baseline Vue runs retain exact source and PNG fingerprints without relabeling old defects", () => {
  for (const mode of ["current", "baseline"]) {
    const e = evidence(mode),
      dir = `output/playwright/p42-write-ownership/${mode}`;
    assert.equal(
      e.kind,
      mode === "current"
        ? "current-organization-action-ownership"
        : "historical-original-script-replay",
    );
    assert.equal(e.processesClosed, true);
    assert.equal(e.scenarios.length, 16);
    assert.equal(e.checks.length, 98);
    assert.equal(e.screenshots.length, 28);
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(
        reviewHash(historicalUserCreationSource(f, historicalFilterResetSource(f, read(f)))),
        sha,
        f,
      );
    const source =
      mode === "baseline"
        ? historicalOrganizationActionSource(
            organizationActionParent,
            read(organizationActionParent),
          )
        : historicalUserCreationSource(organizationActionParent, read(organizationActionParent));
    assert.equal(
      e.transformedHashes[organizationActionParent],
      reviewHash(organizationListPreview(source)),
    );
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots) {
      assert.equal(reviewHash(readFileSync(`${dir}/${s.file}`)), s.sha256);
      assert.equal(s.sourceSha, reviewHash(JSON.stringify(e.sourceHashes)));
    }
  }
});
test("closed current actions neither reopen nor reread, reasons on history navigation issue no writes", () => {
  const e = evidence("current");
  for (const s of e.scenarios) {
    const writes = s.requests.filter((r) => r.method !== "GET");
    if (s.mode === "refresh-failure") {
      assert.ok(s.finalState.feedback.length);
      continue;
    }
    assert.equal(s.finalState.detailVisible, false);
    assert.equal(s.finalState.reasonVisible, false);
    assert.equal(s.finalState.url, "/platform-admin/organizations");
    assert.deepEqual(s.finalState.feedback, []);
    assert.deepEqual(s.finalState.errors, []);
    assert.equal(writes.length, s.mode === "reason-back" ? 0 : 1);
    assert.equal(s.requests.filter((r) => r.method === "GET" && r.afterWrite).length, 0);
  }
  for (const s of evidence("baseline").scenarios.filter((s) =>
    ["success-close", "reason-back"].includes(s.mode),
  )) {
    assert.equal(s.finalState.detailVisible, true);
    assert.equal(s.finalState.url, "/platform-admin/organizations");
  }
});
test("historical associations accept only exact reviewed source revisions", () => {
  for (const [file, pair] of Object.entries(organizationActionRevisions)) {
    assert.equal(reviewHash(historicalUserCreationSource(file, read(file))), pair.after);
    assert.equal(reviewHash(historicalOrganizationActionSource(file, read(file))), pair.before);
    assert.throws(
      () => historicalOrganizationActionSource(file, read(file) + "\n// unknown delta"),
      /Unreviewed/,
    );
  }
  assert.equal(historicalOrganizationActionSource("unrelated", "unchanged"), "unchanged");
  const audit = JSON.parse(read("design-plans/ui-phase-2-2026-09-07/design-delivery-audit.json"));
  const associations = audit.packages.flatMap((p) => p.historicalSourceAssociations ?? []);
  assert.ok(associations.length > 0);
  for (const association of associations) {
    const pair = [
      organizationActionRevisions[association.file],
      tokenCopyRevisions[association.file],
      adminResultsRevisions[association.file],
      userCreationRevisions[association.file],
      association.file === passwordRevision.file ? passwordRevision : undefined,
      association.file === adminControlsRevision.file ? adminControlsRevision : undefined,
      association.file === adminDirectoryRevision.file ? adminDirectoryRevision : undefined,
      association.file === filterResetRevision.file ? filterResetRevision : undefined,
    ].find((candidate) => candidate?.before === association.expected);
    assert.ok(pair, `Unknown historical association: ${association.file}`);
    assert.equal(association.expected, pair.before);
    assert.equal(
      association.actual,
      association.file === adminDirectoryRevision.file
        ? adminDirectoryRevision.after
        : (userCreationRevisions[association.file]?.after ?? pair.after),
    );
    assert.equal(association.encoding, "historical-LF-exact-revision-not-current-acceptance");
  }
});
