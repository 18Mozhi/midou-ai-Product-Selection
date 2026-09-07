import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  digest,
  scanSource,
  parseLegacyInventory,
  reconcileLegacy,
  reachableFiles,
} from "./lib/ui-phase2-inventory.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = "design-plans/ui-phase-2-2026-09-07";
const old = "design-plans/ui-redesign-2026-09-05";
const check = process.argv.includes("--check");
if (process.argv.slice(2).some((argument) => argument !== "--check"))
  throw new Error("Only --check is supported");
const read = (file) => readFile(path.join(repo, file), "utf8");
const relative = (file) => path.relative(repo, file).split(path.sep).join("/");
const catalog = JSON.parse(await read("config/route-catalog.json"));
const matrix = await read(`${output}/PAGES.md`);
const reconciliation = JSON.parse(await read(`${output}/source-reconciliation.json`));
const rows = [
  ...matrix.matchAll(
    /^\| (P\d{2}) \| `([^`]+)` [^|]+\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gmu,
  ),
];
if (rows.length !== catalog.routes.length) throw new Error("page_catalog_count_mismatch");
const pages = catalog.routes.map((route, index) => {
  const id = `P${String(index + 1).padStart(2, "0")}`;
  const row = rows.find((item) => item[1] === id);
  if (!row || row[2] !== route.path) throw new Error(`page_catalog_mismatch:${id}`);
  const component = `apps/web/src/components/${row[3]}.vue`;
  if (!existsSync(path.join(repo, component))) throw new Error(`missing_component:${component}`);
  const number = index + 1;
  const batch =
    number === 13 || (number >= 19 && number <= 28)
      ? "W03"
      : number >= 29 && number <= 37
        ? "W04"
        : number >= 38 && number <= 45
          ? "W05"
          : number >= 46 && number <= 53
            ? "W06"
            : (number >= 54 && number <= 60) || number === 63
              ? "W07"
              : number >= 61 && number <= 71
                ? "W08"
                : "W02";
  return {
    id,
    path: route.path,
    title: route.title,
    component,
    batch,
    shell: route.shell,
    acceptance: route.acceptance,
    sessionRequired: route.sessionRequired ?? false,
    capabilities: route.capabilities,
    productionResolver: route.productionResolver ?? null,
    desktopDirection: row[4].trim(),
    mobileDirection: row[5].trim(),
    acceptanceSteps: row[6].trim(),
    status: "inventory-in-progress",
    designEvidence: [],
    implementationEvidence: [],
    productionEvidence: [],
    userReview: "pending",
  };
});

const modules = new Map();
async function collect(directory) {
  const entries = (await readdir(path.join(repo, directory), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name, "en"),
  );
  for (const entry of entries) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(file);
    else if (/\.(?:vue|ts)$/u.test(entry.name)) {
      const source = await read(file);
      modules.set(file, { ...scanSource(source, file), sha256: digest(source) });
    }
  }
}
await collect("apps/web/src");
for (const [file, module] of modules) {
  module.dependencies = [];
  for (const imported of module.imports.filter((item) => item.startsWith("."))) {
    const base = path.resolve(repo, path.dirname(file), imported);
    const resolved = [base, `${base}.ts`, `${base}.vue`, path.join(base, "index.ts")]
      .map(relative)
      .find((candidate) => modules.has(candidate));
    if (resolved) module.dependencies.push(resolved);
  }
}
const routeReachability = new Map();
// Router metadata references App, but that does not render every route inside each consumer.
const stopExpansionAt = new Set([
  "apps/web/src/App.vue",
  "apps/web/src/router.ts",
  "apps/web/src/route-catalog.ts",
]);
for (const page of pages) {
  const visited = reachableFiles(page.component, modules, stopExpansionAt);
  if (page.shell === "account") {
    reachableFiles("apps/web/src/components/AccountShell.vue", modules, stopExpansionAt).forEach(
      (file) => visited.add(file),
    );
  } else if (page.shell) {
    reachableFiles("apps/web/src/components/NavigationShell.vue", modules, stopExpansionAt).forEach(
      (file) => visited.add(file),
    );
    reachableFiles(
      "apps/web/src/components/DiscoveryOverlay.vue",
      modules,
      stopExpansionAt,
    ).forEach((file) => visited.add(file));
  }
  visited.add("apps/web/src/App.vue");
  routeReachability.set(page.id, visited);
}
const candidates = [...modules.entries()].flatMap(([file, module]) =>
  module.candidates.map((candidate) => ({
    ...candidate,
    candidateRouteIds: pages
      .filter((page) => routeReachability.get(page.id).has(file))
      .map((page) => page.id),
    routeAttribution: "static-import-superset-not-runtime-proof",
    sourceInventoryIds: [],
    evidence: [],
  })),
);
const legacyEntries = [
  ...parseLegacyInventory(await read(`${old}/button-inventory.md`), "button"),
  ...parseLegacyInventory(await read(`${old}/dialog-inventory.md`), "dialog"),
];
if (legacyEntries.length !== 704) throw new Error("legacy_inventory_changed_review_baseline");
const legacyRevision = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", `${old}/button-inventory.md`],
  { cwd: repo, encoding: "utf8" },
).trim();
const historical = [];
const legacySpans = [];
for (const file of [...new Set(legacyEntries.map((entry) => entry.file))]) {
  const source = execFileSync("git", ["show", `${legacyRevision}:${file}`], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  historical.push(...scanSource(source, file).candidates);
  for (const [type, pattern] of [
    ["button", /<button\b([^>]*)>([\s\S]*?)<\/button>/gu],
    ["dialog", /<(dialog)\b([^>]*)>|<[^>]+role="dialog"[^>]*>/gu],
  ]) {
    const records = legacyEntries.filter((entry) => entry.file === file && entry.type === type);
    const spans = [...source.matchAll(pattern)];
    if (records.length !== spans.length)
      throw new Error(`historical_regex_count_mismatch:${file}:${type}`);
    for (let index = 0; index < records.length; index++) {
      const span = spans[index];
      if (source.slice(0, span.index).split("\n").length !== records[index].line)
        throw new Error(`historical_regex_line_mismatch:${records[index].legacyId}`);
      legacySpans.push({
        legacyId: records[index].legacyId,
        start: span.index,
        end: span.index + span[0].length,
      });
    }
  }
}
const legacy = reconcileLegacy(legacyEntries, candidates, historical, legacySpans);
for (const override of reconciliation.legacyOverrides) {
  const record = legacy.find((item) => item.legacyId === override.legacyId);
  const matches = candidates.filter(
    (candidate) =>
      candidate.file === override.file &&
      candidate.kind === "control" &&
      (!override.label || candidate.label === override.label) &&
      Object.entries(override.attributes).every(
        ([key, value]) => candidate.attributes[key] === value,
      ),
  );
  if (!record || matches.length !== 1)
    throw new Error(`manual_reconciliation_stale:${override.legacyId}`);
  record.candidateIds = [matches[0].candidateId];
  record.disposition = "source-reviewed-correspondence-runtime-pending";
  record.businessDisposition = override.disposition;
  record.reviewReason = override.reason;
}
for (const candidate of candidates) {
  const scope = reconciliation.sourceScopes.find((item) => item.file === candidate.file);
  candidate.sourceScope =
    scope?.classification ??
    (candidate.candidateRouteIds.length ? "catalog-route-candidate" : "unclassified");
}
const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
for (const entry of legacy)
  for (const id of entry.candidateIds) byId.get(id).sourceInventoryIds.push(entry.legacyId);
const controls = candidates.filter((item) => !item.kind.startsWith("dialog-"));
const dialogs = candidates.filter((item) => item.kind.startsWith("dialog-"));
for (const page of pages) {
  page.candidateControls = controls.filter((item) =>
    item.candidateRouteIds.includes(page.id),
  ).length;
  page.candidateDialogs = dialogs.filter((item) => item.candidateRouteIds.includes(page.id)).length;
}
const sources = [...modules.entries()].map(([file, module]) => ({ file, sha256: module.sha256 }));
const sourceRevision = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", "apps/web/src", "config/route-catalog.json"],
  { cwd: repo, encoding: "utf8" },
).trim();
const fingerprint = digest(
  JSON.stringify({
    sources,
    catalog,
    matrix,
    legacyEntries,
    reconciliation,
    scanner: await read("scripts/lib/ui-phase2-inventory.mjs"),
    generator: await read("scripts/build-ui-phase2-inventory.mjs"),
  }),
);
const warnings = [...modules.values()].flatMap((module) => module.warnings);
const baseline = {
  schemaVersion: 1,
  sourceRevision,
  legacyRevision,
  sourceFingerprint: fingerprint,
  status: "static-discovery-complete-runtime-inventory-pending",
  denominatorFrozen: false,
  counts: {
    routes: pages.length,
    controls: controls.length,
    dialogs: dialogs.length,
    nativeButtons: controls.filter((item) => item.tag === "button").length,
    nativeDialogs: dialogs.filter((item) => item.kind === "dialog-definition").length,
    legacyButtons: 648,
    legacyDialogs: 56,
    legacySourceMatches: legacy.filter((item) => !item.disposition.startsWith("unresolved")).length,
    unmappedCandidates: candidates.filter((item) => !item.candidateRouteIds.length).length,
    runtimeWarnings: warnings.length,
  },
  evidenceTypes: {
    [`${old}/screens/desktop`]: "concept-html-not-vue-not-production",
    [`${old}/screens/mobile`]: "concept-html-not-vue-not-production",
    [`${old}/implementation-proof`]: "vue-isolated-per-existing-report-not-new-version-proof",
  },
  limitations: [
    "Candidate IDs identify source sites, not reviewed business actions.",
    "Shared surface imports over-approximate routes; mode, role, v-for and runtime variations remain unreviewed.",
    "App DEV query views and unmapped source sites require explicit classification; absence of route attribution does not prove removal.",
    "Shared reason helper and native dialog calls are discovered; arbitrary render functions or other helper aliases still need runtime audit.",
    "Historical AST identity or unique handler-and-label matches reconcile old rows; no business disposition is automatically approved.",
  ],
  sources,
  sourceReconciliation: reconciliation,
  runtimeWarnings: warnings,
};
const coverage = {
  schemaVersion: 1,
  sourceFingerprint: fingerprint,
  denominatorFrozen: false,
  pages,
  legacy,
  gates: {
    G0: "in-progress",
    G1: "pending",
    G2: "pending",
    G3: "pending",
    G4: "pending",
    G5: "pending",
  },
  verifiedBusinessActions: 0,
  verifiedDialogVariants: 0,
  productionExecutedActions: 0,
  userApprovedPages: 0,
};
const slim = (item) => ({
  id: item.candidateId,
  kind: item.kind,
  scope: item.sourceScope,
  file: item.file,
  line: item.line,
  label: item.label,
  events: item.events ?? {},
  conditions: item.conditions,
  routes: item.candidateRouteIds,
  legacy: item.sourceInventoryIds,
});
const review = {
  fingerprint,
  sourceRevision,
  counts: baseline.counts,
  pages,
  candidates: candidates.map(slim),
  legacyUnresolved: legacy.filter((item) => item.disposition.startsWith("unresolved")),
  limitations: baseline.limitations,
};
const outputs = {
  "baseline.json": JSON.stringify(baseline, null, 2) + "\n",
  "actions.json":
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceFingerprint: fingerprint,
        status: "discovery-not-behavior-coverage",
        candidates: controls,
      },
      null,
      2,
    ) + "\n",
  "dialogs.json":
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceFingerprint: fingerprint,
        status: "discovery-not-variant-coverage",
        candidates: dialogs,
      },
      null,
      2,
    ) + "\n",
  "coverage.json": JSON.stringify(coverage, null, 2) + "\n",
  "review-data.js": `window.SCOUTOPS_PHASE2 = ${JSON.stringify(review).replaceAll("<", "\\u003c")};\n`,
};
for (const [file, content] of Object.entries(outputs)) {
  const destination = `${output}/${file}`;
  if (check) {
    if (!existsSync(path.join(repo, destination)) || (await read(destination)) !== content) {
      throw new Error(`ui_phase2_artifact_stale:${destination}`);
    }
  } else await writeFile(path.join(repo, destination), content, "utf8");
}
console.log(
  `ui_phase2_inventory_${check ? "verified" : "generated"} ${JSON.stringify(baseline.counts)}`,
);
