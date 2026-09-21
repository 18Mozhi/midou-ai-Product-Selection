import test from "node:test";
import { assertP34HistoricalSourceHash } from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { approvalsParentBase } from "../../scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import { loadingVueDriver } from "../../scripts/lib/ui-phase2-org-approvals-loading-driver.mjs";
import {
  readOrderOutput,
  readOrderVueDriver,
} from "../../scripts/lib/ui-phase2-org-approvals-read-order-driver.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("read-order driver preserves earlier assertions and exact Vue/CSS composition", () => {
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
  const original = loadingVueDriver(read(approvalsParentBase)),
    revised = readOrderVueDriver(read(approvalsParentBase));
  const current = checks(revised);
  for (const check of checks(original)) assert.ok(current.includes(check), check);
  for (const pattern of [
    /const sourceRevisions = new Map\([\s\S]*?\n\]\);/,
    /\.replace\("<\/head>",[\s\S]*?\.join\(""\) \+ "<\/head>"\);/,
  ]) {
    const before = original.match(pattern)?.[0];
    assert.ok(before, "Original presentation anchor must exist");
    assert.equal(revised.match(pattern)?.[0], before);
  }
  assert.match(revised, /await firstResponse\.finished\(\)/);
  assert.match(revised, /await firstResponse\.json\(\)/);
  assert.match(revised, /requestAnimationFrame\(\(\)=>requestAnimationFrame\(resolve\)\)/);
  assert.match(
    revised,
    /if \(active\.endpointGates\?\.\[endpoint\]\) await active\.endpointGates\[endpoint\]/,
  );
  assert.match(revised, /page\.off\("response",onResponse\)/);
});

test("read-order modes reject invalid arguments before service creation", () => {
  for (const args of [["--unknown"], ["--smoke", "--capture"], ["--smoke", "--smoke"]]) {
    const run = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-org-approvals-read-order-vue.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
  }
});

test("previous loading r2 packet remains byte-identical", () => {
  const folder = "output/playwright/p34-loading-vue-c-r2",
    bytes = readFileSync(folder + "/evidence.json");
  assert.equal(hash(bytes), "ba90d1428752817ab59b5a8f52391feedfc38b58f3df585f2ef856872afee779");
  for (const image of JSON.parse(bytes).screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256);
});

test("historical read-order evidence binds24response orders and its original presentation", () => {
  const e = JSON.parse(read(readOrderOutput + "/evidence.json"));
  assert.equal(e.kind, "P34-READ-ORDER-VUE-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 200);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  const old = JSON.parse(read("output/playwright/p34-loading-vue-c-r2/evidence.json"));
  assert.deepEqual(e.transformedHashes, old.transformedHashes);
  assert.deepEqual(e.scenarios, old.scenarios);
  assert.equal(e.scenarios.length, 56);
  for (const check of old.checks)
    assert.ok(e.checks.some((c) => c.width === check.width && c.name === check.name));
  assert.equal(e.orderedReads.length, 24);
  const expectedCombinations = [];
  for (const width of [1440, 390])
    for (const phase of ["initial", "background"])
      for (const firstEndpoint of ["summary", "approvals"])
        for (const outcome of ["success", "server-error", "permission-forbidden"])
          expectedCombinations.push([width, phase, firstEndpoint, outcome]);
  assert.deepEqual(
    e.orderedReads.map((s) => [s.width, s.phase, s.firstEndpoint, s.outcome]),
    expectedCombinations,
  );
  for (const s of e.orderedReads) {
    assert.deepEqual(s.responseOrder, [
      s.firstEndpoint,
      s.firstEndpoint === "summary" ? "approvals" : "summary",
    ]);
    assert.deepEqual(s.partial, s.before);
    assert.deepEqual(s.failedSnapshot, s.outcome === "success" ? null : s.before);
    if (s.phase === "initial") assert.deepEqual(s.before, { observedAt: null, templateName: null });
    else assert.equal(s.before.templateName, "采购首次审批模板");
    assert.deepEqual(s.after, {
      observedAt: "2026-08-27T10:00:00.000Z",
      templateName: "采购更新后审批模板",
    });
    assert.equal(s.requestCount, s.outcome === "success" ? 2 : 4);
    const name =
      `order-${s.phase}-${s.firstEndpoint}` + (s.outcome === "success" ? "" : "-then-" + s.outcome);
    for (const suffix of [
      "first response contains new fixture",
      "only chosen response completed",
      "no partial data commit",
      "partial refresh stays disabled",
      "response order observed",
      "both data sets commit together",
      "completion preserves current query",
    ])
      assert.ok(e.checks.some((c) => c.width === s.width && c.name === name + ": " + suffix));
  }
  assert.equal(e.checks.length, 2416);
  assert.deepEqual(e.requestCounts, [
    { width: 1440, parentReads: 220, writes: 0 },
    { width: 390, parentReads: 220, writes: 0 },
  ]);
  assert.equal(e.screenshots.length, 250);
  for (const image of e.screenshots) {
    const bytes = readFileSync(readOrderOutput + "/" + image.file);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.width === 390 ? 844 : 1000);
  }
});

test("read-order capture refuses to overwrite evidence", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-read-order-vue.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /EEXIST/);
});
