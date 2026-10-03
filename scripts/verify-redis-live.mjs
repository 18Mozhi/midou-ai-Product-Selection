import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createRedisProbeConnection, ScopedRedisStore } from "../packages/redis/dist/index.js";

async function runLocalProbe() {
  const config = loadRuntimeConfig(process.env, "api");
  const client = createRedisProbeConnection(config);
  client.on("error", () => {});
  const store = new ScopedRedisStore(client);
  const runId = randomUUID();
  const input = {
    purpose: "cache",
    organization_id: `verify-${runId}`,
    workspace_id: "local",
    resource: "live-check",
  };
  const rateInput = {
    organization_id: `verify-${runId}`,
    workspace_id: "local",
    resource: "rate-check",
  };
  const rateKey = { ...rateInput, purpose: "rate" };

  try {
    await store.connect();
    const health = await store.health(runId, runId);
    if (health.status !== "available") throw new Error("Redis ping did not return PONG");
    await store.writeJson(input, { run_id: runId }, 5);
    const value = await store.readJson(input);
    if (value?.run_id !== runId) throw new Error("Redis scoped set/get mismatch");
    const rate = await store.incrementRate(rateInput, 5);
    if (rate.count !== 1 || rate.ttl_seconds < 1 || rate.ttl_seconds > 5)
      throw new Error("Redis atomic rate TTL mismatch");
    await store.delete(input);
    await store.delete(rateKey);
    console.log(
      JSON.stringify({
        status: "passed",
        dependency: "redis",
        isolation: "organization_and_workspace",
        cleanup: "passed",
        request_id: runId,
        trace_id: runId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "redis_unavailable",
        message: error instanceof Error ? error.message : "unknown",
        request_id: runId,
        trace_id: runId,
      }),
    );
    process.exitCode = 2;
  } finally {
    try {
      await store.delete(input);
    } catch {}
    try {
      await store.delete(rateKey);
    } catch {}
    await store.close();
  }
}

async function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "redis"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    const requestId = randomUUID();
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "baota_probe_runner_unavailable",
        message: "The BaoTa-side probe runner could not be started.",
        request_id: requestId,
        trace_id: requestId,
      }),
    );
    process.exitCode = 2;
    return;
  }
  if (result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_REDIS_LIVE_TARGET ?? "local";
if (target === "baota-production") await runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const requestId = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "redis_live_target_invalid",
      message: "SCOUTOPS_REDIS_LIVE_TARGET must be local or baota-production.",
      request_id: requestId,
      trace_id: requestId,
    }),
  );
  process.exitCode = 2;
}
