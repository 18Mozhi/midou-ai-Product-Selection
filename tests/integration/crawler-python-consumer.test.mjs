import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import test from "node:test";

import { buildApp } from "../../apps/api/dist/app.js";
import { CrawlerRuntimeService } from "../../apps/api/dist/crawler-runtime-service.js";

const root = resolve(import.meta.dirname, "../..");
const ids = {
  actor: "00000000-0000-4000-8000-000000000701",
  organization: "00000000-0000-4000-8000-000000000702",
  workspace: "00000000-0000-4000-8000-000000000703",
  task: "00000000-0000-4000-8000-000000000704",
  subquery: "00000000-0000-4000-8000-000000000705",
  provider: "00000000-0000-4000-8000-000000000706",
  job: "00000000-0000-4000-8000-000000000707",
  profile: "00000000-0000-4000-8000-000000000708",
};

const runPythonConsumer = async (apiBaseUrl, serviceToken) => {
  const child = spawn("python", ["tests/integration/crawler-python-consumer-probe.py"], {
    cwd: root,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONPATH: resolve(root, "apps/crawler"),
      CRAWLER_API_BASE_URL: apiBaseUrl,
      CRAWLER_SERVICE_TOKEN: serviceToken,
      CRAWLER_ID: "crawler-integration",
      CRAWLER_HEARTBEAT_SECONDS: "5",
      CRAWLER_LEASE_SECONDS: "30",
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr || stdout);
  return stdout;
};

const startRuntimeApi = async ({ assignmentAvailable }) => {
  const calls = [];
  const repository = {
    list: async () => ({ profiles: [], runs: [] }),
    recoverExpired: async () => ({ recovered: 0 }),
    acquireJob: async (input) => {
      calls.push(["acquire", input]);
      if (!assignmentAvailable) return null;
      return {
        job: {
          id: ids.job,
          collection_task_id: ids.task,
          collection_subquery_id: ids.subquery,
          provider_id: ids.provider,
          provider_code: "1688_search",
          execution_request: { plan: { start_url: "https://example.test/" } },
        },
        run: {
          id: input.runId,
          organization_id: ids.organization,
          workspace_id: ids.workspace,
          provider_id: ids.provider,
          crawler_profile_id: ids.profile,
          status: "running",
          page_count: 0,
          item_count: 0,
          detail_count: 0,
          duration_ms: null,
          error_code: null,
          request_id: input.requestId,
          trace_id: input.traceId,
          started_at: input.now.toISOString(),
          finished_at: null,
        },
        profile: { id: ids.profile, locale: "zh-CN", timezone: "Asia/Shanghai" },
        credential: {
          asset_id: "browser-credential-integration",
          asset_version: 1,
          kind: "cookie_bundle",
          key_version: "v1",
          ciphertext_base64: "YQ==",
          nonce_base64: "Yg==",
          auth_tag_base64: "Yw==",
        },
      };
    },
    heartbeatJob: async (input) => {
      calls.push(["heartbeat", input]);
    },
    finishJob: async (input) => {
      calls.push(["complete", input]);
    },
  };
  const serviceToken = "crawler-integration-service-token";
  const app = buildApp({
    crawlerRuntime: {
      service: new CrawlerRuntimeService(repository),
      authorization: { authorize: async () => {} },
      auth: { authenticate: async () => ({ user: { id: ids.actor } }) },
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      serviceToken,
      serviceActorId: ids.actor,
    },
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address === "object");
  return { app, calls, serviceToken, apiBaseUrl: `http://127.0.0.1:${address.port}` };
};

test("Python crawler consumes, renews and completes a real Fastify job over HTTP", async () => {
  const runtime = await startRuntimeApi({ assignmentAvailable: true });
  try {
    const stdout = await runPythonConsumer(runtime.apiBaseUrl, runtime.serviceToken);
    assert.match(stdout, /consumer_processed=true/);
    assert.deepEqual(
      runtime.calls.map(([name]) => name),
      ["acquire", "heartbeat", "complete"],
    );
    const acquire = runtime.calls[0][1];
    const heartbeat = runtime.calls[1][1];
    const complete = runtime.calls[2][1];
    assert.equal(acquire.leaseOwner, "crawler-integration");
    assert.equal(heartbeat.runId, acquire.runId);
    assert.equal(complete.runId, acquire.runId);
    assert.equal(complete.status, "succeeded");
    assert.equal(complete.itemCount, 2);
    assert.equal(complete.result.request_id, acquire.requestId);
    assert.equal(complete.result.trace_id, acquire.traceId);
  } finally {
    await runtime.app.close();
  }
});

test("Python crawler does not emit an idle heartbeat when Fastify has no job", async () => {
  const runtime = await startRuntimeApi({ assignmentAvailable: false });
  try {
    const stdout = await runPythonConsumer(runtime.apiBaseUrl, runtime.serviceToken);
    assert.match(stdout, /consumer_processed=false/);
    assert.deepEqual(
      runtime.calls.map(([name]) => name),
      ["acquire"],
    );
  } finally {
    await runtime.app.close();
  }
});
