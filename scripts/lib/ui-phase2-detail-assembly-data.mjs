import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { buildReviewDesignData } from "./ui-phase2-review-design-data.mjs";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildDetailAssemblyData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  const prior = await buildReviewDesignData(repo);
  const source = await read("apps/web/src/components/OpportunityWorkspace.vue");
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("workspace.ts", script, ts.ScriptTarget.Latest, true);
  function fn(name) {
    const matches = ast.statements.filter(
      (n) => ts.isFunctionDeclaration(n) && n.name.text === name,
    );
    assert.equal(matches.length, 1, name);
    return matches[0].getText(ast);
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
  const presentation = run(
    await read("apps/web/src/components/opportunity-workspace-presentation.ts"),
  );
  const tabs = plain(presentation.opportunityTabs);
  assert.equal(tabs.length, 10);
  const routeCases = [];
  for (const [key] of tabs) {
    let query;
    const tab = { value: "overview" };
    await run(`${fn("setTab")} export const result=setTab(next);`, {
      tab,
      next: key,
      route: { query: { from: "/tasks?view=mine", retained: "yes", tab: "ai" } },
      router: {
        replace: async (value) => {
          query = plain(value.query);
        },
      },
    }).result;
    assert.equal(tab.value, key);
    assert.equal(query.from, "/tasks?view=mine");
    assert.equal(query.retained, "yes");
    assert.equal(query.tab, key === "overview" ? undefined : key);
    routeCases.push({ tab: key, query });
  }
  for (const invalid of ["not-a-tab", ["profit"], null])
    assert.equal(presentation.resolveOpportunityTab(invalid), "overview");
  assert.equal(presentation.safeOpportunityReturnPath("//outside.invalid"), "/opportunities");
  const decisions = {};
  const reason = "  已核对当前样例，保留人工判断依据  ";
  for (const action of ["observe", "reject"]) {
    let reads = 0;
    await run(`${fn("decide")} export const result=decide();`, {
      detail: { value: prior.facts.detail },
      decisionReason: { value: reason },
      decisionAction: { value: action },
      showDecision: { value: true },
      message: { value: "" },
      write: async (p, body) => {
        decisions[action] = plain({ method: "POST", path: p, body });
        return {};
      },
      load: async () => {
        reads++;
      },
    }).result;
    assert.equal(reads, 1);
    assert.equal(decisions[action].body.expected_version, 1);
    assert.equal(decisions[action].body.reason, reason);
  }
  const fixture = await read("tests/e2e/m04-07-ai-analysis.spec.ts");
  const fixtureAst = ts.createSourceFile("fixture.ts", fixture, ts.ScriptTarget.Latest, true);
  const objects = [],
    navigationObjects = [];
  function visit(n) {
    if (
      ts.isObjectLiteralExpression(n) &&
      ["roles", "capabilities", "guard_reason"].every((key) =>
        n.properties.some((p) => p.name?.getText(fixtureAst) === key),
      )
    )
      navigationObjects.push(n.getText(fixtureAst));
    if (
      ts.isObjectLiteralExpression(n) &&
      ["latest_run", "current_inputs"].every((key) =>
        n.properties.some((p) => p.name?.getText(fixtureAst) === key),
      )
    )
      objects.push(n.getText(fixtureAst));
    ts.forEachChild(n, visit);
  }
  visit(fixtureAst);
  assert.equal(objects.length, 1);
  assert.equal(navigationObjects.length, 1);
  const capabilities = plain(run(`export const value=${navigationObjects[0]};`).value.capabilities);
  assert.deepEqual(capabilities, ["task:read", "opportunity:read", "opportunity:decide"]);
  const profit = plain(run(`export const value=${objects[0]};`).value);
  assert.deepEqual(profit, { latest_run: null, current_inputs: [] });
  assert.equal(prior.facts.detail.id, "00000000-0000-4000-8000-000000000701");
  assert.equal(prior.facts.detail.evidence_count, 1);
  assert.equal(prior.facts.detail.evidence.length, 0);
  assert.equal(Object.hasOwn(prior.facts.detail, "lineage"), false);
  assert.equal(Object.hasOwn(prior.facts.detail, "operating_feedback"), false);
  return {
    version: "DETAIL-ASSEMBLY-C-r1",
    fixedNow: prior.fixedNow,
    facts: prior.facts,
    profit,
    tabs,
    routeCases,
    decisions,
    reason,
    reviewIntents: prior.intents,
    reviewReason: prior.reason,
    defaults: prior.defaults,
    feedbackExample: prior.feedbackForm,
    feedbackIntent: prior.feedbackIntent,
    capabilities,
    boundary:
      "One unchanged M04-07 historical opportunity and its own AI/profit responses. No data borrowed from the other three P18 fixtures. Missing lineage/feedback is not an empty response; evidence summary 1 and returned rows 0 remain distinct. Drafts, delays and failure states are isolated proposals, not real Vue/HTTP/RBAC or production acceptance.",
  };
}
