import assert from "node:assert/strict";
import test from "node:test";
import {
  validateSupplyTitleClassifications,
  validatedSupplyTitleCandidates,
  SupplyTitleCitationError,
} from "../../apps/worker/dist/supply-title-classification.js";
import {
  isPhoneCase,
  productIdentityConfidence,
  selectClassifiedSupplyQuote,
} from "../../apps/worker/dist/automatic-selection-evaluation.js";
import { OpenAiIntelligenceProductClassifier } from "../../apps/worker/dist/intelligence-product-association.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";

const title = "Waterproof nylon makeup case with zipper";
const offer = {
  externalId: "123",
  evidenceId: "raw-1",
  title: "防水尼龙化妆包拉链收纳",
  price: 8.5,
  currency: "CNY",
  observedAt: new Date("2026-10-17T00:00:00Z"),
};
const input = {
  product_ref: "amazon:main-1",
  product_title: title,
  candidates: [{ source_ref: "123:raw-1", title: offer.title }],
};
const result = {
  source_ref: "123:raw-1",
  relation: "compatible",
  rationale: "Explicit type, material and waterproof function agree; exact SKU is unverified.",
  attributes: [
    { kind: "product_type", product_excerpt: "makeup case", supply_excerpt: "化妆包" },
    { kind: "material", product_excerpt: "nylon", supply_excerpt: "尼龙" },
    { kind: "function", product_excerpt: "Waterproof", supply_excerpt: "防水" },
  ],
};
const context = () => structuredClone({ input, classifications: [result] });
const select = (supplies = [offer], value = context(), ref = input.product_ref, product = title) =>
  selectClassifiedSupplyQuote(ref, product, supplies, value);

test("ordinary case products never inherit phone-only cost policy", () => {
  for (const name of [
    title,
    "Pencil case",
    "Storage case",
    "保护套收纳袋",
    "Apple storage case 17",
  ])
    assert.equal(isPhoneCase(name), false, name);
  for (const name of [
    "Phone case",
    "手机保护套",
    "Magnetic Case for iPhone 17 Pro Max",
    "Samsung Galaxy S24 cover",
    "Pixel 9 case",
  ])
    assert.equal(isPhoneCase(name), true, name);
});

test("cross-language classification preserves literal evidence and returns a real quote without invented confidence", () => {
  assert.deepEqual(validateSupplyTitleClassifications({ classifications: [result] }, input), [
    result,
  ]);
  const match = select();
  assert.equal(match.item.evidenceId, offer.evidenceId);
  assert.equal(match.conservativePrice, offer.price);
  assert.equal(match.confidence, null);
  assert.equal(match.sampleCount, 1);
  assert.deepEqual(match.classification, context());
});

for (const [name, mutate] of [
  [
    "invented price",
    (v) => {
      v.classifications[0].price = 1;
    },
  ],
  [
    "invented source",
    (v) => {
      v.classifications[0].source_ref = "other";
    },
  ],
  [
    "invented excerpt",
    (v) => {
      v.classifications[0].attributes[0].product_excerpt = "leather";
    },
  ],
  [
    "category alone",
    (v) => {
      v.classifications[0].attributes.length = 1;
    },
  ],
  [
    "duplicated kind",
    (v) => {
      v.classifications[0].attributes[1].kind = "product_type";
    },
  ],
  [
    "repeated excerpt",
    (v) => {
      v.classifications[0].attributes[1].product_excerpt = "makeup case";
    },
  ],
  [
    "overlapping excerpt",
    (v) => {
      v.classifications[0].attributes[1].product_excerpt = "case";
    },
  ],
  [
    "duplicate source",
    (v) => {
      v.classifications.push(structuredClone(result));
    },
  ],
])
  test(`rejects ${name}`, () => {
    const v = context();
    mutate(v);
    assert.throws(
      () => validateSupplyTitleClassifications({ classifications: v.classifications }, v.input),
      /classification_invalid/,
    );
    assert.equal(select([offer], v), null);
  });

test("classifications cannot cross primary evidence, title or supply versions", () => {
  assert.equal(select([offer], context(), "amazon:other"), null);
  assert.equal(select([offer], context(), input.product_ref, `${title} changed`), null);
  assert.equal(select([{ ...offer, evidenceId: "new-evidence" }]), null);
  assert.equal(select([{ ...offer, title: "other product" }]), null);
  assert.equal(select([{ ...offer, priceDescription: "新人价" }]), null);
  assert.equal(select([{ ...offer, currency: "USD" }]), null);
  assert.equal(select([{ ...offer, price: 0 }]), null);
  assert.equal(select([{ ...offer, price: Number.NaN }]), null);
  const newer = { ...offer, price: Number.NaN, observedAt: new Date("2026-10-18") };
  assert.equal(select([offer, newer]), null);
  for (const relation of ["incompatible", "uncertain"]) {
    const v = context();
    v.classifications[0].relation = relation;
    assert.equal(select([offer], v), null);
  }
});

test("numerical specifications fail closed and phone model matching cannot be bypassed", () => {
  const v = context();
  v.input.product_title += " 20";
  assert.equal(select([offer], v, input.product_ref, v.input.product_title), null);
  const v2 = context();
  v2.input.candidates[0].title += " 30";
  assert.equal(select([{ ...offer, title: v2.input.candidates[0].title }], v2), null);
  const v3 = context();
  v3.input.product_title = "Waterproof nylon phone case with zipper";
  v3.classifications[0].attributes[0].product_excerpt = "phone case";
  assert.equal(select([offer], v3, input.product_ref, v3.input.product_title), null);
});

test("model output ordering cannot choose a different source or invent a cheapest-price policy", () => {
  const second = { ...offer, externalId: "456", evidenceId: "raw-2", price: 1 };
  const v = context();
  v.input.candidates.push({ source_ref: "456:raw-2", title: second.title });
  v.classifications.unshift({ ...structuredClone(result), source_ref: "456:raw-2" });
  const matched = select([offer, second], v);
  assert.equal(matched.item.externalId, "123");
  assert.equal(matched.conservativePrice, 8.5);
});

test("explicit material conflicts reject model false positives and lexical overlap", () => {
  const silicone = { ...offer, title: "硅胶化妆包防水拉链收纳" };
  const v = context();
  v.input.candidates[0].title = silicone.title;
  v.classifications[0].attributes[1] = {
    kind: "design",
    product_excerpt: "zipper",
    supply_excerpt: "拉链",
  };
  // This is the real-model false positive found by the ten-candidate synthetic probe.
  assert.equal(select([silicone], v), null);
  assert.equal(
    productIdentityConfidence(
      "Waterproof nylon makeup bag zipper",
      "Waterproof silicone makeup bag zipper",
    ),
    0,
  );
  const missingMaterial = { ...offer, title: "防水化妆包拉链收纳" };
  v.input.candidates[0].title = missingMaterial.title;
  assert.equal(select([missingMaterial], v), null);
});

test("model supplies only classifications through the existing bounded OpenAI contract", async () => {
  let body;
  const api = new OpenAiIntelligenceProductClassifier(
    "configured-model",
    "http://model.test/v1",
    "",
    1000,
    async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ classifications: [{ ...result, source_ref: "c1" }] }),
              },
            },
          ],
        }),
      );
    },
  );
  assert.deepEqual(await api.classifySupplies(input), [result]);
  assert.equal(body.model, "configured-model");
  assert.equal(body.chat_template_kwargs, undefined);
  assert.deepEqual(JSON.parse(body.messages[1].content), {
    ...input,
    product_ref: "primary",
    candidates: input.candidates.map((c, i) => ({ ...c, source_ref: `c${i + 1}` })),
  });
  assert.doesNotMatch(body.messages[1].content, /8\.5|price|currency/);
  for (const candidates of [
    [],
    Array(11).fill(input.candidates[0]),
    [...input.candidates, ...input.candidates],
  ])
    await assert.rejects(api.classifySupplies({ ...input, candidates }), /input_invalid/);
});

test("short model references restore the exact original candidate even when results omit or reorder entries", async () => {
  const original = {
    ...input,
    candidates: [
      { ...input.candidates[0], source_ref: "111:00000000-0000-4000-8000-000000000001" },
      { ...input.candidates[0], source_ref: "222:00000000-0000-4000-8000-000000000002" },
    ],
  };
  const api = new OpenAiIntelligenceProductClassifier(
    "configured-model",
    "http://model.test/v1",
    "",
    1000,
    async (_url, options) => {
      const payload = JSON.parse(JSON.parse(options.body).messages[1].content);
      assert.deepEqual(
        payload.candidates.map((c) => c.source_ref),
        ["c1", "c2"],
      );
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ classifications: [{ ...result, source_ref: "c2" }] }),
            },
          },
        ],
      });
    },
  );
  assert.deepEqual(await api.classifySupplies(original), [
    { ...result, source_ref: original.candidates[1].source_ref },
  ]);
});

test("supply model cannot cite translated or supply-only attributes as primary evidence", async () => {
  const translated = structuredClone(result);
  translated.attributes = translated.attributes.map((attribute) => ({
    ...attribute,
    product_excerpt: attribute.supply_excerpt,
  }));
  const responses = [
    { classifications: [{ ...translated, source_ref: "c1" }] },
    { classifications: [] },
  ];
  const api = new OpenAiIntelligenceProductClassifier(
    "configured-model",
    "http://model.test/v1",
    "",
    1000,
    async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(JSON.parse(body.messages[1].content).candidates[0].source_ref, "c1");
      return Response.json({
        choices: [{ message: { content: JSON.stringify(responses.shift()) } }],
      });
    },
  );
  await assert.rejects(api.classifySupplies(input), /supply_title_classification_invalid/);
  assert.deepEqual(await api.classifySupplies(input), []);
  assert.equal(
    selectClassifiedSupplyQuote(input.product_ref, title, [offer], { input, classifications: [] }),
    null,
  );
});

test("Qwen 3.5 supply and intelligence classification use the documented non-thinking parameter", async () => {
  for (const model of ["Qwen3.5-9B-AWQ-4bit", "Qwen/Qwen3.5-9B"]) {
    const bodies = [];
    const api = new OpenAiIntelligenceProductClassifier(
      model,
      "http://model.test/v1",
      "",
      1000,
      async (_url, options) => {
        const body = JSON.parse(options.body);
        bodies.push(body);
        const value = body.messages[0].content.includes("Compare the English Amazon")
          ? { classifications: [{ ...result, source_ref: "c1" }] }
          : {
              relation: "unrelated",
              rationale: "No physical product demand.",
              queries: [],
            };
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }),
        );
      },
    );
    await api.classifySupplies(input);
    await api.associate({ source_ref: "news", title: "test", summary: "test" });
    assert.deepEqual(bodies[0].chat_template_kwargs, { enable_thinking: false });
    assert.deepEqual(bodies[1].chat_template_kwargs, { enable_thinking: false });
  }
});

test("preflight model call holds no SQL transaction and reads only the scoped main and sourcing evidence", async () => {
  const reads = [];
  const pool = {
    getConnection() {
      throw new Error("model must not acquire a transaction");
    },
    async query(sql, params) {
      reads.push({ sql, params });
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [{ raw_evidence_id: "main-1", observed_at: offer.observedAt, payload_json: { title } }],
        ];
      if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
      if (sql === automaticSupplyEvidenceSql)
        return [
          [
            {
              raw_evidence_id: offer.evidenceId,
              created_at: offer.observedAt,
              payload_json: { ...offer, external_id: offer.externalId },
            },
          ],
        ];
      throw new Error("unexpected SQL");
    },
  };
  let called = 0;
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    pool,
    "worker",
    "actor",
    120,
    undefined,
    {
      async classifySupplies(value) {
        called++;
        assert.deepEqual(value, input);
        return [result];
      },
    },
  );
  assert.deepEqual(
    await worker.classifySupplyTitles({
      opportunityId: "item",
      organizationId: "org",
      workspaceId: "ws",
    }),
    context(),
  );
  assert.equal(called, 1);
  assert.equal(reads.length, 3);
  for (const read of reads) assert.deepEqual(read.params, ["item", "org", "ws"]);
});

function batchHarness(
  count,
  classify,
  { leaseValid = true, productTitle = title, supplyTitles } = {},
) {
  const calls = [],
    renewals = [];
  let clock = Date.parse("2026-10-17T00:00:00Z");
  const supplies = Array.from({ length: count }, (_, index) => ({
    ...offer,
    externalId: String(index + 1),
    evidenceId: `raw-${index + 1}`,
    title: supplyTitles?.(index) ?? offer.title,
  }));
  const pool = {
    getConnection() {
      throw new Error("model must not hold a SQL transaction");
    },
    async query(sql, params) {
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              raw_evidence_id: "main-1",
              observed_at: offer.observedAt,
              payload_json: { title: productTitle },
            },
          ],
        ];
      if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
      if (sql === automaticSupplyEvidenceSql)
        return [
          supplies.map((item) => ({
            raw_evidence_id: item.evidenceId,
            created_at: item.observedAt,
            payload_json: { ...item, external_id: item.externalId },
          })),
        ];
      assert.match(
        sql,
        /^UPDATE automatic_selection_evaluations SET lease_expires_at=\?,updated_at=\?/,
      );
      assert.match(
        sql,
        /organization_id=\? AND workspace_id=\? AND status='leased' AND lease_owner=\? AND lease_expires_at>\?/,
      );
      assert.doesNotMatch(sql, /result_json|available_at|attempt_count/);
      renewals.push({ sql, params });
      return [{ affectedRows: leaseValid ? 1 : 0 }];
    },
  };
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    pool,
    "worker",
    "actor",
    120,
    () => new Date(clock),
    {
      async classifySupplies(value) {
        calls.push(structuredClone(value));
        clock += 20_000;
        return classify(value, calls.length);
      },
    },
  );
  const job = { opportunityId: "item", organizationId: "org", workspaceId: "ws" };
  return {
    worker,
    calls,
    renewals,
    supplies,
    productTitle,
    run: () => worker.classifySupplyTitles(job),
  };
}

test("literal-citation rejection preserves a separately validated candidate but identity errors fail closed", () => {
  const second = { ...input.candidates[0], source_ref: "second" };
  const scoped = { ...input, candidates: [...input.candidates, second] };
  const bad = structuredClone(result);
  bad.attributes[0].supply_excerpt = "not in original";
  const good = { ...result, source_ref: "second" };
  assert.deepEqual(validatedSupplyTitleCandidates({ classifications: [bad, good] }, scoped), [
    good,
  ]);
  assert.throws(
    () => validatedSupplyTitleCandidates({ classifications: [bad] }, scoped),
    SupplyTitleCitationError,
  );
  for (const items of [
    [good, { ...bad, source_ref: "unknown" }],
    [good, good],
    [good, { ...bad, attributes: "invalid" }],
    [
      good,
      {
        ...bad,
        attributes: [bad.attributes[0], { ...bad.attributes[1], extra: true }, bad.attributes[2]],
      },
    ],
  ])
    assert.throws(
      () => validatedSupplyTitleCandidates({ classifications: items }, scoped),
      /classification_invalid/,
    );
});

test("a citation-rejected batch does not hide a later independently validated quote", async () => {
  const h = batchHarness(60, (value, batch) => {
    if (batch === 1) throw new SupplyTitleCitationError();
    return [{ ...result, source_ref: value.candidates[0].source_ref }];
  });
  const value = await h.run();
  assert.equal(h.calls.length, 2);
  assert.equal(h.renewals.length, 1);
  assert.equal(
    selectClassifiedSupplyQuote(input.product_ref, title, h.supplies, value).item.externalId,
    "11",
  );
  const allBad = batchHarness(60, () => {
    throw new SupplyTitleCitationError();
  });
  await assert.rejects(allBad.run(), SupplyTitleCitationError);
  assert.equal(allBad.calls.length, 6);
  const network = batchHarness(60, () => {
    throw Object.assign(new Error("private"), { code: "intelligence_model_timeout" });
  });
  await assert.rejects(network.run(), { code: "intelligence_model_timeout" });
  assert.equal(network.calls.length, 1);
});

test("a compatible quote after the first ten is found without classifying later batches", async () => {
  const h = batchHarness(60, (value, batch) =>
    batch === 2 ? [{ ...result, source_ref: value.candidates[2].source_ref }] : [],
  );
  const value = await h.run();
  assert.deepEqual(
    h.calls.map((call) => call.candidates.length),
    [10, 10],
  );
  assert.equal(value.input.candidates.length, 20);
  const match = selectClassifiedSupplyQuote(input.product_ref, title, h.supplies, value);
  assert.equal(match.item.externalId, "13");
  assert.equal(match.conservativePrice, offer.price);
  assert.equal(h.renewals.length, 1);
  assert.deepEqual(h.renewals[0].params.slice(2, 6), ["item", "org", "ws", "worker"]);
  assert.equal(h.renewals[0].params[0].getTime() - h.renewals[0].params[1].getTime(), 120_000);
});

test("classification covers at most sixty offers in ten-title batches with bounded lease renewal", async () => {
  const h = batchHarness(70, () => []);
  const value = await h.run();
  assert.equal(h.calls.length, 6);
  assert.equal(h.renewals.length, 5);
  assert.equal(value.input.candidates.length, 60);
  assert.deepEqual(value.classifications, []);
  assert.equal(
    new Set(h.calls.flatMap((call) => call.candidates.map((item) => item.source_ref))).size,
    60,
  );
});

test("a model false positive with conflicting dimensions does not stop later supply matching", async () => {
  const h = batchHarness(
    11,
    (value) => [{ ...result, source_ref: value.candidates[0].source_ref }],
    {
      productTitle: `${title} 20cm`,
      supplyTitles: (index) => `${offer.title} ${index < 10 ? "30cm" : "20cm"}`,
    },
  );
  const value = await h.run();
  assert.equal(h.calls.length, 2);
  assert.equal(
    selectClassifiedSupplyQuote(input.product_ref, h.productTitle, h.supplies, value).item
      .externalId,
    "11",
  );
});

test("an expired or stolen lease prevents the next batch from calling the model", async () => {
  const h = batchHarness(20, () => [], { leaseValid: false });
  await assert.rejects(h.run(), /automatic_selection_lease_expired/);
  assert.equal(h.calls.length, 1);
});

test("a later model batch cannot classify a reference from a different batch", async () => {
  const h = batchHarness(30, (_value, batch) =>
    batch === 2 ? [{ ...result, source_ref: "1:raw-1" }] : [],
  );
  await assert.rejects(h.run(), /supply_title_classification_invalid/);
  assert.equal(h.calls.length, 2);
});

for (const withContext of [false, true])
  test(`expired classification lease rolls back before price writes with context=${withContext}`, async () => {
    const statements = [];
    let rolledBack = false;
    const connection = {
      async beginTransaction() {},
      async rollback() {
        rolledBack = true;
      },
      release() {},
      async query(sql) {
        statements.push(sql);
        if (sql.startsWith("SELECT o.*")) return [[{ id: "item" }]];
        if (sql.startsWith("SELECT opportunity_id FROM automatic_selection_evaluations"))
          return [[]];
        throw new Error("unexpected SQL");
      },
    };
    const worker = new MySqlAutomaticSelectionEvaluationWorker(
      { getConnection: async () => connection },
      "worker",
      "actor",
      120,
      undefined,
      {
        async classifySupplies() {
          return [];
        },
      },
    );
    await assert.rejects(
      worker.evaluate(
        { opportunityId: "item", organizationId: "org", workspaceId: "ws" },
        withContext ? context() : undefined,
      ),
      /lease_expired/,
    );
    assert.equal(rolledBack, true);
    assert.equal(statements.length, 2);
    assert.match(statements[1], /lease_owner=\? AND lease_expires_at>\? FOR UPDATE/);
  });
