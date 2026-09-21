import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { approvalsParentBase } from "../../scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import { readOrderVueDriver } from "../../scripts/lib/ui-phase2-org-approvals-read-order-driver.mjs";
import {
  routeLifecycleOutput,
  routeLifecycleVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-route-lifecycle-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("route driver preserves all original checks and exact Vue/CSS composition", () => {
  const checks = (source) => {
    const ast = ts.createSourceFile("driver.mjs", source, ts.ScriptTarget.Latest, true),
      result = [];
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(ast) === "check")
        result.push(n.getText(ast));
      ts.forEachChild(n, visit);
    };
    visit(ast);
    return result;
  };
  const before = readOrderVueDriver(read(approvalsParentBase)),
    after = routeLifecycleVueDriver(read(approvalsParentBase)),
    current = checks(after);
  for (const check of checks(before)) assert.ok(current.includes(check), check);
  for (const pattern of [
    /const sourceRevisions = new Map\([\s\S]*?\n\]\);/,
    /\.replace\("<\/head>",[\s\S]*?\.join\(""\) \+ "<\/head>"\);/,
  ]) {
    const original = before.match(pattern)?.[0];
    assert.ok(original);
    assert.equal(after.match(pattern)?.[0], original);
  }
  assert.match(after, /if \(!smoke\) \{\n      const first = hold\(\);/);
  assert.match(after, /await page\.goBack\(\)/);
  assert.match(
    after,
    /ownerType:owner\.type\.name,cacheType:owner\.parent\.type\.name,deactivated:owner\.isDeactivated/,
  );
  assert.match(after, /\["AsyncComponentWrapper","KeepAlive"\]/);
  assert.doesNotMatch(after, /route-cache-ancestry/);
});

test("route driver rejects unknown and combined options", () => {
  for (const args of [["--unknown"], ["--smoke", "--capture"], ["--smoke", "--smoke"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-route-lifecycle-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("previous two-response packet remains immutable", () => {
  const folder = "output/playwright/p34-read-order-vue-c-r1",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "bce22066453e91a4d4cfb5bd77167df376b6c63a3ac63996af11bf6256ef0abf");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});

test("route evidence binds24actual history/cache cases and old matrices", () => {
  const e = JSON.parse(read(routeLifecycleOutput + "/evidence.json")),
    old = JSON.parse(read("output/playwright/p34-read-order-vue-c-r1/evidence.json"));
  assert.equal(e.kind, "P34-ROUTE-LIFECYCLE-VUE-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 202);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  const parent = "apps/web/src/components/OrganizationAdminCenter.vue",
    panel = "apps/web/src/components/OrganizationApprovalPanel.vue";
  assert.deepEqual(
    Object.keys(e.transformedHashes)
      .filter((file) => e.transformedHashes[file] !== old.transformedHashes[file])
      .sort(),
    [parent, panel].sort(),
  );
  const undo = (text, before, after) => {
    assert.equal(text.split(after).length, 2);
    return text.replace(after, before);
  };
  assert.equal(
    hash(undo(read(parent), "", '        :owner-path="props.routePath"\n')),
    old.sourceHashes[parent],
  );
  assert.equal(
    hash(
      undo(
        undo(read(panel), "", "  ownerPath?: string;\n"),
        "const queryOwnerPath = route.path,",
        "const queryOwnerPath = props.ownerPath ?? route.path,",
      ),
    ),
    old.sourceHashes[panel],
  );
  assert.deepEqual(e.scenarios, old.scenarios);
  assert.deepEqual(e.orderedReads, old.orderedReads);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  const combinations = [];
  for (const width of [1440, 390])
    for (const phase of ["initial", "background"])
      for (const timing of ["away", "returned"])
        for (const outcome of ["success", "server-error", "permission-forbidden"])
          combinations.push([width, phase, timing, outcome]);
  assert.equal(e.routeRuns.length, 24);
  assert.deepEqual(
    e.routeRuns.map((s) => [s.width, s.phase, s.releaseTiming, s.outcome]),
    combinations,
  );
  for (const s of e.routeRuns) {
    assert.equal(s.before.ownerType, "AsyncComponentWrapper");
    assert.equal(s.before.cacheType, "KeepAlive");
    assert.deepEqual(
      [s.before.connected, s.before.deactivated, s.before.unmounted],
      [true, false, false],
    );
    assert.deepEqual(
      [s.away.connected, s.away.deactivated, s.away.unmounted],
      [false, true, false],
    );
    assert.equal(s.before.uid, s.away.uid);
    assert.equal(s.before.cacheUid, s.away.cacheUid);
    assert.equal(s.settled.uid, s.before.uid);
    assert.equal(s.settled.cacheUid, s.before.cacheUid);
    assert.notEqual(s.destinationBefore.uid, s.before.uid);
    assert.equal(
      s.settled.state,
      s.outcome !== "success" && (s.phase === "initial" || s.outcome === "permission-forbidden")
        ? s.outcome === "server-error"
          ? "error"
          : "forbidden"
        : "ready",
    );
    assert.deepEqual(
      [s.settled.observedAt, s.settled.templateName],
      s.outcome === "success"
        ? ["2026-08-27T10:00:00.000Z", "采购更新后审批模板"]
        : [s.before.observedAt, s.before.templateName],
    );
    assert.equal(s.requestCount, s.outcome === "success" ? 3 : 5);
    if (s.releaseTiming === "away") assert.deepEqual(s.destinationAfter, s.destinationBefore);
    else assert.equal(s.destinationAfter, null);
    const name = `route-${s.phase}-${s.releaseTiming}-${s.outcome}`;
    for (const suffix of [
      "exact asynchronous cache ownership",
      "history reuses original component",
      "returning keeps original query",
      "returned content follows original rule",
      "no new parent read just for history",
    ])
      assert.ok(e.checks.some((c) => c.width === s.width && c.name === name + ": " + suffix));
  }
  assert.equal(e.checks.length, 2996);
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 284, writes: 0 },
    { width: 390, parentReads: 284, writes: 0 },
  ]);
  assert.equal(e.screenshots.length, 298);
  for (const image of e.screenshots) {
    const bytes = readFileSync(routeLifecycleOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("route capture refuses overwrite before services start", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-route-lifecycle-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});
