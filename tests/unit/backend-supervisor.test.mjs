import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { BackendSupervisor } from '../../apps/backend/dist/supervisor.js';

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.exitCode = null;
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    queueMicrotask(() => {
      this.exitCode = 0;
      this.emit('exit', 0, signal);
    });
    return true;
  }
}

test('unified backend restarts an unexpectedly exited child', async () => {
  const children = [];
  const supervisor = new BackendSupervisor(
    [{ name: 'api', entrypoint: 'apps/api/dist/server.js' }],
    {
      restartDelayMs: 1,
      spawnProcess: () => {
        const child = new FakeChild(100 + children.length);
        children.push(child);
        return child;
      },
    },
  );

  supervisor.start();
  assert.equal(children.length, 1);
  children[0].exitCode = 1;
  children[0].emit('exit', 1, null);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(children.length, 2);
  await supervisor.stop('SIGTERM');
});

test('unified backend forwards graceful stop and does not restart children', async () => {
  const children = [];
  const supervisor = new BackendSupervisor(undefined, {
    restartDelayMs: 1,
    shutdownGraceMs: 50,
    spawnProcess: () => {
      const child = new FakeChild(200 + children.length);
      children.push(child);
      return child;
    },
  });

  supervisor.start();
  assert.equal(children.length, 2);
  await supervisor.stop('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(children.map((child) => child.signals), [['SIGTERM'], ['SIGTERM']]);
  assert.equal(children.length, 2);
});
