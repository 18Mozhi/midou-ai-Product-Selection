import { randomUUID } from 'node:crypto';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const matrixPath = resolve(root, 'verification/release-matrix.json');
const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
const runId = randomUUID();
const traceId = runId;

function fail(message) {
  console.error(JSON.stringify({ module_id: 'M07-01', status: 'failed', message, run_id: runId, trace_id: traceId }));
  process.exit(1);
}

async function filesUnder(directory, suffix) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesUnder(path, suffix));
    else if (entry.name.endsWith(suffix)) found.push(relative(root, path).replaceAll('\\', '/'));
  }
  return found.sort();
}

async function validate() {
  if (matrix.schemaVersion !== 1 || matrix.moduleId !== 'M07-01') fail('matrix schema or module id is invalid');
  const dimensions = ['roleScope', 'sourceCollection', 'taskQueue', 'dataQuality', 'mobileVisual', 'performance', 'securityFailClosed'];
  for (const name of dimensions) if (!Array.isArray(matrix.dimensions[name]) || matrix.dimensions[name].length === 0) fail(`dimension ${name} is empty`);
  const targets = { newMemberJourneyMs: 180000, taskCreateP95Ms: 3000, queuedVisibilityMs: 15000, firstOutcomeP95Ms: 180000, lcpMs: 2500, inpMs: 200, cls: 0.1, coreReadP95Ms: 300, coreWriteP95Ms: 600 };
  for (const [name, value] of Object.entries(targets)) if (matrix.performanceTargets[name] !== value) fail(`performance target ${name} drifted`);
  for (const path of matrix.requiredEvidence) await access(resolve(root, path));
  const expected = Object.values(matrix.browserGroups).flat().sort();
  if (new Set(expected).size !== expected.length) fail('browser matrix contains duplicate specs');
  const actual = (await filesUnder(resolve(root, 'tests/e2e'), '.spec.ts')).map((path) => path.split('/').at(-1)).filter((name) => /^m0[0-6]-/.test(name)).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) fail(`browser matrix drift: expected ${expected.length}, repository ${actual.length}`);
}

function run(program, args, id) {
  const command = program === 'node' || program === 'npx' ? process.execPath : program;
  const commandArgs = program === 'npx' ? [resolve(root, 'node_modules/@playwright/test/cli.js'), ...args.slice(1)] : args;
  const result = spawnSync(command, commandArgs, { cwd: root, env: process.env, stdio: 'inherit', shell: false });
  if (result.error) fail(`${id}: ${result.error.message}`);
  if (result.status !== 0) fail(`${id}: exited with ${result.status ?? 'no status'}`);
}

await validate();
const mode = process.argv[2] ?? '--validate';
if (mode === '--node') {
  const tests = await filesUnder(resolve(root, 'tests'), '.test.mjs');
  const stripTypes = '--experimental-strip-types';
  const nodeTestArgs = process.allowedNodeEnvironmentFlags.has(stripTypes)
    ? [stripTypes, '--test', ...tests]
    : ['--test', ...tests];
  run('node', nodeTestArgs, 'node-test-matrix');
} else if (mode === '--live') {
  for (const scenario of matrix.liveScenarios) run(scenario.program, scenario.args, scenario.id);
} else if (mode === '--browser') {
  const group = process.argv[3];
  const specs = group === 'all' ? Object.values(matrix.browserGroups).flat() : matrix.browserGroups[group];
  if (!specs) fail(`unknown browser group: ${group ?? '(missing)'}`);
  run('npx', ['playwright', 'test', ...specs.map((name) => `tests/e2e/${name}`)], `browser-${group}`);
} else if (mode !== '--validate') {
  fail(`unknown mode: ${mode}`);
}
console.log(JSON.stringify({ module_id: 'M07-01', mode, status: 'passed', run_id: runId, trace_id: traceId }));
