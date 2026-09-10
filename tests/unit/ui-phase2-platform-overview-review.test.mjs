import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import {
  base,
  sourceFiles,
  parentFiles,
  contractFile,
  readPlatformReviewInputs,
  buildPlatformReview,
  renderPlatformContract,
  validatePlatformReview,
} from "../../scripts/build-ui-phase2-platform-overview-review.mjs";

const inputs = readPlatformReviewInputs();
const build = () => buildPlatformReview(inputs);
const context = {
  candidates: sourceFiles.flatMap((f) => scanSource(inputs.sources[f], f).candidates),
  sourceHashes: build().sourceHashes,
  contracts: runContractAudit().records,
  packages: inputs.packages,
  files: new Set(["scripts/verify-ui-phase2-platform-overview-c.mjs"]),
};

test("P38 exact30 sites map to19 interactions and one dialog definition without approval", () => {
  const result = validateActionReview(build(), context);
  assert.equal(result.sourceSites, 30);
  assert.equal(result.semanticGroups, 20);
  assert.equal(result.routeActions, 19);
  assert.equal(result.wiringGroups, 1);
  assert.equal(result.writeActions, 0);
  assert.equal(result.unmappedVisualSlots, 114);
  assert.deepEqual(JSON.parse(readFileSync(base + "/action-reviews/P38.json", "utf8")), build());
  assert.equal(
    readFileSync(contractFile, "utf8").replaceAll("\r\n", "\n"),
    renderPlatformContract(build(), inputs),
  );
  const omitted = build();
  omitted.actions.find((a) => a.actionId === "PA38-SOURCES").sourceCandidateIds.pop();
  assert.throws(() => validateActionReview(omitted, context), /unmapped candidates/);
  const approved = build();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context), /cannot grant approval/);
  const duplicate = build();
  duplicate.actions[1].sourceCandidateIds.push(duplicate.actions[0].sourceCandidateIds[0]);
  assert.throws(() => validateActionReview(duplicate, context), /mapped twice/);
});

test("P38 density is retained as a model even though scanner has no explicit event candidate", () => {
  assert.deepEqual(validateReviewSurfaces(build().surfaceReview, inputs), {
    callerFiles: 4,
    localModelBindings: 2,
    callerContainers: 1,
    consumerVariants: 3,
    runtimeAcceptance: "unproven",
  });
  assert.deepEqual(build().inputs["TableViewControls.vue"], ["density"]);
  assert.equal(context.candidates.filter((c) => c.file === sourceFiles[2]).length, 3);
  const omitted = build();
  omitted.surfaceReview.inputs.pop();
  assert.throws(() => validateReviewSurfaces(omitted.surfaceReview, inputs), /input omissions/);
  const extra = build();
  extra.surfaceReview.containers.push({
    file: sourceFiles[1],
    tag: "section",
    ordinal: 1,
    shape: "native-dialog",
  });
  assert.throws(() => validateReviewSurfaces(extra.surfaceReview, inputs), /container omissions/);
});

test("P38 shared preview definition forwards only to explicit local interactions", () => {
  const action = build().actions.find((a) => a.kind === "wiring");
  assert.deepEqual(action.forwardsTo, ["PA38-PREVIEW-OPEN", "PA38-PREVIEW-CLOSE"]);
  assert.deepEqual(action.forwardBindings, []);
  const cycle = build();
  cycle.actions.find((a) => a.kind === "wiring").forwardsTo = [action.actionId];
  assert.throws(() => validateActionReview(cycle, context), /never a cycle/);
  assert.match(
    build().actions.find((a) => a.actionId === "PA38-TECH").handler,
    /不是共享请求编号复制/,
  );
  assert.match(
    build().actions.find((a) => a.actionId === "PA38-REQUEST-DETAILS").handler,
    /不视为P38已有字段/,
  );
});

test("P38 real surfaceProps forwards only API base and unchanged capabilities array", () => {
  const box = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(inputs.sources[parentFiles[1]], {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    box,
  );
  for (const capabilities of [
    [],
    ["platform:operate"],
    ["platform:superadmin"],
    ["platform:operate", "platform:superadmin"],
  ]) {
    const result = box.exports.surfaceProps({
      surface: "platform-dashboard",
      path: "/platform-admin",
      apiBaseUrl: "/fixture",
      capabilities,
      organizationId: "fixture-org",
      workspaceId: "fixture-space",
      roles: ["fixture-role"],
    });
    assert.deepEqual(Object.keys(result).sort(), ["apiBaseUrl", "capabilities"]);
    assert.equal(result.apiBaseUrl, "/fixture");
    assert.equal(result.capabilities, capabilities);
  }
});

test("P38 source wiring rejects wrong dispatcher, capabilities, component props or route surface", () => {
  assert.deepEqual(validatePlatformReview(build(), inputs), {
    sourceSites: 30,
    semanticGroups: 20,
    routeActions: 19,
    wiringGroups: 1,
    writeActions: 0,
    modelBindings: 2,
    entryChecks: 20,
    clickedInstances: 52,
    newImages: 8,
  });
  for (const [file, from, to] of [
    [
      parentFiles[0],
      '"platform-dashboard": lazy("PlatformDashboard")',
      '"platform-dashboard": lazy("PlatformManagementCenter")',
    ],
    [parentFiles[0], 'v-bind="selectedSurfaceProps"', 'v-bind="{}"'],
    [parentFiles[0], "capabilities: allCapabilities.value", "capabilities: []"],
    [
      parentFiles[1],
      'case "platform-dashboard":\n      return { ...common, capabilities: input.capabilities };',
      'case "platform-dashboard":\n      return { ...common, capabilities: [] };',
    ],
  ]) {
    assert.ok(inputs.sources[file].includes(from));
    const changed = {
      ...inputs,
      sources: { ...inputs.sources, [file]: inputs.sources[file].replace(from, to) },
    };
    assert.throws(() => validatePlatformReview(buildPlatformReview(changed), changed));
  }
});

test("P38 eight actual entry compositions bind exact pixels and52 fixture router clicks, not RBAC", () => {
  validatePlatformReview(build(), inputs);
  assert.equal(build().actualEntryEvidence.sourceCandidateIds.length, 13);
  assert.equal(new Set(build().actualEntryEvidence.sourceCandidateIds).size, 13);
  for (const mutate of [
    (e) => e.navigation.pop(),
    (e) => {
      e.navigation[0].href = "/platform-admin/unknown";
    },
    (e) => {
      e.screenshots[0].sha256 = "0".repeat(64);
    },
    (e) => {
      e.screenshots[0].approval = "approved";
    },
    (e) => {
      e.processesClosed = false;
    },
  ]) {
    const changed = { ...inputs, evidence: structuredClone(inputs.evidence) };
    mutate(changed.evidence);
    assert.throws(() => validatePlatformReview(buildPlatformReview(changed), changed));
  }
  assert.match(inputs.evidence.scope, /NOT full NavigationShell, backend RBAC/);
  assert.ok(inputs.evidence.navigation.every((n) => n.scope.includes("router-destination-only")));
});

test("P38 source hash and semantic edits cannot silently pass registry validation", () => {
  const changed = build();
  changed.actions[0].handler = "unreviewed mutation";
  assert.throws(() => validatePlatformReview(changed, inputs), /registry drift/);
  const drift = build();
  drift.sourceHashes[sourceFiles[0]] = "0".repeat(64);
  assert.throws(() => validateActionReview(drift, context), /source drift/);
  assert.equal(build().approval, "pending-user-review");
  assert.match(build().compositionGaps.join(" "), /401\/403/);
});
