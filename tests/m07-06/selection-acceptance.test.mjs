import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const read = (path) => readFile(path, "utf8");

test("M07-06.A01-A06 exposes a member-scoped real selection journey", async () => {
  const [{ SelectionJourneyService }, routes, journeyMigration, evidenceLinkMigration, evidenceLinkRollback] = await Promise.all([
    import("../../apps/api/dist/selection-journey-service.js"),
    read("apps/api/src/selection-journey-routes.ts"),
    read("database/migrations/0028_selection_journeys_m07_06.up.sql"),
    read("database/migrations/0029_collection_task_evidence_links_m07_06.up.sql"),
    read("database/migrations/0029_collection_task_evidence_links_m07_06.down.sql"),
  ]);
  const created = [];
  const service = new SelectionJourneyService({
    create: async (input) => (created.push(input), { id: input.journeyId, state: "accepted" }),
    get: async () => null,
    decide: async () => ({ decision_status: "observing" }),
  });
  const result = await service.create({
    organizationId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    actorId: "33333333-3333-4333-8333-333333333333",
    requestId: "44444444-4444-4444-8444-444444444444",
    traceId: "55555555-5555-4555-8555-555555555555",
    idempotencyKey: "m07-06-create",
    value: { input_kind: "keyword", input_value: "portable blender" },
  });
  assert.equal(result.state, "accepted");
  assert.equal(created[0].providerCode, "google_news_search");
  assert.match(routes, /task:create/);
  assert.match(routes, /opportunity:decide/);
  assert.doesNotMatch(routes, /collection:replay|provider:configure/);
  assert.match(journeyMigration, /CREATE TABLE `selection_journeys`/);
  assert.match(journeyMigration, /organization_id/);
  assert.match(journeyMigration, /workspace_id/);
  assert.match(evidenceLinkMigration, /CREATE TABLE `collection_task_evidence_links`/);
  assert.match(evidenceLinkMigration, /UNIQUE KEY `uq_collection_task_evidence`/);
  assert.match(evidenceLinkMigration, /INSERT INTO `collection_task_evidence_links`/);
  assert.match(evidenceLinkRollback, /DROP TABLE IF EXISTS `collection_task_evidence_links`/);
  assert.doesNotMatch(`${journeyMigration}\n${evidenceLinkMigration}`, /utf8mb4_0900|CHECK\s*\(/i);
});

test("M07-06.A07-A17 keeps UI, contracts, production evidence and rollback synchronized", async () => {
  const files = await Promise.all([
    "apps/web/src/components/SelectionJourney.vue",
    "apps/web/src/selection-journey.css",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "config/env.example",
    "docs/architecture/m07-06-selection-acceptance.md",
    "docs/runbooks/m07-06-selection-acceptance.md",
    "verification/modules/M07-06.json",
    "verification/selection-acceptance-production-evidence.schema.json",
    "scripts/verify-selection-acceptance-production.mjs",
  ].map(read));
  const all = files.join("\n");
  for (const token of [
    "M07-06",
    "/api/v1/selection-journeys",
    "succeeded_empty",
    "blocked",
    "180000",
    "task:create",
    "opportunity:decide",
    "PROVIDER_PROXY_URL",
    "PROVIDER_PROXY_PASSWORD",
    "content_changed",
    "回滚",
  ]) assert.match(all, new RegExp(token));
  assert.match(files[0], /390/);
  assert.match(files[0], /真实来源/);
  assert.match(files[0], /没有演示数据替代真实结果/);
});

test("M07-06.A08/A12/A16 validates input and refuses deadline relaxation", async () => {
  const { SelectionJourneyService } = await import("../../apps/api/dist/selection-journey-service.js");
  const repository = { create: async (input) => input, get: async () => null, decide: async () => ({}) };
  const context = { organizationId:"11111111-1111-4111-8111-111111111111",workspaceId:"22222222-2222-4222-8222-222222222222",actorId:"33333333-3333-4333-8333-333333333333",requestId:"44444444-4444-4444-8444-444444444444",traceId:"55555555-5555-4555-8555-555555555555",idempotencyKey:"validation" };
  assert.throws(() => new SelectionJourneyService(repository, 180001), { code:"selection_deadline_contract_invalid" });
  const service = new SelectionJourneyService(repository, 180000, () => new Date("2026-08-10T12:00:00.000Z"));
  assert.throws(() => service.create({ ...context, value:{ input_kind:"asin",input_value:"short" } }), { code:"selection_asin_invalid" });
  assert.throws(() => service.create({ ...context, value:{ input_kind:"product_url",input_value:"http://example.com/product" } }), { code:"selection_product_url_invalid" });
  const accepted = await service.create({ ...context, value:{ input_kind:"product_url",input_value:"https://example.com/product" } });
  assert.equal(accepted.providerCode, "google_news_search");
  assert.equal(accepted.deadlineAt.toISOString(), "2026-08-10T12:03:00.000Z");
});

test("M07-06.A04/A08 keeps a journey running until the collection task is terminal", async () => {
  const repository = await read("apps/api/src/mysql-selection-journey-repository.ts");
  const taskGate = repository.indexOf("if(!terminal.has(String(row.status)))");
  const resultGate = repository.indexOf('if(hasResult)return"result_ready"');
  assert.ok(taskGate > 0, "journey state must first verify the collection task terminal status");
  assert.ok(resultGate > taskGate, "persisted evidence cannot expose result_ready while the task is retrying");
  assert.match(repository, /if\(\["leased","running","retry_scheduled","rate_limited"\]\.includes\(String\(row\.status\)\)\)return"running"/);
});

test("M07-06.A09/A16 production runner selects tenant context before member guard", async () => {
  const [runner, manifestRaw] = await Promise.all([
    read("scripts/run-baota-selection-acceptance.mjs"),
    read("infra/baota/selection-acceptance-manifest.json"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const memberships = runner.indexOf('request("/org/memberships"');
  const workspaces = runner.indexOf('request(`/org/${organization.id}/workspaces`');
  const context = runner.indexOf('request("/auth/context"');
  const guard = runner.indexOf('request("/me/navigation?shell=member"');
  assert.ok(memberships > 0, "production runner must list the account organizations after login");
  assert.ok(workspaces > memberships, "production runner must resolve a workspace from the selected organization");
  assert.ok(context > workspaces, "production runner must bind the new login session to organization/workspace context");
  assert.ok(guard > context, "member capability guard must run only after tenant context is selected");
  assert.match(runner, /"idempotency-key":randomUUID\(\)/);
  assert.equal(manifest.memberBoundary.sessionContextRequired, true);
  assert.equal(manifest.memberBoundary.exactlyOneActiveOrganization, true);
});

test("M07-06.A04 live verification accepts an already running journey", async () => {
  const verifier = await read("scripts/verify-selection-acceptance-live.mjs");
  assert.match(
    verifier,
    /\["accepted","running"\]\.includes\(created\.state\)/,
    "the production worker may advance a newly committed journey before create() reads it back",
  );
});

test("M07-06.A04/A05/A14 links deduplicated evidence to every scoped collection task", async () => {
  const { MySqlEvidencePersistence } = await import("../../apps/worker/dist/evidence-persistence.js");
  const ids = {
    organization: "11111111-1111-4111-8111-111111111111",
    workspace: "22222222-2222-4222-8222-222222222222",
    task: "33333333-3333-4333-8333-333333333333",
    subquery: "44444444-4444-4444-8444-444444444444",
    provider: "55555555-5555-4555-8555-555555555555",
    actor: "66666666-6666-4666-8666-666666666666",
    evidence: "77777777-7777-4777-8777-777777777777",
    record: "88888888-8888-4888-8888-888888888888",
  };
  const content = Buffer.from("existing evidence");
  const contentHash = createHash("sha256").update(content).digest("hex");
  const statements = [];
  const connection = {
    beginTransaction: async () => statements.push("BEGIN"),
    commit: async () => statements.push("COMMIT"),
    rollback: async () => statements.push("ROLLBACK"),
    release: () => statements.push("RELEASE"),
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes("FROM collection_tasks t")) return [[{ retention_days: 90 }]];
      if (sql.includes("FROM raw_evidence e")) return [[{
        evidence_id: ids.evidence,
        content_sha256: contentHash,
        record_id: ids.record,
        normalized_payload: { title: "Existing item" },
        canonical_url: "https://example.test/item",
        parser_version: "parser-v1",
        adapter_version: "adapter-v1",
        schema_version: "provider-source-v1",
      }]];
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: connection.query,
    getConnection: async () => connection,
  };
  const persistence = new MySqlEvidencePersistence(pool, "unused-for-deduplicated-evidence", 1024);
  const evidenceInput = {
    organizationId: ids.organization,
    workspaceId: ids.workspace,
    taskId: ids.task,
    subqueryId: ids.subquery,
    providerId: ids.provider,
    sourceUrl: "https://example.test/source",
    canonicalUrl: "https://example.test/item",
    dedupeKey: "existing-item",
    contentType: "application/json",
    content,
    capturedAt: new Date("2026-08-11T12:00:00.000Z"),
    parserVersion: "parser-v1",
    adapterVersion: "adapter-v1",
    recordKey: "existing-item",
    recordSchemaVersion: "provider-source-v1",
    normalizedPayload: { title: "Existing item" },
    provenance: [{ fieldPath: "title", sourcePath: "$.title", transformVersion: "parser-v1", sourceValueHash: contentHash }],
    requestId: "m07-06-dedupe-request",
    traceId: "m07-06-dedupe-trace",
    actorId: ids.actor,
  };
  const result = await persistence.persist(evidenceInput);
  assert.equal(result.deduplicated, true);
  assert.ok(statements.some((sql) => typeof sql === "string" && sql.includes("INSERT INTO collection_task_evidence_links")), "deduplicated evidence must be linked to the current task");
  assert.ok(statements.some((sql) => typeof sql === "string" && sql.includes("FROM collection_tasks t")), "task, subquery, provider and tenant scope must be validated before linking");
  assert.ok(statements.includes("COMMIT"));

  const changedContentStatements = [];
  const changedContentConnection = {
    beginTransaction: async () => changedContentStatements.push("BEGIN"),
    commit: async () => changedContentStatements.push("COMMIT"),
    rollback: async () => changedContentStatements.push("ROLLBACK"),
    release: () => changedContentStatements.push("RELEASE"),
    query: async (sql, values) => {
      changedContentStatements.push({ sql, values });
      if (sql.includes("FROM collection_tasks t")) return [[{ retention_days: 90 }]];
      if (sql.includes("FROM raw_evidence e")) return [[{
        evidence_id: ids.evidence,
        content_sha256: contentHash,
        record_id: ids.record,
        normalized_payload: { title: "Existing item" },
        canonical_url: "https://example.test/item",
        parser_version: "parser-v1",
        adapter_version: "adapter-v1",
        schema_version: "provider-source-v1",
      }]];
      return [{ affectedRows: 1 }];
    },
  };
  const changedContentPersistence = new MySqlEvidencePersistence(
    { getConnection: async () => changedContentConnection },
    "unused-for-deduplicated-evidence",
    1024,
  );
  const changedContentResult = await changedContentPersistence.persist({
    ...evidenceInput,
    content: Buffer.from("same normalized fields, changed source wrapper"),
  });
  assert.equal(changedContentResult.deduplicated, true);
  assert.equal(changedContentResult.content_changed, true);
  const linkedEvent = changedContentStatements.find((entry) =>
    typeof entry === "object" && entry.sql.includes("INSERT INTO evidence_data_events") && entry.values?.[3] === "evidence.linked"
  );
  assert.ok(linkedEvent, "changed source wrapper must preserve an audited scoped evidence link");
  assert.match(String(linkedEvent.values[9]), /existing_content_sha256/);
  assert.match(String(linkedEvent.values[9]), /observed_content_sha256/);
  assert.ok(changedContentStatements.includes("COMMIT"));

  const changedFieldsPersistence = new MySqlEvidencePersistence(
    { getConnection: async () => changedContentConnection },
    "unused-for-deduplicated-evidence",
    1024,
  );
  await assert.rejects(() => changedFieldsPersistence.persist({
    ...evidenceInput,
    content: Buffer.from("changed source and changed normalized fields"),
    normalizedPayload: { title: "Changed item" },
  }), { code: "evidence_dedupe_conflict" });

  const rejectedStatements = [];
  const rejectedConnection = {
    beginTransaction: async () => rejectedStatements.push("BEGIN"),
    commit: async () => rejectedStatements.push("COMMIT"),
    rollback: async () => rejectedStatements.push("ROLLBACK"),
    release: () => rejectedStatements.push("RELEASE"),
    query: async (sql) => (rejectedStatements.push(sql), [[]]),
  };
  const rejectedPersistence = new MySqlEvidencePersistence({getConnection:async()=>rejectedConnection}, "unused", 1024);
  await assert.rejects(() => rejectedPersistence.persist(evidenceInput), {code:"evidence_scope_or_task_invalid"});
  assert.ok(!rejectedStatements.some((sql) => typeof sql === "string" && sql.includes("INSERT INTO collection_task_evidence_links")), "invalid task scope must never create an evidence association");
  assert.ok(rejectedStatements.includes("ROLLBACK"));
});

test("M03-07 automatic feeds skip conflicting already-seen items while M07-06 required journeys stay explicit", async () => {
  const [{ ProviderSourceExecutor }, { EvidencePersistenceError }] = await Promise.all([
    import("../../apps/worker/dist/provider-source-executor.js"),
    import("../../apps/worker/dist/evidence-persistence.js"),
  ]);
  const replayUpdates = [];
  const pool = {
    query: async (sql, values) => {
      if (sql.includes("FROM providers p")) return [[{
        id: "55555555-5555-4555-8555-555555555555",
        code: "google_news_search",
        access_mode: "public_rss",
        target_url: "https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en",
        parser_version: "google-news-rss-v1",
        timeout_ms: 20000,
        fields_json: ["title", "summary", "publisher"],
        status: "enabled",
        created_by: "66666666-6666-4666-8666-666666666666",
      }]];
      if (sql.includes("UPDATE provider_source_replay_runs SET status=?")) replayUpdates.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  const records = ["first", "conflict", "third"].map((id) => ({
    externalId: id,
    observedAt: "2026-08-12T12:00:00.000Z",
    evidenceRef: `google-news-rss:${id}`,
    payload: {
      raw_content: `<item>${id}</item>`,
      content_type: "application/rss+xml",
      canonical_url: `https://example.test/${id}`,
      fields: { title: id, summary: id, publisher: "Example" },
      source_paths: { title: "rss.item.title", summary: "rss.item.description", publisher: "rss.item.source" },
    },
  }));
  const registry = {
    collect: async () => ({ records, nextCursor: null }),
    normalize: (_code, raw) => ({
      external_id: raw.externalId,
      observed_at: raw.observedAt,
      canonical_url: raw.payload.canonical_url,
      fields: raw.payload.fields,
      evidence_ref: raw.evidenceRef,
      provenance: { adapter_version: "google-news-rss-adapter-v1" },
    }),
  };
  const persisted = [];
  let allRecordsAlreadySeen = false;
  const evidence = {
    persist: async (input) => {
      persisted.push(input.dedupeKey);
      if (allRecordsAlreadySeen || input.dedupeKey === "conflict") throw new EvidencePersistenceError("evidence_dedupe_conflict");
      return { evidence_id: input.dedupeKey, normalized_record_id: input.dedupeKey, deduplicated: false };
    },
  };
  const executor = new ProviderSourceExecutor(pool, registry, evidence, "m07-06-test-worker");
  const outcomes = await executor.execute({
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    attemptCount: 1,
    requestId: "m07-06-conflict-request",
    traceId: "m07-06-conflict-trace",
    leaseToken: "not-used-by-executor",
    subqueries: [{ id: "44444444-4444-4444-8444-444444444444", providerId: "55555555-5555-4555-8555-555555555555", ordinal: 0, required: false, target: { query: "portable blender" } }],
  }, async () => {});
  assert.deepEqual(persisted, ["first", "conflict", "third"], "a conflicting record must not discard later independent records");
  assert.deepEqual(outcomes, [{
    id: "44444444-4444-4444-8444-444444444444",
    required: false,
    status: "succeeded",
    availableResultCount: 2,
    missingFields: [],
    errorCode: null,
  }]);
  assert.deepEqual(replayUpdates[0]?.slice(0, 3), ["succeeded", 2, null], "automatic non-required feeds must not retry an entire source batch");

  allRecordsAlreadySeen = true;
  const duplicateOnlyOutcomes = await executor.execute({
    id: "77777777-7777-4777-8777-777777777777",
    organizationId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    attemptCount: 1,
    requestId: "m07-06-duplicate-only-request",
    traceId: "m07-06-duplicate-only-trace",
    leaseToken: "not-used-by-executor",
    subqueries: [{ id: "88888888-8888-4888-8888-888888888888", providerId: "55555555-5555-4555-8555-555555555555", ordinal: 0, required: true, target: { query: "portable blender" } }],
  }, async () => {});
  assert.deepEqual(duplicateOnlyOutcomes, [{
    id: "88888888-8888-4888-8888-888888888888",
    required: true,
    status: "failed",
    availableResultCount: 0,
    missingFields: [],
    errorCode: "validation_failed",
  }], "a required selection journey must keep a normalized-data conflict explicit");
  assert.deepEqual(replayUpdates[1]?.slice(0, 3), ["failed", 0, "validation_failed"]);
});
