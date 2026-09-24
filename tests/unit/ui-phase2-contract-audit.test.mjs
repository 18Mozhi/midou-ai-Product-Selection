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

test("historical source hashes do not shadow the current source fingerprint", () => {
  const doc = parse(
    `## Old snapshot\n| E#${sig} | 1 | control | old mapping |\n| E | ${digest("older source")} |\n## Current snapshot\n| E#${sig} | 1 | control | current mapping |\n| E | ${digest(source)} |`,
    { defaultComponent: "Example", historicalSections: ["Old snapshot"] },
  );
  const report = auditContracts({ documents: [doc], sources: new Map([[file, source]]) });
  assert.equal(report.records[1].temporalScope, "unclassified");
  assert.equal(report.records[1].status, "identity-current");
  assert.equal(report.records[1].sourceBinding, "hash-current");
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

test("task and scoring stable tables cover the exact current local source set without promoting historical line rows", () => {
  const report = runContractAudit();
  const groups = [
    {
      document: "task-contract-review.md",
      names: [
        "TaskWorkspace",
        "TaskListPanel",
        "TaskDetailPanel",
        "TaskBatchActions",
        "TaskActionDialog",
      ],
      controls: 76,
      dialogs: 4,
    },
    {
      document: "scoring-contract-review.md",
      names: ["ScoreRuleConsole"],
      controls: 25,
      dialogs: 3,
    },
  ];
  for (const group of groups) {
    const records = report.records.filter((record) =>
      record.document.endsWith(`/${group.document}`),
    );
    const current = records.filter((record) => record.temporalScope !== "historical");
    const historical = records.filter((record) => record.temporalScope === "historical");
    const candidates = group.names.flatMap((name) => {
      const file = `apps/web/src/components/${name}.vue`;
      const text = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
        "\r\n",
        "\n",
      );
      return scanSource(text, file).candidates;
    });
    assert.equal(current.length, group.controls + group.dialogs);
    assert.equal(
      historical.length,
      group.document === "task-contract-review.md" ? 71 + 75 : group.controls,
    );
    if (group.document === "task-contract-review.md") {
      const lineOnly = historical.filter((record) => !record.signature);
      const supersededSnapshot = historical.filter((record) => record.signature);
      assert.equal(lineOnly.length, 71);
      assert.equal(supersededSnapshot.length, 75);
      assert.ok(supersededSnapshot.every((record) => record.temporalScope === "historical"));
    }
    assert.equal(
      current.filter((record) => record.recordedKind === "dialog-definition").length,
      group.dialogs,
    );
    assert.deepEqual(
      current.map((record) => record.candidateId).sort(),
      candidates.map((candidate) => candidate.candidateId).sort(),
    );
    for (const record of current) {
      assert.equal(record.status, "identity-current", record.candidateId);
      assert.equal(record.sourceBinding, "hash-current", record.candidateId);
      assert.equal(record.recordedLine, record.currentLine);
    }
    if (group.document === "scoring-contract-review.md") {
      for (const old of historical.filter((record) => !record.signature)) {
        assert.equal(old.status, "line-only-unbound");
        const oldCells = old.claim.split("|").map((cell) => cell.trim());
        const replacements = current.filter(
          (record) => record.claim.split("|")[4]?.trim() === oldCells[1],
        );
        assert.equal(replacements.length, 1, `${group.document}:${oldCells[1]}`);
        assert.equal(replacements[0].sourceFile, old.sourceFile);
        assert.equal(replacements[0].status, "identity-current");
        assert.ok(replacements[0].claim.split("|")[5].trim().startsWith(`${oldCells[2]}：`));
      }
    }
    assert.equal(
      report.unreferenced.filter((item) =>
        group.names.some((name) => item.file.endsWith(`/${name}.vue`)),
      ).length,
      0,
    );
  }
  assert.equal(report.denominatorFrozen, false);
});

test("shared shell role and state contract binds every current source site without collapsing business variants", () => {
  const report = runContractAudit();
  const document = "shared-shell-role-state-contract-review.md";
  const records = report.records.filter((record) => record.document.endsWith(`/${document}`));
  const files = [
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/DiscoveryOverlay.vue",
    "apps/web/src/components/OrganizationRolePanel.vue",
    "apps/web/src/components/NotFoundPage.vue",
    "apps/web/src/components/UiStateShowcase.vue",
    "apps/web/src/use-modal-dialog.ts",
  ];
  const source = (file) =>
    readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const candidates = files.flatMap((file) => scanSource(source(file), file).candidates);
  assert.equal(records.length, 70);
  assert.deepEqual(
    records.map((record) => record.candidateId).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of records) {
    assert.equal(record.temporalScope, "unclassified");
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine);
    assert.ok(record.claim.split("|")[4].trim(), "Every site needs explicit semantic ownership");
  }
  const semantics = (file, semantic) =>
    records.filter(
      (record) =>
        record.sourceFile.endsWith(`/${file}`) && record.claim.split("|")[4].trim() === semantic,
    );
  for (const [file, semantic] of [
    ["NavigationShell.vue", "shell.navigation.item"],
    ["DiscoveryOverlay.vue", "discovery.search"],
    ["OrganizationRolePanel.vue", "grant.create.submit"],
    ["OrganizationRolePanel.vue", "grant.expiry.submit"],
  ])
    assert.equal(semantics(file, semantic).length, 2, `${file}:${semantic}`);
  const helper = semantics("use-modal-dialog.ts", "modal.native.lifecycle");
  assert.equal(helper.length, 1);
  assert.equal(helper[0].recordedKind, "dialog-script-call");
  assert.equal(semantics("UiStateShowcase.vue", "ST-DEMO-CONFIRM").length, 1);
  assert.equal(semantics("DiscoveryOverlay.vue", "discovery.dialog").length, 1);
  assert.equal(semantics("NavigationShell.vue", "discovery.dialog").length, 1);
  const oldState = report.records.filter(
    (record) =>
      record.document.endsWith("/state-recovery-contract-review.md") &&
      record.temporalScope === "historical" &&
      ["UiStateShowcase.vue", "NotFoundPage.vue"].some((name) =>
        record.sourceFile?.endsWith(`/${name}`),
      ),
  );
  assert.equal(oldState.length, 8);
  for (const old of oldState) {
    const priorSemantic = old.claim.split("|")[3].split("，")[0].trim();
    const current = records.filter(
      (record) =>
        record.sourceFile === old.sourceFile && record.claim.split("|")[4].trim() === priorSemantic,
    );
    assert.equal(current.length, 1, `${old.sourceFile}:${priorSemantic}`);
    assert.equal(current[0].claim.split("|")[4].trim(), priorSemantic);
  }
  const hashes = report.sourceClaims.filter((claim) => claim.document.endsWith(`/${document}`));
  assert.equal(hashes.length, 15);
  for (const claim of hashes) assert.equal(digest(source(claim.file)), claim.hash, claim.file);
  assert.equal(
    report.unreferenced.filter((item) => files.includes(item.file)).length,
    0,
    "Shared source sites must gain explicit ownership",
  );
  assert.equal(report.denominatorFrozen, false, "Source completeness must not approve runtime");
});

test("audited reason source bindings retain every current site and all consumer hash claims", () => {
  const file = "apps/web/src/components/AuditedReasonDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const records = report.records.filter(
    (record) => record.sourceFile === file && record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 6);
  assert.deepEqual(
    records.map((r) => r.candidateId).sort(),
    candidates.map((c) => c.candidateId).sort(),
  );
  for (const record of records) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine);
    assert.match(record.claim, /LG62-REASON/);
  }
  const claims = report.sourceClaims.filter((claim) => claim.file === file);
  assert.equal(claims.length, 4);
  for (const claim of claims) assert.equal(claim.hash, digest(source), claim.document);
  assert.equal(report.unreferenced.filter((item) => item.file === file).length, 0);
});

test("current P48/P50 source maps cover each live candidate and fingerprint", () => {
  const report = runContractAudit();
  for (const [name, firstCurrentLine] of [
    ["CredentialAssetCenter.vue", 255],
    ["ProviderSourceConfigurationDialog.vue", 292],
    ["ProviderSourceCenter.vue", 326],
    ["ProviderSourceDirectory.vue", 326],
    ["Alibaba1688AcceptanceCenter.vue", 326],
    ["ProviderParserSampleDialog.vue", 326],
    ["ProviderParserSampleReview.vue", 326],
    ["ProviderCompatibilityMatrixDialog.vue", 326],
  ]) {
    const file = `apps/web/src/components/${name}`;
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
      "\r\n",
      "\n",
    );
    const candidates = scanSource(source, file).candidates;
    const records = report.records.filter(
      (record) =>
        record.document.endsWith("source-channel-credential-contract-review.md") &&
        record.sourceFile === file &&
        record.temporalScope !== "historical" &&
        record.sourceBinding === "hash-current" &&
        ["identity-current", "line-moved"].includes(record.status),
    );
    assert.deepEqual(
      [...new Set(records.map((record) => record.candidateId))].sort(),
      candidates.map((candidate) => candidate.candidateId).sort(),
      name,
    );
    for (const record of records.filter((item) => item.documentLine >= firstCurrentLine)) {
      assert.equal(record.status, "identity-current", record.candidateId);
      assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    }
    assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  }
  assert.equal(report.denominatorFrozen, false);
});

test("current collection operations map covers all live candidates and isolates the old snapshot", () => {
  const file = "apps/web/src/components/CollectionOperationsConsole.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const records = report.records.filter(
    (record) =>
      record.document.endsWith("collection-runtime-contract-review.md") &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 29);
  assert.deepEqual(
    [...new Set(records.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of records.filter((item) => item.candidateId)) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const oldSnapshot = report.sourceClaims.filter(
    (claim) =>
      claim.document.endsWith("collection-runtime-contract-review.md") &&
      claim.file === file &&
      claim.hash === "7acded3c40ce98f08e87955cd161bba67874aca496d1768b34505bb35b527d7d",
  );
  assert.equal(oldSnapshot.length, 1);
  assert.equal(oldSnapshot[0].temporalScope, "historical");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current platform message workbench map covers every live source and isolates the old table", () => {
  const file = "apps/web/src/components/PlatformMessageWorkbench.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const records = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 11);
  assert.deepEqual(
    [...new Set(records.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of records) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const oldRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.temporalScope === "historical",
  );
  assert.equal(oldRows.length, 4);
  assert.equal(
    report.sourceClaims.filter(
      (claim) =>
        claim.document.endsWith(document) &&
        claim.file === file &&
        claim.hash === "7863a19cace6a921628b2e33e66434a5662868d8a33351abc1ef3d129a7382c2",
    )[0]?.temporalScope,
    "historical",
  );
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current platform notification center map covers its parent actions and child boundaries", () => {
  const file = "apps/web/src/components/PlatformNotificationCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const records = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 10);
  assert.deepEqual(
    [...new Set(records.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of records) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current platform user detail map covers all live sites without trusting stale signatures", () => {
  const file = "apps/web/src/components/PlatformUserDetailDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "platform-user-design-contract.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.claim.includes("PA43-CURRENT-"),
  );
  assert.equal(candidates.length, 15);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    assert.ok(record.recordedKind, record.candidateId);
  }
  const staleRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      !record.claim.includes("PA43-CURRENT-") &&
      record.status === "identity-not-found",
  );
  assert.equal(staleRows.length, 7);
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current provider source filter map covers local query, facets, sorting and reset", () => {
  const file = "apps/web/src/components/ProviderSourceFilters.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "source-channel-credential-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const records = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 10);
  assert.deepEqual(
    [...new Set(records.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of records) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    assert.equal(
      record.recordedKind,
      candidates.find((c) => c.candidateId === record.candidateId)?.kind,
    );
  }
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current home dashboard map covers all current routes, form actions and evidence disclosure", () => {
  const file = "apps/web/src/components/HomeDashboard.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "account-home-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.claim.includes("HD-CURRENT-"),
  );
  assert.equal(candidates.length, 18);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    assert.ok(record.recordedKind, record.candidateId);
  }
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P11 profile panel map covers controlled field events and parent-owned save", () => {
  const file = "apps/web/src/components/personal-center/PersonalProfilePanel.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "account-home-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.claim.includes("PC-CURRENT-"),
  );
  assert.equal(candidates.length, 9);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current open platform map binds live operations and keeps old hash history isolated", () => {
  const file = "apps/web/src/components/OpenPlatformCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "commercial-security-open-platform-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRecords = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 44);
  assert.deepEqual(
    [...new Set(currentRecords.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRecords)
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
  const addedRows = currentRecords.filter((record) => record.claim.includes("OP60-CURRENT-"));
  assert.equal(addedRows.length, 9);
  for (const record of addedRows) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
    assert.ok(record.recordedKind, record.candidateId);
  }
  const staleRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.temporalScope !== "historical" &&
      record.currentLine === null,
  );
  assert.equal(staleRows.length, 3);
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  assert.equal(
    hashes.find((claim) => claim.temporalScope === "historical")?.hash,
    "5bc93ec6671395ad0e4319b4fb36aca0eba29dceb5d47a777d09fbb9ccd416d5",
  );
  assert.equal(hashes.find((claim) => claim.temporalScope !== "historical")?.hash, digest(source));
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("shared contract input inventory is separate from static actions and preserves approval state", () => {
  const inputs = {
    NavigationShell: ["menuQuery"],
    DiscoveryOverlay: ["query", "resourceType", "status", "assignee"],
    OrganizationRolePanel: [
      "roleQuery",
      "capabilityQuery",
      "capabilityGroup",
      "scopeQuery",
      "scopeFilter",
      "grantQuery",
      "grantForm.workspace_id",
      "grantForm.resource_id",
      "grantForm.grantee_membership_id",
      "grantForm.actions",
      "grantForm.reason",
      "grantForm.expires_at",
      "grantMutation.reason",
      "grantMutation.expires_at",
    ],
  };
  for (const [name, expected] of Object.entries(inputs)) {
    const text = readFileSync(
      new URL(`../../apps/web/src/components/${name}.vue`, import.meta.url),
      "utf8",
    );
    const actual = [...text.matchAll(/\bv-model(?:\.[\w-]+)*="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(actual.sort(), [...expected].sort(), name);
  }
  const coveragePath = new URL(
    "../../design-plans/ui-phase-2-2026-09-07/coverage.json",
    import.meta.url,
  );
  const before = readFileSync(coveragePath, "utf8");
  runContractAudit();
  assert.equal(readFileSync(coveragePath, "utf8"), before);
});
