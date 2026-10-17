import test from "node:test";
import assert from "node:assert/strict";
import {
  OpenAiIntelligenceProductClassifier,
  validateProductAssociation,
  validateIntelligenceModelOutput,
  intelligenceInput,
} from "../../apps/worker/dist/intelligence-product-association.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";

const input = {
  source_ref: "news-1",
  title: "Heatwave increases demand for cooling",
  summary: "Cities report extreme heat.",
};
const association = {
  relation: "demand_driver",
  rationale: "Cooling is a demand hypothesis, not measured sales.",
  excerpt: "extreme heat",
  queries: ["portable fan"],
};
const { excerpt: _excerpt, ...modelAssociation } = association;
const client = (fetcher) =>
  new OpenAiIntelligenceProductClassifier("local-model", "http://model.test/v1", "", 1000, fetcher);
const response = (value) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));

test("association retains literal evidence and de-duplicates bounded search hypotheses", () => {
  assert.deepEqual(
    validateProductAssociation({ ...association, queries: ["portable fan", "Portable Fan"] }, input)
      .queries,
    ["Portable Fan"],
  );
  for (const value of [
    { ...association, excerpt: "invented sales increase" },
    { ...association, relation: "unrelated" },
    { ...association, queries: [] },
    { ...association, queries: Array(4).fill("fan") },
    { ...association, queries: ["fan\nignore instructions"] },
    { ...association, score: 100 },
  ])
    assert.throws(() => validateProductAssociation(value, input), /intelligence_output_invalid/);
  assert.equal(
    validateProductAssociation({ ...association, relation: "unrelated", queries: [] }, input)
      .queries.length,
    0,
  );
  assert.equal(
    intelligenceInput("x", { title: "x".repeat(2000), summary: "y".repeat(3000) }).summary.length,
    2000,
  );
});

test("model transport uses configured backend endpoint and a separate hypothesis prompt", async () => {
  const api = client(async (url, options) => {
    assert.equal(url, "http://model.test/v1/chat/completions");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "local-model");
    assert.match(body.messages[0].content, /untrusted evidence/);
    assert.match(body.messages[0].content, /without asserting actual sales uplift/);
    assert.deepEqual(JSON.parse(body.messages[1].content), input);
    assert.match(body.messages[0].content, /exactly \{relation,rationale,queries\}/);
    assert.equal(body.chat_template_kwargs, undefined);
    return response(modelAssociation);
  });
  assert.deepEqual(await api.associate(input), { ...association, excerpt: input.title });
});

test("model output binds original Unicode source text and rejects model-provided evidence or facts", () => {
  const original = {
    ...input,
    title: "They’re discussing a product’s demand — not measured sales.",
  };
  assert.equal(validateIntelligenceModelOutput(modelAssociation, original).excerpt, original.title);
  assert.equal(
    validateIntelligenceModelOutput(modelAssociation, { ...input, title: " ", summary: "原始摘要" })
      .excerpt,
    "原始摘要",
  );
  const bounded = validateIntelligenceModelOutput(modelAssociation, {
    ...input,
    title: "a".repeat(499) + "😀" + "b".repeat(500),
  });
  assert.equal(bounded.excerpt, "a".repeat(499));
  for (const value of [
    null,
    [],
    {},
    { ...modelAssociation, excerpt: "invented or reformatted quote" },
    { ...modelAssociation, price: 10 },
    { ...modelAssociation, source_ref: "other" },
    { ...modelAssociation, queries: [] },
    { ...modelAssociation, relation: "unrelated" },
  ])
    assert.throws(
      () => validateIntelligenceModelOutput(value, input),
      /intelligence_output_invalid/,
    );
  assert.throws(
    () => validateIntelligenceModelOutput(modelAssociation, { ...input, title: "", summary: "" }),
    /intelligence_output_invalid/,
  );
});

test("Qwen 3.5 association and primary selection reuse classification-only non-thinking transport", async () => {
  const candidates = [{ source_ref: "p1", asin: "B000000001", title: "Portable fan" }];
  for (const model of ["Qwen3.5-9B-AWQ-4bit", "Qwen/Qwen3.5-9B", "local-model"]) {
    const bodies = [];
    const api = new OpenAiIntelligenceProductClassifier(
      model,
      "http://model.test/v1",
      "",
      1000,
      async (_url, options) => {
        const body = JSON.parse(options.body);
        bodies.push(body);
        return response(
          bodies.length === 1
            ? modelAssociation
            : { source_ref: "p1", rationale: "Same product type." },
        );
      },
    );
    await api.associate(input);
    await api.selectPrimary("portable fan", candidates);
    for (const body of bodies)
      assert.deepEqual(
        body.chat_template_kwargs,
        model === "local-model" ? undefined : { enable_thinking: false },
      );
  }
});

test("primary selection accepts only real supplied source references including an explicit no-match", async () => {
  const candidates = [{ source_ref: "record-1", asin: "B000000001", title: "Portable Fan" }];
  for (const id of ["record-1", null]) {
    const selected = await client(async () =>
      response({ source_ref: id, rationale: "Title relevance only." }),
    ).selectPrimary("portable fan", candidates);
    assert.equal(selected.source_ref, id);
  }
  await assert.rejects(
    client(async () => response({ source_ref: "invented", rationale: "fake" })).selectPrimary(
      "fan",
      candidates,
    ),
    /intelligence_output_invalid/,
  );
});

test("model failures preserve retry classification and cap response bytes", async () => {
  for (const [status, retryable] of [
    [401, false],
    [429, true],
    [503, true],
  ]) {
    await assert.rejects(
      client(async () => new Response("failure", { status })).associate(input),
      (error) => error.retryable === retryable,
    );
  }
  await assert.rejects(
    client(async () => new Response("x".repeat(65537))).associate(input),
    /intelligence_output_invalid/,
  );
  await assert.rejects(
    client(
      async (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    ).associate(input),
    /intelligence_model_timeout/,
  );
});

const now = new Date("2026-10-17T01:00:00Z");
const sourceId = "00000000-0000-4000-8000-000000000001";
const baseJob = {
  id: "job",
  organizationId: "org",
  workspaceId: "ws",
  normalizedRecordId: sourceId,
  rawEvidenceId: "evidence",
  providerId: "provider",
  providerCode: "google_news_search",
  collectionTaskId: "task",
  payload: {
    ...input,
    publisher: "News",
    canonical_url: "https://news.test/article",
    published_at: now.toISOString(),
    observed_at: now.toISOString(),
  },
  actorId: "actor",
  requestId: "request",
  traceId: "trace",
  attemptCount: 1,
};

test("news hypotheses schedule scoped Amazon tasks atomically; unrelated news schedules none", async () => {
  for (const related of [true, false]) {
    const calls = [];
    const connection = {
      beginTransaction: async () => calls.push(["begin"]),
      commit: async () => calls.push(["commit"]),
      rollback: async () => calls.push(["rollback"]),
      release() {},
      query: async (sql, params) => {
        calls.push([sql, params]);
        if (sql.startsWith("SELECT id FROM trend_projection_jobs")) return [[{ id: "job" }]];
        if (
          sql.startsWith("SELECT id FROM trend_topics") ||
          sql.startsWith("SELECT id,include_keywords")
        )
          return [[]];
        if (sql.startsWith("SELECT id FROM providers WHERE code='amazon_product'"))
          return [[{ id: "amazon" }]];
        return [{ affectedRows: 1 }];
      },
    };
    const persistence = new TrendProjectionPersistence(
      { getConnection: async () => connection },
      "worker",
      () => now,
    );
    await persistence.project({
      ...baseJob,
      intelligenceAssociation: related
        ? association
        : { ...association, relation: "unrelated", queries: [] },
    });
    const tasks = calls.filter(([sql]) => sql.startsWith("INSERT INTO collection_subqueries"));
    assert.equal(tasks.length, related ? 1 : 0);
    if (related) {
      assert.deepEqual(JSON.parse(tasks[0][1][6]), {
        query: "portable fan",
        projection_type: "intelligence_product_discovery",
        intelligence_source_record_id: sourceId,
      });
      assert.deepEqual(tasks[0][1].slice(2, 5), ["org", "ws", "amazon"]);
    }
    assert.ok(calls.some(([sql]) => sql.startsWith("INSERT INTO trend_events")));
    assert.equal(calls.at(-1)[0], "commit");
  }
});

test("expired leases cannot publish AI-derived tasks", async () => {
  let rolledBack = false;
  const persistence = new TrendProjectionPersistence(
    {
      getConnection: async () => ({
        beginTransaction: async () => {},
        rollback: async () => {
          rolledBack = true;
        },
        release() {},
        query: async () => [[]],
      }),
    },
    "worker",
    () => now,
  );
  await assert.rejects(
    persistence.project({ ...baseJob, intelligenceAssociation: association }),
    /trend_projection_lease_lost/,
  );
  assert.equal(rolledBack, true);
});

test("search results choose exactly one actual product before projection and retain intelligence lineage", async () => {
  const calls = [];
  const product = (index) => ({
    id: `record-${index}`,
    provider_id: "amazon",
    raw_evidence_id: `raw-${index}`,
    payload_json: {
      title: `Portable Fan ${index}`,
      asin: `B00000000${index}`,
      canonical_url: `https://www.amazon.com/dp/B00000000${index}`,
    },
  });
  const worker = new MySqlTrendProjectionWorker(
    {
      query: async (sql, params) => {
        calls.push([sql, params]);
        return sql.startsWith("SELECT n.id FROM normalized_records")
          ? [[{ id: sourceId }]]
          : [[product(1), product(2)]];
      },
    },
    "worker",
    120,
    () => now,
    {
      model: "local",
      associate: async () => association,
      selectPrimary: async (query, candidates) => {
        assert.equal(query, "portable fan");
        assert.equal(candidates.length, 2);
        return { source_ref: "record-2", rationale: "Exact product type match." };
      },
    },
  );
  const job = {
    ...baseJob,
    providerCode: "amazon_product",
    intelligenceSourceRecordId: sourceId,
    intelligenceQuery: "portable fan",
  };
  assert.equal(await worker.prepareIntelligence(job), true);
  assert.equal(job.normalizedRecordId, "record-2");
  assert.equal(job.payload.asin, "B000000002");
  assert.equal(job.intelligenceSourceRecordId, sourceId);
  assert.match(calls[0][0], /e.organization_id=n.organization_id/);
  assert.match(calls[1][0], /l.organization_id=\? AND l.workspace_id=\?/);
});

test("selected Amazon primary links original news and schedules the existing detail, competitor and sourcing chain", async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.startsWith("SELECT id FROM trend_projection_jobs")) return [[{ id: "job" }]];
      if (sql.startsWith("SELECT id,code FROM providers"))
        return [
          [
            { id: "amazon", code: "amazon_product" },
            { id: "alibaba", code: "1688_search" },
          ],
        ];
      if (sql.startsWith("SELECT ")) return [[]];
      return [{ affectedRows: 1 }];
    },
  };
  const persistence = new TrendProjectionPersistence(
    { getConnection: async () => connection },
    "worker",
    () => now,
  );
  await persistence.project({
    ...baseJob,
    providerCode: "amazon_product",
    providerId: "amazon",
    normalizedRecordId: "chosen-record",
    intelligenceSourceRecordId: sourceId,
    intelligenceQuery: "portable fan",
    primarySelectionRationale: "Fan title matches.",
    payload: {
      ...baseJob.payload,
      asin: "B000000001",
      title: "Portable Fan",
      canonical_url: "https://www.amazon.com/dp/B000000001",
      image_url: "https://m.media-amazon.com/images/I/fan.jpg",
    },
  });
  const targets = calls
    .filter(([sql]) => sql.startsWith("INSERT INTO collection_subqueries"))
    .map(([, params]) => JSON.parse(params[6]));
  assert.deepEqual(
    targets.map((target) => target.projection_type),
    ["sourcing_search", "opportunity_competitors", "competitor_snapshot"],
  );
  assert.equal(targets[1].main_asin, "B000000001");
  const newsLink = calls.find(([sql]) =>
    sql.includes("FROM trend_signals s WHERE s.normalized_record_id=?"),
  );
  assert.deepEqual(newsLink[1].slice(2), [sourceId, "org", "ws"]);
  assert.ok(
    calls.some(
      ([sql, params]) =>
        sql.startsWith("INSERT INTO trend_events") &&
        params[3] === "trend.intelligence.primary_selected",
    ),
  );
});

test("forged intelligence lineage and no relevant matches cannot project products", async () => {
  let selected = false;
  const classifier = {
    model: "local",
    selectPrimary: async () => {
      selected = true;
      return { source_ref: null, rationale: "No match." };
    },
  };
  const job = { ...baseJob, intelligenceSourceRecordId: sourceId, intelligenceQuery: "fan" };
  const invalid = new MySqlTrendProjectionWorker(
    { query: async () => [[]] },
    "worker",
    120,
    () => now,
    classifier,
  );
  await assert.rejects(invalid.prepareIntelligence(job), /intelligence_provenance_invalid/);
  assert.equal(selected, false);
  let index = 0;
  const empty = new MySqlTrendProjectionWorker(
    { query: async () => [index++ ? [] : [{ id: sourceId }]] },
    "worker",
    120,
    () => now,
    classifier,
  );
  assert.equal(await empty.prepareIntelligence(job), false);
});

test("observed numeric advertising flags are excluded before selecting the primary", async () => {
  let reads = 0;
  const worker = new MySqlTrendProjectionWorker(
    {
      query: async () => [
        reads++ === 0
          ? [{ id: sourceId }]
          : [
              {
                id: "ad",
                provider_id: "amazon",
                raw_evidence_id: "raw-ad",
                payload_json: {
                  asin: "B000000001",
                  canonical_url: "https://www.amazon.com/dp/B000000001",
                  title: "Portable Fan Ad",
                  sponsored: 1,
                },
              },
              {
                id: "organic",
                provider_id: "amazon",
                raw_evidence_id: "raw-organic",
                payload_json: {
                  asin: "B000000002",
                  canonical_url: "https://www.amazon.com/dp/B000000002",
                  title: "Portable Fan",
                },
              },
            ],
      ],
    },
    "worker",
    120,
    () => now,
    {
      model: "local",
      selectPrimary: async (_query, candidates) => {
        assert.deepEqual(
          candidates.map((c) => c.source_ref),
          ["organic"],
        );
        return { source_ref: "organic", rationale: "Product title matches." };
      },
    },
  );
  const job = {
    ...baseJob,
    providerCode: "amazon_product",
    intelligenceSourceRecordId: sourceId,
    intelligenceQuery: "portable fan",
  };
  assert.equal(await worker.prepareIntelligence(job), true);
  assert.equal(job.normalizedRecordId, "organic");
});

test("no-match and model failure preserve distinct terminal or retry queue receipts", async () => {
  for (const fails of [false, true]) {
    const receipts = [];
    const worker = new MySqlTrendProjectionWorker(
      {
        query: async (_sql, params) => {
          receipts.push(params);
          return [[]];
        },
      },
      "worker",
      120,
      () => now,
    );
    worker.sourceRecovery.processOnce = async () => 0;
    worker.enqueueMissing = async () => {};
    worker.claim = async () => ({ ...baseJob });
    worker.prepareIntelligence = async () => {
      if (fails)
        throw Object.assign(new Error("dependency failure"), { code: "MODEL_UNAVAILABLE" });
      return false;
    };
    worker.persistence.project = async () => {
      assert.fail("must not project an unselected product");
    };
    const result = await worker.processOnce();
    assert.equal(result.status, fails ? "scheduled" : "succeeded_empty");
    assert.equal(receipts[0][0], result.status);
    assert.equal(
      receipts[0][2],
      fails ? "trend_projection_model_unavailable" : "intelligence_no_relevant_product",
    );
  }
});

function automaticChannelProjection(enabled = true) {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.startsWith("SELECT id FROM trend_projection_jobs")) return [[{ id: "job" }]];
      if (sql.startsWith("SELECT id,code FROM providers"))
        return [
          enabled
            ? [
                { id: "amazon", code: "amazon_product" },
                { id: "alibaba", code: "1688_search" },
              ]
            : [],
        ];
      if (sql.startsWith("SELECT ")) return [[]];
      return [{ affectedRows: 1 }];
    },
  };
  return {
    calls,
    persistence: new TrendProjectionPersistence(
      { getConnection: async () => connection },
      "worker",
      () => now,
    ),
  };
}
const channelProduct = {
  asin: "B000000001",
  title: "Portable Fan",
  canonical_url: "https://www.amazon.com/dp/B000000001",
  image_url: "https://m.media-amazon.com/images/I/fan.jpg",
};
test("an actual Amazon product from an automatic product channel enters analysis without a monitoring subscription", async () => {
  const f = automaticChannelProjection();
  await f.persistence.project({
    ...baseJob,
    providerCode: "page_amazon_bestsellers_us",
    payload: { ...baseJob.payload, ...channelProduct },
  });
  const insert = f.calls.find(([sql]) => sql.startsWith("INSERT IGNORE INTO opportunities"));
  assert.ok(insert);
  assert.deepEqual(insert[1].slice(1, 3), ["org", "ws"]);
  assert.equal(
    f.calls.some(([sql]) => sql.startsWith("INSERT IGNORE INTO opportunity_rule_matches")),
    false,
  );
  const event = f.calls.find(
    ([sql]) =>
      sql.startsWith("INSERT INTO opportunity_events") &&
      sql.includes("'opportunity.candidate.discovered'"),
  );
  const payload = JSON.parse(event[1].at(-2));
  assert.deepEqual(payload.matched_rule_ids, []);
  assert.equal(payload.recommendation_status, "insufficient_data");
  const targets = f.calls
    .filter(([sql]) => sql.startsWith("INSERT INTO collection_subqueries"))
    .map(([, params]) => JSON.parse(params[6]));
  assert.deepEqual(
    targets.map((t) => t.projection_type),
    ["sourcing_search", "opportunity_competitors", "competitor_snapshot"],
  );
  assert.equal(targets[1].main_asin, channelProduct.asin);
  assert.equal(targets[1].opportunity_id, insert[1][0]);
  assert.equal(
    f.calls.some(([sql]) => sql.startsWith("INSERT INTO automatic_selection_evaluations")),
    true,
  );
  assert.equal(
    f.calls.some(([, params]) =>
      params?.some(
        (v) => typeof v === "string" && v === "opportunity.selection_pipeline_completed",
      ),
    ),
    false,
  );
});
for (const [name, providerCode, product] of [
  ["unselected Amazon search result", "amazon_product", channelProduct],
  ["ordinary news source", "feed_bbc_business", channelProduct],
  ["supplier evidence", "1688_search", channelProduct],
  ["inconsistent ASIN", "page_amazon_bestsellers_us", { ...channelProduct, asin: "B000000002" }],
  [
    "foreign host",
    "page_amazon_bestsellers_us",
    { ...channelProduct, canonical_url: "https://www.amazon.com.evil.example/dp/B000000001" },
  ],
  [
    "channel homepage",
    "page_amazon_bestsellers_us",
    { ...channelProduct, canonical_url: "https://www.amazon.com/Best-Sellers/zgbs" },
  ],
]) {
  test(`automatic admission does not treat ${name} as a selected primary`, async () => {
    const f = automaticChannelProjection();
    const project = () =>
      f.persistence.project({
        ...baseJob,
        providerCode,
        payload: { ...baseJob.payload, ...product },
      });
    if (providerCode === "1688_search")
      await assert.rejects(project, { code: "trend_provider_unsupported" });
    else await project();
    assert.equal(
      f.calls.some(([sql]) => sql.startsWith("INSERT IGNORE INTO opportunities")),
      false,
    );
    assert.equal(
      f.calls.some(([sql]) => sql.startsWith("INSERT INTO collection_subqueries")),
      false,
    );
  });
}

test("automatic channel admission does not bypass disabled downstream providers", async () => {
  const f = automaticChannelProjection(false);
  await f.persistence.project({
    ...baseJob,
    providerCode: "page_amazon_bestsellers_us",
    payload: { ...baseJob.payload, ...channelProduct },
  });
  assert.ok(f.calls.some(([sql]) => sql.startsWith("INSERT IGNORE INTO opportunities")));
  assert.equal(
    f.calls.some(([sql]) => sql.startsWith("INSERT INTO collection_subqueries")),
    false,
  );
  assert.ok(
    f.calls.some(([sql]) =>
      sql.includes("code IN ('amazon_product','1688_search') AND status='enabled'"),
    ),
  );
});
