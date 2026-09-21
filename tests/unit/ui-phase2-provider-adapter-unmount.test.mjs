import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const root = "output/playwright/p47-unmount-review";
const captured = (file) =>
  execFileSync("git", ["show", `89a72609f914b58f3de71ef2b36d74a81e536889:${file}`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");
const evidence = () => JSON.parse(read(`${root}/evidence.json`));
function loadTs(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      Buffer,
      Date,
      AbortController,
      DOMException,
      setTimeout,
      clearTimeout,
      require: (name) => {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return exports;
}

test("P47 current service and registry permit distinct-key checks before either result is recorded", async () => {
  const registryModule = loadTs("packages/provider-adapters/src/index.ts");
  const { ProviderAdapterService } = loadTs("apps/api/src/provider-adapter-service.ts", {
    "@scoutops/provider-adapters": registryModule,
  });
  const fixtureFile = "tests/m03-03/provider-adapter.test.mjs",
    ast = ts.createSourceFile(fixtureFile, read(fixtureFile), ts.ScriptTarget.Latest, true),
    matches = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "provider") matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1);
  const provider = vm.runInNewContext("(" + matches[0].initializer.getText(ast) + ")");
  const pending = [],
    recorded = [],
    replays = [];
  const registry = new registryModule.ProviderAdapterRegistry({
    healthTimeoutMs: 1000,
    maxResponseBytes: 4096,
    maxItemsPerBatch: 2,
  }).register({
    key: provider.code,
    accessMode: provider.accessMode,
    version: "test-v1",
    collect: () => {
      throw Error("Must not collect");
    },
    normalize: () => {
      throw Error("Must not normalize");
    },
    healthCheck: (context) =>
      new Promise((resolve) => pending.push({ requestId: context.requestId, resolve })),
  });
  const repository = {
    getProvider: async () => provider,
    findReplay: async (input) => {
      replays.push(input.idempotencyKey);
      return null;
    },
    recordHealth: async (input) => {
      recorded.push(input.idempotencyKey);
      return {
        providerId: provider.id,
        adapterVersion: input.adapterVersion,
        healthStatus: input.signal.status,
        lastCheckedAt: input.now.toISOString(),
        lastLatencyMs: input.signal.latencyMs,
        lastErrorCode: null,
        consecutiveFailures: 0,
        version: recorded.length,
        updatedAt: input.now.toISOString(),
      };
    },
  };
  const service = new ProviderAdapterService(
    repository,
    registry,
    () => new Date("2026-09-11T08:00:00Z"),
  );
  const first = service.probe(provider.id, {
    actorId: "same-test-actor",
    idempotencyKey: "first-instance",
    requestId: "request-first",
    traceId: "trace-first",
  });
  const second = service.probe(provider.id, {
    actorId: "same-test-actor",
    idempotencyKey: "new-instance",
    requestId: "request-new",
    traceId: "trace-new",
  });
  try {
    for (let i = 0; i < 10 && pending.length < 2; i++) await Promise.resolve();
    assert.deepEqual(replays, ["first-instance", "new-instance"]);
    assert.equal(
      pending.length,
      2,
      "Both real service calls reach the actual registry before persistence",
    );
    assert.equal(recorded.length, 0);
  } finally {
    for (const operation of pending)
      operation.resolve({
        status: "ready",
        latencyMs: 7,
        errorCode: null,
        message: "local contract sample",
      });
    await Promise.all([first, second]);
  }
  assert.deepEqual(recorded, ["first-instance", "new-instance"]);
});

test("P47 archived unmount evidence binds its complete captured manifest, sources and images", () => {
  const e = evidence();
  assert.deepEqual(e, JSON.parse(captured(`${root}/evidence.json`)));
  assert.equal(e.productionUntransformed, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 24);
  assert.equal(e.screenshots.length, 8);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(captured(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
});

test("P47 archived real max12 eviction and shell unmount retain late-result isolation and pending reset observations", () => {
  for (const run of evidence().runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("actual original instance unmounted"), true);
    assert.equal(value("body background released"), true);
    assert.equal(value("P47 marker no longer matches"), true);
    assert.equal(value("remount has a distinct actual instance"), true);
    assert.equal(value("old completion does not steal new focus"), true);
    assert.equal(value("old result not shown in new page"), true);
    assert.equal(value("new instance probe enabled before old completion"), true);
    assert.equal(
      value("only original local probe, no automatic replay"),
      run.action === "probe" ? 1 : 0,
    );
    assert.equal(value("initial plus remount GET count"), run.action === "read" ? 3 : 2);
    assert.deepEqual(value("no runtime errors"), []);
    assert.deepEqual(value("no unexpected non-read network"), []);
    assert.ok(run.blockedReads.every((key) => key.startsWith("GET /api/")));
    if (run.exit === "cache-eviction") {
      assert.equal(run.cacheObservations.length, 12);
      for (const [index, observation] of run.cacheObservations.entries()) {
        assert.equal(observation.cacheKeys.length, Math.min(index + 2, 12));
        assert.equal(observation.unmounted, index === 11);
        assert.equal(observation.cacheUnmounted, false);
      }
    }
  }
});
