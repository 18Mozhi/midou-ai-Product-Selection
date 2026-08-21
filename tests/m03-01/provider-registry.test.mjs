import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ProviderRegistryError,
  ProviderRegistryService,
} from "../../apps/api/dist/provider-registry-service.js";
import { buildApp } from "../../apps/api/dist/app.js";
const actor = "00000000-0000-4000-8000-000000000701",
  now = new Date("2026-08-07T17:00:00.000Z"),
  read = (path) => readFile(path, "utf8"),
  valid = {
    code: "public_signal_rss",
    name: "公开趋势 RSS",
    target_url: "https://example.test/feed",
    access_mode: "public_rss",
    markets: ["US"],
    languages: ["en-US"],
    fields: ["title", "summary", "published_at", "canonical_url", "publisher"],
    schedule_minutes: 30,
    concurrency_limit: 1,
    timeout_ms: 15000,
    retry_limit: 2,
    circuit_failure_threshold: 5,
    dedupe_key: "canonical_url",
    retention_days: 365,
    failure_rules: ["timeout", "rate_limited", "parser_changed", "empty"],
    parser_version: "v1",
    healthcheck_url: "https://example.test/health",
    owner_label: "平台运营",
    terms_review_status: "pending",
    terms_reference_url: null,
    terms_version: null,
    terms_expires_at: null,
    status: "disabled",
  };
test("M03-01.A01/A02/A04/A05/A12 validates the complete synchronous technical contract", async () => {
  let captured;
  const service = new ProviderRegistryService(
      {
        list: async () => [],
        create: async (input) => (
          (captured = input),
          {
            id: input.id,
            ...input.value,
            version: 1,
            updated_at: input.now.toISOString(),
          }
        ),
        update: async () => {
          throw new Error("unused");
        },
      },
      () => now,
    ),
    created = await service.create(valid, {
      actorId: actor,
      idempotencyKey: "create-1",
      requestId: "request-1",
      traceId: "trace-1",
    });
  assert.equal(created.status, "disabled");
  assert.equal(created.terms_reviewed_at, null);
  assert.equal(captured.actorId, actor);
  assert.equal(captured.requestId, "request-1");
  assert.equal(created.updated_at, now.toISOString());
  for (const patch of [
    { name: undefined },
    { target_url: "ftp://example.test/feed" },
    { schedule_minutes: 0 },
    { concurrency_limit: 21 },
    { timeout_ms: 999 },
    { dedupe_key: "" },
    { owner_label: "x" },
    { healthcheck_url: "file:///health" },
    { markets: [] },
    { terms_review_status: "invalid" },
    { terms_version: "包含空格" },
    { terms_expires_at: "not-a-date" },
  ])
    assert.throws(
      () =>
        service.create(
          { ...valid, ...patch },
          {
            actorId: actor,
            idempotencyKey: "bad",
            requestId: "request-bad",
            traceId: "trace-bad",
          },
        ),
      ProviderRegistryError,
    );
  assert.throws(
    () =>
      service.create(
        { ...valid, status: "enabled", terms_review_status: "pending" },
        {
          actorId: actor,
          idempotencyKey: "missing-compliance",
          requestId: "missing-compliance",
          traceId: "missing-compliance",
        },
      ),
    (error) =>
      error instanceof ProviderRegistryError && error.code === "public_source_compliance_required",
  );
  const approved = await service.create(
    {
      ...valid,
      status: "enabled",
      terms_review_status: "approved",
      terms_reference_url: "https://example.test/terms",
      terms_version: "2026-08",
      terms_expires_at: "2027-08-07T17:00:00.000Z",
    },
    {
      actorId: actor,
      idempotencyKey: "approved",
      requestId: "approved",
      traceId: "approved",
    },
  );
  assert.equal(approved.terms_reviewed_at, now.toISOString());
  assert.equal(approved.terms_version, "2026-08");
});
test("M03-01.A04/A06/A09/A11/A13 API enforces platform capability, origin, idempotency and correlation", async () => {
  const calls = [],
    definition = {
      id: "00000000-0000-4000-8000-000000000702",
      ...valid,
      version: 1,
      updated_at: now.toISOString(),
    },
    service = {
      list: async () => [definition],
      create: async (value, context) => (calls.push({ value, context }), definition),
      update: async () => definition,
    },
    authorization = { authorize: async (input) => calls.push(input) },
    auth = {
      authenticate: async () => ({
        user: { id: actor },
        session: { id: "session" },
      }),
    },
    app = buildApp({
      providerRegistry: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/providers",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "m03-01-read",
      "x-trace-id": "m03-01-read-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(response.json().request_id, "m03-01-read");
  assert.deepEqual(calls[0], {
    actorId: actor,
    capability: "provider:configure",
    surface: "api",
    requestId: "m03-01-read",
    traceId: "m03-01-read-trace",
  });
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/providers",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "create-api",
      "content-type": "application/json",
    },
    payload: valid,
  });
  assert.equal(response.statusCode, 201);
  assert.equal(calls.at(-1).context.idempotencyKey, "create-api");
  const forbidden = await app.inject({
    method: "POST",
    url: "/api/v1/platform/providers",
    headers: {
      cookie: "scoutops_session=test",
      origin: "https://evil.test",
      "idempotency-key": "blocked",
      "content-type": "application/json",
    },
    payload: valid,
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "origin_forbidden");
  await app.close();
});
test("M03-01.A03/A06-A10/A13/A15-A17 delivery contracts are complete and platform-global", async () => {
  const [
    up,
    down,
    repo,
    routes,
    service,
    web,
    styles,
    shell,
    openapi,
    env,
    architecture,
    runbook,
    feature,
    e2e,
    blueprint,
  ] = await Promise.all(
    [
      "database/migrations/0016a_provider_registry_m03_01.up.sql",
      "database/migrations/0016a_provider_registry_m03_01.down.sql",
      "apps/api/src/mysql-provider-registry-repository.ts",
      "apps/api/src/provider-registry-routes.ts",
      "apps/api/src/provider-registry-service.ts",
      "apps/web/src/components/ProviderRegistry.vue",
      "apps/web/src/provider-registry.css",
      "apps/web/src/components/NavigationShell.vue",
      "docs/openapi.yaml",
      "config/env.example",
      "docs/architecture/m03-01-provider-registry.md",
      "docs/runbooks/m03-01-provider-registry.md",
      "docs/feature-map.json",
      "tests/e2e/m03-01-provider-registry.spec.ts",
      "new-product-enterprise-blueprint.md",
    ].map(read),
  );
  const [complianceUp, policy, executor] = await Promise.all(
    [
      "database/migrations/0052b_provider_public_compliance.up.sql",
      "packages/provider-sources/src/public-collection-policy.ts",
      "apps/worker/src/provider-source-executor.ts",
    ].map(read),
  );
  for (const table of ["providers", "provider_versions", "provider_operations"])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.doesNotMatch(up, /organization_id|workspace_id/);
  assert.match(up, /CHAR\(36\) CHARACTER SET ascii/);
  assert.match(down, /DROP TABLE IF EXISTS `providers`/);
  assert.match(repo, /FOR UPDATE/);
  assert.match(repo, /idempotency_key/);
  assert.match(routes, /provider:configure/);
  assert.match(routes, /origin_forbidden/);
  assert.match(service, /expectedVersion/);
  assert.match(
    web,
    /loading[\s\S]*ready[\s\S]*empty[\s\S]*error[\s\S]*expired[\s\S]*forbidden[\s\S]*blocked/,
  );
  assert.match(web, /status\s*:\s*["']disabled["']/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(shell, /provider-runtime-surface/);
  assert.match(web, /基本信息[\s\S]*范围与字段[\s\S]*执行策略[\s\S]*合规与发布/);
  assert.match(web, /应用技术模板/);
  assert.match(web, /items\.length && !editorOpen/);
  assert.match(openapi, /\/platform\/providers\/\{providerId\}:/);
  assert.match(openapi, /ProviderDefinitionInput:/);
  assert.match(complianceUp, /terms_review_status/);
  assert.match(policy, /robots\.txt/);
  assert.match(executor, /assertPublicCollectionPolicy/);
  assert.doesNotMatch(env, /PROVIDER_REGISTRY_|PROVIDER_TARGET_/);
  assert.match(architecture, /平台全局/);
  assert.match(runbook, /宝塔.*Node API/s);
  assert.match(feature, /providerRegistry/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(blueprint, /M03-01/);
});
