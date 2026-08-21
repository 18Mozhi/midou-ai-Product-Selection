import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expectedAtomicTaskIds,
  loadModuleRegistry,
  modulesForPhase,
  runAll,
  runModule,
  runPhase,
  VerificationError,
} from "../../scripts/lib/verification-engine.mjs";

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), "scoutops-m00-07-"));
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

function registry(moduleId, commands, dependencies = []) {
  return {
    moduleId,
    phaseId: "P00",
    dependencies,
    atomicTasks: expectedAtomicTaskIds(moduleId).map((id) => ({ id, evidence: id })),
    commands,
  };
}

test("M00-07.A14/M00-07.A16 nonzero command fails and writes a redacted report", async () => {
  await withWorkspace(async (root) => {
    const moduleId = "M00-99";
    await writeFile(
      join(root, "verification", "modules", `${moduleId}.json`),
      JSON.stringify(
        registry(moduleId, ["node -e \"console.error('password=hunter2'); process.exit(7)\""]),
      ),
    );
    await assert.rejects(
      () =>
        runModule(moduleId, {
          root,
          env: { VERIFY_REPORT_DIR: ".artifacts/verification", VERIFY_COMMAND_TIMEOUT_MS: "10000" },
        }),
      (error) => error instanceof VerificationError && error.code === "command_failed",
    );
    const report = await readFile(
      join(root, ".artifacts", "verification", "module-M00-99.json"),
      "utf8",
    );
    assert.match(report, /\[REDACTED\]/);
    assert.doesNotMatch(report, /hunter2/);
    assert.match(report, /"status": "failed"/);
  });
});

test("M00-07.A05 dependency absence is blocked before command execution", async () => {
  await withWorkspace(async (root) => {
    const moduleId = "M00-98";
    await writeFile(
      join(root, "verification", "modules", `${moduleId}.json`),
      JSON.stringify(registry(moduleId, ["node --version"], ["M00-01"])),
    );
    await assert.rejects(
      () => runModule(moduleId, { root, env: { VERIFY_REPORT_DIR: ".artifacts/verification" } }),
      (error) => error.code === "dependency_blocked" && error.status === "blocked",
    );
  });
});

test("M00-07.A05 phase runner reads every module in plan order", async () => {
  await withWorkspace(async (root) => {
    await writeFile(
      join(root, "plans", "phase-00-foundation.md"),
      ["# P00", "### M00-01 原子任务索引", "### M00-07 原子任务索引"].join("\n"),
    );
    assert.deepEqual(await modulesForPhase("P00", root), ["M00-01", "M00-07"]);
  });
});

test("M00-07.A16 missing registry is a controlled blocked result", async () => {
  await withWorkspace(async (root) => {
    await assert.rejects(
      () => loadModuleRegistry("M00-97", root),
      (error) => error.code === "registry_missing" && error.status === "blocked",
    );
  });
});

test("M00-07.A16 command exit 2 propagates as blocked, not failed", async () => {
  await withWorkspace(async (root) => {
    const moduleId = "M00-96";
    await writeFile(
      join(root, "verification", "modules", `${moduleId}.json`),
      JSON.stringify(registry(moduleId, ['node -e "process.exit(2)"'])),
    );
    await assert.rejects(
      () => runModule(moduleId, { root, env: { VERIFY_REPORT_DIR: ".artifacts/verification" } }),
      (error) => error.code === "command_blocked" && error.status === "blocked",
    );
  });
});

test("M00-07.A16 phase and all runners persist aggregate reports", async () => {
  await withWorkspace(async (root) => {
    const identity = {
      commitSha: "a".repeat(40),
      worktreeDirty: true,
      worktreeFingerprint: "b".repeat(64),
    };
    await writeFile(
      join(root, "verification", "state.json"),
      JSON.stringify({
        completedModules: [],
        completedPhases: [],
        moduleEvidence: {},
        phaseEvidence: {},
      }),
    );
    for (let index = 0; index <= 8; index += 1) {
      const phaseId = `P${String(index).padStart(2, "0")}`;
      const moduleId = `M${String(index).padStart(2, "0")}-01`;
      await writeFile(
        join(root, "plans", `phase-${String(index).padStart(2, "0")}-test.md`),
        `# ${phaseId}\n### ${moduleId} 原子任务索引\n`,
      );
      await writeFile(
        join(root, "verification", "modules", `${moduleId}.json`),
        JSON.stringify({
          ...registry(moduleId, ['node -e "process.exit(0)"']),
          phaseId,
        }),
      );
    }

    await runPhase("P00", {
      root,
      identity,
      env: { VERIFY_REPORT_DIR: ".artifacts/verification" },
    });
    assert.match(
      await readFile(join(root, ".artifacts", "verification", "phase-P00.json"), "utf8"),
      /"status": "passed"/,
    );

    await runAll({
      root,
      identity,
      env: { VERIFY_REPORT_DIR: ".artifacts/verification" },
    });
    const allReport = await readFile(
      join(root, ".artifacts", "verification", "all-P00-P08.json"),
      "utf8",
    );
    assert.match(allReport, /"phases": \[/);
    assert.match(allReport, /"P08"/);
  });
});
