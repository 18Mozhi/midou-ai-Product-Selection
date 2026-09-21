import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { topologyAlertFixtures } from "../../scripts/lib/topology-alert-fixtures.mjs";
const { cases, policies } = await topologyAlertFixtures();
const data = (id) => cases.find((c) => c.id === id).data;
const source = readFileSync("apps/web/src/components/RuntimeTopologyCenter.vue", "utf8");
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("topology.ts", script, ts.ScriptTarget.Latest, true);
const lookup = (name) => {
  const statement = ast.statements.find(
    (s) =>
      ts.isVariableStatement(s) &&
      s.declarationList.declarations.some((d) => d.name.getText(ast) === name),
  );
  return vm.runInNewContext(
    ts.transpileModule(statement.getText(ast), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText +
      ";" +
      name +
      ";",
    {},
    { timeout: 1000 },
  );
};
test("P66 all registered queues and eight alert codes have real labels", () => {
  assert.equal(cases.length, 29);
  assert.equal(Object.keys(policies).length, 19);
  const queues = lookup("queueLabels"),
    alerts = lookup("alertLabels");
  for (const name of Object.keys(policies)) assert.ok(queues[name], "queue label " + name);
  const codes = [...new Set(cases.flatMap((c) => c.data.alerts.map((a) => a.code)))];
  assert.equal(codes.length, 8);
  for (const code of codes) assert.ok(alerts[code], "alert label " + code);
});
test("P66 one-minute edges and expected business waits do not create extra alerts", () => {
  assert.equal(data("result-window-edge").alerts.length, 1);
  for (const id of [
    "result-outside-window",
    "result-future",
    "waiting_evidence",
    "waiting_profit",
    "result-no-code",
  ])
    assert.equal(data(id).alerts.length, 0, id);
  assert.deepEqual(data("recent-failures").alerts[0].queues, ["collection_tasks"]);
});
test("P66 current Worker normalizer yields six allowed object kinds and three actual links", () => {
  const rows = cases.filter((c) => c.id.startsWith("object-"));
  const objects = rows.flatMap((c) => c.data.alerts[0].business_objects);
  assert.equal(new Set(objects.map((o) => o.type)).size, 6);
  assert.equal(objects.filter((o) => o.href).length, 3);
  assert.equal(data("result-no-object").alerts[0].business_objects.length, 0);
  assert.equal(data("result-rejected-objects").alerts[0].business_objects.length, 1);
});
test("P66 aggregate alerts do not invent linked objects or overwrite ready node state", () => {
  for (const id of [
    "backpressure",
    "recent-failures",
    "suspected-stuck",
    "circuit-open",
    "publication-failed",
    "restart-at",
  ]) {
    assert.equal(data(id).state, "ready");
    assert.equal(data(id).blockers.length, 0);
    assert.equal(data(id).alerts[0].business_objects.length, 0);
  }
  assert.equal(data("restart-below").alerts.length, 0);
  assert.equal(data("combined-alerts").alerts.length, 8);
});
test("P66 state factory remains inert and records one local view per scenario", () => {
  for (const row of cases) {
    assert.equal(row.recordedView.requestId, row.id);
    assert.equal(row.data.capacity_claim, "unverified");
  }
});
test("P66 injected aggregate values keep backpressure and failure percentage coherent", () => {
  for (const id of ["backpressure", "combined-alerts"]) {
    const s = data(id).worker_scheduler;
    assert.equal(
      s.backpressure,
      s.due_queue_count > Math.max(0, s.max_concurrency - s.active_runs),
    );
  }
  for (const id of ["recent-failures", "combined-alerts"]) {
    const s = data(id).worker_scheduler;
    assert.equal(
      s.failure_rate_percent,
      Math.round((s.failed_last_minute / s.completed_last_minute) * 10000) / 100,
    );
  }
});
