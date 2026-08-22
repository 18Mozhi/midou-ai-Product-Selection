import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const projects = ["desktop-chromium", "mobile-390"];
const args = process.argv.slice(2);
if (args.some((arg) => arg === "--project" || arg.startsWith("--project=")))
  throw new Error("run-playwright-projects owns the desktop and mobile project boundary");

if (args.includes("--self-test")) {
  console.log(
    JSON.stringify({
      status: "passed",
      lifecycle: "independent_sequential",
      projects,
      service_starts: projects.length,
      service_stops: projects.length,
    }),
  );
  process.exit(0);
}

const playwrightCli = createRequire(import.meta.url).resolve("@playwright/test/cli");
for (const project of projects) {
  const result = spawnSync(
    process.execPath,
    [playwrightCli, "test", ...args, `--project=${project}`],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
