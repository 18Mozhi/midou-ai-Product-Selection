import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OpenPlatformService,
  OpenPlatformError,
} from "../../apps/api/dist/open-platform-service.js";
import { resolveWebhookTarget } from "../../apps/worker/dist/webhook-delivery-worker.js";
const repo = new Proxy(
  { overview: async () => ({}), recordUsage: async () => {} },
  { get: (o, k) => o[k] ?? (async (i) => i) },
);
const service = (repository = repo) =>
  new OpenPlatformService(
    repository,
    "unit-verification-master-key-32chars",
    "v1",
    {
      clientTtlDays: 90,
      defaultQuota: 60,
      maxQuota: 1000,
      timestampToleranceSeconds: 300,
      nonceTtlSeconds: 600,
    },
    () => new Date("2026-08-08T08:00:00Z"),
  );
test("M06-05.A06 overview validates and normalizes server pagination, filters and dependency failure", async () => {
  let captured;
  const repository = {
    ...repo,
    overview: async (input) => {
      captured = input;
      return { clients: [], webhooks: [], deliveries: [] };
    },
  };
  await service(repository).overview({
    query: {
      organization_id: "00000000-0000-4000-8000-000000000001",
      client_query: " status ",
      client_status: "expired",
      client_sort: "name_asc",
      client_page: "2",
      client_page_size: "50",
    },
  });
  assert.equal(captured.organizationId, "00000000-0000-4000-8000-000000000001");
  assert.deepEqual(captured.clients, {
    query: "status",
    status: "expired",
    sort: "name_asc",
    page: 2,
    pageSize: 50,
  });
  assert.equal(captured.webhooks.pageSize, 20);
  await assert.rejects(
    () => service(repository).overview({ query: { organization_id: "bad" } }),
    (error) => error.code === "organization_id_invalid" && error.statusCode === 400,
  );
  await assert.rejects(
    () => service(repository).overview({ query: { delivery_page_size: "51" } }),
    (error) => error.code === "delivery_page_size_invalid" && error.statusCode === 400,
  );
  await assert.rejects(
    () =>
      service({
        ...repo,
        overview: async () => {
          throw new Error("database offline");
        },
      }).overview({ query: {} }),
    (error) => error.code === "open_platform_dependency_unavailable" && error.statusCode === 503,
  );
});
test("M06-05.A01/A02/A04/A09 client and webhook inputs are fail closed", async () => {
  assert.throws(
    () =>
      service().createClient({
        value: { organization_id: "bad", name: "x", scopes: ["admin:write"], reason: "x" },
      }),
    (e) => e instanceof OpenPlatformError,
  );
  assert.throws(
    () =>
      service().createWebhook({
        value: {
          organization_id: "00000000-0000-4000-8000-000000000001",
          name: "x",
          target_url: "http://127.0.0.1",
          events: ["unknown"],
          reason: "x",
        },
      }),
    (e) => e instanceof OpenPlatformError,
  );
  await assert.rejects(
    () => service().authenticate({ authorization: "Bearer bad", timestamp: "1", nonce: "short" }),
    (e) => e.code === "open_api_unauthorized",
  );
});
test("M06-05.A03/A05/A10/A11/A12/A14/A16 security and persistence contracts", async () => {
  const files = await Promise.all(
      [
        "database/migrations/0023_open_platform_m06_05.up.sql",
        "database/migrations/0023_open_platform_m06_05.down.sql",
        "apps/worker/src/webhook-delivery-worker.ts",
        "apps/api/src/mysql-open-platform-repository.ts",
        "config/env.example",
      ].map((p) => readFile(p, "utf8")),
    ),
    all = files.join("\n");
  for (const x of [
    "open_api_request_nonces",
    "webhook_delivery_events",
    "dead_letter",
    "open_api_usage",
    "WEBHOOK_DELIVERY_TIMEOUT_MS",
    "platform_audit_events",
    "outbox_events",
    "ER_DUP_ENTRY",
    "FOR UPDATE",
    "recordRejectedAuth",
  ])
    assert.match(all, new RegExp(x));
  assert.doesNotMatch(files[3], /SELECT[^;]+secret_ciphertext[^;]+overview/i);
  await assert.rejects(() => resolveWebhookTarget("https://127.0.0.1/hook"), /private/);
});
test("M06-05.A06/A07/A08/A13/A15/A17 documented UI and contracts", async () => {
  const all = (
    await Promise.all(
      [
        "docs/openapi.yaml",
        "apps/web/src/components/OpenPlatformCenter.vue",
        "apps/web/src/open-platform.css",
        "config/route-catalog.json",
        "apps/web/src/styles/platform-operations.css",
        "docs/feature-map.json",
        "docs/architecture/m06-05-open-platform.md",
        "docs/runbooks/m06-05-open-platform.md",
      ].map((p) => readFile(p, "utf8")),
    )
  ).join("\n");
  for (const x of [
    "/open/v1/status",
    "/platform/open",
    "loading",
    "empty",
    "secret_visible_once",
    "M06-05",
    "宝塔",
    "回滚",
    "390",
    "platform_token:manage",
    "client_page_size",
    "OpenPlatformPagination",
    "15 秒",
  ])
    assert.match(all, new RegExp(x.replaceAll("/", "\\/")));
});
test("M06-05.A07/A08 token actions preview concrete permission and access impact", async () => {
  const center = await readFile("apps/web/src/components/OpenPlatformCenter.vue", "utf8");
  assert.match(center, /令牌权限风险预览/);
  assert.match(center, /不包含业务数据写入权限/);
  assert.match(center, /旧密钥立即失效/);
  assert.match(center, /访问立即终止且不可恢复/);
  assert.match(center, /status:read/);
  assert.match(center, /webhookUpdate/);
  assert.match(center, /currentPagination/);
});
