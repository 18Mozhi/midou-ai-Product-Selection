import { accountOnlyAutomaticPrimaryEvidenceSql, automaticPrimaryEvidenceSql, nativeAccountAutomaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";
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
import {
  competitorFunctionalFormatCase,
  functionalSubstituteRefs,
} from "../fixtures/competitor-functional-format-cases.mjs";
const mainAsin = "B000000001";
test("functional-format fixture preserves every original title and ordered evidence binding", async () => {
  const fixture = competitorFunctionalFormatCase;
  let sent;
  const classifier = new OpenAiIntelligenceProductClassifier(
    "test-model",
    "https://model.invalid/v1",
    "",
    1000,
    async (_url, init) => {
      sent = JSON.parse(init.body);
      const input = JSON.parse(sent.messages[1].content);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: input.candidates
                  .map((candidate, index) => ({
                    source_ref: candidate.source_ref,
                    relation: functionalSubstituteRefs.includes(
                      fixture.candidates[index].source_ref,
                    )
                      ? "substitute"
                      : "uncertain",
                    rationale: "Synthetic transport response; not a model semantic assertion",
                  }))
                  .reverse(),
              }),
            },
          },
        ],
      });
    },
  );
  const result = await classifier.classifyCompetitors(fixture);
  const format = sent.response_format;
  assert.equal(format.type, "json_schema");
  assert.equal(format.json_schema.strict, true);
  const schema = format.json_schema.schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["classifications"]);
  const item = schema.properties.classifications.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.required, ["source_ref", "relation", "rationale"]);
  assert.deepEqual(Object.keys(item.properties).sort(), ["rationale", "relation", "source_ref"]);
  assert.deepEqual(
    item.properties.source_ref.enum,
    fixture.candidates.map((_, i) => `c${i + 1}`),
  );
  assert.deepEqual(item.properties.relation.enum, [
    "substitute",
    "different_use",
    "accessory",
    "uncertain",
  ]);
  assert.equal(item.properties.rationale.type, "string");
  assert.deepEqual(
    JSON.parse(sent.messages[1].content).candidates.map((v) => v.title),
    fixture.candidates.map((v) => v.title),
  );
  assert.deepEqual(
    result.map((v) => v.source_ref),
    fixture.candidates.map((v) => v.source_ref),
  );
  assert.deepEqual(
    result.map((v) => v.candidate_excerpt),
    fixture.candidates.map((v) => v.title),
  );
  assert.match(sent.messages[0].content, /Riding describes the visual scene/);
  assert.match(sent.messages[0].content, /no other top-level fields or corrections/);
  assert.match(sent.messages[0].content, /within 800 characters/);
});
const opportunityId = "00000000-0000-4000-8000-000000000001";
const input = {
  primary: { source_ref: "primary", asin: mainAsin, title: "Portable handheld fan" },
  candidates: [
    { source_ref: "n1", asin: "B000000002", title: "Rechargeable handheld fan" },
    { source_ref: "n2", asin: "B000000003", title: "Desktop air circulator" },
  ],
};

test("a service ignoring the requested schema still cannot pass a misspelled rationale field", async () => {
  let calls = 0;
  const classifier = new OpenAiIntelligenceProductClassifier(
    "test-model",
    "http://model.invalid/v1",
    "",
    1000,
    async (_url, request) => {
      calls += 1;
      const sent = JSON.parse(request.body),
        modelInput = JSON.parse(sent.messages[1].content);
      assert.equal(sent.response_format.type, "json_schema");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: modelInput.candidates.map((c, i) => ({
                  source_ref: c.source_ref,
                  relation: "substitute",
                  [i === 0 ? "rationable" : "rationale"]: "Synthetic spelling regression",
                })),
              }),
            },
          },
        ],
      });
    },
  );
  await assert.rejects(classifier.classifyCompetitors(input), /competitor_classification_invalid/);
  assert.equal(calls, 1, "no repair request or automatic weaker JSON fallback");
});

test("unsupported structured output fails closed without a weaker transport retry", async () => {
  let calls = 0;
  const classifier = new OpenAiIntelligenceProductClassifier(
    "test-model",
    "http://model.invalid/v1",
    "",
    1000,
    async () => {
      calls += 1;
      return Response.json({ error: "unsupported response format" }, { status: 400 });
    },
  );
  await assert.rejects(classifier.classifyCompetitors(input), /intelligence_model_unavailable/);
  assert.equal(calls, 1);
});
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

function fixture({ lease = true, mutate = false, auditFails = false, account = false, native = false,
  accountParent = false, sealed = true, ledgerFails = false, fresh = false } = {}) {
  let inTransaction = false,
    changed = false;
  const calls = [];
  const task = {
    id: "task",
    organizationId: native ? undefined : "org",
    workspaceId: native ? undefined : "workspace",
    ...(native ? { accountId: "owner" } : {}),
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
    if (s.startsWith("SELECT cut.primary_account_id")) return [account || native
      ? [{primary_account_id:"owner",account_id:"owner",reason:"shared"}] : []];
    if (s.startsWith("SHOW COLUMNS FROM collection_tasks")) return [native
      ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
    if (s.startsWith("SELECT o.organization_id,o.workspace_id FROM opportunities")) return [[{organization_id:"org",workspace_id:"workspace"}]];
    if (s.startsWith("SHOW COLUMNS FROM normalized_records")) return [[{Field:"account_id"}]];
    if (s.startsWith("SHOW COLUMNS FROM opportunities")) return [accountParent
      ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
    if (s.startsWith("SELECT r.legacy_org_id,r.legacy_workspace_id")) return [sealed
      ? [{legacy_org_id:"original-org",legacy_workspace_id:"original-ws"}]
      : fresh ? [{sealed_id:null,account_after_cutover:1}] : []];
    if (s.startsWith("SELECT q.id FROM collection_tasks")) return [[{id:query.id}]];
    if (s === automaticPrimaryEvidenceSql || s === nativeAccountAutomaticPrimaryEvidenceSql ||
        s === accountOnlyAutomaticPrimaryEvidenceSql)
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
    if (s.includes("FROM opportunities o JOIN competitors c") || s.includes("FROM competitors c JOIN account_owned_records owner")) return [[]];
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
    if (s.startsWith("SHOW COLUMNS FROM opportunity_events"))
      return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
    if (s.startsWith("INSERT INTO opportunity_events") && auditFails)
      throw new Error("audit_failed");
    if (s.startsWith("INSERT INTO account_owned_records") && ledgerFails)
      throw new Error("ledger_failed");
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

test("0192 classification rechecks lease and candidate lineage by native account, and keeps the consumer's proof fingerprint", async () => {
  const f = fixture({native:true});
  await f.service.classify(f.task, f.query, async () => {});
  const read = f.calls.find(c => c.sql?.startsWith("SELECT n.id"));
  assert.deepEqual(read.args, ["task","subquery","owner"]);
  assert.match(read.sql, /origin.account_id=link_task.account_id AND n.account_id=link_task.account_id AND e.account_id=link_task.account_id/);
  assert.doesNotMatch(read.sql, /organization_id|workspace_id/);
  const lease = f.calls.find(c => c.sql?.startsWith("SELECT id FROM collection_tasks"));
  assert.match(lease.sql, /account_id=\?.*lease_token_hash=UNHEX\(\?\).*FOR UPDATE/);
  assert.equal(lease.args[1], "owner");
  const event = f.calls.find(c => c.sql?.startsWith("INSERT INTO opportunity_events"));
  const proof = JSON.parse(event.args.find(value => typeof value === "string" && value.startsWith('{"version"')));
  assert.equal(proof.scope.organizationId, "org");
  const consumer = await readCompetitorClassificationContext(f.pool, proof.scope);
  assert.equal(consumer.fingerprint, proof.input_fingerprint);
  const foreign = fixture({native:true});
  foreign.task.accountId = "another-account";
  await assert.rejects(foreign.service.classify(foreign.task, foreign.query, async () => {}), /competitor_evidence_scope_invalid/);
  assert.ok(!foreign.calls.some(c => c.begin || c.sql?.startsWith("SELECT n.id")));
});

test("0195 classification appends a same-account event and preserves the sealed original fingerprint", async () => {
  const f = fixture({native:true, accountParent:true});
  await f.service.classify(f.task,f.query,async()=>{});
  const reads = f.calls.filter(c => c.sql?.startsWith("SELECT r.legacy_org_id,r.legacy_workspace_id"));
  assert.equal(reads.length, 2);
  assert.match(reads[1].sql, /LOCK IN SHARE MODE$/);
  const event = f.calls.find(c => c.sql?.startsWith("INSERT INTO opportunity_events"));
  assert.doesNotMatch(event.sql,/organization_id|workspace_id/);
  assert.match(event.sql,/o\.account_id=p\.account_id/);
  const scope = JSON.parse(event.args[4]).scope;
  assert.deepEqual([scope.organizationId,scope.workspaceId],["original-org","original-ws"]);
  const owner = f.calls.find(c => c.sql?.startsWith("INSERT INTO account_owned_records"));
  assert.deepEqual(owner.args, [[["opportunity_events",event.args[0],"owner","shared"]]]);
  assert.ok(f.calls.indexOf(owner) < f.calls.findIndex(c=>c.commit));
  const missing = fixture({native:true,accountParent:true,sealed:false});
  await assert.rejects(missing.service.classify(missing.task,missing.query,async()=>{}),/competitor_primary_missing/);
  assert.ok(!missing.calls.some(c=>c.begin || c.sql?.startsWith("INSERT INTO opportunity_events")));
  const failing = fixture({native:true,accountParent:true,ledgerFails:true});
  await assert.rejects(failing.service.classify(failing.task,failing.query,async()=>{}),/ledger_failed/);
  assert.ok(failing.calls.some(c=>c.sql?.startsWith("INSERT INTO opportunity_events")));
  assert.ok(failing.calls.some(c=>c.rollback));
  assert.ok(!failing.calls.some(c=>c.commit));
});

test("a native opportunity created after cutover writes an account-only classification fingerprint", async () => {
  const f = fixture({native:true,accountParent:true,sealed:false,fresh:true});
  await f.service.classify(f.task,f.query,async()=>{});
  const origin = f.calls.find(c=>c.sql?.startsWith("SELECT r.legacy_org_id,r.legacy_workspace_id"));
  assert.match(origin.sql,/LEFT JOIN account_retirement_records/);
  assert.match(origin.sql,/o\.created_at>cut\.created_at/);
  const e = f.calls.find(c=>c.sql?.startsWith("INSERT INTO opportunity_events"));
  const p = JSON.parse(e.args[4]);
  assert.equal(p.scope.accountId,"owner");
  assert.equal(p.scope.opportunityId,f.query.target.opportunity_id);
  assert.equal("organizationId" in p.scope,false);
  assert.equal("workspaceId" in p.scope,false);
  const current = await readCompetitorClassificationContext(f.pool,p.scope);
  assert.equal(current.fingerprint,p.input_fingerprint);
});

test("native parser drift audit records the task and account without fabricating legacy coordinates", async () => {
  const executor = new ProviderSourceExecutor({}, {}, {}, "worker");
  const statements = [];
  const now = new Date("2026-11-15T00:00:00Z");
  await executor.recordProviderPause({query: async (sql, args) => {
    statements.push({sql,args});
    if (sql.startsWith("INSERT INTO platform_audit_events") && sql.includes("organization_id")) throw Object.assign(new Error("missing field"), {
      code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column 'organization_id' in 'field list'",
    });
    if (sql.startsWith("SHOW COLUMNS")) return [[{Field:"historical_context"}]];
    return [{affectedRows:1}];
  }}, {id:"task", accountId:"owner", nativeAccountScope:true, requestId:"request", traceId:"trace"},
  {id:"provider", code:"amazon_product", parserVersion:"v1"}, "actor", 2, {}, {code:"source_changed", retryable:false}, now);
  const audit = statements.at(-1);
  assert.match(audit.sql, /historical_context/);
  assert.equal(audit.args[1], null);
  assert.deepEqual(JSON.parse(audit.args.at(-2)), {
    provider_code:"amazon_product", parser_version:"v1", error_code:"source_changed",
    retryable:false, account_id:"owner", collection_task_id:"task",
  });
});

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

test("0190 competitor classification preserves the proof fingerprint and checks all same-account evidence", async () => {
  const f = fixture({account: true});
  const scope = {taskId:"task",subqueryId:"subquery",organizationId:"org",workspaceId:"workspace",opportunityId,mainAsin};
  const legacy = await readCompetitorClassificationContext(fixture().pool, scope);
  const current = await readCompetitorClassificationContext(f.pool, scope);
  assert.deepEqual(current, legacy);
  const candidate = f.calls.find(c => c.sql?.startsWith("SELECT n.id,n.raw_evidence_id"));
  assert.deepEqual(candidate.args, ["task","subquery","org","workspace","owner"]);
  assert.doesNotMatch(candidate.sql, /\b[en]\.(organization_id|workspace_id)/);
  for (const [table,id] of [["collection_subqueries","q.id"],["collection_task_evidence_links","l.id"],
    ["collection_tasks","origin.id"],["normalized_records","n.id"],["raw_evidence","e.id"]]) {
    assert.ok(candidate.sql.includes(`own.source_table='${table}' AND own.source_id=${id} AND own.account_id=link_owner.account_id`));
  }
  const denied = fixture({account:true});
  await assert.rejects(readCompetitorClassificationContext({
    query: (sql,args) => sql.startsWith("SELECT cut.primary_account_id")
      ? [[{primary_account_id:"owner",account_id:null}]] : denied.pool.query(sql,args),
  }, scope), {code:"competitor_primary_missing"});
  assert.equal(denied.calls.length, 0);
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
  assert.match(
    body.messages[0].content,
    /functional format, fit\/compatibility and intended audience from appearance/,
  );
  assert.match(
    body.messages[0].content,
    /different decorative motif[\s\S]*not a different mode of use/,
  );
  assert.match(
    body.messages[0].content,
    /Do not infer a required wearer count[\s\S]*use uncertain/,
  );
  assert.match(
    body.messages[0].content,
    /multi-occupant item[\s\S]*bundle of separate single-occupant/,
  );
  assert.match(
    body.messages[0].content,
    /distinct mounting\/use context or a different core function means different_use/,
  );
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
