import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";
import { verifyCostRulesSource } from "./verify-ui-phase2-cost-rules-source.mjs";

// Source setup only: probes read/selection ownership, never renders or accesses a real API.
export async function verifyCostRulesReview() {
  const existing = await verifyCostRulesSource();
  const source = await readFile("apps/web/src/components/CostRuleConsole.vue", "utf8");
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
  for (const node of [...ast.statements].reverse())
    if (ts.isImportDeclaration(node)) script = script.slice(0, node.pos) + script.slice(node.end);
  const js = ts.transpileModule(
    script +
      "\nreturn {load,rules,selected,state,beginAction,submitAction,actionReason,showAction,busy,search,route};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const scopes = [];
  const checks = [];
  class ApiClientError extends Error {}
  function setup() {
    const calls = [],
      replies = [],
      route = reactive({ query: { rule: "A" } });
    const scope = effectScope();
    scopes.push(scope);
    const env = {
      computed,
      reactive,
      ref,
      watch,
      ApiClientError,
      onMounted: () => {},
      defineProps: () => ({
        apiBaseUrl: "inert",
        roles: [],
        capabilities: ["opportunity:approve"],
      }),
      useRoute: () => route,
      useRouter: () => ({
        replace: ({ query }) => {
          route.query = query;
        },
        push: () => {},
      }),
      useModalDialog: () => ({ dialogElement: ref(null), handleCancel: () => {} }),
      createApiClient: () => async (url, options) => {
        calls.push({ url, options: options && structuredClone(options) });
        assert.ok(replies.length, "unexpected isolated request " + url);
        const reply = await replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
      },
    };
    return {
      ...scope.run(() => new Function(...Object.keys(env), js)(...Object.values(env))),
      calls,
      replies,
    };
  }
  const rule = (id, revision = 7) => ({
    id,
    revision,
    name: id,
    version_code: id,
    market: "US",
    platform: "amazon",
    status: "draft",
    fee_lines: [],
    conversion_rates: [],
    automatic_scope: null,
    effective_from: "2026-09-10",
    approvals: [],
  });
  const ok = (data) => ({ data, request_id: "isolated-p22-review" });
  try {
    let s = setup();
    s.replies.push(ok([rule("A"), rule("B", 11)]));
    await s.load();
    await nextTick();
    s.beginAction("submit");
    s.actionReason.value = "核对 A 的依据";
    s.replies.push(ok([rule("B", 11)]));
    await s.load();
    await nextTick();
    assert.equal(s.showAction.value, true);
    assert.equal(s.selected.value.id, "B");
    assert.equal(s.actionReason.value, "核对 A 的依据");
    s.replies.push(new Error("isolated stop; no persistence"));
    await s.submitAction();
    assert.equal(s.calls.at(-1).url, "/cost-rules/B/actions");
    assert.deepEqual(s.calls.at(-1).options.body, {
      action: "submit",
      reason: "核对 A 的依据",
      expected_revision: 11,
    });
    checks.push(
      "UNFIXED: load replacing A with B keeps open action/reason for A, then submit reads B ID/revision; setup reachability only, not a mounted user sequence",
    );

    s = setup();
    s.replies.push(ok([rule("A"), rule("B")]));
    await s.load();
    await nextTick();
    s.search.value = "B";
    await nextTick();
    assert.equal(s.selected.value.id, "B");
    assert.equal(s.route.query.rule, "A");
    assert.equal(s.calls.length, 1);
    checks.push(
      "Actual filtered auto-selection changes selected to B but leaves rule=A query and sends no HTTP",
    );

    s = setup();
    s.replies.push(ok([rule("A"), rule("B")]));
    await s.load();
    await nextTick();
    s.route.query = { rule: "B" };
    await nextTick();
    assert.equal(s.selected.value.id, "A");
    s.replies.push(ok([rule("A"), rule("B")]));
    await s.load();
    await nextTick();
    assert.equal(s.selected.value.id, "A");
    checks.push(
      "Actual query-only change has no local watcher; load prefers existing A over query B; parent/history integration not inferred",
    );
    return { existingChecks: existing.checks.length, checks, limits: existing.limits };
  } finally {
    scopes.forEach((scope) => scope.stop());
  }
}
if (process.argv[1]?.endsWith("verify-ui-phase2-cost-rules-review.mjs"))
  console.log(JSON.stringify(await verifyCostRulesReview()));
