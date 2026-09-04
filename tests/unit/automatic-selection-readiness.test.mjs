import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile("apps/web/src/automatic-selection-readiness.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  loadAutomaticSelectionReadiness,
  resolveAutomaticSelectionReadiness,
  unavailableAutomaticSelectionReadiness,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const activeScoreRule = {
  status: "active",
  dimensions: [
    { code: "market_demand", weight: 30, evidence_group: "market" },
    { code: "competition", weight: 20, evidence_group: "competition" },
    { code: "profit", weight: 30, evidence_group: "cost" },
    { code: "risk", weight: 20, evidence_group: "other" },
  ],
};

test("automatic selection readiness exposes every missing initial rule without defaults", () => {
  const result = resolveAutomaticSelectionReadiness([], [], []);
  assert.equal(result.available, true);
  assert.equal(result.readyCount, 0);
  assert.equal(result.allReady, false);
  assert.deepEqual(
    result.steps.map((step) => [step.code, step.ready]),
    [
      ["score", false],
      ["market", false],
      ["competition", false],
      ["cost", false],
      ["risk", false],
    ],
  );
  assert.equal(result.steps[0].route, "/opportunities/scoring-rules");
  assert.equal(result.steps[3].route, "/sourcing/cost-rules");
});

test("automatic selection readiness requires active score cost and competitor rules", () => {
  const incomplete = resolveAutomaticSelectionReadiness(
    [activeScoreRule],
    [{ status: "draft" }],
    [{ status: "disabled" }],
  );
  assert.equal(incomplete.readyCount, 3);
  assert.equal(incomplete.steps.find((step) => step.code === "competition")?.ready, false);
  assert.equal(incomplete.steps.find((step) => step.code === "cost")?.ready, false);

  const complete = resolveAutomaticSelectionReadiness(
    [activeScoreRule],
    [{ status: "active" }],
    [{ status: "enabled" }],
  );
  assert.equal(complete.readyCount, 5);
  assert.equal(complete.allReady, true);
});

test("automatic selection readiness reports an independent read failure", () => {
  assert.deepEqual(unavailableAutomaticSelectionReadiness(), {
    available: false,
    readyCount: 0,
    allReady: false,
    steps: [],
  });
});

test("automatic selection readiness loads all three rule surfaces and fails closed", async () => {
  const paths = [];
  const loaded = await loadAutomaticSelectionReadiness(async (path) => {
    paths.push(path);
    if (path === "/opportunity-score-rules") return { data: [activeScoreRule] };
    if (path === "/cost-rules") return { data: [{ status: "active" }] };
    return { data: [{ status: "enabled" }] };
  });
  assert.deepEqual(paths.sort(), [
    "/competitor-monitor-rules",
    "/cost-rules",
    "/opportunity-score-rules",
  ]);
  assert.equal(loaded.allReady, true);

  const unavailable = await loadAutomaticSelectionReadiness(async (path) => {
    if (path === "/cost-rules") throw new Error("cost rules unavailable");
    return { data: [] };
  });
  assert.equal(unavailable.available, false);
});
