import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlProviderSourceRepository } from "../../apps/api/dist/mysql-provider-source-repository.js";
import { ProviderSourceServiceError } from "../../apps/api/dist/provider-source-service.js";
import { ProviderSourceService } from "../../apps/api/dist/provider-source-service.js";
import { MySqlAuthenticatedBrowserJobClient } from "../../apps/worker/dist/authenticated-browser-job-client.js";
import { MySqlEvidencePersistence } from "../../apps/worker/dist/evidence-persistence.js";
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
const artifact = (kind, contentType, content) => {
  const buffer = Buffer.from(content);
  return {
    kind,
    source_url: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
    content_type: contentType,
    content_base64: buffer.toString("base64"),
    content_sha256: createHash("sha256").update(buffer).digest("hex"),
    captured_at: "2026-08-20T01:00:00.000Z",
    parser_version: ALIBABA_1688_BROWSER_PARSER_VERSION,
  };
};

test("authenticated browser job client links a business subquery and parses the returned fixed snapshot", async () => {
  const statements = [];
  const pool = {
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.startsWith("SELECT id,status"))
        return [
          [
            {
              id: ids.job,
              status: "succeeded",
              error_code: null,
              result_json: {
                status: "succeeded",
                error_code: null,
                snapshots: { search: searchSnapshot },
                artifacts: [
                  artifact("dom_fragment", "text/html", '<a href="/offer/123">桌面灯</a>'),
                  artifact("screenshot", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
                ],
              },
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  let heartbeats = 0;
  const collection = await new MySqlAuthenticatedBrowserJobClient(pool, 1, async () => {}).collect(
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
  assert.equal(collection.records[0].externalId, "1688-search:1234567890");
  assert.equal(collection.parseError, null);
  assert.equal(collection.artifacts.length, 2);
  assert.equal(collection.artifacts[0].parser_version, ALIBABA_1688_BROWSER_PARSER_VERSION);
  assert.equal(heartbeats, 1);
  assert.match(statements[0].sql, /browser_collection_jobs/);
  assert.equal(
    JSON.parse(statements[0].values[6]).plan.start_url,
    create1688BrowserExecutionRequest({ query: "桌面灯" }).plan.start_url,
  );
});

test("browser screenshot and DOM fragment are persisted with task, job and parser version", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-browser-evidence-")),
    statements = [],
    connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql, values) => {
        statements.push({ sql, values });
        if (sql.startsWith("SELECT p.retention_days")) return [[{ retention_days: 7 }]];
        if (sql.startsWith("SELECT id,content_sha256")) return [[]];
        return [{ affectedRows: 1 }];
      },
    },
    pool = { getConnection: async () => connection },
    content = Buffer.from('<a href="/offer/123">桌面灯</a>');
  try {
    const result = await new MySqlEvidencePersistence(pool, root, 1_000_000).persistBrowserArtifact(
      {
        organizationId: ids.org,
        workspaceId: ids.workspace,
        taskId: ids.task,
        subqueryId: ids.subquery,
        providerId: ids.provider,
        browserJobId: ids.job,
        kind: "dom_fragment",
        sourceUrl: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
        contentType: "text/html",
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
        capturedAt: new Date("2026-08-20T01:00:00.000Z"),
        parserVersion: ALIBABA_1688_BROWSER_PARSER_VERSION,
        requestId: "browser-evidence-request",
        traceId: "browser-evidence-trace",
        actorId: ids.actor,
      },
    );
    assert.equal(result.deduplicated, false);
    const inserted = statements.find((item) =>
      item.sql.startsWith("INSERT INTO browser_evidence_artifacts"),
    );
    assert.equal(inserted.values[6], ids.job);
    assert.equal(inserted.values[14], ALIBABA_1688_BROWSER_PARSER_VERSION);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
  const sqlStatements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      sqlStatements.push(sql);
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
  const acceptanceSql = sqlStatements.find((sql) => sql.includes("last_replay_status"));
  assert.match(acceptanceSql, /last_replay_status='passed'/);
  assert.match(acceptanceSql, /r\.created_at=s\.last_replay_at/);
});

test("real browser snapshots can be fixed and replayed against the current 1688 parser", async () => {
  let stored = null;
  const repository = {
      parserSampleByOperation: async () => null,
      parserReplayByOperation: async () => null,
      parserSampleCandidate: async () => ({
        browser_job_id: ids.job,
        organization_id: ids.org,
        workspace_id: ids.workspace,
        captured_at: "2026-08-20T01:00:00.000Z",
        item_count: 1,
        parser_version: ALIBABA_1688_BROWSER_PARSER_VERSION,
        snapshots: { search: searchSnapshot },
      }),
      createParserSample: async (input) => {
        stored = input;
        return {
          id: input.sampleId,
          provider_id: input.providerId,
          browser_job_id: input.browserJobId,
          name: input.name,
          baseline_parser_version: input.parserVersion,
          last_replay_status: "never",
          last_replay_at: null,
          created_at: input.now.toISOString(),
        };
      },
      loadParserSample: async () => ({
        sample: { id: stored.sampleId },
        snapshots: stored.snapshots,
        baselineOutput: stored.baselineOutput,
        providerCode: "1688_search",
        parserVersion: ALIBABA_1688_BROWSER_PARSER_VERSION,
      }),
      recordParserReplay: async (input) => input,
    },
    service = new ProviderSourceService(repository, () => new Date("2026-08-20T02:00:00.000Z")),
    context = {
      actorId: ids.actor,
      idempotencyKey: "parser-sample-key",
      requestId: "parser-sample-request",
      traceId: "parser-sample-trace",
    },
    sample = await service.createParserSample(
      ids.provider,
      { browser_job_id: ids.job, name: "真实登录样本" },
      context,
    );
  assert.equal(sample.baseline_parser_version, ALIBABA_1688_BROWSER_PARSER_VERSION);
  assert.equal(stored.baselineOutput[0].fields.title, "桌面灯");
  repository.parserSampleByOperation = async () => sample;
  repository.parserSampleCandidate = async () => {
    throw new Error("idempotent retry must not reload the consumed candidate");
  };
  assert.equal(
    await service.createParserSample(
      ids.provider,
      { browser_job_id: ids.job, name: "真实登录样本" },
      context,
    ),
    sample,
  );
  const replay = await service.replayParserSample(ids.provider, sample.id, {
    ...context,
    idempotencyKey: "parser-replay-key",
  });
  assert.equal(replay.status, "passed");
  assert.deepEqual(replay.diff, []);
  repository.parserReplayByOperation = async () => replay;
  const loadParserSample = repository.loadParserSample;
  repository.loadParserSample = async () => {
    throw new Error("idempotent retry must not reload the parser sample");
  };
  assert.equal(
    await service.replayParserSample(ids.provider, sample.id, {
      ...context,
      idempotencyKey: "parser-replay-key",
    }),
    replay,
  );
  repository.parserReplayByOperation = async () => null;
  repository.loadParserSample = loadParserSample;
  stored.baselineOutput[0].fields.title = "旧标题";
  const changed = await service.replayParserSample(ids.provider, sample.id, {
    ...context,
    idempotencyKey: "parser-replay-changed-key",
  });
  assert.equal(changed.status, "changed");
  assert.deepEqual(changed.diff, [
    { path: "$[0].fields.title", before: "旧标题", after: "桌面灯" },
  ]);
});

test("parser sample creation rejects evidence produced by a different parser version", async () => {
  const service = new ProviderSourceService({
    parserSampleByOperation: async () => null,
    parserSampleCandidate: async () => ({
      browser_job_id: ids.job,
      organization_id: ids.org,
      workspace_id: ids.workspace,
      captured_at: "2026-08-20T01:00:00.000Z",
      item_count: 1,
      parser_version: "stale-parser-v0",
      snapshots: { search: searchSnapshot },
    }),
  });
  await assert.rejects(
    () =>
      service.createParserSample(
        ids.provider,
        { browser_job_id: ids.job, name: "旧版真实样本" },
        {
          actorId: ids.actor,
          idempotencyKey: "stale-parser-key",
          requestId: "stale-parser-request",
          traceId: "stale-parser-trace",
        },
      ),
    (error) =>
      error instanceof ProviderSourceServiceError &&
      error.code === "parser_sample_parser_unavailable",
  );
});
