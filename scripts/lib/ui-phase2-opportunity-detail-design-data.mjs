import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOpportunityDetailDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  const main = (await read("apps/web/src/components/OpportunityWorkspace.vue"))
    .split('<script setup lang="ts">')[1]
    .split("</script>")[0];
  const fixture = await read("tests/e2e/ui-phase2-opportunity-contracts.spec.ts"),
    older = await read("tests/e2e/m04-02-opportunities.spec.ts"),
    presentation = await read("apps/web/src/components/opportunity-workspace-presentation.ts"),
    gates = await read("apps/web/src/components/opportunity-decision-presentation.ts"),
    backend = await read("apps/api/src/opportunity-service.ts"),
    panel = await read("apps/web/src/components/OpportunityDecisionPanel.vue"),
    evidencePanel = await read("apps/web/src/components/OpportunityEvidencePanel.vue");
  function extract(text, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true),
      matches = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      if (kind === "class" && ts.isClassDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  function run(code, bindings = {}) {
    const context = { exports: {}, computed: (fn) => ({ value: fn() }), ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const vars = (text, names) => names.map((n) => `const ${n}=${extract(text, n)};`).join("\n");
  const sample = plain(
    run(
      `${vars(fixture, ["id", "opportunityId", "memberId", "at"])}\n${extract(fixture, "detailFixture", "function")}\nexport const value=detailFixture();`,
    ).value,
  );
  const historical = plain(
    run(
      `${vars(older, ["opportunityId", "topicId", "base", "recommendedBase", "evidence"])}\nexport {recommendedBase,evidence};`,
    ),
  );
  const labels = plain(
    run(
      `${vars(presentation, ["opportunityLabels", "opportunityPrimaryTabs", "opportunitySecondaryTabs"])}\nexport {opportunityLabels,opportunityPrimaryTabs,opportunitySecondaryTabs};`,
    ),
  );
  const gateFns = run(
    `${vars(gates, ["opportunityQualityGateLabels", "opportunityQualityGateKeys", "countPassedOpportunityQualityGates", "nextOpportunityQualityGateLabel", "opportunityDecisionCopy"])}\nexport {opportunityQualityGateLabels,countPassedOpportunityQualityGates,nextOpportunityQualityGateLabel,opportunityDecisionCopy};`,
  );
  for (const stage of ["not_eligible", "rule_candidate", "recommended"])
    for (const passed of [false, true]) {
      const result = run(`export const value=${extract(panel, "canAdopt")};`, {
        selectionStage: { value: stage },
        qualityGates: { value: { all_passed: passed } },
      }).value.value;
      assert.equal(result, stage === "recommended" && passed);
    }
  assert.equal(gateFns.countPassedOpportunityQualityGates(sample.quality_gates), 0);
  assert.equal(gateFns.nextOpportunityQualityGateLabel(sample.quality_gates), "评分");
  assert.equal(
    gateFns.countPassedOpportunityQualityGates(historical.recommendedBase.quality_gates),
    5,
  );
  const decisionIntents = {},
    reason = "  核对来源后继续验证  ";
  for (const action of ["adopt", "observe", "reject"]) {
    for (const succeeds of [false, true]) {
      const decisionReason = { value: reason },
        showDecision = { value: true };
      let reads = 0;
      await run(`${extract(main, "decide", "function")}\nexport const result=decide();`, {
        detail: { value: sample },
        decisionReason,
        decisionAction: { value: action },
        showDecision,
        message: { value: "" },
        write: async (p, body) => {
          decisionIntents[action] = { method: "POST", path: p, body: plain(body) };
          return succeeds ? {} : null;
        },
        load: async () => {
          reads++;
        },
      }).result;
      assert.equal(showDecision.value, !succeeds);
      assert.equal(reads, succeeds ? 1 : 0);
      assert.equal(decisionReason.value, reason);
    }
  }
  const decisionReason = { value: reason },
    decisionAction = { value: "adopt" },
    showDecision = { value: false };
  run(`${extract(main, "startDecision", "function")}\nstartDecision("reject");`, {
    decisionReason,
    decisionAction,
    showDecision,
  });
  assert.equal(decisionReason.value, "");
  assert.equal(decisionAction.value, "reject");
  const validator = run(
    `${extract(backend, "OpportunityServiceError", "class")}\n${vars(backend, ["bounded"])}\n${extract(backend, "validateDecisionInput", "function")}\nexport {validateDecisionInput};`,
  ).validateDecisionInput;
  assert.equal(validator(decisionIntents.observe.body).reason, reason.trim());
  for (const invalid of ["", "   ", "字".repeat(1001)])
    assert.throws(() => validator({ ...decisionIntents.observe.body, reason: invalid }));
  const taskId = "00000000-0000-4000-8000-000000000625",
    taskIntents = [],
    taskNavigation = [];
  for (const created of [false, true]) {
    await run(
      `${extract(main, "createEvidenceTask", "function")}\nexport const result=createEvidenceTask();`,
      {
        detail: { value: sample },
        message: { value: "" },
        route: { fullPath: `/opportunities/${sample.id}?tab=evidence&from=%2Fopportunities` },
        write: async (p, body) => {
          taskIntents.push({ method: "POST", path: p, body: plain(body) });
          return { created, task_id: taskId };
        },
        load: async () => {},
        router: { push: async (v) => taskNavigation.push(plain(v)) },
      },
    ).result;
  }
  const visibleCount = { value: 20 };
  const more = () =>
    run(`${extract(evidencePanel, "showMore", "function")}\nshowMore();`, {
      props: { evidence: Array(41) },
      visibleCount,
      EVIDENCE_BATCH_SIZE: 20,
    });
  more();
  assert.equal(visibleCount.value, 40);
  more();
  assert.equal(visibleCount.value, 41);
  run(`${extract(evidencePanel, "collapse", "function")}\ncollapse();`, {
    visibleCount,
    EVIDENCE_BATCH_SIZE: 20,
  });
  assert.equal(visibleCount.value, 20);
  assert.ok(
    evidencePanel.includes(
      "watch([() => props.opportunityId, () => props.evidence], () => collapse())",
    ),
  );
  const routes = run(
    `${vars(presentation, ["opportunityPrimaryTabs", "opportunitySecondaryTabs", "opportunityTabs", "safeOpportunityReturnPath", "resolveOpportunityTab"])}\nexport {safeOpportunityReturnPath,resolveOpportunityTab};`,
  );
  assert.equal(routes.safeOpportunityReturnPath("//example.test"), "/opportunities");
  assert.equal(routes.resolveOpportunityTab("unknown"), "overview");
  const titleId = 'id="opportunity-decision-title"';
  assert.ok(
    panel.includes(titleId) &&
      (await read("apps/web/src/components/OpportunityWorkspaceDialogs.vue")).includes(titleId),
  );
  const message = { value: "" };
  await run(`${extract(main, "write", "function")}\nexport const result=write("/isolated",{});`, {
    busy: { value: false },
    message,
    requestId: { value: "" },
    ApiClientError: class extends Error {},
    request: async () => {
      throw new Error("isolated transport failure");
    },
  }).result;
  assert.equal(message.value, "依赖暂不可用，未写入任何状态。");
  return {
    version: "OPPORTUNITY-DETAIL-C-core-r1",
    sample,
    historical,
    labels,
    gateLabels: plain(gateFns.opportunityQualityGateLabels),
    decisionIntents,
    taskIntent: taskIntents[0],
    taskNavigation: taskNavigation[0],
    taskId,
    knownGaps: { duplicateTitleId: true, genericFailureCopy: message.value, sourceFixed: false },
    boundary:
      "Historical isolated fixtures and explicitly synthetic layout states. Source functions executed in VM; no actual Vue/HTTP/database/RBAC/production acceptance. Core overview/evidence/decisions only, seven remaining sections and AI dialogs are pending.",
  };
}
