import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { auditControls, auditCompositions } from "../../scripts/lib/ui-phase2-audit-controls.mjs";

const output = "output/playwright/p37-controls-review/";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const evidence = JSON.parse(await text(output + "evidence.json"));

test("P37 controls bind current source and preserve142 earlier PNG", async () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(await text(file)), sha, file);
  let count = 0;
  for (const [dir, old] of Object.entries(evidence.retained)) {
    assert.equal(hash(await readFile(dir + "evidence.json")), old.manifest);
    const e = JSON.parse(await text(dir + "evidence.json"));
    assert.equal(e.screenshots.length, old.images);
    for (const s of e.screenshots) assert.equal(hash(await readFile(dir + s.file)), s.sha256);
    count += old.images;
  }
  assert.equal(count, 142);
});

test("P37 exact19 variants have172 dual-width state and composition images", async () => {
  assert.deepEqual(evidence.controls, auditControls);
  assert.deepEqual(evidence.compositions, auditCompositions);
  assert.equal(auditControls.length, 19);
  const expected = [390, 1440].flatMap((width) => [
    ...auditControls
      .filter((x) => !x.mobile || width === 390)
      .flatMap((x) => x.states.map((state) => `control-${x.id}-${state}-${width}.png`)),
    ...auditCompositions.map(([name]) => `${name}-${width}.png`),
    ...["request", "trace"].flatMap((field) =>
      ["copied", "failed"].map((state) => `copy-${field}-${state}-${width}.png`),
    ),
  ]);
  assert.equal(expected.length, 172);
  assert.deepEqual(evidence.screenshots.map((s) => s.file).sort(), expected.sort());
  for (const s of evidence.screenshots)
    assert.equal(hash(await readFile(output + s.file)), s.sha256, s.file);
  assert.deepEqual(
    (await readdir(output)).sort(),
    ["evidence.json", "index.html", ...expected].sort(),
  );
});

test("P37 proposals and unapproved scope cannot be promoted to source behavior", async () => {
  assert.equal(
    new Set(auditControls.filter((x) => x.source.startsWith("proposal:")).map((x) => x.source))
      .size,
    3,
  );
  for (const s of evidence.screenshots) {
    assert.equal(s.approval, "pending");
    if (s.control) {
      const item = auditControls.find((c) => c.id === s.control);
      assert.equal(
        s.proposalOnly,
        item.source.startsWith("proposal:") ||
          (s.visual === "disabled" && !!item.disabledProposalOnly),
      );
    }
  }
  const source = await text("apps/web/src/components/OrganizationAuditPanel.vue");
  for (const event of [
    "submitFilters",
    "resetFilters",
    "choose(event)",
    "loadMore",
    "copy(selectedEvent.request_id, 'request')",
    "copy(selectedEvent.trace_id, 'trace')",
  ])
    assert.ok(source.includes(`="${event}"`), event);
  assert.match(source, /@click="systemEventsExpanded = !systemEventsExpanded"/);
  assert.match(evidence.scope, /not actual Vue\/API\/permission\/OS clipboard\/production proof/);
});

test("P37 native focus,selected state and read-only flow proof remains explicit", () => {
  for (const width of [390, 1440]) {
    const names = new Set(evidence.checks.filter((c) => c.width === width).map((c) => c.name));
    for (const c of auditControls.filter((x) => !x.mobile || width === 390)) {
      assert.ok(names.has(c.id + ":keyboard-focus"));
      assert.ok(names.has(c.id + ":active"));
    }
    for (const name of [
      "event-selected:focus:selection",
      "event-unselected:focus:selection",
      "apply:read-first-page",
      "system:show50",
      "system:show10",
      "selection:second-id",
      "more:cursor",
      "more:55",
      "clear:local-only",
      "zero-dialogs",
      "zero-http",
      "zero-errors",
      "zero-storage",
      "zero-cookies",
    ])
      assert.ok(names.has(name), name);
    for (const field of ["request", "trace"])
      for (const result of ["copied", "failed"]) assert.ok(names.has(`copy:${field}:${result}`));
  }
});
