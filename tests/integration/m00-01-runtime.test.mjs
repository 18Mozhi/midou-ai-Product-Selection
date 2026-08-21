import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import { processFoundationWork } from "../../apps/worker/dist/foundation-worker.js";

test("M00-01.A14 API runtime serves liveness without external dependencies", async () => {
  const app = buildApp({
    now: () => new Date("2026-08-07T00:00:00.000Z"),
    version: "integration",
    buildSha: "integration",
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "ok");
  assert.equal(response.json().meta.observed_at, "2026-08-07T00:00:00.000Z");
  assert.ok(response.headers["x-request-id"]);
  assert.ok(response.headers["x-trace-id"]);
  await app.close();
});

test("M00-01.A04 scoped service boundaries do not leak through unknown routes", async () => {
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/private-foundation" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "route_not_found");
  assert.ok(response.json().request_id);
  assert.ok(response.json().trace_id);
  await app.close();
});

test("M00-01.A16 successful recovery transitions work to succeeded", async () => {
  const result = await processFoundationWork(
    {
      event_id: "event-recovered",
      organization_id: "org-1",
      workspace_id: "workspace-1",
      schema_version: 1,
      request_id: "request-1",
      trace_id: "trace-1",
      attempt_count: 2,
      payload: {},
    },
    async () => undefined,
  );
  assert.equal(result.status, "succeeded");
});
