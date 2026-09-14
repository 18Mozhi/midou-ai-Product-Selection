import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as vue from "vue";
import { renderToString } from "vue/server-renderer";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { parse as parseHTML } from "@vue/compiler-dom";

const filename = "apps/web/src/components/SelectionJourney.vue";
const source = await readFile(filename, "utf8");
const compiled = compileTemplate({
  source: parse(source).descriptor.template.content,
  filename,
  id: "journey-radio-semantics",
});
assert.deepEqual(compiled.errors, []);
const box = {
  exports: {},
  require(name) {
    assert.equal(name, "vue");
    return vue;
  },
};
vm.runInNewContext(
  ts.transpileModule(compiled.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  box,
);

function elements(node) {
  return [...(node.type === 1 ? [node] : []), ...(node.children ?? []).flatMap(elements)];
}
const attr = (node, name) => node.props.find((p) => p.name === name)?.value?.content;
const has = (node, name) => node.props.some((p) => p.name === name);
async function render({ started = true, qualified = false } = {}) {
  // Actual template, synthetic presentation state: no HTTP, lifecycle or storage claims.
  const candidates = [
    {
      raw_evidence_id: "first",
      title: "候选一",
      publisher: "测试来源",
      canonical_url: "https://example.com/one",
      observed_at: "2026-09-01T00:00:00Z",
    },
    {
      raw_evidence_id: "second",
      title: "候选二",
      publisher: "测试来源",
      canonical_url: "https://example.com/two",
      observed_at: "2026-09-01T00:00:00Z",
    },
  ];
  const app = vue.createSSRApp({
    render: box.exports.render,
    setup: () => ({
      reading: false,
      busy: false,
      currentPhase: started ? 3 : 1,
      state: "ready",
      journey: started
        ? {
            state: "result_ready",
            timeline: [],
            input_kind: "keyword",
            input_value: "测试线索",
            provider_code: "fixture",
            available_result_count: 2,
            request_id: "fixture",
          }
        : null,
      form: { input_kind: "keyword", input_value: "" },
      decision: { action: "observe", reason: "" },
      stateTitle: "首个可验证结果已到达",
      seconds: 1,
      terminal: true,
      candidates,
      selectedResultId: "first",
      selectedCandidate: candidates[0],
      canAdopt: qualified,
      passedGateCount: qualified ? 5 : 0,
      qualityGateLabels: [
        ["score", "评分"],
        ["market", "市场"],
        ["competition", "竞争"],
        ["cost", "成本"],
        ["risk", "风险"],
      ],
      adoptionHint: () => "测试候选质量门说明",
      message: "",
      requestId: "fixture",
      create() {},
      decide() {},
      reset() {},
    }),
  });
  app.component("RouterLink", {
    props: ["to"],
    setup:
      (props, { slots }) =>
      () =>
        vue.h("a", { href: props.to }, slots.default?.()),
  });
  app.component("UiStatePanel", {
    render() {
      throw new Error("Unexpected error-state branch");
    },
  });
  return elements(parseHTML(await renderToString(app)));
}

test("P16 input kind retains its existing named native radio group", async () => {
  const nodes = await render({ started: false });
  const group = nodes.find((n) => attr(n, "role") === "radiogroup");
  assert.equal(attr(group, "aria-label"), "输入类型");
  assert.equal(
    elements(group).filter((n) => n.tag === "input" && attr(n, "type") === "radio").length,
    3,
  );
});

test("P16 candidates and decisions expose separate named native radio groups", async () => {
  const nodes = await render();
  const groups = nodes.filter((n) => attr(n, "role") === "radiogroup");
  assert.deepEqual(
    groups.map((n) => attr(n, "aria-label")),
    ["候选结果", "决策方式"],
  );
  for (const [index, name, count] of [
    [0, "selection-candidate", 2],
    [1, "decision", 3],
  ]) {
    const radios = elements(groups[index]).filter(
      (n) => n.tag === "input" && attr(n, "type") === "radio",
    );
    assert.equal(radios.length, count);
    assert.ok(radios.every((n) => attr(n, "name") === name));
    assert.ok(
      radios.every((n) => !has(n, "tabindex")),
      "native radio keyboard behavior is not overridden",
    );
  }
});

test("P16 grouping retains disabled adoption, selected observation and source link attributes", async () => {
  for (const qualified of [false, true]) {
    const nodes = await render({ qualified });
    const radios = nodes.filter((n) => n.tag === "input" && attr(n, "name") === "decision");
    assert.equal(
      has(
        radios.find((n) => attr(n, "value") === "adopt"),
        "disabled",
      ),
      !qualified,
    );
    assert.equal(
      has(
        radios.find((n) => attr(n, "value") === "observe"),
        "checked",
      ),
      true,
    );
    const links = nodes.filter((n) => n.tag === "a" && attr(n, "target") === "_blank");
    assert.equal(links.length, 2);
    assert.ok(links.every((n) => attr(n, "rel") === "noopener noreferrer"));
  }
});
