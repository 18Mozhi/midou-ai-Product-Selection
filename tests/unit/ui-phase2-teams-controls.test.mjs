import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { buildTeamsDesignData } from "../../scripts/lib/ui-phase2-teams-design-data.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/teams-controls-direction-c";
const e = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
test("P33 individual controls cover every actual child candidate once without counting variants as new source actions", () => {
  const candidates = scanSource(readFileSync(e.sourceFile, "utf8"), e.sourceFile).candidates;
  assert.equal(candidates.length, 18);
  const signatures = candidates.map((c) => c.candidateId.split("#")[1]).sort();
  assert.deepEqual(e.sourceSignatures, signatures);
  assert.deepEqual(e.controls.flatMap((c) => c.signatures).sort(), signatures);
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.controls.filter((c) => c.proposalOnly).length, 2);
  const bySignature = new Map(candidates.map((c) => [c.candidateId.split("#")[1], c]));
  for (const control of e.controls)
    for (const signature of control.signatures) {
      const source = bySignature.get(signature);
      if (control.actionId === "OG-T-MEMBER")
        assert.equal(source.attributes["@click"], `performMemberAction('${control.id}')`);
      if (control.actionId === "OG-T-OPEN") assert.equal(source.attributes["@click"], "openCreate");
      if (control.actionId === "OG-T-CANCEL")
        assert.equal(source.attributes[":disabled"], "createBusy");
    }
});
test("P33 all control variants and reason compositions have exact dual-viewport image bindings", () => {
  assert.equal(e.controls.length, 43);
  assert.equal(
    e.controls.reduce((n, c) => n + c.states.length, 0),
    179,
  );
  assert.equal(e.screenshots.length, 362);
  assert.equal(e.checks.length, 358);
  assert.equal(e.interactions.length, 84);
  const expected = e.controls.flatMap((c) =>
    c.states.flatMap((s) => [1440, 390].map((w) => `${c.id}-${s}/${w}`)),
  );
  expected.push(
    ...["assign", "remove"].flatMap((a) => [1440, 390].map((w) => `composition-${a}/${w}`)),
  );
  assert.deepEqual(e.screenshots.map((s) => `${s.scene}/${s.width}`).sort(), expected.sort());
  for (const s of e.screenshots.filter((s) => s.control)) {
    const c = e.controls.find((c) => c.id === s.control.id);
    assert.equal(s.control.selector, c.selector);
    assert.equal(s.control.actionId, c.actionId);
    assert.ok(c.states.includes(s.control.variant));
  }
});
test("P33 absent-member and archived-team states do not invent disabled rules or versioned membership writes", () => {
  for (const action of ["assign", "remove"])
    for (const suffix of ["missing", "archived", "no-members"])
      assert.deepEqual(e.controls.find((c) => c.id === `${action}-${suffix}`).states, [
        "default",
        "hover",
        "focus",
        "pressed",
      ]);
  for (const row of e.interactions.filter(
    (r) => r.id === "reason-assign-confirm" || r.id === "reason-remove-confirm",
  )) {
    assert.equal(row.intents.length, 1);
    assert.deepEqual(Object.keys(row.intents[0].body).sort(), [
      "action",
      "membership_id",
      "reason",
    ]);
  }
});
test("P33 evidence rejects drift in source dependencies and all permanent screenshots", () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${root}/${s.file}`)), s.sha256, s.file);
});
test("P33 real extracted child, parent and service contracts remain distinct from pending visual proposals", async () => {
  const data = await buildTeamsDesignData(process.cwd());
  assert.equal(data.sourceChecks.length, 5);
  assert.ok(data.sourceChecks.some((s) => s.includes("OG-G02")));
  assert.ok(data.sourceChecks.some((s) => s.includes("no expected_version")));
  const box = { window: {} };
  vm.runInNewContext(
    readFileSync("design-plans/ui-phase-2-2026-09-07/design/teams-direction-c/data.js", "utf8"),
    box,
  );
  assert.deepEqual(data.contracts, JSON.parse(JSON.stringify(box.window.TEAMS_C_DATA.contracts)));
});
