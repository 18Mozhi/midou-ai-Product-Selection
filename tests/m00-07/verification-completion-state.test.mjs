import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  expectedAtomicTaskIds,
  runAll,
  runModule,
  runPhase,
} from '../../scripts/lib/verification-engine.mjs';

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), 'scoutops-completion-state-'));
  try {
    await mkdir(join(root, 'verification', 'modules'), { recursive: true });
    await mkdir(join(root, 'plans'), { recursive: true });
    await writeFile(join(root, 'verification', 'state.json'), JSON.stringify({ completedModules: [], completedPhases: [] }));
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function registry(moduleId, phaseId = 'P00') {
  return {
    moduleId,
    phaseId,
    dependencies: [],
    atomicTasks: expectedAtomicTaskIds(moduleId).map((id) => ({ id, evidence: id })),
    commands: ['node -e "process.exit(0)"'],
  };
}

test('M00-07 module and phase success persist completion and reuse completed modules', async () => {
  await withWorkspace(async (root) => {
    const moduleId = 'M00-01';
    await writeFile(join(root, 'verification', 'modules', `${moduleId}.json`), JSON.stringify(registry(moduleId)));
    await writeFile(join(root, 'plans', 'phase-00-test.md'), '# P00\n### M00-01 原子任务索引\n');

    await runModule(moduleId, { root, env: { VERIFY_REPORT_DIR: '.artifacts/verification' } });
    assert.deepEqual(JSON.parse(await readFile(join(root, 'verification', 'state.json'), 'utf8')).completedModules, [moduleId]);

    const phase = await runPhase('P00', { root, env: { VERIFY_REPORT_DIR: '.artifacts/verification' } });
    assert.deepEqual(phase.reused_modules, [moduleId]);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'verification', 'state.json'), 'utf8')).completedPhases, ['P00']);
  });
});

test('M00-07 full runner reuses completed phases and persists the final phase', async () => {
  await withWorkspace(async (root) => {
    const completedPhases = Array.from({ length: 8 }, (_, index) => `P${String(index).padStart(2, '0')}`);
    const moduleId = 'M08-01';
    await writeFile(join(root, 'verification', 'state.json'), JSON.stringify({ completedModules: [moduleId], completedPhases }));
    await writeFile(join(root, 'plans', 'phase-08-test.md'), '# P08\n### M08-01 原子任务索引\n');
    await writeFile(join(root, 'verification', 'modules', `${moduleId}.json`), JSON.stringify(registry(moduleId, 'P08')));

    const report = await runAll({ root, env: { VERIFY_REPORT_DIR: '.artifacts/verification' } });
    assert.deepEqual(report.reused_phases, completedPhases);
    assert.deepEqual(report.phases, ['P08']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'verification', 'state.json'), 'utf8')).completedPhases, [...completedPhases, 'P08']);
  });
});
