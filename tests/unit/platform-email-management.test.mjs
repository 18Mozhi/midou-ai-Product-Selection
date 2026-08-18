import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PlatformDashboardError,
  PlatformDashboardService,
} from "../../apps/api/dist/platform-dashboard-service.js";

test("platform email management validates source, action and audited reason", async () => {
  const calls = [];
  const service = new PlatformDashboardService({
    manageEmailDelivery: async (input) => {
      calls.push(input);
      return { status: "queued" };
    },
  });
  await service.manageEmailDelivery(
    "account",
    "00000000-0000-4000-8000-000000000901",
    { action: "retry", reason: "故障恢复后重试" },
    {
      actorId: "actor",
      idempotencyKey: "idem",
      requestId: "request",
      traceId: "trace",
    },
  );
  assert.equal(calls[0].source, "account");
  assert.equal(calls[0].action, "retry");
  assert.match(calls[0].route, /\/email\/account\/.+\/actions$/);
  assert.throws(
    () =>
      service.manageEmailDelivery(
        "account",
        "00000000-0000-4000-8000-000000000901",
        { action: "suppress", reason: "不要发送" },
        {
          actorId: "actor",
          idempotencyKey: "idem-2",
          requestId: "request",
          traceId: "trace",
        },
      ),
    (error) =>
      error instanceof PlatformDashboardError &&
      error.code === "account_email_suppress_forbidden",
  );
});

test("platform email management keeps UI, route, OpenAPI and audit operation aligned", async () => {
  const [web, route, repository, openapi] = await Promise.all(
    [
      "apps/web/src/components/PlatformManagementCenter.vue",
      "apps/api/src/platform-dashboard-routes.ts",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "docs/openapi.yaml",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(web, /重新投递/);
  assert.match(web, /抑制投递/);
  assert.match(route, /management\/email\/:source\/:deliveryId\/actions/);
  assert.match(repository, /email\.delivery\.\$\{i\.action\}/);
  assert.match(openapi, /management\/email\/\{source\}\/\{deliveryId\}\/actions/);
});
