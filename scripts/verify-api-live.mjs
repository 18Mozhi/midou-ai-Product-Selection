import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { createRedisConnection, ScopedRedisStore } from "../packages/redis/dist/index.js";
import { buildApp } from "../apps/api/dist/app.js";

async function runLocalProbe() {
  const id = randomUUID();
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);
  const client = createRedisConnection(config);
  client.on("error", () => {});
  const store = new ScopedRedisStore(client);
  const app = buildApp({
    readinessChecks: [
      {
        name: "mysql",
        check: async () => {
          try {
            await pool.query("SELECT 1");
            return "available";
          } catch {
            return "unavailable";
          }
        },
      },
      {
        name: "redis",
        check: async (requestId, traceId) => {
          try {
            await store.connect();
            return (await store.health(requestId, traceId)).status;
          } catch {
            return "unavailable";
          }
        },
      },
    ],
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/ready",
      headers: { "x-request-id": id, "x-trace-id": id },
    });
    const body = response.json();
    if (response.statusCode !== 200 || body.data?.status !== "ready" || body.request_id !== id)
      throw new Error("readiness contract failed");
    console.log(
      JSON.stringify({
        status: "passed",
        dependencies: body.data.dependencies,
        request_id: id,
        trace_id: id,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "api_readiness_unavailable",
        message: error instanceof Error ? error.message : "unknown",
        request_id: id,
        trace_id: id,
      }),
    );
    process.exitCode = 2;
  } finally {
    await app.close();
    await store.close();
    await pool.end();
  }
}

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "api"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_API_LIVE_TARGET ?? "local";
if (target === "baota-production") runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const id = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "api_live_target_invalid",
      message: "SCOUTOPS_API_LIVE_TARGET must be local or baota-production.",
      request_id: id,
      trace_id: id,
    }),
  );
  process.exitCode = 2;
}
