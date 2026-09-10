import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { auditPagePreview } from "../../scripts/lib/ui-phase2-audit-page-preview.mjs";

const file = "apps/web/src/components/OrganizationAuditPanel.vue",
  folder = "output/playwright/p37-page-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const original = read(file),
  transformed = auditPagePreview(original),
  evidence = JSON.parse(read(`${folder}/evidence.json`));
const normalize = (value) =>
  value.replaceAll('"复制请求 ID"', '"复制"').replaceAll('"复制追踪 ID"', '"复制"');
function structure(source) {
  const controls = [],
    directives = [],
    interpolations = [];
  const walk = (node) => {
    if (node.type === 5) interpolations.push(normalize(node.content.content));
    if (node.type === 1) {
      if (["input", "select", "button", "summary"].includes(node.tag))
        controls.push(normalize(node.loc.source));
      for (const prop of node.props) if (prop.type === 7) directives.push(prop.loc.source);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(parse(source).descriptor.template.content));
  return {
    controls: controls.sort(),
    directives: directives.sort(),
    interpolations: interpolations.sort(),
  };
}
test("P37 audit C composition retains complete script, directives, fields and native controls apart from two explicit copy labels", () => {
  assert.equal(parse(transformed).errors.length, 0);
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.deepEqual(structure(original), structure(transformed));
  assert.equal(transformed.split("p37-local-search").length, 2);
  assert.equal(transformed.split('"复制请求 ID"').length, 2);
  assert.equal(transformed.split('"复制追踪 ID"').length, 2);
  assert.throws(() =>
    auditPagePreview(original.replace('class="org-audit-filter-grid"', 'class="unexpected"')),
  );
});
test("P37 mounted page evidence pins39 current sources and76 exact four-width images", () => {
  assert.equal(evidence.kind, "P37-PAGE-VUE-PREVIEW-r1");
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 216);
  for (const [source, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(source)), sha, source);
  assert.equal(evidence.transformedHashes[file], hash(transformed));
  const states = [
    "loading",
    "default",
    "default-viewport",
    "selected-failed",
    "selected-blocked",
    "technical-open",
    "request-copied",
    "trace-copy-failed",
    "more-pending",
    "cursor-end",
    "no-local-results",
    "date-invalid",
    "server-filtered",
    "system-collapsed",
    "system-expanded",
    "system-search",
    "empty",
    "first-403",
    "first-500",
  ];
  assert.deepEqual(
    evidence.screenshots.map((shot) => shot.file).sort(),
    [390, 760, 761, 1440].flatMap((width) => states.map((state) => `${width}-${state}.png`)).sort(),
  );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P37 uses only eight audit GETs per width, exact queries and separate system fixtures", () => {
  for (const run of evidence.runs) {
    assert.equal(run.requests.length, 8);
    assert.ok(
      run.requests.every(
        (req) =>
          req.method === "GET" &&
          req.path === "/api/v1/organizations/00000000-0000-4000-8000-000000000601/audit-events",
      ),
    );
    assert.deepEqual(run.requests[0].query, { limit: "50" });
    assert.equal(run.requests[1].query.cursor, "00000000-0000-4000-8000-000000000669");
    assert.deepEqual(run.requests[2].query, {
      limit: "50",
      action: "organization.member.invited",
      outcome: "succeeded",
      resource_type: "membership",
      request_id: "m06-01-audit-request-001",
      trace_id: "m06-01-audit-trace-001",
      occurred_from: "2026-08-26T16:00:00.000Z",
      occurred_to: "2026-08-27T16:00:00.000Z",
    });
    const names = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const name of [
      "no unrelated organization summary request",
      "first metadata redacted",
      "raw probe absent from rendered page",
      "blue query region",
      "all eight native inputs present",
      "no visible business dialog",
      "failed detail selected",
      "blocked detail selected",
      "technical ID exact",
      "request copy exact",
      "trace copy exact",
      "trace failure shown",
      "pending disables query buttons",
      "end hides more",
      "local search has no GET",
      "invalid dates no GET",
      "system count40",
      "system expanded",
      "system search no GET",
      "empty has no detail",
      "403:content hidden",
      "500:content hidden",
      "zero browser errors",
      "zero storage",
    ])
      assert.ok(names.includes(name), name);
    assert.equal(names.filter((name) => name.endsWith(":unobscured")).length, 5);
  }
  assert.match(evidence.scope, /never concatenated/);
  assert.match(evidence.scope, /does not implement server date semantics/);
});
test("P37 remains review-only with current protection code preserved and explicit unverified accessibility boundary", () => {
  for (const source of [
    file,
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/main.ts",
  ])
    assert.equal(read(source).includes("audit-page-preview"), false);
  assert.match(original, /onDeactivated\(suspendCopy\)/);
  assert.match(evidence.scope, /full keyboard accessibility remain to audit/);
  assert.match(evidence.scope, /Not full App/);
});
