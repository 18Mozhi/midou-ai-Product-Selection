import test from "node:test";
import { assertOrganizationReasonContract } from "../../scripts/lib/ui-phase2-organization-reason-contract.mjs";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const output = "output/playwright/p36-controls-review";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const file = "apps/web/src/components/OrganizationTokenPanel.vue";
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P36 maps all12 current child source sites exactly once without counting convenience controls", () => {
  const candidates = scanSource(readFileSync(file, "utf8"), file).candidates;
  const signatures = candidates.map((c) => c.candidateId.split("#")[1]).sort();
  assert.equal(signatures.length, 12);
  assert.deepEqual(e.sourceSignatures, signatures);
  assert.deepEqual(e.controls.flatMap((c) => c.signatures).sort(), signatures);
  const events = {
    copy: "copySecret",
    dismiss: "dismissSecret",
    reset: "resetFilters",
    ttl: "createForm.ttl_days = days",
    scope: "toggleScope(scope.value)",
  };
  for (const c of e.controls)
    for (const id of c.signatures) {
      const source = candidates.find((s) => s.candidateId.endsWith(`#${id}`));
      if (events[c.action]) assert.ok(Object.values(source.events).includes(events[c.action]));
      if (c.action === "open-reason") {
        assert.equal(source.events["@click"], `performTokenAction(item, '${c.tokenAction}')`);
        assert.equal(source.attributes[":disabled"], "busy");
      }
      if (c.action === "page")
        assert.equal(source.events["@click"], `tokenPage ${c.delta < 0 ? "-=" : "+="} 1`);
      if (c.action === "technical") assert.equal(source.tag, "summary");
      if (c.action === "create")
        assert.ok(
          source.tag === "form"
            ? source.events["@submit.prevent"] === "submitCreate"
            : source.attributes[":disabled"] === "busy",
        );
    }
  for (const c of e.controls.filter((c) => c.proposalOnly || c.sharedReason || c.parentReference))
    assert.deepEqual(c.signatures, []);
  assert.equal(e.controls.filter((c) => c.proposalOnly).length, 6);
});

test("P36 every applicable control/state/width has one image and native check", () => {
  assert.equal(e.controls.length, 44);
  assert.equal(e.checks.length, 344);
  assert.equal(e.interactions.length, 82);
  assert.equal(e.screenshots.length, 354);
  const expected = e.controls
    .flatMap((c) =>
      c.states.flatMap((variant) => c.widths.map((width) => `${c.id}-${variant}-${width}.png`)),
    )
    .sort();
  assert.deepEqual(
    e.screenshots
      .filter((s) => s.controlId)
      .map((s) => s.file)
      .sort(),
    expected,
  );
  assert.equal(new Set(expected).size, expected.length);
  for (const c of e.controls)
    for (const width of c.widths) {
      for (const variant of c.states)
        assert.equal(
          e.checks.filter(
            (s) =>
              s.controlId === c.id &&
              s.width === width &&
              s.variant === variant &&
              s.nativeState &&
              s.unchangedFacts,
          ).length,
          1,
        );
      if (!c.disabledOnly)
        assert.equal(
          e.interactions.filter(
            (s) => s.controlId === c.id && s.width === width && s.exactIntentOrLocalResult,
          ).length,
          1,
        );
    }
  for (const action of ["rotate", "revoke", "copy", "copy-copied", "copy-failed"])
    for (const width of [1440, 390])
      assert.ok(e.screenshots.some((s) => s.composition === action && s.width === width));
});

test("P36 selection, pressing, busy and approval remain distinct without OS credential access", async () => {
  assert.equal(e.approval, "pending-user-review");
  assert.match(e.scope, /no mounted Vue\/API\/SQL\/OS clipboard or production proof/);
  assert.equal(e.externalRequests, 0);
  assert.equal(e.osClipboardCalls, 0);
  assert.deepEqual(
    e.controls.filter((c) => c.states.includes("busy")).map((c) => c.id),
    ["refresh", "create", "rotate", "revoke"],
  );
  for (const action of ["ttl", "scope"]) {
    const choices = e.controls.filter((c) => c.action === action);
    assert.equal(choices.length, 8);
    assert.ok(
      choices.every(
        (c) =>
          JSON.stringify(c.states) === JSON.stringify(["default", "hover", "focus", "pressed"]),
      ),
    );
  }
  const source = readFileSync("apps/web/src/components/AuditedReasonDialog.vue", "utf8");
  await assertOrganizationReasonContract(
    source,
    readFileSync("apps/web/src/components/OrganizationAdminCenter.vue", "utf8"),
  );
  assert.match(
    readFileSync(
      "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c/tokens.js",
      "utf8",
    ),
    /maxlength="500"/,
  );
});

test("P36 capture-time sources and354 images are pinned while original112 images remain unchanged", () => {
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assertCaptureSourceRevision(f, readFileSync(f, "utf8"), sha);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(output).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  const original = "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c";
  const old = JSON.parse(readFileSync(`${original}/evidence.json`, "utf8"));
  assert.equal(e.retainedOriginalImages, 112);
  assert.equal(old.screenshots.length, 112);
  for (const s of old.screenshots)
    assert.equal(hash(readFileSync(`${original}/${s.file}`)), s.sha256);
});
