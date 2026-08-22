import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkspaceBuildPlan, topologicalLevels } from "../../scripts/build-workspaces.mjs";

test("workspace build graph orders every internal dependency before its consumer", async () => {
  const plan = await loadWorkspaceBuildPlan();
  const levelByName = new Map();
  plan.levels.forEach((level, index) => {
    for (const node of level) levelByName.set(node.name, index);
  });
  assert.equal(levelByName.size, plan.nodes.length);
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(
        levelByName.get(dependency) < levelByName.get(node.name),
        `${dependency} must build before ${node.name}`,
      );
  assert.ok(
    levelByName.get("@scoutops/provider-adapters") < levelByName.get("@scoutops/provider-sources"),
  );
  assert.ok(levelByName.get("@scoutops/config") < levelByName.get("@scoutops/database"));
  assert.ok(levelByName.get("@scoutops/config") < levelByName.get("@scoutops/web"));
  assert.ok(levelByName.get("@scoutops/contracts") < levelByName.get("@scoutops/api"));
  assert.ok(levelByName.get("@scoutops/contracts") < levelByName.get("@scoutops/worker"));
});

test("workspace build graph fails closed on dependency cycles", () => {
  assert.throws(
    () =>
      topologicalLevels([
        { name: "a", script: "build:a", dependencies: ["b"] },
        { name: "b", script: "build:b", dependencies: ["a"] },
      ]),
    /workspace_dependency_cycle/,
  );
});
