import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function summarizeAccountUnitTap(tap) {
  const counts = {};
  for (const match of tap.matchAll(
    /^# (tests|pass|fail|cancelled|skipped|todo|duration_ms) ([0-9.]+)\s*$/gm,
  ))
    counts[match[1]] = Number(match[2]);
  assert.ok(
    Number.isInteger(counts.tests) && Number.isInteger(counts.fail),
    "Missing complete CLI test footer",
  );
  const lines = tap.split(/\r?\n/),
    failures = [];
  for (let index = 0; index < lines.length; index++) {
    const match = /^(\s*)not ok (\d+) - (.*)$/.exec(lines[index]);
    if (!match) continue;
    const diagnostic = [];
    for (let j = index + 1; j < lines.length; j++) {
      if (/^\s*(?:not ok|ok) \d+ - /.test(lines[j]) || /^# (?:tests|pass|fail) /.test(lines[j]))
        break;
      diagnostic.push(lines[j]);
      if (/^\s*\.\.\.\s*$/.test(lines[j])) break;
    }
    failures.push({ number: Number(match[2]), name: match[3], diagnostic: diagnostic.join("\n") });
  }
  assert.equal(
    failures.length,
    counts.fail,
    "Failure list does not reconcile with full CLI footer",
  );
  return { counts, failures };
}

async function main() {
  assert.equal(process.argv.length, 2, "This full-unit gate accepts no options");
  assert.equal(
    existsSync("design-plans/ui-phase-2-2026-09-07/P39-CAPTURE-UNIT-RESULT.json"),
    false,
    "P39 full-unit report already exists; do not rerun or overwrite this capture",
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
    kind: "P39-capture-full-unit-closure",
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
    "design-plans/ui-phase-2-2026-09-07/P39-CAPTURE-UNIT-RESULT.json",
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
