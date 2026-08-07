import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const MODULE_PATTERN = /^M\d{2}-\d{2}$/;
const PHASE_PATTERN = /^P\d{2}$/;
const SECRET_PATTERN = /(password|secret|token|cookie|api[_-]?key|private[_-]?key)(\s*[=:]\s*)([^\s,;'\"]+)/gi;

export class VerificationError extends Error {
  constructor(message, { code = 'verification_failed', status = 'failed', details } = {}) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function redactVerificationOutput(value) {
  return String(value ?? '').replace(SECRET_PATTERN, '$1$2[REDACTED]');
}

export function expectedAtomicTaskIds(moduleId) {
  return Array.from({ length: 17 }, (_, index) =>
    `${moduleId}.A${String(index + 1).padStart(2, '0')}`,
  );
}

export function validateModuleRegistry(registry, requestedModuleId) {
  if (!MODULE_PATTERN.test(requestedModuleId)) {
    throw new VerificationError(`Invalid module ID ${requestedModuleId}`, { code: 'invalid_module_id' });
  }
  if (registry.moduleId !== requestedModuleId) {
    throw new VerificationError(`${requestedModuleId} registry moduleId mismatch`, { code: 'registry_mismatch' });
  }
  if (!PHASE_PATTERN.test(registry.phaseId ?? '')) {
    throw new VerificationError(`${requestedModuleId} has invalid phaseId`, { code: 'invalid_phase_id' });
  }
  const actual = new Set(registry.atomicTasks?.map((task) => task.id));
  for (const taskId of expectedAtomicTaskIds(requestedModuleId)) {
    if (!actual.has(taskId)) {
      throw new VerificationError(`${requestedModuleId} missing atomic verification entry ${taskId}`, {
        code: 'atomic_task_missing', details: { task_id: taskId },
      });
    }
  }
  if (!registry.atomicTasks?.every((task) => typeof task.evidence === 'string' && task.evidence.trim())) {
    throw new VerificationError(`${requestedModuleId} has atomic tasks without evidence`, { code: 'evidence_missing' });
  }
  if (!Array.isArray(registry.commands) || registry.commands.length === 0) {
    throw new VerificationError(`${requestedModuleId} has no executable commands`, { code: 'commands_missing' });
  }
  return registry;
}

function resolveReportDirectory(root, requested) {
  const reportDir = resolve(root, requested || '.artifacts/verification');
  const pathFromRoot = relative(root, reportDir);
  if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..' || isAbsolute(pathFromRoot)) {
    throw new VerificationError('VERIFY_REPORT_DIR must stay inside the project workspace', {
      code: 'report_path_outside_workspace',
    });
  }
  return reportDir;
}

export function verificationConfig(root = process.cwd(), env = process.env) {
  const timeoutMs = Number.parseInt(env.VERIFY_COMMAND_TIMEOUT_MS ?? '120000', 10);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) {
    throw new VerificationError('VERIFY_COMMAND_TIMEOUT_MS must be between 1000 and 900000', {
      code: 'invalid_timeout',
    });
  }
  return {
    timeoutMs,
    reportDir: resolveReportDirectory(root, env.VERIFY_REPORT_DIR),
  };
}

export async function loadVerificationState(root = process.cwd()) {
  return JSON.parse(await readFile(resolve(root, 'verification', 'state.json'), 'utf8'));
}

export async function loadModuleRegistry(moduleId, root = process.cwd()) {
  const path = resolve(root, 'verification', 'modules', `${moduleId}.json`);
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new VerificationError(`[${moduleId}] verification registry is missing: ${path}`, {
      code: 'registry_missing', status: 'blocked', details: { module_id: moduleId },
    });
  }
  return validateModuleRegistry(JSON.parse(raw), moduleId);
}

export async function assertModuleDependencies(registry, root = process.cwd()) {
  const state = await loadVerificationState(root);
  const completed = new Set(state.completedModules ?? []);
  const missing = (registry.dependencies ?? []).filter((id) => !completed.has(id));
  if (missing.length) {
    throw new VerificationError(`[${registry.moduleId}] prerequisite modules are not completed: ${missing.join(', ')}`, {
      code: 'dependency_blocked', status: 'blocked', details: { missing_dependencies: missing },
    });
  }
}

export function runVerificationCommand(command, { root = process.cwd(), timeoutMs = 120000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, {
    cwd: root,
    env: process.env,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = redactVerificationOutput(result.stdout);
  const stderr = redactVerificationOutput(result.stderr);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  const timedOut = result.error?.code === 'ETIMEDOUT';
  return {
    command: redactVerificationOutput(command),
    status: result.status === 0 && !timedOut ? 'passed' : 'failed',
    exit_code: result.status,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
    output_tail: `${stdout}\n${stderr}`.trim().slice(-4000),
  };
}

async function writeReport(report, config) {
  await mkdir(config.reportDir, { recursive: true });
  const file = resolve(config.reportDir, `${report.scope.toLowerCase()}-${report.id}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}

export async function runModule(moduleId, options = {}) {
  const root = options.root ?? process.cwd();
  const config = options.config ?? verificationConfig(root, options.env ?? process.env);
  const registry = await loadModuleRegistry(moduleId, root);
  await assertModuleDependencies(registry, root);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const commands = [];
  let status = 'passed';
  let failure = null;

  for (const command of registry.commands) {
    console.log(`[${moduleId}] RUN ${redactVerificationOutput(command)}`);
    const result = runVerificationCommand(command, { root, timeoutMs: config.timeoutMs });
    commands.push(result);
    if (result.status !== 'passed') {
      status = 'failed';
      failure = {
        code: result.timed_out ? 'command_timeout' : 'command_failed',
        command: result.command,
        exit_code: result.exit_code,
      };
      break;
    }
  }

  const report = {
    scope: 'MODULE',
    id: moduleId,
    phase_id: registry.phaseId,
    status,
    run_id: runId,
    trace_id: runId,
    atomic_tasks: expectedAtomicTaskIds(moduleId),
    commands,
    failure,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  };
  const reportFile = await writeReport(report, config);
  console.log(JSON.stringify({ ...report, report_file: relative(root, reportFile) }, null, 2));
  if (status !== 'passed') {
    throw new VerificationError(`[${moduleId}] module verification failed`, {
      code: failure?.code, details: { report_file: reportFile, failure },
    });
  }
  return report;
}

export async function modulesForPhase(phaseId, root = process.cwd()) {
  if (!PHASE_PATTERN.test(phaseId)) {
    throw new VerificationError(`Invalid phase ID ${phaseId}`, { code: 'invalid_phase_id' });
  }
  const phaseNumber = phaseId.slice(1).toLowerCase();
  const files = await readdir(resolve(root, 'plans'));
  const planFile = files.find((file) => file.startsWith(`phase-${phaseNumber}-`) && file.endsWith('.md'));
  if (!planFile) {
    throw new VerificationError(`[${phaseId}] phase plan is missing`, { code: 'phase_plan_missing', status: 'blocked' });
  }
  const content = await readFile(resolve(root, 'plans', planFile), 'utf8');
  return [...content.matchAll(/^### (M\d{2}-\d{2}) 原子任务索引$/gm)].map((match) => match[1]);
}

export async function assertPhaseDependencies(phaseId, root = process.cwd()) {
  const phaseNumber = Number.parseInt(phaseId.slice(1), 10);
  const state = await loadVerificationState(root);
  const completed = new Set(state.completedPhases ?? []);
  const missing = Array.from({ length: phaseNumber }, (_, index) => `P${String(index).padStart(2, '0')}`)
    .filter((id) => !completed.has(id));
  if (missing.length) {
    throw new VerificationError(`[${phaseId}] prerequisite phases are not completed: ${missing.join(', ')}`, {
      code: 'phase_dependency_blocked', status: 'blocked', details: { missing_phases: missing },
    });
  }
}

export async function runPhase(phaseId, options = {}) {
  const root = options.root ?? process.cwd();
  await assertPhaseDependencies(phaseId, root);
  const moduleIds = await modulesForPhase(phaseId, root);
  const reports = [];
  for (const moduleId of moduleIds) reports.push(await runModule(moduleId, options));
  return { scope: 'PHASE', id: phaseId, status: 'passed', modules: reports.map((report) => report.id) };
}

export async function runAll(options = {}) {
  const phases = [];
  for (let index = 0; index <= 8; index += 1) {
    const phaseId = `P${String(index).padStart(2, '0')}`;
    phases.push(await runPhase(phaseId, options));
  }
  return { scope: 'ALL', id: 'P00-P08', status: 'passed', phases: phases.map((phase) => phase.id) };
}
