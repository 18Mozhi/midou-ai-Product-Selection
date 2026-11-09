import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  nodeVerificationBatches,
  nodeVerificationBatchFileLimit,
  releaseMatrixNodeBatches,
} from "../../scripts/lib/node-verification-batches.mjs";
import { expandVerificationCommands } from "../../scripts/lib/verification-engine.mjs";

const root = process.cwd();
const matrix = JSON.parse(
  await readFile(resolve(root, "verification/release-matrix.json"), "utf8"),
);

test("mutation-capable BaoTa probes refuse to reach SSH without isolated stores", () => {
  const env = { ...process.env, VERIFY_ISOLATION_ID: "", PYTHONDONTWRITEBYTECODE: "1" };
  for (const probe of ["playwright-crawler", "collection-task", "ai-analysis", "automation"]) {
    const result = spawnSync("python", ["scripts/verify-live-baota.py", probe], {
      encoding: "utf8",
      env,
      windowsHide: true,
      timeout: 15_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(JSON.parse(result.stderr).stage, "fixture_isolation_config");
    assert.equal(result.stdout, "");
  }
  const local = spawnSync(process.execPath, ["scripts/verify-fixture-isolation.mjs"], {
    encoding: "utf8",
    env,
    timeout: 15_000,
  });
  assert.ifError(local.error);
  assert.equal(local.status, 2, local.stderr);
  assert.deepEqual(JSON.parse(local.stderr), {
    status: "blocked",
    code: "fixture_isolation_config",
  });
});

test("M07-01.A01/A02/A11/A12 release matrix has frozen scope, dimensions and observable ids", () => {
  assert.equal(matrix.moduleId, "M07-01");
  assert.equal(matrix.browserWorkers, 4);
  assert.match(matrix.scope, /no production runtime API, table, page, permission or daemon/);
  assert.deepEqual(
    Object.keys(matrix.dimensions).sort(),
    [
      "dataQuality",
      "mobileVisual",
      "performance",
      "roleScope",
      "securityFailClosed",
      "sourceCollection",
      "taskQueue",
    ].sort(),
  );
  assert.equal(new Set(matrix.liveScenarios.map(({ id }) => id)).size, matrix.liveScenarios.length);
});

test("M07-01.A04 node matrix uses native strip-types or the project TypeScript loader", async () => {
  const verifier = await readFile(
    resolve(root, "scripts/lib/node-verification-batches.mjs"),
    "utf8",
  );
  assert.match(verifier, /process\.allowedNodeEnvironmentFlags\.has\(stripTypes\)/);
  assert.match(verifier, /typescript-test-loader\.mjs/);
  await access(resolve(root, "scripts/lib/typescript-test-loader.mjs"));
});

test("Windows-safe Node batches preserve every test and every non-Node release command", async () => {
  const sample = Array.from({ length: 115 }, (_, index) => `tests/含 空格/${index}.test.mjs`);
  const prefix = ["--test", "--test-concurrency=4"];
  const batches = nodeVerificationBatches(process.execPath, prefix, sample);
  assert.deepEqual(
    batches.flatMap((args) => args.slice(prefix.length)),
    sample,
  );
  assert.ok(batches.every((args) => args.length <= prefix.length + nodeVerificationBatchFileLimit));
  const real = await releaseMatrixNodeBatches(root);
  assert.deepEqual(
    real.batches.flatMap((args) => args.slice(real.prefix.length)),
    real.files,
  );
  assert.ok(real.files.length > sample.length);
  const commands = [
    "npm run build",
    "node scripts/verify-release-matrix.mjs --node",
    "node scripts/verify-release-matrix.mjs --live",
    "node scripts/verify-release-matrix.mjs --browser all",
  ];
  const expanded = await expandVerificationCommands("M07-01", commands, root);
  assert.deepEqual(
    expanded.slice(1, -2),
    real.batches.map(
      (_, index) =>
        `node scripts/verify-release-matrix.mjs --node-batch ${index + 1}/${real.batches.length}`,
    ),
  );
  assert.deepEqual([expanded[0], ...expanded.slice(-2)], [commands[0], ...commands.slice(-2)]);
  assert.deepEqual(await expandVerificationCommands("M07-02", commands, root), commands);
});

test("M07-01 release validation fails closed when current documentation drifts from the BaoTa topology", async () => {
  const verifier = await readFile(resolve(root, "scripts/verify-release-matrix.mjs"), "utf8");
  assert.match(verifier, /verifyRuntimeDocumentation/);
  assert.match(verifier, /runtime documentation consistency/);
  await access(resolve(root, "scripts/verify-runtime-doc-consistency.mjs"));
});

test("M07-01.A03/A04/A05/A14/A16 matrix invokes existing reversible MySQL Redis Worker and failure drills", async () => {
  for (const scenario of matrix.liveScenarios) {
    assert.ok(["node", "python"].includes(scenario.program));
    assert.ok(scenario.args.length >= 1);
    await access(resolve(root, scenario.args[0]));
  }
  const businessTasks = matrix.liveScenarios.find(({ id }) => id === "verify-business-tasks-live");
  assert.deepEqual(businessTasks, {
    id: "verify-business-tasks-live",
    program: "python",
    args: ["scripts/verify-live-baota.py", "business-tasks"],
  });
  for (const [id, probe] of [
    ["verify-approval-workflow-live", "approval-workflow"],
    ["verify-notifications-live", "notifications"],
    ["verify-realtime-live", "realtime"],
    ["verify-automation-live", "automation"],
    ["verify-reports-live", "reports"],
  ]) {
    assert.deepEqual(
      matrix.liveScenarios.find((scenario) => scenario.id === id),
      {
        id,
        program: "python",
        args: ["scripts/verify-live-baota.py", probe],
      },
    );
  }
  const runner = await readFile(resolve(root, "scripts/verify-live-baota.py"), "utf8");
  assert.match(runner, /m05_probes\s*=\s*\{[\s\S]*"business-tasks"[\s\S]*"reports"/);
  assert.match(runner, /local report probe temporary root mismatch/);
  for (const [moduleId, probe] of [
    ["M05-02", "approval-workflow"],
    ["M05-03", "notifications"],
    ["M05-04", "realtime"],
    ["M05-05", "automation"],
    ["M05-06", "reports"],
  ]) {
    const module = JSON.parse(
      await readFile(resolve(root, `verification/modules/${moduleId}.json`), "utf8"),
    );
    assert.ok(module.commands.includes(`python scripts/verify-live-baota.py ${probe}`));
  }
  const migrations = await readdir(resolve(root, "database/migrations"));
  const ups = migrations.filter((name) => name.endsWith(".up.sql"));
  assert.ok(ups.length >= 24);
  for (const up of ups)
    assert.ok(migrations.includes(up.replace(".up.sql", ".down.sql")), `${up} lacks rollback`);
});

test("0076 refuses both cancellation footprints while holding locks and restores the previous ENUM only", async () => {
  const readMigration = (name) =>
    readFile(resolve(root, `database/migrations/${name}.sql`), "utf8");
  const [previous, down] = await Promise.all([
    readMigration("0049_credential_renewal_auto_replay.up"),
    readMigration("0076_collection_backlog_cancellation.down"),
  ]);
  const enumDefinition = /ENUM\([^\r\n]+\) NOT NULL/.exec(previous)?.[0];
  assert.ok(enumDefinition);
  assert.equal(/ENUM\([^\r\n]+\) NOT NULL/.exec(down)?.[0], enumDefinition);
  assert.match(down, /STRICT_ALL_TABLES/);
  assert.match(
    down,
    /LOCK TABLES `collection_tasks` WRITE, `collection_task_events` READ;[\s\S]*?WHERE EXISTS \(SELECT 1 FROM `collection_tasks` WHERE `status` = 'cancelled'\)[\s\S]*?`event_type` = 'collection\.task\.cancelled' OR `to_status` = 'cancelled'[\s\S]*?ALGORITHM=COPY, LOCK=EXCLUSIVE;\s*UNLOCK TABLES;/,
  );
  assert.doesNotMatch(down, /\b(?:UPDATE|DELETE FROM|TRUNCATE)\b/i);
});

test("M07-01 live data-quality drill distinguishes wrapper drift from normalized fact conflicts", async () => {
  const verifier = await readFile(
    resolve(root, "scripts/verify-evidence-data-quality-live.mjs"),
    "utf8",
  );
  assert.match(verifier, /normalizedPayload:\s*\{\s*title:\s*["']Changed item["']\s*\}/);
  assert.match(verifier, /dedupe conflict was not rejected/);
});

test("M07-01.A06/A09/A10/A13 contracts guards and existing configuration stay synchronized", async () => {
  const openapi = await readFile(resolve(root, "docs/openapi.yaml"), "utf8");
  const env = await readFile(resolve(root, "config/env.example"), "utf8");
  const docs = await readFile(resolve(root, "docs/architecture/m07-01-release-matrix.md"), "utf8");
  assert.match(openapi, /releaseMatrix: node scripts\/verify-release-matrix\.mjs --validate/);
  assert.match(openapi, /releaseMatrixRuntimeApiExposed: false/);
  assert.match(env, /VERIFY_COMMAND_TIMEOUT_MS=120000/);
  assert.match(env, /VERIFY_REPORT_DIR=\.artifacts\/verification/);
  assert.match(docs, /不新增生产 API、数据库表、页面、权限或常驻进程/);
});

test("M07-01.A07/A08/A15 every prior browser contract is assigned exactly once", async () => {
  const assigned = Object.values(matrix.browserGroups).flat();
  const actual = (await readdir(resolve(root, "tests/e2e"))).filter((name) =>
    /^m0[0-6]-.*\.spec\.ts$/.test(name),
  );
  assert.equal(assigned.length, actual.length);
  assert.equal(new Set(assigned).size, assigned.length);
  assert.deepEqual([...assigned].sort(), actual.sort());
  assert.ok(assigned.some((name) => name.includes("ui-states")));
  assert.ok(assigned.some((name) => name.includes("home-mobile")));
  assert.ok(assigned.some((name) => name.includes("real-api-acceptance")));
});

test("M07-01 keeps mocked screenshots below the frozen ratio and reuses mobile occlusion checks", async () => {
  const verifier = await readFile(resolve(root, "scripts/verify-release-matrix.mjs"), "utf8");
  const realism = await readFile(resolve(root, "scripts/verify-e2e-realism.mjs"), "utf8");
  const helper = await readFile(resolve(root, "tests/e2e/helpers/mobile-occlusion.ts"), "utf8");
  assert.match(verifier, /verify-e2e-realism\.mjs/);
  assert.match(realism, /mockedRatio >= 0\.5/);
  assert.match(realism, /e2e_real_api_screenshot_coverage_insufficient/);
  assert.match(helper, /overlap/);
  assert.match(helper, /role-mobile-nav/);
});

test("M07-01 runs desktop and mobile browser projects with independent service lifecycles", async () => {
  const [runner, functional, verifier, packageJson] = await Promise.all([
    readFile(resolve(root, "scripts/run-playwright-projects.mjs"), "utf8"),
    readFile(resolve(root, "scripts/verify-functional.mjs"), "utf8"),
    readFile(resolve(root, "scripts/verify-release-matrix.mjs"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8").then(JSON.parse),
  ]);
  assert.match(runner, /\["desktop-chromium", "mobile-390"\]/);
  assert.match(runner, /for \(const project of projects\)/);
  assert.match(runner, /spawnSync/);
  assert.match(runner, /--project=\$\{project\}/);
  assert.equal(packageJson.scripts["test:e2e"], "node scripts/run-playwright-projects.mjs");
  assert.match(functional, /run-playwright-projects\.mjs/);
  assert.match(verifier, /run-playwright-projects\.mjs/);
});

test("M07-01.A17 blueprint performance budgets are immutable matrix values", () => {
  assert.deepEqual(matrix.performanceTargets, {
    newMemberJourneyMs: 180000,
    taskCreateP95Ms: 3000,
    queuedVisibilityMs: 15000,
    firstOutcomeP95Ms: 180000,
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
    coreReadP95Ms: 300,
    coreWriteP95Ms: 600,
  });
});
