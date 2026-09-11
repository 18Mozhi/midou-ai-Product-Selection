import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const folder = "design-plans/ui-phase-2-2026-09-07/";
const contractPath = `${folder}platform-account-contract-review.md`;
const userContractPath = `${folder}platform-user-design-contract.md`;
const currentContractPath = `${folder}platform-account-current-contract.md`;
const responsiveContractPath = `${folder}responsive-detail-focus-contract-review.md`;
const responsiveFile = "apps/web/src/components/ResponsiveDataView.vue";
const addedSource = "apps/web/src/use-platform-organization-actions.ts";
const files = {
  D: "PlatformDashboard",
  C: "PlatformAccountCenter",
  O: "PlatformOrganizationRecords",
  M: "PlatformAdminRecords",
  W: "OrganizationCreationWizard",
  G: "PlatformOrganizationDetailDialog",
  R: "PlatformRoleComparison",
  A: "PlatformAccountDialogs",
  U: "PlatformUserRecords",
  V: "PlatformUserDetailDialog",
  F: "PlatformUserMembershipForm",
  S: "ResponsiveDataView",
  Q: "ResponsiveFilterDrawer",
  T: "TableViewControls",
  X: "TechnicalDetails",
};
const supportingSources = [
  "apps/web/src/use-modal-dialog.ts",
  "apps/web/src/use-platform-user-detail.ts",
  "apps/web/src/platform-account-types.ts",
  "apps/web/src/api-client.ts",
  "apps/web/src/components/NavigationShell.vue",
  "apps/api/src/authorization-routes.ts",
  "apps/api/src/platform-account-routes.ts",
  "apps/api/src/platform-account-service.ts",
  "apps/api/src/mysql-platform-account-repository.ts",
  "apps/api/src/platform-dashboard-routes.ts",
  "apps/api/src/platform-dashboard-service.ts",
  "apps/api/src/mysql-platform-dashboard-repository.ts",
  "apps/api/src/mysql-platform-dashboard-scale-metrics.ts",
  "apps/api/src/mysql-platform-dashboard-collection-metrics.ts",
  "apps/api/src/mysql-platform-dashboard-risk-metrics.ts",
  "apps/api/src/mysql-platform-dashboard-storage-metrics.ts",
  "config/route-catalog.json",
];

function modelBindings(source, filename) {
  const parsed = parse(source, { filename });
  assert.equal(parsed.errors.length, 0, `${filename}: invalid Vue source`);
  const bindings = [];
  function walk(node) {
    for (const prop of node.props ?? []) {
      if (prop.type === 7 && prop.name === "model") bindings.push(prop.exp?.content ?? "");
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(baseParse(parsed.descriptor.template?.content ?? ""));
  return bindings;
}

function sameUnique(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate records`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: source/contract drift`);
}

// Injectable reader permits read-only negative checks without changing repository files.
export function verifyPlatformAccountContract(read = (file) => readFileSync(file, "utf8")) {
  const source = (file) => read(resolve(root, file)).replaceAll("\r\n", "\n");
  const contract = source(contractPath);
  const userContract = source(userContractPath);
  const currentContract = source(currentContractPath);
  const responsiveContract = source(responsiveContractPath);
  const historicalCandidates = [
    ...`${contract}\n${userContract}`.matchAll(/^\|\s*([A-Z])\s*\|\s*([0-9a-f]{16}\.\d+)\s*\|/gm),
  ].map((match) => `${match[1]}#${match[2]}`);
  // The old table is evidence, not the current template. Supersede only the
  // explicitly documented shared component; all other candidate identities remain exact.
  sameUnique(
    historicalCandidates.filter((key) => key.startsWith("S#")),
    [
      "S#6da4dad42cb34c8d.1",
      "S#4fa7deb3456a41ae.1",
      "S#53d89072117d7eda.1",
      "S#e23893d134b1daa1.1",
      "S#847801b2ac6e7a17.1",
    ],
    "historical responsive candidates",
  );
  const responsiveCandidates = [
    ...responsiveContract.matchAll(
      /^\|\s*apps\/web\/src\/components\/ResponsiveDataView\.vue#([0-9a-f]{16}\.\d+)\s*\|/gm,
    ),
  ].map((match) => `S#${match[1]}`);
  assert.equal(responsiveCandidates.length, 5, "current responsive candidates required");
  const candidates = [
    ...historicalCandidates.filter((key) => !key.startsWith("S#")),
    ...responsiveCandidates,
  ];
  const bindings = [...contract.matchAll(/^\|\s*([A-Z])\s*\|\s*([\w.]+)\s*\|/gm)]
    .filter((match) => !/^[0-9a-f]{16}\.\d+$/.test(match[2]))
    .map((match) => `${match[1]}#${match[2]}`);
  const expectedCandidates = [],
    expectedBindings = [],
    vueFiles = [];
  for (const [alias, name] of Object.entries(files)) {
    const file = `apps/web/src/components/${name}.vue`;
    vueFiles.push(file);
    const content = source(file);
    expectedCandidates.push(
      ...scanSource(content, file).candidates.map(
        (item) => `${alias}#${item.candidateId.split("#")[1]}`,
      ),
    );
    expectedBindings.push(...modelBindings(content, file).map((binding) => `${alias}#${binding}`));
  }
  sameUnique(candidates, expectedCandidates, "candidates");
  sameUnique(bindings, expectedBindings, "v-model bindings");
  assert.equal(candidates.length, 128);
  assert.equal(bindings.length, 24);

  const hashes = [...contract.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([0-9a-f]{64})\s*\|/gm)];
  const revisions = [
    ...currentContract.matchAll(
      /^\|\s*([^|\n]+?)\s*\|\s*([0-9a-f]{64})\s*\|\s*([0-9a-f]{64})\s*\|/gm,
    ),
  ].map((match) => ({ file: match[1].trim(), before: match[2], after: match[3] }));
  sameUnique(
    revisions.map((item) => item.file),
    [
      "PlatformDashboard",
      "PlatformAccountCenter",
      "ResponsiveDataView",
      "ResponsiveFilterDrawer",
    ].map((name) => `apps/web/src/components/${name}.vue`),
    "explicit source revisions",
  );
  const revisionByFile = new Map(revisions.map((item) => [item.file, item]));
  sameUnique(
    hashes.map((match) => match[1].trim()),
    [...vueFiles, ...supportingSources],
    "hash files",
  );
  for (const match of hashes) {
    const file = match[1].trim();
    const revision = revisionByFile.get(file);
    if (revision) assert.equal(match[2], revision.before, `${file}: historical hash drift`);
    assert.equal(
      createHash("sha256").update(source(file)).digest("hex"),
      revision?.after ?? match[2],
      `${file}: hash drift`,
    );
  }
  const responsiveHashes = [
    ...responsiveContract.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([0-9a-f]{64})\s*\|/gm),
  ];
  sameUnique(
    responsiveHashes.map((match) => match[1].trim()),
    [responsiveFile],
    "responsive supplement hash files",
  );
  assert.equal(
    responsiveHashes[0][2],
    revisionByFile.get(responsiveFile).after,
    "responsive supplement hash drift",
  );
  // Extraction added a runtime dependency. Keep the original 32-source snapshot,
  // but do not omit the new producer from the current verification surface.
  const additionalHashes = [
    ...currentContract.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([0-9a-f]{64})\s*\|\s*$/gm),
  ];
  sameUnique(
    additionalHashes.map((match) => match[1].trim()),
    [addedSource],
    "additional source files",
  );
  assert.equal(
    createHash("sha256").update(source(addedSource)).digest("hex"),
    additionalHashes[0][2],
    `${addedSource}: hash drift`,
  );
  const coverage = JSON.parse(source(`${folder}coverage.json`));
  const routes = JSON.parse(source("config/route-catalog.json")).routes;
  const documents = [contractPath, userContractPath, currentContractPath, responsiveContractPath];
  for (let number = 38; number <= 45; number += 1) {
    const id = `P${number}`;
    const page = coverage.pages.find((item) => item.id === id);
    assert(page && page.batch === "W05", `${id}: missing W05 route`);
    assert(
      routes.some((route) => route.path === page.path),
      `${id}: route catalog drift`,
    );
    const file = `${folder}page-specs/${id}.md`;
    const spec = source(file);
    assert(spec.includes(page.path), `${id}: missing exact route`);
    assert(spec.startsWith(`# ${id} `), `${id}: incorrect title`);
    assert.deepEqual(
      [...spec.matchAll(/^## (\d+)\./gm)].map((match) => Number(match[1])),
      Array.from({ length: 10 }, (_, index) => index + 1),
      `${id}: ten sections required`,
    );
    documents.push(file);
  }
  let links = 0;
  for (const file of documents) {
    for (const match of source(file).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      assert(existsSync(resolve(root, dirname(file), target)), `${file}: broken link ${target}`);
      links += 1;
    }
  }
  return {
    pages: 8,
    candidates: candidates.length,
    bindings: bindings.length,
    sources: hashes.length + additionalHashes.length,
    historicalSources: hashes.length,
    revisedSources: revisions.length,
    links,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, "This read-only verifier accepts no arguments.");
  console.log(
    "ui_phase2_platform_account_contract_checked",
    JSON.stringify(verifyPlatformAccountContract()),
  );
  console.log(
    "Static contract only; runtime coverage, formal design and user approval remain pending.",
  );
}
