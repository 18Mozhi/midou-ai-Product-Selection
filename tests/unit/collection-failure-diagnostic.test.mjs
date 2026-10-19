import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { collectionFailureDiagnostic } from "../../apps/worker/dist/collection-failure-diagnostic.js";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";
import { ProviderAdapterRegistry } from "../../packages/provider-adapters/dist/index.js";
import { MySqlEvidencePersistence } from "../../apps/worker/dist/evidence-persistence.js";
import {
  BUILTIN_PROVIDER_SOURCES,
  createBuiltinSourceAdapters,
  parseAmazonProductPage,
} from "../../packages/provider-sources/dist/index.js";

test("internal diagnostics retain only allowlisted technical values, never error details", () => {
  const error = Object.assign(new Error("secret SQL password page content"), {
    code: "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
    errno: 1366,
    sql: "secret SQL",
    cause: "secret cause",
  });
  const result = collectionFailureDiagnostic(error, {
    taskId: "task",
    stage: "evidence_persist",
    recordOrdinal: 10,
  });
  assert.equal(result.technical_code, error.code);
  assert.equal(result.mysql_errno, 1366);
  assert.equal(result.record_ordinal, 10);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  for (const value of [
    null,
    "secret",
    { code: "ER_SECRET_TOKEN", name: "secret", errno: "secret" },
    { errno: -1 },
    { errno: Infinity },
  ]) {
    const safe = collectionFailureDiagnostic(value, { taskId: "task", stage: "task_execution" });
    assert.equal(safe.technical_code, "unclassified_error");
    assert.equal(safe.mysql_errno, undefined);
    assert.equal(JSON.stringify(safe).includes("secret"), false);
  }
});

test("real persistence lock failures carry only the failing internal step and retain rollback", async () => {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const input = {
    organizationId: id(1),
    workspaceId: id(2),
    taskId: id(3),
    subqueryId: id(4),
    providerId: id(5),
    actorId: id(6),
    sourceUrl: "https://example.test/raw",
    canonicalUrl: "https://example.test/item",
    dedupeKey: "observed",
    recordKey: "observed",
    contentType: "application/json",
    content: Buffer.from("{}"),
    capturedAt: new Date(),
    parserVersion: "test",
    adapterVersion: "test",
    recordSchemaVersion: "v1",
    normalizedPayload: { title: "Observed" },
    provenance: [
      {
        fieldPath: "title",
        sourcePath: "$.title",
        transformVersion: "copy-v1",
        sourceValueHash: createHash("sha256").update("Observed").digest("hex"),
      },
    ],
    requestId: "test",
    traceId: "test",
  };
  for (const [failAt, expected] of [
    [0, "transaction_begin"],
    [1, "scope_lock"],
    [2, "dedupe_lock"],
    [3, "record_version_lock"],
  ]) {
    let calls = 0,
      rollbacks = 0,
      releases = 0;
    const error = Object.assign(new Error("private SQL and parameters"), {
      code: "ER_LOCK_DEADLOCK",
      persistence_operation: "secret-spoof",
    });
    const connection = {
      beginTransaction: async () => {
        if (failAt === 0) throw error;
      },
      query: async () => {
        calls++;
        if (calls === failAt) throw error;
        return calls === 1 ? [[{ retention_days: 30 }]] : [[]];
      },
      rollback: async () => {
        rollbacks++;
      },
      release() {
        releases++;
      },
    };
    const persistence = new MySqlEvidencePersistence(
      { getConnection: async () => connection },
      "unused-no-file-write",
      1024,
    );
    await assert.rejects(persistence.persist(input), (value) => value === error);
    const diagnostic = collectionFailureDiagnostic(error, {
      taskId: input.taskId,
      stage: "evidence_persist",
    });
    assert.equal(diagnostic.persistence_operation, expected);
    assert.equal(rollbacks, 1);
    assert.equal(releases, 1);
    assert.equal(JSON.stringify(diagnostic).includes("private"), false);
    assert.equal(JSON.stringify(diagnostic).includes("secret"), false);
  }
  assert.equal(
    collectionFailureDiagnostic(
      { persistence_operation: "scope_lock" },
      { taskId: "task", stage: "evidence_persist" },
    ).persistence_operation,
    undefined,
  );
});

test("a tenth-record storage failure is diagnosed while preserving task failure and nine prior writes", async (t) => {
  const provider = {
    id: "provider",
    code: "amazon_product",
    access_mode: "public_page",
    target_url: "https://www.amazon.com/s?k={urlEncodedQuery}",
    parser_version: BUILTIN_PROVIDER_SOURCES.find((p) => p.code === "amazon_product")
      .parser_version,
    timeout_ms: 20000,
    fields_json: ["title"],
    status: "enabled",
    terms_review_status: "approved",
    terms_version: "approved",
    terms_permanent: 1,
    created_by: "actor",
    circuit_failure_threshold: 5,
  };
  const pool = {
    query: async (sql) =>
      sql.includes("FROM providers p")
        ? [[provider]]
        : sql.includes("SELECT state,consecutive_failures")
          ? [[]]
          : [{ affectedRows: 1 }],
  };
  pool.getConnection = async () => ({
    query: pool.query,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  });
  const registry = new ProviderAdapterRegistry({
    healthTimeoutMs: 1000,
    maxResponseBytes: 1000000,
    maxItemsPerBatch: 20,
  });
  for (const adapter of createBuiltinSourceAdapters()) registry.register(adapter);
  const html = Array.from(
    { length: 11 },
    (_, i) =>
      `<div data-component-type="s-search-result" data-asin="B0TEST${String(i).padStart(4, "0")}"><h2><a href="/dp/B0TEST${String(i).padStart(4, "0")}"><span>Storage Box ${i}</span></a></h2><span class="a-price"><span class="a-offscreen">$19.99</span></span></div>`,
  ).join("");
  const records = parseAmazonProductPage(
    `<html><body>${html}</body></html>`,
    "https://www.amazon.com/s?k=box",
    20,
  );
  assert.equal(records.length, 11);
  const diagnostics = [];
  t.mock.method(console, "error", (line) => diagnostics.push(JSON.parse(line)));
  let writes = 0,
    calls = 0;
  const evidence = {
    persist: async () => {
      calls += 1;
      if (calls === 10)
        throw Object.assign(new Error("secret SQL"), {
          code: "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
          errno: 1366,
        });
      writes += 1;
      return { deduplicated: false };
    },
  };
  const executor = new ProviderSourceExecutor(
    pool,
    registry,
    evidence,
    "worker",
    { collect: async () => ({ browserJobId: "job", records, artifacts: [], parseError: null }) },
    undefined,
    undefined,
    undefined,
    true,
  );
  await assert.rejects(
    executor.execute(
      {
        id: "task",
        organizationId: "org",
        workspaceId: "workspace",
        requestId: "request",
        traceId: "trace",
        subqueries: [
          { id: "subquery", providerId: "provider", required: true, target: { query: "box" } },
        ],
      },
      async () => {},
    ),
    (error) => error.code === "network_error",
  );
  assert.equal(writes, 9);
  assert.equal(calls, 10);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].stage, "evidence_persist");
  assert.equal(diagnostics[0].record_ordinal, 10);
  assert.equal(diagnostics[0].technical_code, "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD");
  assert.equal(JSON.stringify(diagnostics).includes("secret"), false);
});
