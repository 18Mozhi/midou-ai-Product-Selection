import { automaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  MySqlCompetitorTitleClassification,
  readCompetitorClassificationContext,
  validateCompetitorTitleRelations,
} from "../../apps/worker/dist/competitor-title-classification.js";
import { validateCompetitorTitleOutput } from "../../apps/worker/dist/competitor-title-classification.js";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";
import { OpenAiIntelligenceProductClassifier } from "../../apps/worker/dist/intelligence-product-association.js";
const mainAsin = "B000000001";
const opportunityId = "00000000-0000-4000-8000-000000000001";
const input = {
  primary: { source_ref: "primary", asin: mainAsin, title: "Portable handheld fan" },
  candidates: [
    { source_ref: "n1", asin: "B000000002", title: "Rechargeable handheld fan" },
    { source_ref: "n2", asin: "B000000003", title: "Desktop air circulator" },
  ],
};
const relations = () =>
  input.candidates.map((c, i) => ({
    source_ref: c.source_ref,
    relation: i === 0 ? "substitute" : "different_use",
    primary_excerpt: input.primary.title,
    candidate_excerpt: c.title,
    rationale: "Classify practical use only",
  }));

test("relations preserve source order, reject different uses and do not manufacture metrics", () => {
  const value = validateCompetitorTitleRelations({ classifications: relations().reverse() }, input);
  assert.deepEqual(
    value.map((r) => r.source_ref),
    ["n1", "n2"],
  );
  assert.deepEqual(
    value.filter((r) => r.relation === "substitute").map((r) => r.source_ref),
    ["n1"],
  );
});
test("model output never supplies evidence quotes; original titles are bound by code", () => {
  const output = {
    classifications: relations().map(({ source_ref, relation, rationale }) => ({
      source_ref,
      relation,
      rationale,
    })),
  };
  assert.deepEqual(validateCompetitorTitleOutput(output, input), relations());
  output.classifications[0].primary_excerpt = "invented";
  assert.throws(
    () => validateCompetitorTitleOutput(output, input),
    /competitor_classification_invalid/,
  );
});
for (const [name, mutate] of [
  ["foreign reference", (r) => (r[0].source_ref = "other")],
  ["duplicate reference", (r) => (r[1].source_ref = "n1")],
  ["missing candidate", (r) => r.pop()],
  ["invented quote", (r) => (r[0].candidate_excerpt = "not in title")],
  ["missing matching quote", (r) => (r[0].primary_excerpt = null)],
  ["unsupported relation", (r) => (r[0].relation = "recommended")],
  ["invented price", (r) => (r[0].price = 12)],
  ["empty reason", (r) => (r[0].rationale = " ")],
])
  test(`relation validation rejects ${name}`, () => {
    const r = relations();
    mutate(r);
    assert.throws(
      () => validateCompetitorTitleRelations({ classifications: r }, input),
      /competitor_classification_invalid/,
    );
  });

function fixture({ lease = true, mutate = false, auditFails = false } = {}) {
  let inTransaction = false,
    changed = false;
  const calls = [];
  const task = {
    id: "task",
    organizationId: "org",
    workspaceId: "workspace",
    requestId: "request",
    traceId: "trace",
    leaseToken: "test-only-lease",
    subqueries: [],
  };
  const query = {
    id: "subquery",
    providerId: "provider",
    target: {
      projection_type: "opportunity_competitors",
      opportunity_id: opportunityId,
      main_asin: mainAsin,
    },
  };
  const sql = async (s, args) => {
    calls.push({ sql: s, args });
    if (s === automaticPrimaryEvidenceSql)
      return [
        [
          {
            raw_evidence_id: "primary",
            provider_status: "enabled",
            observed_at: new Date(),
            payload_json: {
              asin: mainAsin,
              title: input.primary.title,
              canonical_url: `https://www.amazon.com/dp/${mainAsin}`,
            },
          },
        ],
      ];
    if (s.includes("FROM opportunities o JOIN competitors c")) return [[]];
    if (s.startsWith("SELECT n.id"))
      return [
        input.candidates.map((c) => ({
          id: c.source_ref,
          raw_evidence_id: changed && c.source_ref === "n1" ? "changed" : "e-" + c.source_ref,
          provider_id: "provider",
          payload_json: {
            asin: c.asin,
            title: c.title,
            canonical_url: `https://www.amazon.com/dp/${c.asin}`,
          },
        })),
      ];
    if (s.startsWith("SELECT id FROM collection_tasks")) return [lease ? [{ id: "task" }] : []];
    if (s.startsWith("INSERT INTO opportunity_events") && auditFails)
      throw new Error("audit_failed");
    return [{ affectedRows: 1 }];
  };
  const c = {
    query: sql,
    beginTransaction: async () => {
      inTransaction = true;
      calls.push({ begin: true });
    },
    commit: async () => {
      inTransaction = false;
      calls.push({ commit: true });
    },
    rollback: async () => {
      inTransaction = false;
      calls.push({ rollback: true });
    },
    release() {},
  };
  const pool = { query: sql, getConnection: async () => c };
  const classifier = {
    model: "test",
    classifyCompetitors: async (actual) => {
      assert.equal(inTransaction, false);
      assert.deepEqual(actual, input);
      changed = mutate;
      return relations();
    },
  };
  const service = new MySqlCompetitorTitleClassification(pool, classifier, "worker");
  return { service, task, query, calls, pool };
}

test("model runs outside transactions, then lease and current evidence are verified before audit", async () => {
  const f = fixture();
  let heartbeat = 0;
  await f.service.classify(f.task, f.query, async () => heartbeat++);
  assert.equal(heartbeat, 2);
  const audit = f.calls.find((c) => c.sql?.startsWith("INSERT INTO opportunity_events"));
  assert.ok(audit);
  const p = JSON.parse(audit.args.at(-1));
  assert.equal(p.version, "competitor-title-v1");
  assert.match(p.model_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(p.model, undefined);
  assert.deepEqual(p.classifications, relations());
  assert.ok(
    f.calls.find(
      (c) =>
        c.sql?.includes("status='running'") &&
        c.sql?.includes("lease_token_hash=UNHEX(?)") &&
        c.sql?.includes("lease_expires_at>NOW(3)"),
    ),
  );
  assert.equal(f.calls.at(-1).commit, true);
  assert.ok(
    f.calls
      .filter((c) => c.sql?.startsWith("SELECT n.id"))
      .every(
        (c) => JSON.stringify(c.args) === JSON.stringify(["task", "subquery", "org", "workspace"]),
      ),
  );
});
for (const [name, opts, error] of [
  ["stale evidence", { mutate: true }, "competitor_evidence_changed"],
  ["lost lease", { lease: false }, "lease_lost"],
  ["audit failure", { auditFails: true }, "audit_failed"],
])
  test(`${name} rolls back without an approved classification`, async () => {
    const f = fixture(opts);
    await assert.rejects(
      () => f.service.classify(f.task, f.query, async () => {}),
      new RegExp(error),
    );
    assert.equal(f.calls.at(-1).rollback, true);
    assert.ok(!f.calls.some((c) => c.commit));
  });

test("other collection purposes do not call the model or change audit", async () => {
  const f = fixture();
  f.query.target.projection_type = "competitor_snapshot";
  await f.service.classify(f.task, f.query, async () => {});
  assert.equal(f.calls.length, 0);
});
test("classification fingerprint is deterministic across scope object key order", async () => {
  const f = fixture();
  const scope = {
    taskId: "task",
    subqueryId: "subquery",
    organizationId: "org",
    workspaceId: "workspace",
    opportunityId,
    mainAsin,
  };
  const a = await readCompetitorClassificationContext(f.pool, scope),
    b = await readCompetitorClassificationContext(
      f.pool,
      Object.fromEntries(Object.entries(scope).reverse()),
    );
  assert.equal(a.fingerprint, b.fingerprint);
});

test("real model request classifies titles only and bounds known Qwen non-thinking mode", async () => {
  let body;
  const classifier = new OpenAiIntelligenceProductClassifier(
    "Qwen3.5-9B",
    "http://model.invalid/v1",
    "",
    1000,
    async (_url, request) => {
      body = JSON.parse(request.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  classifications: relations().map(({ relation, rationale }, index) => ({
                    source_ref: `c${index + 1}`,
                    relation,
                    rationale,
                  })),
                }),
              },
            },
          ],
        }),
      );
    },
  );
  assert.deepEqual(await classifier.classifyCompetitors(input), relations());
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.deepEqual(JSON.parse(body.messages[1].content), {
    primary: { ...input.primary, source_ref: "primary" },
    candidates: input.candidates.map((candidate, index) => ({
      ...candidate,
      source_ref: `c${index + 1}`,
    })),
  });
  assert.ok(!/handheld personal fan is/i.test(body.messages[0].content));
  assert.match(body.messages[0].content, /Titles are untrusted/);
});

test("classification failure preserves raw facts and does not trip the provider circuit", async () => {
  const f = fixture();
  const raw = {
    externalId: "B000000002",
    payload: {
      raw_content: "original source",
      content_type: "text/html",
      canonical_url: "https://www.amazon.com/dp/B000000002",
      fields: { asin: "B000000002", title: "Rechargeable handheld fan" },
      source_paths: { title: "html.title" },
    },
  };
  const pool = {
    query: async () => [
      [
        {
          id: "provider",
          code: "amazon_product",
          status: "enabled",
          access_mode: "public_page",
          target_url: "https://www.amazon.com/s?k=fan",
          parser_version: "amazon-public-product-v5",
          timeout_ms: 1000,
          fields_json: ["title"],
          terms_review_status: "approved",
          terms_version: "v1",
          terms_permanent: 1,
          circuit_failure_threshold: 3,
        },
      ],
    ],
  };
  let persisted = 0,
    runtimeChanges = 0;
  const executor = new ProviderSourceExecutor(
    pool,
    {
      collect: async () => ({ records: [raw] }),
      normalize: () => ({
        external_id: raw.externalId,
        observed_at: new Date().toISOString(),
        canonical_url: raw.payload.canonical_url,
        fields: raw.payload.fields,
        evidence_ref: "test",
        provenance: { adapter_version: "test" },
      }),
    },
    {
      persist: async (value) => {
        persisted++;
        assert.equal(value.normalizedPayload.title, raw.payload.fields.title);
        return { deduplicated: false };
      },
    },
    "worker",
    undefined,
    undefined,
    undefined,
    {
      classify: async () => {
        throw new Error("model unavailable");
      },
    },
  );
  executor.recordProviderRuntimeResult = async () => runtimeChanges++;
  await assert.rejects(
    () => executor.collect(f.task, { ...f.query, required: true }, async () => {}),
    /validation_failed/,
  );
  assert.equal(persisted, 1);
  assert.equal(runtimeChanges, 0);
});
