import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildJourneyDesignData(repo) {
  const read = async (file) =>
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n");
  const main = (await read("apps/web/src/components/SelectionJourney.vue"))
      .split('<script setup lang="ts">')[1]
      .split("</script>")[0],
    fixture = await read("tests/e2e/ui-phase2-journey-contracts.spec.ts"),
    backend = await read("apps/api/src/selection-journey-service.ts"),
    repository = await read("apps/api/src/mysql-selection-journey-repository.ts");
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
    const context = { exports: {}, reactive: (v) => v, URL, ...bindings };
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
      `${vars(fixture, ["id", "journeyId", "at"])}\n${extract(fixture, "fixture", "function")}\nexport const value=fixture();`,
    ).value,
  );
  const defaults = plain(
    run(
      `export const form=${extract(main, "form")}; export const decision=${extract(main, "decision")};`,
    ),
  );
  const validators = run(
    `${extract(backend, "SelectionJourneyError", "class")}\n${vars(backend, ["bounded", "uuid"])}\n${extract(backend, "input", "function")}\n${extract(backend, "decision", "function")}\nexport {input,decision};`,
  );
  const values = {
      keyword: " portable blender ",
      asin: "b012345678",
      product_url: "https://example.test/product",
    },
    createIntents = {},
    decisionIntents = {};
  for (const [input_kind, input_value] of Object.entries(values)) {
    const form = { input_kind, input_value };
    await run(`${extract(main, "create", "function")}\nexport const result=create();`, {
      active: true,
      busy: { value: false },
      reading: { value: false },
      stopRead() {},
      resumeId: { value: "" },
      state: { value: "ready" },
      message: { value: "" },
      requestId: { value: "" },
      form,
      request: async (p, options) => {
        createIntents[input_kind] = { path: p, method: options.method, body: plain(options.body) };
        return { data: sample, request_id: sample.request_id };
      },
      applyJourney() {},
      schedule() {},
      applyFailure: (e) => {
        throw e;
      },
    }).result;
    assert.equal(validators.input(form).inputValue, input_value.trim());
  }
  const state = { value: "error" },
    decision = { action: "observe", reason: "  核对来源后继续验证  " };
  for (const action of ["adopt", "observe", "reject"]) {
    await run(`${extract(main, "decide", "function")}\nexport const result=decide();`, {
      active: true,
      busy: { value: false },
      reading: { value: false },
      journey: { value: sample },
      state,
      message: { value: "" },
      requestId: { value: "" },
      selectedResultId: { value: sample.results[1].raw_evidence_id },
      decision: { ...decision, action },
      stopRead() {},
      stop() {},
      applyJourney() {},
      applyFailure: (e) => {
        throw e;
      },
      request: async (p, options) => {
        decisionIntents[action] = { path: p, method: options.method, body: plain(options.body) };
        return { data: { ...sample, state: "decided" }, request_id: sample.request_id };
      },
    }).result;
  }
  assert.equal(state.value, "error");
  const resetDecision = { action: "reject", reason: "旧旅程原因" };
  run(`${extract(main, "reset", "function")}\nreset();`, {
    busy: { value: false },
    stopRead() {},
    resumeId: { value: sample.id },
    journey: { value: sample },
    state: { value: "error" },
    message: { value: "error" },
    form: { input_kind: "asin", input_value: "b012345678" },
    selectedResultId: { value: "selected" },
    localStorage: { removeItem() {} },
    progressStorageKey: "scoutops.selection-journey.active-id",
    decision: resetDecision,
  });
  assert.equal(resetDecision.reason, "旧旅程原因");
  const errors = [];
  for (const input_value of [
    "http://example.test/product",
    "https://example.test/product#fragment",
    "https://user@example.test/product",
  ]) {
    try {
      validators.input({ input_kind: "product_url", input_value });
      assert.fail("Expected URL rejection");
    } catch (e) {
      assert.equal(e.code, "selection_product_url_invalid");
      errors.push({ input_value, code: e.code, status: e.statusCode, hint: e.actionHint });
    }
  }
  let selected = { value: "" },
    saved = null;
  const apply = (next) =>
    run(`${extract(main, "applyJourney", "function")}\napplyJourney(next);`, {
      next,
      journey: { value: null },
      selectedResultId: selected,
      progressStorageKey: "scoutops.selection-journey.active-id",
      localStorage: {
        setItem: (_, value) => {
          saved = value;
        },
        removeItem: () => {
          saved = null;
        },
      },
    });
  apply(sample);
  assert.equal(selected.value, "");
  assert.equal(saved, sample.id);
  apply({ ...sample, results: [sample.results[1]] });
  assert.equal(selected.value, sample.results[1].raw_evidence_id);
  apply({ ...sample, results: [], first_result: sample.results[0] });
  assert.equal(selected.value, sample.results[0].raw_evidence_id);
  apply({ ...sample, state: "decided" });
  assert.equal(saved, null);
  const taskTerminal = plain(
    run(`export const value=[...${extract(repository, "terminal")}];`).value,
  );
  return {
    version: "JOURNEY-C-r1",
    sample,
    defaults,
    values,
    createIntents,
    decisionIntents,
    taskTerminal,
    urlErrors: errors,
    knownGaps: {
      decideSuccessState: state.value,
      resetReason: resetDecision.reason,
      adoption:
        "Current repository directly writes adopted; P18 five-gate contract conflicts. Awaiting user decision; prototype adoption is explicitly unavailable pending that decision.",
      sourceFixed: false,
    },
    boundary:
      "Historical isolated UI2-J fixture. Source functions executed in VM; no actual Vue, backend calls, storage, database or production acceptance.",
  };
}
