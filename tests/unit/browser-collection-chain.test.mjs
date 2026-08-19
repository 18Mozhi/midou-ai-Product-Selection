import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlProviderSourceRepository } from "../../apps/api/dist/mysql-provider-source-repository.js";
import { ProviderSourceServiceError } from "../../apps/api/dist/provider-source-service.js";
import { MySqlAuthenticatedBrowserJobClient } from "../../apps/worker/dist/authenticated-browser-job-client.js";
import {
  ALIBABA_1688_BROWSER_PARSER_VERSION,
  ALIBABA_1688_SNAPSHOT_SCHEMAS,
  create1688BrowserExecutionRequest,
} from "../../packages/provider-sources/dist/index.js";

const ids = {
  actor: "00000000-0000-4000-8000-000000000481",
  org: "00000000-0000-4000-8000-000000000482",
  workspace: "00000000-0000-4000-8000-000000000483",
  task: "00000000-0000-4000-8000-000000000484",
  subquery: "00000000-0000-4000-8000-000000000485",
  provider: "00000000-0000-4000-8000-000000000486",
  job: "00000000-0000-4000-8000-000000000487",
  run: "00000000-0000-4000-8000-000000000488",
  profile: "00000000-0000-4000-8000-000000000489",
};

const searchSnapshot = {
  schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
  source_url: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
  observed_at: "2026-08-20T01:00:00.000Z",
  items: [
    {
      offer_id: "1234567890",
      title: "桌面灯",
      supplier_id: "supplier-1",
      supplier_name: "示例供应商",
      quoted_price: 12.5,
      currency: "CNY",
      moq: 10,
      location: "广东 惠州",
      canonical_url: "https://detail.1688.com/offer/1234567890.html",
      dom_fragment: '<article data-offer-id="1234567890">桌面灯</article>',
      source_paths: {
        title: "article h2",
        supplier_name: "article .company",
        quoted_price: "article .price",
        moq: "article .moq",
        location: "article .location",
        canonical_url: "article a[href]",
      },
    },
  ],
};

test("authenticated browser job client links a business subquery and parses the returned fixed snapshot", async () => {
  const statements = [];
  const pool = {
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.startsWith("SELECT status"))
        return [
          [
            {
              status: "succeeded",
              error_code: null,
              result_json: {
                status: "succeeded",
                error_code: null,
                snapshots: { search: searchSnapshot },
              },
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  let heartbeats = 0;
  const records = await new MySqlAuthenticatedBrowserJobClient(pool, 1, async () => {}).collect(
    {
      organizationId: ids.org,
      workspaceId: ids.workspace,
      taskId: ids.task,
      subqueryId: ids.subquery,
      provider: {
        id: ids.provider,
        code: "1688_search",
        accessMode: "authenticated_browser",
        targetUrl: "https://s.1688.com/selloffer/offer_search.htm",
        parserVersion: ALIBABA_1688_BROWSER_PARSER_VERSION,
        timeoutMs: 1000,
        fields: ["title"],
      },
      target: { query: "桌面灯" },
      requestId: "browser-job-request",
      traceId: "browser-job-trace",
    },
    async () => {
      heartbeats += 1;
    },
  );
  assert.equal(records[0].externalId, "1688-search:1234567890");
  assert.equal(heartbeats, 1);
  assert.match(statements[0].sql, /browser_collection_jobs/);
  assert.equal(
    JSON.parse(statements[0].values[6]).plan.start_url,
    create1688BrowserExecutionRequest({ query: "桌面灯" }).plan.start_url,
  );
});

test("internal browser job API returns encrypted assignment only to the crawler service", async () => {
  const calls = [];
  const service = {
    acquireJob: async (input) => (
      calls.push(["acquire", input]),
      {
        job: {
          id: ids.job,
          collection_task_id: ids.task,
          collection_subquery_id: ids.subquery,
          provider_id: ids.provider,
          provider_code: "1688_search",
          execution_request: { plan: {} },
        },
        run: { id: ids.run, request_id: "request", trace_id: "trace" },
        profile: { id: ids.profile, locale: "zh-CN", timezone: "Asia/Shanghai" },
        credential: {
          asset_id: "asset",
          asset_version: 1,
          kind: "cookie_bundle",
          key_version: "v1",
          ciphertext_base64: "YQ==",
          nonce_base64: "Yg==",
          auth_tag_base64: "Yw==",
        },
        lease_token: "x".repeat(64),
      }
    ),
    heartbeatJob: async (input) => calls.push(["heartbeat", input]),
    finishJob: async (input) => calls.push(["complete", input]),
    list: async () => ({ profiles: [], runs: [], observed_at: "2026-08-20T01:00:00.000Z" }),
    recoverExpired: async () => ({ recovered: 0 }),
  };
  const app = buildApp({
    crawlerRuntime: {
      service,
      authorization: { authorize: async () => {} },
      auth: { authenticate: async () => ({ user: { id: ids.actor } }) },
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      serviceToken: "s".repeat(32),
      serviceActorId: ids.actor,
    },
  });
  const unauthorized = await app.inject({
    method: "POST",
    url: "/api/v1/internal/crawler-runtime/jobs/acquire",
    payload: { lease_owner: "crawler-1", lease_seconds: 120 },
  });
  assert.equal(unauthorized.statusCode, 401);
  const headers = {
    authorization: `Bearer ${"s".repeat(32)}`,
    "x-request-id": "request",
    "x-trace-id": "trace",
  };
  const acquired = await app.inject({
    method: "POST",
    url: "/api/v1/internal/crawler-runtime/jobs/acquire",
    headers,
    payload: { lease_owner: "crawler-1", lease_seconds: 120 },
  });
  assert.equal(acquired.statusCode, 200);
  assert.equal(acquired.json().data.job.collection_task_id, ids.task);
  assert.equal(acquired.json().data.credential.ciphertext_base64, "YQ==");
  const completed = await app.inject({
    method: "POST",
    url: `/api/v1/internal/crawler-runtime/jobs/${ids.job}/complete`,
    headers,
    payload: {
      run_id: ids.run,
      profile_id: ids.profile,
      lease_token: "x".repeat(64),
      status: "succeeded",
      page_count: 1,
      item_count: 1,
      detail_count: 0,
      duration_ms: 20,
      error_code: null,
      result: { status: "succeeded_empty" },
    },
  });
  assert.equal(completed.statusCode, 200);
  assert.equal(calls.at(-1)[0], "complete");
  await app.close();
});

test("1688 cannot be enabled before real logged-in fixed-sample replay is accepted", async () => {
  let queryIndex = 0;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async () => {
      queryIndex += 1;
      if (queryIndex === 1) return [[]];
      return [
        [
          {
            id: ids.provider,
            code: "1688_search",
            status: "disabled",
            version: 1,
            schedule_minutes: 30,
            timeout_ms: 20_000,
            retry_limit: 2,
            updated_at: "2026-08-20T01:00:00.000Z",
          },
        ],
      ];
    },
  };
  const repository = new MySqlProviderSourceRepository({
    getConnection: async () => connection,
  });
  await assert.rejects(
    () =>
      repository.updateConfiguration({
        providerId: ids.provider,
        scheduleMinutes: 30,
        timeoutMs: 20_000,
        retryLimit: 2,
        status: "enabled",
        expectedVersion: 1,
        reason: "尝试启用",
        actorId: ids.actor,
        route: `/platform/provider-sources/${ids.provider}/configuration`,
        idempotencyKey: "enable-1688-before-acceptance",
        requestId: "request",
        traceId: "trace",
        now: new Date("2026-08-20T01:00:00.000Z"),
      }),
    (error) =>
      error instanceof ProviderSourceServiceError &&
      error.code === "provider_source_setup_required" &&
      error.statusCode === 409,
  );
});
