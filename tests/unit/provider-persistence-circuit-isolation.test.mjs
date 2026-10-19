import test from "node:test";
import assert from "node:assert/strict";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";
import { ProviderAdapterFailure } from "../../packages/provider-adapters/dist/index.js";
import { EvidencePersistenceError } from "../../apps/worker/dist/evidence-persistence.js";

const record = {
  externalId: "observed",
  observedAt: "2026-10-19T00:00:00Z",
  evidenceRef: "observed",
  payload: {
    raw_content: "observed",
    content_type: "text/html",
    canonical_url: "https://example.test/product",
    fields: { title: "Observed product" },
    source_paths: { title: "h1" },
  },
};
async function executeFailure(stage, error) {
  const circuitWrites = [];
  let persistAttempts = 0;
  const query = async (sql, values) => {
    if (sql.includes("FROM providers p"))
      return [
        [
          {
            id: "provider",
            code: "amazon_product",
            access_mode: "public_page",
            target_url: "https://www.amazon.com/s",
            timeout_ms: 1000,
            parser_version: "test",
            fields_json: ["title"],
            status: "enabled",
            terms_review_status: "approved",
            terms_version: "test",
            terms_permanent: 1,
            circuit_failure_threshold: 5,
            created_by: "actor",
          },
        ],
      ];
    if (sql.startsWith("SELECT state,")) return [[{ state: "closed", consecutive_failures: 4 }]];
    if (sql.startsWith("INSERT INTO provider_runtime_circuits")) {
      if (stage === "runtime") throw error;
      circuitWrites.push(values);
    }
    return [{ affectedRows: 1 }];
  };
  const pool = {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  };
  const executor = new ProviderSourceExecutor(
    pool,
    {
      normalize: (_key, raw) => ({
        external_id: raw.externalId,
        observed_at: raw.observedAt,
        fields: raw.payload.fields,
        evidence_ref: raw.evidenceRef,
        provenance: { adapter_version: "test" },
      }),
    },
    {
      persist: async () => {
        persistAttempts++;
        if (stage === "persist") throw error;
        return { deduplicated: false };
      },
      persistBrowserArtifact: async () => {
        if (stage === "artifact") throw error;
      },
    },
    "worker",
    {
      collect: async () => {
        if (stage === "source") throw error;
        return {
          browserJobId: "job",
          records: [record],
          artifacts:
            stage === "artifact"
              ? [
                  {
                    kind: "dom_fragment",
                    source_url: "https://example.test/product",
                    content_type: "text/html",
                    content: Buffer.from("observed"),
                    captured_at: new Date(),
                    parser_version: "test",
                    content_sha256: "test-only",
                  },
                ]
              : [],
          parseError: null,
        };
      },
    },
    undefined,
    undefined,
    undefined,
    true,
  );
  let failure;
  try {
    await executor.execute(
      {
        id: "task",
        organizationId: "org",
        workspaceId: "workspace",
        attemptCount: 1,
        leaseToken: "lease",
        requestId: "request",
        traceId: "trace",
        subqueries: [
          {
            id: "query",
            providerId: "provider",
            ordinal: 0,
            required: true,
            target: { query: "observed" },
          },
        ],
      },
      async () => {},
    );
  } catch (value) {
    failure = value;
  }
  return { failure, circuitWrites, persistAttempts };
}
test("exhausted evidence deadlock retry leaves task failed without opening a healthy source", async () => {
  const result = await executeFailure(
    "persist",
    Object.assign(new Error("private SQL"), { code: "ER_LOCK_DEADLOCK" }),
  );
  assert.equal(result.failure.code, "network_error");
  assert.equal(result.persistAttempts, 3);
  assert.equal(result.circuitWrites.length, 0);
});
test("artifact database failures and rolled-back runtime writes are not upstream source failures", async () => {
  for (const stage of ["artifact", "runtime"]) {
    const result = await executeFailure(
      stage,
      Object.assign(new Error("private SQL"), { code: "ER_LOCK_WAIT_TIMEOUT" }),
    );
    assert.equal(result.failure.code, "network_error");
    assert.equal(result.circuitWrites.length, 0);
  }
});
test("new real source network failures and evidence validation failures retain circuit protection", async () => {
  for (const [stage, error, expected] of [
    ["source", new ProviderAdapterFailure("network_error", true), "network_error"],
    ["persist", new EvidencePersistenceError("evidence_dedupe_conflict"), "validation_failed"],
  ]) {
    const result = await executeFailure(stage, error);
    assert.equal(result.failure.code, expected);
    assert.equal(result.circuitWrites.length, 1);
    assert.equal(result.circuitWrites[0][1], "open");
    assert.equal(result.circuitWrites[0][2], 5);
  }
});
