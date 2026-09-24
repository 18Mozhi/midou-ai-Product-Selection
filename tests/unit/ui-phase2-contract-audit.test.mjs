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

test("current P11 security panel map covers MFA navigation, password events and session actions", () => {
  const file = "apps/web/src/components/personal-center/PersonalSecurityPanel.vue";
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
      record.claim.includes("PC-SEC-CURRENT-"),
  );
  assert.equal(candidates.length, 8);
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

test("current P11 parent map covers refresh, section navigation and all child event boundaries", () => {
  const file = "apps/web/src/components/PersonalCenter.vue";
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
      record.claim.includes("PC-CENTER-CURRENT-"),
  );
  assert.equal(candidates.length, 8);
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

test("current P11 notifications panel map binds its read state, five-option loop and parent save", () => {
  const file = "apps/web/src/components/personal-center/PersonalNotificationsPanel.vue";
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
      record.claim.includes("PC-NOTIFY-CURRENT-"),
  );
  assert.equal(candidates.length, 4);
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

test("current P11 assets panel map binds retries and the exact destinations for each asset type", () => {
  const file = "apps/web/src/components/personal-center/PersonalAssetsPanel.vue";
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
      record.claim.includes("PC-ASSET-CURRENT-"),
  );
  assert.equal(candidates.length, 4);
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

test("current P11 permissions panel map binds scoped retry and conditional token navigation", () => {
  const file = "apps/web/src/components/personal-center/PersonalPermissionsPanel.vue";
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
      record.claim.includes("PC-PERM-CURRENT-"),
  );
  assert.equal(candidates.length, 2);
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

test("current P11 shared read status maps the conditional retry affordance and current fingerprint", () => {
  const file = "apps/web/src/components/personal-center/PersonalSectionReadStatus.vue";
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
      record.claim.includes("PC-READ-STATUS-CURRENT-"),
  );
  assert.equal(candidates.length, 1);
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

test("current P53 runtime center reconciles all candidates and retains stale identities", () => {
  const file = "apps/web/src/components/CollectionRuntimeCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "collection-runtime-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 12);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.ok(["identity-current", "line-moved"].includes(record.status), record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const additions = currentRows.filter((record) => record.claim.includes("CL53-CURRENT-"));
  assert.equal(additions.length, 8);
  for (const record of additions) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const staleRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.temporalScope !== "historical" &&
      record.currentLine === null,
  );
  assert.equal(staleRows.length, 8);
  assert.ok(staleRows.every((record) => record.status === "identity-not-found"));
  const claims = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(claims.length, 2);
  const currentClaim = claims.find((claim) => claim.temporalScope !== "historical");
  const historicalClaim = claims.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentClaim?.hash, digest(source));
  assert.equal(currentClaim?.status, "hash-current");
  assert.equal(historicalClaim?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P60 shared reason dialog maps native modal, field, submit, cancel and open behavior", () => {
  const file = "apps/web/src/components/OpenActionReasonDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "commercial-security-open-platform-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.claim.includes("OP60-DIALOG-CURRENT-"),
  );
  assert.equal(candidates.length, 8);
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

test("current P62 log center maps remaining controls and isolates the superseded source hash", () => {
  const file = "apps/web/src/components/PlatformLogCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "log-backup-release-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 20);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.ok(["identity-current", "line-moved"].includes(record.status), record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const additions = currentRows.filter((record) => record.claim.includes("LG62-CURRENT-"));
  assert.equal(additions.length, 8);
  for (const record of additions) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P42 organization detail dialog reconciles every candidate and current hash", () => {
  const file = "apps/web/src/components/PlatformOrganizationDetailDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "platform-account-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 14);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.ok(["identity-current", "line-moved"].includes(record.status), record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const additionIds = [
    "106fea94b943db73.1",
    "ed675af42a95eee6.1",
    "e9b3a32bc524be8e.1",
    "e2d410a205d6addc.1",
    "f5028ff7b6963e7c.1",
    "9135d46a904a737d.1",
    "c912786107f1a3c8.1",
    "1c447b2a32d2d030.1",
  ];
  const additions = currentRows.filter((record) =>
    additionIds.some((signature) => record.candidateId?.endsWith(`#${signature}`)),
  );
  assert.equal(additions.length, 8);
  for (const record of additions) {
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.recordedLine, record.currentLine, record.candidateId);
  }
  const oldStaleIds = [
    "6fbf23d3aefd32ed.1",
    "806c920618d07330.1",
    "c86975c19b2b8d14.1",
    "68c23982ea6f10d3.1",
    "1ddc3f63c9d2ad7d.1",
    "758ab89691c1c72b.1",
    "b8fc8632d25866fd.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P49 acceptance execution maps every controlled field, action and trace disclosure", () => {
  const file = "apps/web/src/components/ProviderAcceptanceExecution.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "source-channel-credential-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 8);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P47 adapter center reconciles all candidates and isolates its superseded fingerprint", () => {
  const file = "apps/web/src/components/ProviderAdapterCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "provider-definition-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("PR47-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 16);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "92930355cc4e2a4f.1",
    "d2b72f6631a5008b.1",
    "2c7db35d039ef2f4.1",
    "efa5a28bbc761600.1",
    "369397a871aefe1e.1",
    "e193aebbbf403ff8.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P66 topology center maps all controls and isolates the old source inventory", () => {
  const file = "apps/web/src/components/RuntimeTopologyCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "runtime-resilience-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("RT66-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 16);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = ["99e387027e98dda9.1", "21c66441891be768.1", "6a87ca890e2cd293.1"];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P10 theme studio reconciles all routes, error recovery and preference controls", () => {
  const file = "apps/web/src/components/ThemeStudio.vue";
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
      record.claim.includes("TH-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 12);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "9b4b982bf643379f.1",
    "826731794907a876.1",
    "615525e93bd0aa8d.1",
    "b5fc72dd64e3a6e6.1",
    "e717723479d58780.1",
    "b13c528391353263.1",
    "38740096ebfd6c5f.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P65 release center maps all page controls and isolates its old fingerprint", () => {
  const file = "apps/web/src/components/ReleaseRolloutCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "log-backup-release-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("RL65-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 12);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = ["f801437d922c379b.1", "21c66441891be768.1", "227b66d9ec4e0216.1"];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "0fcdd0f1eb7e16423188350bbc1dee13fc036d7b51b0ee248a25f2edd54537d1",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P09 onboarding guide maps all local navigation sites and preserves stale identities", () => {
  const file = "apps/web/src/components/OnboardingGuide.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "identity-onboarding-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("OG-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 7);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "07db575ab56f90da.1",
    "75986af56e7cd4f4.1",
    "0728ff37173af0c0.1",
    "f74e91375a9aef9f.1",
    "176ac690f7c39e94.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const oldSkip = report.records.find(
    (item) =>
      item.document.endsWith(document) &&
      item.candidateId === `${file}#7142f76fc59ad9ee.1` &&
      !item.claim.includes("OG-CURRENT-"),
  );
  assert.notEqual(oldSkip?.status, "identity-not-found");
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current platform message editor maps modal and parent save boundaries without reviving old sites", () => {
  const file = "apps/web/src/components/PlatformMessageEditor.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("PN57-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 6);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "c18fb34a85c44a13.1",
    "2412ed75f6e08a76.1",
    "ff3f7c9094488d9f.1",
    "c6a9a644f04c8e3f.1",
    "358517db18f8c7cb.1",
    "d55ba76cf5f7483a.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "8bafb3374f744389257c36a27580dbf768a9b4a0991fa0ce748889bb2c093cea",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P57 notification action dialog maps reason and close versus cancel boundaries", () => {
  const file = "apps/web/src/components/PlatformNotificationActionDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("PN57-ACTION-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 6);
  assert.deepEqual(
    [...new Set(currentRows.map((record) => record.candidateId))].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P51 task center maps missing state recovery and detail shell candidates", () => {
  const file = "apps/web/src/components/CollectionTaskCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "collection-runtime-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("CL51-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 23);
  assert.equal(currentRows.length, 5);
  const expectedCurrentIds = [
    "3a210e63ca5a7831.1",
    "16620352511db5c2.1",
    "6b55734308f206c3.1",
    "ed8b70dc2e6170f2.1",
    "d3da42ac8f789e3b.1",
  ].map((signature) => `${file}#${signature}`);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    expectedCurrentIds.sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "2f2f0f3ceae01eac.1",
    "b6414d02a0f96150.1",
    "472cf13bb7c4d799.1",
    "86cb88a88c044c05.1",
    "e2f1f3476ece93e2.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "509341da51ee51234bbf27de21e14c7943d409efb0339bcd59b6dbf047ff6160",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current shared ConfirmDialog maps each source site and preserves stale identities", () => {
  const file = "apps/web/src/components/ConfirmDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "state-recovery-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("CD-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 5);
  assert.equal(currentRows.length, candidates.length);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = [
    "4505a8c2bbf9389c.1",
    "30a3b6ddc206839e.1",
    "d1b7ac74d4f4ffc3.1",
    "3003ba3e33804f38.1",
  ];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
    assert.equal(record?.temporalScope, "historical", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "fc593274463c1ced2eebe1094402d8b3aef5649d8502b78f04e65fdadb9c1a0f",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P60 create dialog shell maps its container without claiming parent writes", () => {
  const file = "apps/web/src/components/OpenCreateDialog.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "commercial-security-open-platform-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("OP60-CREATE-SHELL-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 5);
  assert.equal(currentRows.length, candidates.length);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P11 account shell maps brand, section and theme navigation sites", () => {
  const file = "apps/web/src/components/AccountShell.vue";
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
      record.claim.includes("AC-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  const expectedCurrentIds = ["b832de42f3091adf.1", "257559b0b0a3692f.1", "2ea362a7d2584a88.1"].map(
    (signature) => `${file}#${signature}`,
  );
  assert.equal(candidates.length, 5);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    expectedCurrentIds.sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const oldStaleIds = ["dfb70bc4ca0070a5.1", "1f54ecd0f870df67.1", "508ee18711ffdef2.1"];
  for (const signature of oldStaleIds) {
    const record = report.records.find(
      (item) => item.document.endsWith(document) && item.candidateId === `${file}#${signature}`,
    );
    assert.equal(record?.status, "identity-not-found", signature);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P63 operation card maps native evidence and trace disclosures", () => {
  const file = "apps/web/src/components/ApiCoverageOperationCard.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("P63-OP-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 2);
  assert.equal(currentRows.length, candidates.length);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P61 status view maps its five navigation candidates and current hash", () => {
  const file = "apps/web/src/components/PlatformStatusCenterView.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "status-center-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("P61-STATUS-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 5);
  assert.equal(currentRows.length, candidates.length);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P61 status workspace maps its local section switch without persistence claims", () => {
  const file = "apps/web/src/components/PlatformStatusWorkspace.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "status-center-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("P61-WORKSPACE-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  assert.equal(candidates.length, 1);
  assert.equal(currentRows.length, 1);
  const record = currentRows[0];
  const candidate = candidates[0];
  assert.equal(record?.candidateId, candidate?.candidateId);
  assert.equal(record?.status, "identity-current");
  assert.equal(record?.sourceBinding, "hash-current");
  assert.equal(record?.currentLine, candidate?.line);
  assert.equal(record?.recordedLine, candidate?.line);
  assert.equal(record?.recordedKind, candidate?.kind);
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
  assert.equal(report.unreferenced.filter((item) => item.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P64 recovery center maps refresh actions and isolates the original fingerprint", () => {
  const file = "apps/web/src/components/BackupRecoveryCenter.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "log-backup-release-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("BR64-CURRENT-") &&
      record.currentLine !== null &&
      record.temporalScope !== "historical",
  );
  const expectedCurrentIds = ["32472f95c82e1a43.1", "a93553a3ba9aa8a6.1", "0227b741c3d451ee.1"].map(
    (signature) => `${file}#${signature}`,
  );
  assert.equal(candidates.length, 7);
  assert.deepEqual(
    currentRows.map((record) => record.candidateId).sort(),
    expectedCurrentIds.sort(),
  );
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "6da8b11e02114158f6189148d4edfb824179446794e4d20b798e5356a030cd02",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P34 organization approvals map both pagers and isolate the historical fingerprint", () => {
  const file = "apps/web/src/components/OrganizationApprovalPanel.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "organization-governance-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("OG-A-CURRENT-PAGINATION") &&
      record.temporalScope !== "historical",
  );
  const expectedIds = [
    "95030381fd924d2b.1",
    "87f27ee40744d069.1",
    "25d2be8fec5c35cd.1",
    "62fcf758cc715685.1",
  ].map((signature) => `${file}#${signature}`);
  assert.equal(candidates.length, 14);
  assert.deepEqual(currentRows.map((record) => record.candidateId).sort(), expectedIds.sort());
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "9ec2fb2e38b6b9ff11f81c3f314671dedec07667f96d137265c42c1ddf84b032",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P41 organization wizard maps its form submission and three field owners", () => {
  const file = "apps/web/src/components/OrganizationCreationWizard.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "platform-account-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("PA41-CURRENT-") &&
      record.temporalScope !== "historical",
  );
  const expectedIds = [
    "ffa5038e256f600a.1",
    "bc0893035430063c.1",
    "73dff0e93770c698.1",
    "dd8a952068bb7d3e.1",
  ].map((signature) => `${file}#${signature}`);
  assert.deepEqual(currentRows.map((record) => record.candidateId).sort(), expectedIds.sort());
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "6e0cefda653491671b244267a3c7a0538fc411ebcfc50ddac8556cf12180b8b0",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P57 notification management maps its four child event boundaries", () => {
  const file = "apps/web/src/components/PlatformNotificationManagement.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "content-notification-evidence-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("PN57-MANAGEMENT-CURRENT-") &&
      record.temporalScope !== "historical",
  );
  const expectedIds = [
    "a84b9b74f461a608.1",
    "22aeb336eb22dffc.1",
    "70cfd76c23fd89d4.1",
    "ae1971e3fd4a8474.1",
  ].map((signature) => `${file}#${signature}`);
  assert.equal(candidates.length, 4);
  assert.deepEqual(currentRows.map((record) => record.candidateId).sort(), expectedIds.sort());
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 2);
  const currentHash = hashes.find((claim) => claim.temporalScope !== "historical");
  const previousHash = hashes.find((claim) => claim.temporalScope === "historical");
  assert.equal(currentHash?.hash, digest(source));
  assert.equal(currentHash?.status, "hash-current");
  assert.equal(
    previousHash?.hash,
    "a91ffa14ffdbd1f17b01f0877b745288d96c4ea8574449721edbc61883f1cb18",
  );
  assert.equal(previousHash?.status, "hash-drift");
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(report.denominatorFrozen, false);
});

test("current P64 recovery directory maps all three same-page anchor links", () => {
  const file = "apps/web/src/components/BackupRecoveryDirectory.vue";
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const document = "log-backup-release-contract-review.md";
  const report = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const currentRows = report.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      record.claim.includes("BR64-DIRECTORY-CURRENT-NAV") &&
      record.temporalScope !== "historical",
  );
  const expectedIds = ["cbe3ce9e478ff362.1", "6b6da7e2248b5970.1", "90f85112b27af94e.1"].map(
    (signature) => `${file}#${signature}`,
  );
  assert.equal(candidates.length, 3);
  assert.deepEqual(currentRows.map((record) => record.candidateId).sort(), expectedIds.sort());
  for (const record of currentRows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }
  const hashes = report.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0]?.hash, digest(source));
  assert.equal(hashes[0]?.status, "hash-current");
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
