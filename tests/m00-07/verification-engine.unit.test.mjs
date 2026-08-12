import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedAtomicTaskIds,
  redactVerificationOutput,
  validateModuleRegistry,
  verificationConfig,
  VerificationError,
} from '../../scripts/lib/verification-engine.mjs';

const registry = {
  moduleId: 'M00-07',
  phaseId: 'P00',
  dependencies: ['M00-01'],
  atomicTasks: expectedAtomicTaskIds('M00-07').map((id) => ({ id, evidence: `evidence:${id}` })),
  commands: ['node --version'],
};

test('M00-07.A02 registry requires all A01-A17 evidence entries', () => {
  assert.equal(validateModuleRegistry(registry, 'M00-07'), registry);
  assert.throws(
    () => validateModuleRegistry({ ...registry, atomicTasks: registry.atomicTasks.slice(0, 16) }, 'M00-07'),
    (error) => error instanceof VerificationError && error.code === 'atomic_task_missing',
  );
});

test('M00-07.A10 timeout and report directory are validated', () => {
  const config = verificationConfig(process.cwd(), {
    VERIFY_COMMAND_TIMEOUT_MS: '30000',
    VERIFY_REPORT_DIR: '.artifacts/custom-verification',
  });
  assert.equal(config.timeoutMs, 30000);
  assert.match(config.reportDir, /\.artifacts[\\/]custom-verification$/);
  assert.throws(
    () => verificationConfig(process.cwd(), { VERIFY_REPORT_DIR: '..\\outside' }),
    (error) => error.code === 'report_path_outside_workspace',
  );
  assert.throws(
    () => verificationConfig(process.cwd(), { VERIFY_REPORT_DIR: '../outside' }),
    (error) => error.code === 'report_path_outside_workspace',
  );
});

test('M00-07.A11 common secret values are redacted from reports', () => {
  const output = redactVerificationOutput('password=hunter2 token:abcd api_key=xyz safe=value');
  assert.doesNotMatch(output, /hunter2|abcd|xyz/);
  assert.match(output, /safe=value/);
});

test('M00-07.A12 unit coverage includes invalid module and evidence branches', () => {
  assert.throws(() => validateModuleRegistry(registry, 'bad'), /Invalid module ID/);
});
