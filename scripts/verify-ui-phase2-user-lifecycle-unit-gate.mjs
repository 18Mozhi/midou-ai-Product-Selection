import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { summarizeAccountUnitTap } from "./verify-ui-phase2-account-unit-gate.mjs";

async function main() {
  assert.equal(process.argv.length, 2, "This full-unit gate accepts no options");
  assert.equal(
    existsSync("design-plans/ui-phase-2-2026-09-07/P43-LIFECYCLE-CAPTURE-UNIT-RESULT.json"),
    false,
    "P43-LIFECYCLE full-unit report already exists; do not rerun or overwrite this capture",
  );
  const files = (await readdir("tests/unit"))
    .filter((file) => file.endsWith(".test.mjs"))
    .sort()
    .map((file) => `tests/unit/${file}`);
  const command = ["--test", "--test-concurrency=8", ...files];
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, command, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  console.log(JSON.stringify({ state: "running", pid: child.pid, files: files.length, startedAt }));
  const stdout = [],
    stderr = [];
  child.stdout.on("data", (bytes) => stdout.push(bytes));
  child.stderr.on("data", (bytes) => stderr.push(bytes));
  const timer = setInterval(
    () =>
      console.log(
        JSON.stringify({
          state: "running",
          pid: child.pid,
          stdoutBytes: stdout.reduce((n, bytes) => n + bytes.length, 0),
        }),
      ),
    30000,
  );
  let exit;
  try {
    exit = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
  } finally {
    clearInterval(timer);
  }
  const tap = Buffer.concat(stdout).toString("utf8");
  const result = summarizeAccountUnitTap(tap);
  const report = {
    kind: "P43-LIFECYCLE-capture-full-unit-closure",
    startedAt,
    finishedAt: new Date().toISOString(),
    command: "node --test --test-concurrency=8 tests/unit/*.test.mjs",
    files: files.length,
    ...result,
    exit,
    childClosed: true,
    failureListTruncated: false,
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
  await writeFile(
    "design-plans/ui-phase-2-2026-09-07/P43-LIFECYCLE-CAPTURE-UNIT-RESULT.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      files: report.files,
      counts: report.counts,
      failures: report.failures.length,
      exit,
      childClosed: true,
    }),
  );
  process.exitCode = exit ?? 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
