import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ProviderAdapterFailure,
  ProviderAdapterRegistry,
  classifyProviderAdapterFailure,
} from "../../packages/provider-adapters/dist/index.js";
import { ProviderAdapterService } from "../../apps/api/dist/provider-adapter-service.js";
import { buildApp } from "../../apps/api/dist/app.js";
import { ConfigError, loadRuntimeConfig } from "../../packages/config/dist/index.js";

const provider = {
  id: "00000000-0000-4000-8000-000000000731",
  code: "synthetic_adapter",
  name: "合成合同适配器",
  accessMode: "public_rss",
  targetUrl: "https://example.test/feed",
  parserVersion: "v1",
  timeoutMs: 1000,
  fields: ["title"],
  status: "disabled",
};
const actor = "00000000-0000-4000-8000-000000000732",
  now = new Date("2026-08-07T19:30:00.000Z"),
  limits = { healthTimeoutMs: 100, maxResponseBytes: 4096, maxItemsPerBatch: 2 };
const adapter = {
  key: provider.code,
  accessMode: "public_rss",
  version: "test-v1",
  collect: async () => ({
    records: [
      {
        externalId: "item-1",
        observedAt: now.toISOString(),
        evidenceRef: "evidence/item-1.json",
        payload: { title: "真实合成记录" },
      },
    ],
    nextCursor: null,
  }),
  normalize: (record, context) => ({
    external_id: record.externalId,
    observed_at: record.observedAt,
    canonical_url: "https://example.test/item-1",
    fields: { title: "真实合成记录" },
    evidence_ref: record.evidenceRef,
    provenance: {
      provider_id: context.provider.id,
      adapter_key: provider.code,
      adapter_version: "test-v1",
      parser_version: context.provider.parserVersion,
    },
  }),
  healthCheck: async () => ({ status: "ready", latencyMs: 7, errorCode: null, message: "ok" }),
};

test("M03-03.A01/A02/A04/A05/A12 collect normalize healthCheck enforce scope provenance and bounds", async () => {
  const registry = new ProviderAdapterRegistry(limits).register(adapter),
    context = {
      requestId: "request-1",
      traceId: "trace-1",
      organizationId: "00000000-0000-4000-8000-000000000733",
      workspaceId: "00000000-0000-4000-8000-000000000734",
      provider,
    };
  const batch = await registry.collect({ ...context, limit: 2 });
  assert.equal(batch.records.length, 1);
  const normalized = registry.normalize(provider.code, batch.records[0], context);
  assert.equal(normalized.provenance.provider_id, provider.id);
  assert.equal(normalized.evidence_ref, "evidence/item-1.json");
  assert.equal(
    (await registry.healthCheck({ requestId: "request-1", traceId: "trace-1", provider })).status,
    "ready",
  );
  await assert.rejects(
    () => registry.collect({ ...context, organizationId: "", limit: 2 }),
    (error) =>
      error instanceof ProviderAdapterFailure && error.code === "collect_scope_or_limit_invalid",
  );
  assert.throws(
    () => registry.normalize("wrong-key", batch.records[0], context),
    ProviderAdapterFailure,
  );
  const missing = new ProviderAdapterRegistry(limits);
  assert.throws(
    () => missing.healthCheck({ requestId: "r", traceId: "t", provider }),
    (error) => error instanceof ProviderAdapterFailure && error.code === "adapter_not_registered",
  );
  const timeout = new ProviderAdapterRegistry(limits).register({
    ...adapter,
    healthCheck: () => new Promise(() => {}),
  });
  await assert.rejects(
    () => timeout.healthCheck({ requestId: "r", traceId: "t", provider }),
    (error) => classifyProviderAdapterFailure(error).code === "timeout",
  );
  const oversized = new ProviderAdapterRegistry({ ...limits, maxResponseBytes: 1024 }).register({
    ...adapter,
    collect: async () => ({
      records: [
        {
          externalId: "item-1",
          observedAt: now.toISOString(),
          evidenceRef: "evidence/item-1.json",
          payload: "x".repeat(2000),
        },
      ],
      nextCursor: null,
    }),
  });
  await assert.rejects(
    () => oversized.collect({ ...context, limit: 2 }),
    (error) => error instanceof ProviderAdapterFailure && error.code === "response_too_large",
  );
});

test("M03-03.A10 runtime limits use validated Baota-configurable bounds", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "test",
    PROVIDER_ADAPTER_HEALTH_TIMEOUT_MS: "7000",
    PROVIDER_ADAPTER_MAX_RESPONSE_BYTES: "2048",
    PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH: "25",
    PROVIDER_PROXY_URL: "http://192.0.2.10:7893",
    PROVIDER_PROXY_USERNAME: "project-user",
    PROVIDER_PROXY_PASSWORD: "project-secret",
    PROVIDER_PROXY_CONNECT_TIMEOUT_MS: "5000",
  });
  assert.deepEqual(config.providerAdapters, {
    healthTimeoutMs: 7000,
    maxResponseBytes: 2048,
    maxItemsPerBatch: 25,
    proxy: {
      url: "http://192.0.2.10:7893/",
      username: "project-user",
      password: "project-secret",
      connectTimeoutMs: 5000,
    },
  });
  assert.throws(
    () => loadRuntimeConfig({ PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH: "5001" }),
    (error) => error instanceof ConfigError && error.key === "PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH",
  );
  assert.throws(
    () =>
      loadRuntimeConfig({
        PROVIDER_PROXY_URL: "http://192.0.2.10:7893",
        PROVIDER_PROXY_USERNAME: "project-user",
      }),
    (error) => error instanceof ConfigError && error.key === "PROVIDER_PROXY_PASSWORD",
  );
  assert.throws(
    () =>
      loadRuntimeConfig({
        PROVIDER_PROXY_URL: "socks5://192.0.2.10:7893",
        PROVIDER_PROXY_USERNAME: "project-user",
        PROVIDER_PROXY_PASSWORD: "project-secret",
      }),
    (error) => error instanceof ConfigError && error.key === "PROVIDER_PROXY_URL",
  );
});

test("M03-03.A04/A11/A12 missing implementation is persisted as truthful blocked health", async () => {
  let recorded;
  const unknown = {
      providerId: provider.id,
      adapterVersion: null,
      healthStatus: "unknown",
      lastCheckedAt: null,
      lastLatencyMs: null,
      lastErrorCode: null,
      consecutiveFailures: 0,
      version: 0,
      updatedAt: new Date(0).toISOString(),
    },
    repository = {
      list: async () => [{ provider, health: unknown }],
      getProvider: async () => provider,
      findReplay: async () => null,
      recordHealth: async (input) => (
        (recorded = input),
        {
          providerId: provider.id,
          adapterVersion: input.adapterVersion,
          healthStatus: input.signal.status,
          lastCheckedAt: input.now.toISOString(),
          lastLatencyMs: input.signal.latencyMs,
          lastErrorCode: input.signal.errorCode,
          consecutiveFailures: 1,
          version: 1,
          updatedAt: input.now.toISOString(),
        }
      ),
    },
    service = new ProviderAdapterService(
      repository,
      new ProviderAdapterRegistry(limits),
      () => now,
    ),
    result = await service.probe(provider.id, {
      actorId: actor,
      idempotencyKey: "probe-1",
      requestId: "request-1",
      traceId: "trace-1",
    });
  assert.equal(result.adapter_registered, false);
  assert.equal(result.health_status, "blocked");
  assert.equal(result.last_error_code, "adapter_not_registered");
  assert.equal(result.latest_runtime_category, "unknown");
  assert.equal(result.runtime_sample_count_24h, 0);
  assert.equal(result.runtime_success_rate_basis_points_24h, null);
  assert.equal(recorded.requestId, "request-1");
  assert.equal(recorded.traceId, "trace-1");
  assert.doesNotMatch(JSON.stringify(result), /cookie|secret|payload/i);
});

test("M03-03.A06/A09/A11/A13 API enforces provider configure, origin, idempotency and correlation", async () => {
  const calls = [],
    summary = {
      id: provider.id,
      code: provider.code,
      name: provider.name,
      access_mode: "public_rss",
      provider_status: "disabled",
      adapter_registered: false,
      adapter_version: null,
      health_status: "unknown",
      last_checked_at: null,
      last_latency_ms: null,
      last_error_code: null,
      consecutive_failures: 0,
      latest_runtime_category: "unknown",
      runtime_sample_count_24h: 0,
      runtime_success_rate_basis_points_24h: null,
      runtime_duration_p95_ms_24h: null,
      runtime_network_failure_count_24h: 0,
      runtime_parser_failure_count_24h: 0,
      runtime_login_failure_count_24h: 0,
      runtime_empty_success_count_24h: 0,
      version: 0,
      updated_at: new Date(0).toISOString(),
    },
    service = {
      list: async () => [summary],
      probe: async (id, context) => (
        calls.push({ id, context }),
        { ...summary, health_status: "blocked" }
      ),
    },
    authorization = { authorize: async (input) => calls.push(input) },
    auth = { authenticate: async () => ({ user: { id: actor }, session: { id: "session" } }) },
    app = buildApp({
      providerAdapters: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/provider-adapters",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "adapter-read",
      "x-trace-id": "adapter-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(calls[0], {
    actorId: actor,
    capability: "provider:configure",
    surface: "api",
    requestId: "adapter-read",
    traceId: "adapter-trace",
  });
  response = await app.inject({
    method: "POST",
    url: `/api/v1/platform/provider-adapters/${provider.id}/health-check`,
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "probe-api",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1).context.idempotencyKey, "probe-api");
  const forbidden = await app.inject({
    method: "POST",
    url: `/api/v1/platform/provider-adapters/${provider.id}/health-check`,
    headers: {
      cookie: "scoutops_session=test",
      origin: "https://evil.test",
      "idempotency-key": "blocked",
    },
  });
  assert.equal(forbidden.statusCode, 403);
  await app.close();
});

test("M03-03.A03/A06-A10/A13/A15-A17 delivery evidence covers adapters without inventing sources", async () => {
  const [
    up,
    down,
    pkg,
    repo,
    routes,
    service,
    web,
    css,
    shell,
    openapi,
    env,
    schema,
    architecture,
    runbook,
    feature,
    e2e,
    blueprint,
  ] = await Promise.all(
    [
      "database/migrations/0016c_provider_adapters_m03_03.up.sql",
      "database/migrations/0016c_provider_adapters_m03_03.down.sql",
      "packages/provider-adapters/src/index.ts",
      "apps/api/src/mysql-provider-adapter-repository.ts",
      "apps/api/src/provider-adapter-routes.ts",
      "apps/api/src/provider-adapter-service.ts",
      "apps/web/src/components/ProviderAdapterCenter.vue",
      "apps/web/src/provider-adapters.css",
      "apps/web/src/components/NavigationShell.vue",
      "docs/openapi.yaml",
      "config/env.example",
      "config/schema.json",
      "docs/architecture/m03-03-provider-adapters.md",
      "docs/runbooks/m03-03-provider-adapters.md",
      "docs/feature-map.json",
      "tests/e2e/m03-03-provider-adapter.spec.ts",
      "new-product-enterprise-blueprint.md",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const table of [
    "provider_adapter_health",
    "provider_adapter_health_versions",
    "provider_adapter_operations",
  ])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.doesNotMatch(up, /organization_id|workspace_id/);
  assert.match(down, /DROP TABLE IF EXISTS `provider_adapter_health`/);
  for (const method of ["collect", "normalize", "healthCheck"])
    assert.match(pkg, new RegExp(method));
  assert.match(repo, /FOR UPDATE/);
  assert.match(repo, /collection_subqueries/);
  assert.match(repo, /runtimeCategory/);
  assert.match(routes, /provider:configure/);
  assert.match(service, /adapter_not_registered/);
  assert.match(web, /loading.*ready.*empty.*error.*expired.*forbidden.*blocked/);
  assert.match(web, /成功率[\s\S]*P95[\s\S]*样本/);
  assert.match(web, /网络[\s\S]*解析[\s\S]*登录[\s\S]*空结果/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(shell, /provider-runtime-surface/);
  assert.match(openapi, /\/platform\/provider-adapters\/\{providerId\}\/health-check:/);
  assert.match(env, /PROVIDER_ADAPTER_MAX_RESPONSE_BYTES/);
  assert.match(schema, /providerAdapters/);
  assert.match(architecture, /M03-07/);
  assert.match(runbook, /宝塔.*Node API/s);
  assert.match(feature, /providerAdapters/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(blueprint, /M03-03/);
});
