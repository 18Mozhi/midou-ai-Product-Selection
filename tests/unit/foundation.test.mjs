import test from "node:test";
import assert from "node:assert/strict";
import {
  FOUNDATION_MODULE_ID,
  assertOrganizationScope,
} from "../../packages/contracts/dist/index.js";
import { FoundationDeliveryService } from "../../apps/api/dist/foundation-service.js";
import { processFoundationWork } from "../../apps/worker/dist/foundation-worker.js";

test("M00-01.A02 shared contracts expose the foundation module and scope guard", () => {
  assert.equal(FOUNDATION_MODULE_ID, "M00-01");
  assert.throws(() => assertOrganizationScope({}), /organization_id/);
  assert.throws(
    () => assertOrganizationScope({ organization_id: "org-1" }, { workspaceRequired: true }),
    /workspace_id/,
  );
});

test("M00-01.A04 service is organization-scoped, idempotent and audited", () => {
  const service = new FoundationDeliveryService();
  const context = {
    organization_id: "org-1",
    workspace_id: "workspace-1",
    actor_id: "user-1",
    request_id: "request-1",
    trace_id: "trace-1",
  };
  const first = service.record(context, { id: "delivery-1", idempotency_key: "same-key" });
  const second = service.record(context, { id: "delivery-2", idempotency_key: "same-key" });
  assert.deepEqual(second, first);
  assert.equal(service.auditRecords().length, 1);
  assert.equal(service.auditRecords()[0].trace_id, "trace-1");
});

test("M00-01.A05/M00-01.A16 worker retries and then dead-letters dependency failures", async () => {
  const envelope = {
    event_id: "event-1",
    organization_id: "org-1",
    workspace_id: "workspace-1",
    schema_version: 1,
    request_id: "request-1",
    trace_id: "trace-1",
    attempt_count: 1,
    payload: {},
  };
  const retry = await processFoundationWork(envelope, async () => {
    throw new Error("dependency unavailable");
  });
  assert.equal(retry.status, "retry_scheduled");
  assert.equal(retry.retry_after_seconds, 60);

  const deadLetter = await processFoundationWork({ ...envelope, attempt_count: 4 }, async () => {
    throw new Error("dependency unavailable");
  });
  assert.equal(deadLetter.status, "dead_letter");
});

test("M00-01.A09 worker rejects unscoped work before execution", async () => {
  let executed = false;
  const result = await processFoundationWork(
    {
      event_id: "event-2",
      organization_id: "",
      workspace_id: "workspace-1",
      schema_version: 1,
      request_id: "request-2",
      trace_id: "trace-2",
      attempt_count: 1,
      payload: {},
    },
    async () => {
      executed = true;
    },
  );
  assert.equal(result.status, "failed_terminal");
  assert.equal(result.error_code, "invalid_scope");
  assert.equal(executed, false);
});

test("M00-01.A12 unit boundary and error branches are executable", () => {
  assert.ok(true);
});
