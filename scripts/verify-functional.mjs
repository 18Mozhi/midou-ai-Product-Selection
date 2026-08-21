import { spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = process.cwd();
const timeout = 900_000;
const npm = "npm";
const npx = "npx";
async function collectNodeTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "e2e") files.push(...(await collectNodeTests(path)));
    } else if (entry.name.endsWith(".test.mjs")) {
      files.push(path);
    }
  }
  return files.sort();
}

const nodeTests = await collectNodeTests(resolve(root, "tests"));
const steps = [
  {
    id: "verify-code-style",
    label: "npm run verify:code-style",
    command: npm,
    args: ["run", "verify:code-style"],
    shell: process.platform === "win32",
  },
  {
    id: "verify-static-analysis",
    label: "npm run verify:static-analysis",
    command: npm,
    args: ["run", "verify:static-analysis"],
    shell: process.platform === "win32",
  },
  {
    id: "build",
    label: "npm run build",
    command: npm,
    args: ["run", "build"],
    shell: process.platform === "win32",
  },
  {
    id: "node-tests",
    label: `node-tests (${nodeTests.length} files)`,
    command: process.execPath,
    args: ["--experimental-strip-types", "--test", "--test-concurrency=4", ...nodeTests],
  },
  {
    id: "python-tests",
    label: "python-tests",
    command: "python",
    args: ["-m", "unittest", "discover", "-s", "apps/crawler/tests", "-p", "test_*.py"],
  },
  {
    id: "playwright-e2e",
    label: "playwright-e2e",
    command: npx,
    args: ["playwright", "test"],
    shell: process.platform === "win32",
  },
  {
    id: "verify-docs",
    label: "npm run verify:docs",
    command: npm,
    args: ["run", "verify:docs"],
    shell: process.platform === "win32",
  },
  {
    id: "verify-plans",
    label: "npm run verify:plans",
    command: npm,
    args: ["run", "verify:plans"],
    shell: process.platform === "win32",
  },
  {
    id: "verify-release-matrix",
    label: "npm run verify:release-matrix",
    command: npm,
    args: ["run", "verify:release-matrix"],
    shell: process.platform === "win32",
  },
  {
    id: "verify-security-gate",
    label: "npm run verify:security-gate",
    command: npm,
    args: ["run", "verify:security-gate"],
    shell: process.platform === "win32",
  },
];

const startedAt = new Date().toISOString();
const results = [];
let status = "passed";

for (const step of steps) {
  console.log(`[FUNCTIONAL] RUN ${step.label}`);
  const started = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    shell: step.shell ?? false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const timedOut = result.error?.code === "ETIMEDOUT";
  const passed = result.status === 0 && !timedOut;
  results.push({
    id: step.id,
    status: passed ? "passed" : "failed",
    exit_code: result.status,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
  });
  if (!passed) {
    status = "failed";
    break;
  }
}

const report = {
  scope: "P00-P08-software-functional",
  status,
  criteria: [
    "code_style",
    "accessibility_and_promise_static_analysis",
    "production_build",
    "node_tests",
    "python_tests",
    "desktop_and_390_e2e",
    "docs",
    "plans",
    "release_matrix",
    "security_gate",
  ],
  excludes: [
    "disk_diagnostics",
    "capacity_performance_claim",
    "production_load_test",
    "same_commit_deployment_evidence",
    "multi_node_claim",
  ],
  steps: results,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
};
const reportDirectory = resolve(root, ".artifacts", "verification");
await mkdir(reportDirectory, { recursive: true });
const reportFile = resolve(reportDirectory, "functional-P00-P08.json");
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, report_file: relative(root, reportFile) }, null, 2));
if (status !== "passed") process.exitCode = 1;
