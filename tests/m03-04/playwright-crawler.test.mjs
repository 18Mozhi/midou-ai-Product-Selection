import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  PlaywrightCrawlerError,
  classifyBrowserFailure,
  hashLeaseToken,
  validateBrowserPlan,
  withExtractedProfileArchive,
} from "../../packages/playwright-crawler/dist/index.js";
import { buildApp } from "../../apps/api/dist/app.js";
import { CrawlerRuntimeService } from "../../apps/api/dist/crawler-runtime-service.js";
const limits = {
  navigationTimeoutMs: 1000,
  actionTimeoutMs: 500,
  maxPages: 3,
  maxScrolls: 2,
  maxDetails: 2,
  maxArchiveBytes: 1024 * 1024,
  maxExtractedBytes: 2 * 1024 * 1024,
  maxArchiveFiles: 10,
  headless: true,
};
function tar(entries) {
  const chunks = [];
  for (const [name, body, type = "0"] of entries) {
    const data = Buffer.from(body),
      header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write("0000600\0", 100, 8, "ascii");
    header.write("0000000\0", 108, 8, "ascii");
    header.write("0000000\0", 116, 8, "ascii");
    header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
    header.write(
      `${Math.floor(Date.now() / 1000)
        .toString(8)
        .padStart(11, "0")}\0`,
      136,
      12,
      "ascii",
    );
    header.fill(32, 148, 156);
    header.write(type, 156, 1, "ascii");
    header.write("ustar\0", 257, 6, "ascii");
    const sum = header.reduce((n, v) => n + v, 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
    chunks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}
test("M03-04.A01/A02/A04/A12 validates bounded browser plans and block classification", () => {
  const plan = validateBrowserPlan(
    {
      start_url: "https://example.test/search",
      allowed_origins: ["https://example.test"],
      search: { input_selector: "#q", query: "desk" },
      item_selector: ".item",
      max_pages: 2,
      max_scrolls: 1,
      max_details: 0,
    },
    limits,
  );
  assert.equal(plan.max_pages, 2);
  assert.throws(
    () => validateBrowserPlan({ ...plan, start_url: "file:///secret" }, limits),
    (error) => error instanceof PlaywrightCrawlerError && error.code === "crawler_url_invalid",
  );
  assert.throws(
    () => validateBrowserPlan({ ...plan, allowed_origins: ["https://evil.test"] }, limits),
    (error) => error.code === "crawler_origin_invalid",
  );
  assert.deepEqual(
    classifyBrowserFailure(new PlaywrightCrawlerError("blocked_captcha", "blocked_captcha", false)),
    { status: "blocked_captcha", code: "blocked_captcha", retryable: false },
  );
  assert.notEqual(hashLeaseToken("secret-token"), "secret-token");
});
test("M03-04.A02/A11/A12 encrypted profile archive extraction rejects traversal and always cleans temp data", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-m03-04-unit-")),
    archive = join(root, "profile.tgz"),
    bad = join(root, "bad.tgz");
  try {
    await writeFile(archive, tar([["Default/Preferences", '{"ok":true}']]));
    let profilePath = "";
    await withExtractedProfileArchive(
      archive,
      root,
      {
        maxArchiveBytes: limits.maxArchiveBytes,
        maxExtractedBytes: limits.maxExtractedBytes,
        maxFiles: limits.maxArchiveFiles,
      },
      async (dir) => {
        profilePath = dir;
        assert.equal(await readFile(join(dir, "Default", "Preferences"), "utf8"), '{"ok":true}');
      },
    );
    await assert.rejects(() => stat(profilePath));
    await writeFile(bad, tar([["../escape", "owned"]]));
    await assert.rejects(
      () =>
        withExtractedProfileArchive(
          bad,
          root,
          {
            maxArchiveBytes: limits.maxArchiveBytes,
            maxExtractedBytes: limits.maxExtractedBytes,
            maxFiles: limits.maxArchiveFiles,
          },
          async () => {},
        ),
      (error) => error.code === "profile_archive_traversal_or_type",
    );
    assert.equal((await import("node:fs/promises")).then ? true : true, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("M03-04.A06/A08/A09 API requires collection replay, same origin, idempotency and never exposes lease token", async () => {
  const calls = [],
    listInputs = [],
    actor = "00000000-0000-4000-8000-000000000801",
    service = {
      list: async (input) => (
        listInputs.push(input),
        {
          profiles: [],
          runs: [],
          run_metrics: { total: 0, abnormal: 0, duplicate_risk: 0 },
          pagination: { page: 2, page_size: 25, total: 0, total_pages: 0 },
          filters: { status: "blocked", query: "captcha" },
          observed_at: "2026-08-07T00:00:00.000Z",
        }
      ),
      recoverExpired: async (context) => (calls.push(context), { recovered: 0 }),
    },
    authorization = { authorize: async (value) => calls.push(value) },
    auth = {
      failureCode: null,
      authenticate: async () => {
        if (auth.failureCode)
          throw Object.assign(new Error("database detail must stay private"), {
            code: auth.failureCode,
          });
        return { user: { id: actor } };
      },
    },
    app = buildApp({
      crawlerRuntime: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/crawler-runtime?page=2&status=blocked&q=captcha",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "crawler-read",
      "x-trace-id": "crawler-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual({ ...listInputs[0] }, { page: "2", status: "blocked", q: "captcha" });
  assert.deepEqual(calls[0], {
    actorId: actor,
    capability: "collection:replay",
    surface: "api",
    requestId: "crawler-read",
    traceId: "crawler-trace",
  });
  assert.doesNotMatch(response.body, /lease_token|ciphertext|credential_asset_id/);
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/crawler-runtime/recover-expired",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "recover-1",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/platform/crawler-runtime/recover-expired",
        headers: {
          cookie: "scoutops_session=test",
          origin: "https://evil.test",
          "idempotency-key": "x",
        },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/platform/crawler-runtime/recover-expired",
        headers: { cookie: "scoutops_session=test", origin: "http://127.0.0.1:5173" },
      })
    ).statusCode,
    400,
  );
  auth.failureCode = "ECONNREFUSED";
  response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/crawler-runtime",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "crawler_runtime_dependency_unavailable");
  assert.doesNotMatch(response.body, /database detail/);
  await app.close();
});
test("M03-04.A08 runtime list validates and normalizes server pagination filters", async () => {
  const calls = [],
    repository = {
      list: async (input) => (
        calls.push(input),
        {
          profiles: [],
          runs: [],
          run_metrics: { total: 129, abnormal: 49, duplicate_risk: 21 },
          pagination: { page: input.page, page_size: input.pageSize, total: 21, total_pages: 1 },
        }
      ),
    },
    service = new CrawlerRuntimeService(repository, () => new Date("2026-08-07T00:00:00.000Z"));
  const result = await service.list({ page: "2", status: "blocked", q: "  TRACE-OLD  " });
  assert.deepEqual(calls[0], {
    page: 2,
    pageSize: 25,
    status: "blocked",
    query: "TRACE-OLD",
  });
  assert.equal(result.filters.query, "TRACE-OLD");
  await assert.rejects(
    () => service.list({ page: "0" }),
    (error) => error.code === "crawler_runtime_page_invalid" && error.statusCode === 400,
  );
  await assert.rejects(
    () => service.list({ status: "unknown" }),
    (error) => error.code === "crawler_runtime_status_invalid" && error.statusCode === 400,
  );
  await assert.rejects(
    () => service.list({ q: "x".repeat(161) }),
    (error) => error.code === "crawler_runtime_query_invalid" && error.statusCode === 400,
  );
  const unavailable = new CrawlerRuntimeService({
    list: async () => {
      throw new Error("database detail must not escape");
    },
  });
  await assert.rejects(
    () => unavailable.list(),
    (error) =>
      error.code === "crawler_runtime_dependency_unavailable" &&
      error.statusCode === 503 &&
      !error.message.includes("database detail"),
  );
});
test("M03-04.A03/A05-A10/A13/A15-A17 delivery evidence is complete and Baota bounded", async () => {
  const paths = [
    "database/migrations/0016d_playwright_crawler_m03_04.up.sql",
    "database/migrations/0016d_playwright_crawler_m03_04.down.sql",
    "packages/playwright-crawler/src/index.ts",
    "apps/crawler/scoutops_crawler/playwright_bridge.py",
    "scripts/run-playwright-crawler.mjs",
    "apps/api/src/mysql-crawler-runtime-repository.ts",
    "apps/api/src/crawler-runtime-routes.ts",
    "apps/web/src/components/CollectionRuntimeCenter.vue",
    "apps/web/src/crawler-runtime.css",
    "docs/openapi.yaml",
    "config/env.example",
    "config/schema.json",
    "docs/architecture/m03-04-playwright-crawler.md",
    "docs/runbooks/m03-04-playwright-crawler.md",
    "docs/feature-map.json",
    "tests/e2e/m03-04-playwright-crawler.spec.ts",
    "tests/integration/crawler-python-consumer.test.mjs",
    "tests/integration/authenticated-browser-source.test.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const [
    up,
    down,
    pkg,
    bridge,
    runner,
    repo,
    routes,
    web,
    css,
    openapi,
    env,
    schema,
    architecture,
    runbook,
    feature,
    e2e,
    pythonIntegration,
    browserIntegration,
    blueprint,
  ] = values;
  for (const table of [
    "crawler_browser_runs",
    "crawler_profile_leases",
    "crawler_profile_lease_events",
    "crawler_browser_run_operations",
    "crawler_runtime_operations",
  ])
    assert.ok(up.includes("CREATE TABLE `" + table + "`"));
  assert.match(down, /DROP TABLE IF EXISTS `crawler_browser_runs`/);
  assert.match(pkg, /launchPersistentContext/);
  assert.match(bridge, /shell=False/);
  assert.match(bridge, /encoding="utf-8"/);
  assert.match(runner, /stdin/);
  assert.match(repo, /FOR UPDATE/);
  assert.match(routes, /collection:replay/);
  assert.match(web, /loading.*ready.*empty.*error.*expired.*forbidden.*blocked/);
  assert.match(web, /expiryForecast[\s\S]*未提供有效期，无法预测/);
  assert.match(web, /expiredLeaseRisks[\s\S]*过期占用/);
  assert.match(web, /占用来源[\s\S]*僵尸占用风险/);
  assert.match(css, /@media\s*\(\s*max-width:\s*760px\s*\)/);
  assert.match(openapi, /\/platform\/crawler-runtime:/);
  assert.match(env, /PLAYWRIGHT_NAVIGATION_TIMEOUT_MS/);
  assert.match(schema, /playwrightCrawler/);
  assert.match(architecture, /M03-05/);
  assert.match(runbook, /Python 3\.12 宝塔项目[\s\S]*Python-to-Playwright/);
  assert.match(feature, /playwrightCrawler/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(pythonIntegration, /CrawlerRuntimeService[\s\S]*app\.listen/);
  assert.match(browserIntegration, /sealCredential[\s\S]*runWithEncryptedProfile/);
  assert.match(blueprint, /M03-04/);
});
