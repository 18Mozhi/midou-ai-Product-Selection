import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import {
  parseContract,
  auditContracts,
  auditPageSpecs,
} from "../../scripts/lib/ui-phase2-contract-audit.mjs";

const file = "apps/web/src/components/Example.vue";
const source = '<template><button @click="save">保存</button></template>';
const sig = scanSource(source, file).candidates[0].candidateId.split("#")[1];
const parse = (text, options = {}) =>
  parseContract(text, { file: "example-contract.md", aliases: { E: "Example" }, ...options });

test("explicit full paths, alias tables, alias locations and section-local signatures resolve", () => {
  for (const row of [
    `| ${file}#${sig} | 1 | control | 保存 |`,
    `| E | 1 | ${sig} | 保存 |`,
    `| E#${sig} | 1 | 保存 |`,
    `| E:${sig} | control / 1 | 保存 |`,
    `| E:1 | ${sig} | 保存 |`,
    `| Example.vue:1 | ${sig} | 保存 |`,
    `| Example:1 | ${sig} | 保存 |`,
    `### ${file}\n| ${sig} | 1 | control | 保存 |`,
  ]) {
    const [ref] = parse(row).references;
    assert.equal(ref.sourceFile, file, row);
    assert.equal(ref.signature, sig);
    assert.equal(ref.recordedLine, 1);
  }
});

test("two explicit aliases in one variant row remain separate source references", () => {
  const refs = parse(`| E:1 #${sig} → T:2 #${sig} | variant |`, {
    aliases: { E: "Example", T: "TechnicalDetails" },
  }).references;
  assert.deepEqual(
    refs.map((ref) => [ref.sourceFile, ref.recordedLine]),
    [
      [file, 1],
      ["apps/web/src/components/TechnicalDetails.vue", 2],
    ],
  );
});

test("unknown aliases and line-only claims never match by a globally unique signature or nearest line", () => {
  const docs = [
    parse(`| UNKNOWN#${sig} | 1 | 保存 |\n\n| 组件行 | 语义 |\n| --- | --- |\n| E999 | 保存 |`),
  ];
  const report = auditContracts({ documents: docs, sources: new Map([[file, source]]) });
  assert.deepEqual(
    report.records.map((record) => record.status),
    ["file-unbound", "line-only-unbound"],
  );
  assert.equal(report.summary.unreferencedCandidates, 1);
});

test("line movement preserves source identity but source hash drift remains explicit", () => {
  const doc = parse(`| E#${sig} | 1 | control | 保存 |\n| ${file} | ${digest(source)} |`);
  const report = auditContracts({ documents: [doc], sources: new Map([[file, "\n" + source]]) });
  assert.equal(report.records[0].status, "line-moved");
  assert.equal(report.records[0].sourceBinding, "hash-drift");
  assert.equal(report.records[0].currentLine, 2);
  assert.equal(report.denominatorFrozen, false);
});

test("handler changes outside the source-site signature are not mistaken for fresh source evidence", () => {
  const old = "<script setup>function save(){return 1}</script>" + source;
  const next = old.replace("return 1", "return 2");
  const report = auditContracts({
    documents: [parse(`| E#${sig} | 1 | control | 保存 |\n| ${file} | ${digest(old)} |`)],
    sources: new Map([[file, next]]),
  });
  assert.equal(report.records[0].status, "identity-current");
  assert.equal(report.records[0].sourceBinding, "hash-drift");
});

test("changed action at the same line and duplicate occurrence removal fail identity matching", () => {
  const doc = parse(
    `| E#${sig} | 1 | control | 保存 |\n| E#${sig.replace(/\.1$/, ".2")} | 1 | control | 保存 |`,
  );
  const report = auditContracts({
    documents: [doc],
    sources: new Map([[file, source.replace("save", "remove")]]),
  });
  assert.deepEqual(
    report.records.map((record) => record.status),
    ["identity-not-found", "identity-not-found"],
  );
});

test("repeated historical and shared references are preserved without inferring duplicate business actions", () => {
  const report = auditContracts({
    documents: [parse(`| E#${sig} | 1 | control | 保存 |\n| E#${sig} | 1 | control | 旧记录 |`)],
    sources: new Map([[file, source]]),
  });
  assert.equal(report.summary.references, 2);
  assert.equal(report.summary.uniquelyReferencedCandidates, 1);
  assert.equal(report.repeatedReferences[0].references.length, 2);
  assert.equal(report.records[0].sourceBinding, "unrecorded");
});

test("missing source, kind drift and supporting-source hashes have distinct outcomes", () => {
  const report = auditContracts({
    documents: [
      parse(
        `| E#${sig} | 1 | dialog-definition | wrong kind |\n| Missing.vue#${sig} | 1 | control | missing |\n| apps/api/src/example.ts | ${digest("backend")} |`,
      ),
    ],
    sources: new Map([[file, source]]),
  });
  assert.deepEqual(
    report.records.map((record) => record.status),
    ["kind-drift", "source-missing"],
  );
  assert.equal(report.sourceClaims[0].status, "not-in-web-scan");
});

test("LF/CRLF hashes match and malformed Vue fails instead of yielding partial evidence", () => {
  const normalized = "\n" + source;
  const doc = parse(`| E#${sig} | 2 | control | 保存 |\n| ${file} | ${digest(normalized)} |`);
  assert.equal(
    auditContracts({ documents: [doc], sources: new Map([[file, "\r\n" + source]]) }).records[0]
      .sourceBinding,
    "hash-current",
  );
  assert.throws(() =>
    auditContracts({ documents: [], sources: new Map([[file, "<template><button></template>"]]) }),
  );
});

test("page audit catches missing/extra specs, duplicated matrix rows and broken local links", () => {
  const matrix =
    "| P01 | `/` 首页 | `Example` | direction |\n| P01 | `/` 首页 | `Example` | direction |";
  const report = auditPageSpecs({
    catalog: { routes: [{ path: "/" }, { path: "/login" }] },
    matrix,
    specs: new Map([
      ["P01", "# P01 /\n[missing](../missing.md)"],
      ["P99", "extra"],
    ]),
    exists: () => false,
  });
  assert.deepEqual(
    report.issues.map((issue) => issue.kind),
    [
      "matrix-route-mismatch",
      "local-link-invalid",
      "matrix-route-mismatch",
      "spec-missing",
      "extra-spec",
    ],
  );
});

test("explicit unknown aliases cannot fall back to a default component", () => {
  const [ref] = parse(`| UNKNOWN#${sig} | 1 | 保存 |`, { defaultComponent: "Example" }).references;
  assert.equal(ref.sourceFile, null);
});

test("page IDs in state tables are not parsed as component line references", () => {
  const doc = parse("| 页面 | 状态 |\n| --- | --- |\n| P49 | ready |", {
    aliases: { P: "ProviderParserSampleDialog" },
  });
  assert.equal(doc.references.length, 0);
});

test("historical section and old-signature column remain traceable but cannot satisfy current coverage", () => {
  const doc = parse(
    `## Old snapshot\n| E#${sig} | 1 | 保存 |\n### Child section\n| E#${sig} | 1 | 保存 |\n## New snapshot\n| 行 | 当前 | 旧尾键 |\n| --- | --- | --- |\n| 1 | ${sig.replace(/\.1$/, ".2")} | ${sig} |`,
    {
      defaultComponent: "Example",
      historicalSections: ["Old snapshot"],
      historicalColumns: ["旧尾键"],
    },
  );
  assert.deepEqual(
    doc.references.map((ref) => ref.temporalScope),
    ["historical", "historical", "unclassified", "historical"],
  );
  assert.equal(doc.references[3].recordedLine, null, "old signature cannot inherit the new line");
  const report = auditContracts({ documents: [doc], sources: new Map([[file, source]]) });
  assert.equal(report.summary.historicalReferences, 3);
  assert.equal(report.summary.historicalStatuses["identity-current"], 3);
  assert.equal(report.summary.statuses["identity-not-found"], 1);
  assert.equal(report.summary.uniquelyReferencedCandidates, 0);
  assert.equal(report.unreferenced.length, 1);
});

test("historical table-column scope resets at a new table", () => {
  const doc = parse(
    `| 当前 | 旧尾键 |\n| --- | --- |\n| E#${sig} | E#${sig} |\n\n| E#${sig} | E#${sig} |`,
    { historicalColumns: ["旧尾键"] },
  );
  assert.deepEqual(
    doc.references.map((ref) => ref.temporalScope),
    ["unclassified", "historical", "unclassified", "unclassified"],
  );
});

test("route audit requires exact route tokens and accepts documented plain-text paths", () => {
  const audit = (route, spec) =>
    auditPageSpecs({
      catalog: { routes: [{ path: route }] },
      matrix: `| P01 | \`${route}\` name | \`Example\` | direction |`,
      specs: new Map([["P01", spec]]),
      exists: () => true,
    });
  assert.deepEqual(
    audit("/", "See /login").issues.map((issue) => issue.kind),
    ["spec-route-missing"],
  );
  assert.equal(audit("/logs", "/logs → Example").issues.length, 0);
  assert.equal(audit("/logs", "/logs-old").issues.length, 1);
});

test("real repository audit is deterministic and preserves historical inventories and approvals", () => {
  const folder = new URL("../../design-plans/ui-phase-2-2026-09-07/", import.meta.url);
  const protectedFiles = [
    "baseline.json",
    "actions.json",
    "dialogs.json",
    "coverage.json",
    "review-data.js",
    "source-scope-review.json",
  ];
  const snapshot = () => protectedFiles.map((name) => digest(readFileSync(new URL(name, folder))));
  const before = snapshot();
  const report = runContractAudit();
  assert.deepEqual(report, runContractAudit());
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(report.pages.issues, []);
  assert.equal(report.pages.specs, report.pages.routes);
  assert.equal(
    report.summary.sourceCandidates,
    report.summary.uniquelyReferencedCandidates + report.unreferenced.length,
  );
  assert.equal(
    report.summary.references,
    Object.values(report.summary.statuses).reduce((a, b) => a + b, 0) +
      report.summary.historicalReferences,
  );
  assert.equal(report.denominatorFrozen, false);
  assert.ok(report.records.some((record) => record.temporalScope === "historical"));
});

test("CLI emits parseable full JSON and rejects write or extra arguments", () => {
  const script = fileURLToPath(
    new URL("../../scripts/audit-ui-phase2-contracts.mjs", import.meta.url),
  );
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  const valid = run("--json");
  assert.equal(valid.status, 0, valid.stderr);
  const result = JSON.parse(valid.stdout);
  assert.equal(result.records.length, result.summary.references);
  assert.equal(result.denominatorFrozen, false);
  for (const args of [["--write"], ["--json", "--json"]]) {
    const invalid = run(...args);
    assert.notEqual(invalid.status, 0);
    assert.equal(invalid.stdout, "");
    assert.match(invalid.stderr, /Read-only audit accepts only --json/);
  }
});
