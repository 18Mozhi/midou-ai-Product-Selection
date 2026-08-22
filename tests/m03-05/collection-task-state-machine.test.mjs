import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertTaskTransition,
  classifyCollectionFailure,
  retryAvailableAt,
  summarizeCoverage,
} from "../../packages/collection-tasks/dist/index.js";
import {
  processCollectionTaskOnce,
  CollectionExecutionError,
} from "../../apps/worker/dist/collection-task-worker.js";
import { buildApp } from "../../apps/api/dist/app.js";
import { CollectionTaskService } from "../../apps/api/dist/collection-task-service.js";
import { MySqlCollectionTaskRepository } from "../../apps/api/dist/mysql-collection-task-repository.js";

test("M03-05.A01/A02/A04/A12 enforces transitions, retries and terminal coverage", () => {
  assert.equal(assertTaskTransition("draft", "scheduled"), "scheduled");
  assert.equal(assertTaskTransition("running", "retry_scheduled"), "retry_scheduled");
  assert.throws(
    () => assertTaskTransition("succeeded", "running"),
    /collection_transition_invalid/,
  );
  assert.deepEqual(classifyCollectionFailure("network_error", 1), {
    status: "retry_scheduled",
    retryable: true,
  });
  assert.deepEqual(classifyCollectionFailure("network_error", 4), {
    status: "dead_letter",
    retryable: false,
  });
  assert.deepEqual(classifyCollectionFailure("login_required", 1), {
    status: "blocked_login",
    retryable: false,
  });
  assert.deepEqual(classifyCollectionFailure("captcha", 1), {
    status: "blocked_captcha",
    retryable: false,
  });
  assert.deepEqual(classifyCollectionFailure("robots_disallowed", 1), {
    status: "blocked_robots",
    retryable: false,
  });
  assert.deepEqual(classifyCollectionFailure("permission_denied", 1), {
    status: "failed_terminal",
    retryable: false,
  });
  const now = new Date("2026-08-07T00:00:00.000Z");
  assert.equal(retryAvailableAt(1, now, 0).toISOString(), "2026-08-07T00:01:00.000Z");
  assert.equal(retryAvailableAt(2, now, 1).toISOString(), "2026-08-07T00:06:00.000Z");
  assert.equal(retryAvailableAt(3, now, 0.5).toISOString(), "2026-08-07T00:16:30.000Z");
  assert.deepEqual(
    summarizeCoverage([
      {
        required: true,
        status: "succeeded",
        availableResultCount: 3,
        missingFields: [],
        errorCode: null,
      },
    ]),
    {
      terminalStatus: "succeeded",
      coverageStatus: "complete",
      successfulSubqueryCount: 1,
      failedSubqueryCount: 0,
      blockedSubqueryCount: 0,
      availableResultCount: 3,
      missingFields: [],
    },
  );
  assert.equal(
    summarizeCoverage([
      {
        required: true,
        status: "succeeded_empty",
        availableResultCount: 0,
        missingFields: ["price"],
        errorCode: "empty_result",
      },
    ]).terminalStatus,
    "succeeded_empty",
  );
  const warning = summarizeCoverage([
    {
      required: true,
      status: "failed",
      availableResultCount: 0,
      missingFields: ["price"],
      errorCode: "parse_failed",
    },
    {
      required: false,
      status: "succeeded",
      availableResultCount: 2,
      missingFields: [],
      errorCode: null,
    },
  ]);
  assert.equal(warning.terminalStatus, "completed_with_warnings");
  assert.equal(warning.coverageStatus, "insufficient");
});

test("M03-05.A05/A09/A16 worker processes success, classified failure and coordination conflict", async () => {
  const claimed = {
    id: "task-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    attemptCount: 1,
    requestId: "request-1",
    traceId: "trace-1",
    leaseToken: "lease-1",
    subqueries: [{ id: "q-1", providerId: "p-1", ordinal: 1, required: true, target: {} }],
  };
  const calls = [];
  const repository = {
    recoverExpired: async () => 0,
    queueReady: async () => null,
    claim: async () => claimed,
    start: async () => calls.push("start"),
    heartbeat: async () => calls.push("heartbeat"),
    complete: async () => ({ terminalStatus: "succeeded", coverageStatus: "complete" }),
    fail: async (_task, error) => ({
      status: error.code === "captcha" ? "blocked_captcha" : "retry_scheduled",
    }),
    releaseCoordinationConflict: async () => ({ status: "retry_scheduled" }),
  };
  const coordinator = {
    signal: async () => {},
    acquire: async () => true,
    release: async () => calls.push("release"),
  };
  let result = await processCollectionTaskOnce({
    repository,
    coordinator,
    executor: {
      execute: async (_task, heartbeat) => {
        await heartbeat();
        return [
          {
            id: "q-1",
            required: true,
            status: "succeeded",
            availableResultCount: 1,
            missingFields: [],
            errorCode: null,
          },
        ];
      },
    },
    workerId: "worker-1",
    leaseSeconds: 120,
    now: () => new Date("2026-08-07T00:00:00Z"),
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls, ["start", "heartbeat", "release"]);
  result = await processCollectionTaskOnce({
    repository,
    coordinator,
    executor: {
      execute: async () => {
        throw new CollectionExecutionError("captcha");
      },
    },
    workerId: "worker-1",
    leaseSeconds: 120,
  });
  assert.equal(result.status, "blocked_captcha");
  result = await processCollectionTaskOnce({
    repository,
    coordinator: { ...coordinator, acquire: async () => false },
    executor: { execute: async () => [] },
    workerId: "worker-1",
    leaseSeconds: 120,
  });
  assert.equal(result.status, "retry_scheduled");
});

test("M03-05.A06/A08/A09/A13 API applies capability, cache, origin, idempotency and replay reason guards", async () => {
  const actorId = "00000000-0000-4000-8000-000000000501",
    taskId = "00000000-0000-4000-8000-000000000502",
    calls = [];
  const sample = {
    task: { id: taskId },
    subqueries: [],
    attempts: [],
    events: [],
    dead_letter: null,
  };
  const service = {
    list: async () => ({ items: [], total: 0, page: 1, page_size: 20 }),
    detail: async () => sample,
    replay: async (id, body, context) => (calls.push({ id, body, context }), sample),
  };
  const authorization = { authorize: async (value) => calls.push(value) },
    auth = { authenticate: async () => ({ user: { id: actorId } }) };
  const app = buildApp({
    collectionTasks: {
      service,
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/collection/tasks",
    headers: { cookie: "scoutops_session=test", "x-request-id": "read-1", "x-trace-id": "trace-1" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(calls[0], {
    actorId,
    capability: "collection:replay",
    surface: "api",
    requestId: "read-1",
    traceId: "trace-1",
  });
  response = await app.inject({
    method: "POST",
    url: `/api/v1/platform/collection/tasks/${taskId}/replay`,
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "replay-1",
    },
    payload: { reason: "来源登录已恢复" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1).context.idempotencyKey, "replay-1");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/platform/collection/tasks/${taskId}/replay`,
        headers: {
          cookie: "scoutops_session=test",
          origin: "https://evil.test",
          "idempotency-key": "x",
        },
        payload: { reason: "重放" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/platform/collection/tasks/${taskId}/replay`,
        headers: { cookie: "scoutops_session=test", origin: "http://127.0.0.1:5173" },
        payload: { reason: "重放" },
      })
    ).statusCode,
    400,
  );
  await app.close();
});

test("M03-05 task detail exposes the audited RSS result kind without a new database column", async () => {
  const taskId = "00000000-0000-4000-8000-000000000521",
    subqueryId = "00000000-0000-4000-8000-000000000522",
    now = new Date("2026-08-22T01:00:00.000Z"),
    repository = new MySqlCollectionTaskRepository({
      query: async (sql) => {
        if (sql.includes("FROM collection_tasks WHERE id="))
          return [
            [
              {
                id: taskId,
                organization_id: "00000000-0000-4000-8000-000000000523",
                workspace_id: "00000000-0000-4000-8000-000000000524",
                status: "succeeded_empty",
                coverage_status: "insufficient",
                priority: "normal",
                scheduled_at: now,
                available_at: now,
                attempt_count: 1,
                successful_subquery_count: 1,
                failed_subquery_count: 0,
                blocked_subquery_count: 0,
                available_result_count: 0,
                missing_fields_json: "[]",
                last_error_code: null,
                replay_of_task_id: null,
                replay_reason: null,
                request_id: "rss-detail-kind",
                trace_id: "rss-detail-kind",
                version: 2,
                created_at: now,
                updated_at: now,
              },
            ],
          ];
        if (sql.includes("FROM collection_subqueries q"))
          return [
            [
              {
                id: subqueryId,
                provider_id: "00000000-0000-4000-8000-000000000525",
                provider_name: "公开 RSS",
                ordinal: 0,
                is_required: 0,
                status: "succeeded_empty",
                available_result_count: 0,
                missing_fields_json: "[]",
                error_code: null,
                retryable: 0,
                started_at: now,
                finished_at: now,
              },
            ],
          ];
        if (sql.includes("FROM collection_task_events"))
          return [
            [
              {
                id: "event-1",
                event_type: "collection.subquery.completed",
                from_status: "running",
                to_status: "succeeded_empty",
                actor_type: "worker",
                actor_id: "worker-1",
                request_id: "rss-detail-kind",
                trace_id: "rss-detail-kind",
                metadata_json: JSON.stringify({
                  subquery_id: subqueryId,
                  result_kind: "no_new_content",
                  fresh_result_count: 0,
                  deduplicated_result_count: 3,
                  robots_policy_decision: {
                    decision_version: "scoutops-robots-policy-v1",
                    allowed: true,
                    decision_basis: "matched_rule",
                    robots_url: "https://example.test/robots.txt",
                    robots_http_status: 200,
                    matched_user_agent: "ScoutOpsPublicCrawler",
                    matched_rule: {
                      directive: "allow",
                      pattern_preview: "/feed",
                      pattern_sha256: "a".repeat(64),
                      truncated: false,
                    },
                  },
                }),
                occurred_at: now,
              },
            ],
          ];
        return [[]];
      },
    });
  const detail = await repository.detail(taskId);
  assert.equal(detail.subqueries[0].result_kind, "no_new_content");
  assert.equal(detail.subqueries[0].robots_decision.matched_rule.pattern_preview, "/feed");
  assert.equal(detail.events[0].metadata.deduplicated_result_count, 3);
});

test("M03-05.A06 query pagination accepts HTTP strings but rejects ambiguous values", async () => {
  let received;
  const service = new CollectionTaskService({
    list: async (input) => ((received = input), { items: [], total: 0 }),
    detail: async () => null,
    replay: async () => {
      throw new Error("unused");
    },
  });
  const result = await service.list({ page: "2", page_size: "50", status: "running" });
  assert.equal(result.page, 2);
  assert.equal(result.page_size, 50);
  assert.equal(received.page, 2);
  assert.equal(received.pageSize, 50);
  await assert.rejects(
    () => service.list({ page: "1.5" }),
    (error) => error.code === "collection_pagination_invalid",
  );
});

test("M03-05.A03/A07/A10/A11/A14-A17 delivery surfaces are complete and Baota bounded", async () => {
  const paths = [
    "database/migrations/0016e_collection_tasks_m03_05.up.sql",
    "database/migrations/0016e_collection_tasks_m03_05.down.sql",
    "packages/collection-tasks/src/index.ts",
    "apps/worker/src/collection-task-worker.ts",
    "apps/worker/src/collection-task-contracts.ts",
    "apps/worker/src/collection-task-state-machine.ts",
    "apps/worker/src/collection-task-evidence.ts",
    "apps/worker/src/collection-task-dead-letter.ts",
    "apps/api/src/mysql-collection-task-repository.ts",
    "apps/api/src/collection-task-routes.ts",
    "apps/web/src/components/CollectionTaskCenter.vue",
    "apps/web/src/collection-tasks.css",
    "scripts/verify-collection-task-live.mjs",
    "docs/openapi.yaml",
    "config/env.example",
    "config/schema.json",
    "docs/architecture/m03-05-collection-task-state-machine.md",
    "docs/runbooks/m03-05-collection-task-state-machine.md",
    "docs/feature-map.json",
    "tests/e2e/m03-05-collection-tasks.spec.ts",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      domain,
      worker,
      workerContracts,
      workerStateMachine,
      workerEvidence,
      workerDeadLetter,
      repo,
      routes,
      web,
      css,
      live,
      openapi,
      env,
      schema,
      architecture,
      runbook,
      feature,
      e2e,
      blueprint,
    ] = values;
  const workerSurface = `${worker}\n${workerContracts}\n${workerStateMachine}\n${workerEvidence}\n${workerDeadLetter}`;
  for (const table of [
    "collection_tasks",
    "collection_subqueries",
    "collection_task_attempts",
    "collection_dead_letters",
    "collection_task_events",
    "collection_task_outbox",
    "collection_task_operations",
  ])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.match(down, /DROP TABLE IF EXISTS `collection_tasks`/);
  assert.match(domain, /retryAvailableAt/);
  assert.match(workerStateMachine, /FOR UPDATE/);
  assert.match(repo, /manually_replayed/);
  assert.match(routes, /collection:replay/);
  assert.match(web, /loading.*ready.*empty.*error.*expired.*forbidden.*blocked/);
  assert.match(web, /subqueryRetryText/);
  assert.match(web, /subqueryDurationText[\s\S]*collection-subquery-missing/);
  assert.match(web, /recoveryAction[\s\S]*建议恢复动作/);
  assert.match(web, /下次重试.*任务级调度/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(live, /const now=new Date\(\);/);
  assert.doesNotMatch(live, /const now=new Date\(['"]\d{4}-\d{2}-\d{2}T/);
  assert.match(openapi, /\/platform\/collection\/tasks:/);
  assert.match(env, /COLLECTION_TASK_LEASE_SECONDS=120/);
  assert.match(schema, /collectionTasks/);
  assert.match(architecture, /M03-06/);
  assert.match(runbook, /宝塔.*Node Worker/s);
  assert.match(feature, /collectionTaskStateMachine/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(blueprint, /M03-05/);
  assert.match(workerStateMachine, /readonly taskId:\s*string \| undefined/);
  assert.match(workerSurface, /signal\?\s*:\s*AbortSignal[\s\S]*executor\.execute/);
  assert.match(workerStateMachine, /completeCollectionTask\(this[\s\S]*failCollectionTask\(this/);
  assert.match(workerEvidence, /summarizeCoverage[\s\S]*collection_subqueries/);
  assert.match(
    workerDeadLetter,
    /recoverExpiredCollectionTasks[\s\S]*collection_attempt_overflow[\s\S]*collection_dead_letters/,
  );
  assert.match(live, /new MySqlCollectionTaskWorkerRepository\(pool,\(\)=>0,id\)/);
  assert.match(
    live,
    /new MySqlCollectionTaskWorkerRepository\(pool,\(\)=>0,ids\.expired\)\.recoverExpired/,
  );
});
