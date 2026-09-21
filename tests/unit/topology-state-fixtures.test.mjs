import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { topologyStateFixtures } from "../../scripts/lib/topology-state-fixtures.mjs";
const { cases } = await topologyStateFixtures();
const byId = (id) => cases.find((row) => row.id === id).data;
const source = readFileSync("apps/web/src/components/RuntimeTopologyCenter.vue", "utf8");
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("topology.ts", script, ts.ScriptTarget.Latest, true);
const labelsNode = ast.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((d) => d.name.getText(ast) === "blockerLabels"),
);
const labels = vm.runInNewContext(
  ts.transpileModule(labelsNode.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + ";blockerLabels;",
  {},
  { timeout: 1000 },
);
test("P66 current producers cover all four states and six blocker codes", () => {
  assert.equal(cases.length, 18);
  assert.deepEqual([...new Set(cases.map((c) => c.data.state))].sort(), [
    "blocked",
    "empty",
    "ready",
    "stale",
  ]);
  const codes = [...new Set(cases.flatMap((c) => c.data.blockers.map((b) => b.code)))];
  assert.equal(codes.length, 6);
  for (const code of codes) assert.ok(labels[code], "specific UI label for " + code);
});
test("P66 worker-only stale is not mislabeled as expired API heartbeat", () => {
  for (const id of ["worker-missing", "worker-stopped", "worker-old", "worker-future"]) {
    const data = byId(id);
    assert.equal(data.stale_node_count, 0);
    assert.equal(data.blockers.length, 0);
    assert.equal(data.alerts[0].code, "worker_scheduler_heartbeat_stale");
  }
  assert.ok(/stale:\s*\[\s*"运行观测需重新核验"/.test(script), "neutral stale heading");
  assert.ok(
    script.includes('worker_scheduler_heartbeat_stale: "任务调度观测需核对"'),
    "neutral Worker alert label",
  );
});
test("P66 supervisor blocker and missing probes do not overwrite current service verdict", () => {
  assert.equal(byId("supervisor-degraded").state, "ready");
  assert.equal(byId("supervisor-degraded").blockers.length, 1);
  assert.equal(byId("health-unavailable").state, "ready");
  assert.equal(byId("health-unavailable").health_probes.status, "unavailable");
});
test("P66 future timestamp asymmetry and restart reset are preserved, not policy fixes", () => {
  assert.equal(byId("node-future").state, "ready");
  assert.equal(byId("worker-future").state, "stale");
  const row = byId("restart-counter-reset")
    .restart_trend.filter((r) => r.process_name === "worker")
    .at(-1);
  assert.equal(row.counter_reset, true);
  assert.equal(row.restart_delta, 0);
});
test("P66 synthetic service view calls do not claim live audit or public capacity", () => {
  for (const row of cases) {
    assert.equal(row.recordedView.requestId, row.id);
    assert.equal(row.data.capacity_claim, "unverified");
    assert.equal(row.data.multi_node_claim, false);
  }
  assert.match(source, /blockerLabels\[item.code\] \?\? "运行条件未满足"/);
});
