import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Refuse all production package imports before they can evaluate or connect anywhere.
const loader = `export async function resolve(specifier, context, nextResolve) {
  if (["auth", "config", "database"].some(name =>
    specifier.endsWith("/packages/" + name + "/dist/index.js")))
    throw new Error("blocked_acceptance_runtime_import:" + specifier);
  return nextResolve(specifier, context);
}`;

function probe({ production = false, password = "" } = {}) {
  const script = `
    import { register } from "node:module";
    register(${JSON.stringify(`data:text/javascript,${encodeURIComponent(loader)}`)}, import.meta.url);
    ${production ? 'process.argv.push("--production");' : ""}
    try { await import("./scripts/run-baota-production-acceptance.mjs"); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  `;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      SCOUTOPS_ACCEPTANCE_PASSWORD: password,
    },
  });
}

test("read-only acceptance preflight never imports production runtime packages", () => {
  const result = probe();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "preflight_passed");
  assert.equal(report.production_verified, false);
  assert.deepEqual(
    [report.paths, report.operations, report.protected_routes, report.roles],
    [225, 258, 60, 6],
  );
});

test("production acceptance rejects missing password before importing runtime packages", () => {
  const result = probe({ production: true });
  assert.equal(result.status, 1, result.error?.message);
  assert.match(result.stderr, /SCOUTOPS_ACCEPTANCE_PASSWORD must contain 12-128 characters/);
  assert.doesNotMatch(result.stderr, /blocked_acceptance_runtime_import/);
});

test("explicit production branch still requires its runtime packages without bypassing the import guard", () => {
  const result = probe({ production: true, password: "isolated-test-only-password" });
  assert.equal(result.status, 1, result.error?.message);
  assert.match(result.stderr, /blocked_acceptance_runtime_import:/);
  assert.equal(result.stdout, "");
});
