import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildInsightsDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  const source = (await read("apps/web/src/components/OpportunityWorkspace.vue"))
    .split('<script setup lang="ts">')[1]
    .split("</script>")[0];
  function extract(text, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true),
      matches = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  function run(code, bindings = {}) {
    const context = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const fixture = await read("tests/e2e/m04-03-scoring.spec.ts");
  const declarations = (text, names) =>
    names.map((n) => `const ${n}=${extract(text, n)};`).join("\n");
  const facts = plain(
    run(
      `${declarations(fixture, ["opportunityId", "ruleId", "draftId", "actor", "dimensions", "detail"])} export {detail,dimensions};`,
    ),
  );
  const compFixture = await read("tests/e2e/m04-05-competitors.spec.ts");
  const item = plain(run(`${declarations(compFixture, ["id", "item"])} export {item};`).item);
  // Cross-fixture association is synthetic layout data, NOT a factual link between these products.
  const competitors = [
    {
      id: item.id,
      opportunity_id: facts.detail.id,
      market: item.market,
      source_site: item.source_site,
      external_id: item.external_id,
      title: item.title,
      snapshot_count: item.snapshot_count,
      latest_snapshot: Object.fromEntries(
        [
          "current_price",
          "currency",
          "rating_value",
          "review_count",
          "captured_at",
          "freshness",
        ].map((key) => [key, item.latest_snapshot[key]]),
      ),
    },
  ];
  const searches = [
    { input_type: "opportunity", input_ref: facts.detail.id, candidate_count: 2 },
    { input_type: "opportunity", input_ref: facts.detail.id, candidate_count: 3 },
    { input_type: "keyword", input_ref: facts.detail.id, candidate_count: 99 },
    { input_type: "opportunity", input_ref: "other-opportunity", candidate_count: 99 },
  ];
  const outputs = {};
  for (const [name, comp, supply, fail] of [
    ["both", true, true, false],
    ["competitor", true, false, false],
    ["supplier", false, true, false],
    ["neither", false, false, false],
    ["supplierFailure", true, true, true],
  ]) {
    const calls = [],
      downstream = { value: { old: true } },
      competitorItems = { value: ["old"] },
      state = { value: "idle" };
    await run(
      `${extract(source, "loadDownstream", "function")} export const result=loadDownstream();`,
      {
        props: { opportunityId: facts.detail.id },
        canReadCompetitors: { value: comp },
        canReadSourcing: { value: supply },
        downstream,
        competitorItems,
        downstreamLoadState: state,
        ApiClientError: class extends Error {},
        requestId: { value: "" },
        request: async (p) => {
          calls.push(p);
          if (fail && p === "/sourcing/searches") throw new Error("isolated failure");
          return {
            data:
              p === "/competitors"
                ? [
                    ...competitors,
                    { ...competitors[0], opportunity_id: "other-opportunity", snapshot_count: 99 },
                  ]
                : searches,
          };
        },
      },
    ).result;
    outputs[name] = plain({
      calls,
      downstream: downstream.value,
      competitors: competitorItems.value,
      state: state.value,
    });
  }
  assert.deepEqual(outputs.both.downstream, {
    competitors: 1,
    snapshots: 2,
    searches: 2,
    suppliers: 5,
  });
  assert.deepEqual(outputs.competitor.calls, ["/competitors"]);
  assert.deepEqual(outputs.supplier.calls, ["/sourcing/searches"]);
  assert.deepEqual(outputs.neither.calls, []);
  assert.equal(outputs.supplierFailure.state, "error");
  assert.deepEqual(outputs.supplierFailure.competitors, ["old"]);
  const intents = {},
    actionResults = {};
  for (const [key, method] of Object.entries({
    competitor: "discoverCompetitors",
    supplier: "discoverSuppliers",
    score: "queueScore",
  })) {
    for (const success of [true, false]) {
      let reads = 0;
      const message = { value: "" };
      await run(`${extract(source, method, "function")} export const result=${method}();`, {
        detail: { value: facts.detail },
        message,
        load: async () => {
          reads++;
        },
        write: async (p, body) => {
          intents[key] = plain({ method: "POST", path: p, body });
          return success ? { task_id: "isolated-task-layout" } : null;
        },
      }).result;
      assert.equal(reads, key === "score" && success ? 1 : 0);
      assert.equal(Boolean(message.value), success);
      actionResults[`${key}-${success}`] = { reads, message: message.value };
    }
  }
  assert.deepEqual(intents.competitor.body, {});
  assert.deepEqual(intents.supplier.body, {
    input_type: "opportunity",
    input_ref: facts.detail.id,
  });
  assert.deepEqual(intents.score.body, { expected_version: facts.detail.version });
  return {
    version: "INSIGHTS-C-r1",
    facts,
    competitors,
    downstream: outputs.both.downstream,
    intents,
    outputs,
    actionResults,
    knownGaps: {
      supplierFailureHidesCompetitorSuccess: true,
      failedReadKeepsOldArrays: true,
      sourceFixed: false,
    },
    boundary:
      "Historical isolated M04-03/M04-05 fixtures. Cross-product association, supplier counts and scenario mutations are explicitly synthetic layout examples, not current business facts. VM source functions only; no real Vue/API/DB/RBAC or production. No market-demand chart, risk-category results or automatic post-queue score/count mutation.",
  };
}
