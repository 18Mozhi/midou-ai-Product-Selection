import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  completionEvidenceReusable,
  expectedAtomicTaskIds,
  runAll,
  runModule,
  runPhase,
} from "../../scripts/lib/verification-engine.mjs";

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), "scoutops-completion-state-"));
  try {
    await mkdir(join(root, "verification", "modules"), { recursive: true });
    await mkdir(join(root, "plans"), { recursive: true });
    await writeFile(
      join(root, "verification", "state.json"),
      JSON.stringify({ completedModules: [], completedPhases: [] }),
    );
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function registry(moduleId, phaseId = "P00") {
  return {
    moduleId,
    phaseId,
    dependencies: [],
    atomicTasks: expectedAtomicTaskIds(moduleId).map((id) => ({ id, evidence: id })),
    commands: ['node -e "process.exit(0)"'],
  };
}

test("M00-07 module and phase success persist completion evidence", async () => {
  await withWorkspace(async (root) => {
    const moduleId = "M00-01";
    await writeFile(
      join(root, "verification", "modules", `${moduleId}.json`),
      JSON.stringify(registry(moduleId)),
    );
    await writeFile(join(root, "plans", "phase-00-test.md"), "# P00\n### M00-01 原子任务索引\n");

    await runModule(moduleId, { root, env: { VERIFY_REPORT_DIR: ".artifacts/verification" } });
    const moduleState = JSON.parse(
      await readFile(join(root, "verification", "state.json"), "utf8"),
    );
    assert.deepEqual(moduleState.completedModules, [moduleId]);
    assert.equal(moduleState.moduleEvidence[moduleId].evidenceSummary.status, "passed");
    assert.equal(moduleState.moduleEvidence[moduleId].evidenceSummary.atomicTaskCount, 17);
    assert.ok(
      moduleState.moduleEvidence[moduleId].worktreeFingerprint === null ||
        typeof moduleState.moduleEvidence[moduleId].worktreeFingerprint === "string",
    );

    const phase = await runPhase("P00", {
      root,
      env: { VERIFY_REPORT_DIR: ".artifacts/verification" },
    });
    assert.deepEqual(phase.reused_modules, []);
    assert.deepEqual(phase.modules, [moduleId]);
    const phaseState = JSON.parse(await readFile(join(root, "verification", "state.json"), "utf8"));
    assert.deepEqual(phaseState.completedPhases, ["P00"]);
    assert.equal(phaseState.phaseEvidence.P00.evidenceSummary.status, "passed");
  });
});

test("M00-07 full runner rejects legacy completed arrays without bound evidence", async () => {
  await withWorkspace(async (root) => {
    const completedPhases = Array.from(
      { length: 8 },
      (_, index) => `P${String(index).padStart(2, "0")}`,
    );
    const moduleId = "M08-01";
    await writeFile(
      join(root, "verification", "state.json"),
      JSON.stringify({ completedModules: [moduleId], completedPhases }),
    );
    await writeFile(join(root, "plans", "phase-08-test.md"), "# P08\n### M08-01 原子任务索引\n");
    await writeFile(
      join(root, "verification", "modules", `${moduleId}.json`),
      JSON.stringify(registry(moduleId, "P08")),
    );

    await assert.rejects(
      runAll({ root, env: { VERIFY_REPORT_DIR: ".artifacts/verification" } }),
      (error) => error.code === "phase_plan_missing",
    );
  });
});

test("M00-07 completion reuse requires the same commit and worktree fingerprint", () => {
  const identity = {
    commitSha: "a".repeat(40),
    worktreeDirty: true,
    worktreeFingerprint: "b".repeat(64),
  };
  const evidence = {
    ...identity,
    completedAt: "2026-08-21T00:00:00.000Z",
    evidenceSummary: { status: "passed" },
  };
  assert.equal(completionEvidenceReusable(evidence, identity), true);
  assert.equal(
    completionEvidenceReusable({ ...evidence, commitSha: "c".repeat(40) }, identity),
    false,
  );
  assert.equal(
    completionEvidenceReusable({ ...evidence, worktreeFingerprint: "d".repeat(64) }, identity),
    false,
  );
  assert.equal(completionEvidenceReusable({ commitSha: identity.commitSha }, identity), false);
});
