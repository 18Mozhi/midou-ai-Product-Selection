import { automaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";
import { readCompetitorClassificationContext } from "../../apps/worker/dist/competitor-title-classification.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  amazonAsin,
  selectIndependentCompetitors,
} from "../../apps/worker/dist/competitor-discovery-policy.js";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";

const asin = (index) => `B0${String(index).padStart(8, "0")}`;
const facts = (index) => ({
  asin: asin(index),
  title: `Product ${index}`,
  canonical_url: `https://www.amazon.com/dp/${asin(index)}`,
  price: 15,
  currency: "USD",
  review_count: 30,
  rating_value: 4.4,
});
const read = (value) => ({ fields: value, canonicalUrl: value.canonical_url });
test("competitors exclude the primary and duplicate ASINs, keeping at most ten independent products", () => {
  const values = [
    facts(0),
    facts(1),
    facts(1),
    ...Array.from({ length: 14 }, (_, index) => facts(index + 2)),
  ];
  const selected = selectIndependentCompetitors(values, read, asin(0));
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map((v) => v.asin)).size, 10);
  assert.ok(selected.every((v) => v.asin !== asin(0)));
  assert.equal(selectIndependentCompetitors([facts(1), facts(2)], read, asin(0)).length, 2);
});
test("ASIN identity must agree with the actual Amazon product URL", () => {
  assert.equal(amazonAsin(facts(1), facts(1).canonical_url), asin(1));
  assert.equal(amazonAsin(facts(2), facts(1).canonical_url), null);
  assert.equal(amazonAsin(facts(1), `https://example.test/dp/${asin(1)}`), null);
  assert.equal(amazonAsin(facts(1), `https://www.amazon.com/s?k=${asin(1)}`), null);
});

test("new details, competitor discovery and opportunity sourcing wake the same scoped evaluator", async () => {
  for (const projectionType of [
    "opportunity_competitors",
    "competitor_snapshot",
    "sourcing_search",
  ]) {
    const calls = [];
    const worker = new CoreCollectionProjectionWorker({}, "worker");
    await worker.requeueEvaluation(
      {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return [[{ opportunity_id: "opportunity", input_ref: "opportunity" }]];
        },
      },
      {
        projectionType,
        resourceId: projectionType === "opportunity_competitors" ? "opportunity" : "resource",
        organizationId: "org",
        workspaceId: "workspace",
      },
      new Date(),
    );
    const queued = calls.find(({ sql }) =>
      sql.startsWith("INSERT INTO automatic_selection_evaluations"),
    );
    assert.deepEqual(queued.params.slice(0, 3), ["opportunity", "org", "workspace"]);
    assert.match(queued.sql, /status=IF\(status='leased',status,'queued'\)/);
  }
  let writes = 0;
  const worker = new CoreCollectionProjectionWorker({}, "worker");
  await worker.requeueEvaluation(
    {
      query: async (sql) => {
        if (sql.startsWith("INSERT")) writes += 1;
        return [[]];
      },
    },
    {
      projectionType: "sourcing_search",
      resourceId: "image-search",
      organizationId: "org",
      workspaceId: "workspace",
    },
    new Date(),
  );
  assert.equal(writes, 0);
});

test("disabled providers preserve historical detail facts without claiming an enabled current source", async () => {
  for (const provider_status of ["enabled", "disabled"]) {
    const repository = new MySqlCompetitorRepository({
      query: async () => [
        [
          {
            id: "competitor",
            latest_snapshot_id: "snapshot",
            provider_status,
            detail_collected: 1,
            current_price: 19.99,
            currency: "USD",
            captured_at: new Date(),
            updated_at: new Date(),
          },
        ],
      ],
    });
    const [item] = await repository.list({ organizationId: "org", workspaceId: "workspace" });
    assert.equal(item.latest_snapshot.source_enabled, provider_status === "enabled");
    assert.equal(item.latest_snapshot.detail_collected, true);
    assert.equal(item.latest_snapshot.current_price, 19.99);
  }
});
const opportunity = "00000000-0000-4000-8000-000000000001";
async function project(
  values,
  {
    conflict = false,
    projectionType = "opportunity_competitors",
    proof = true,
    rejectRefs = [],
  } = {},
) {
  const calls = [];
  const query = async (sql, args = []) => {
    calls.push({ sql, args });
    if (
      sql.includes("FROM collection_tasks t") ||
      sql.startsWith("SELECT id,organization_id") ||
      sql.startsWith("SELECT target_json")
    )
      return [
        [
          {
            id: "task",
            classification_subquery_id: "subquery",
            organization_id: "org",
            workspace_id: "workspace",
            created_by: "actor",
            request_id: "request",
            trace_id: "trace",
            target_json: {
              projection_type: projectionType,
              opportunity_id: opportunity,
              competitor_id: opportunity,
              main_asin: asin(0),
            },
          },
        ],
      ];
    if (sql.startsWith("SELECT id FROM core_collection_projection_runs")) return [[]];
    if (sql.startsWith("SELECT payload_json FROM opportunity_events")) {
      if (!proof) return [[]];
      const context = await readCompetitorClassificationContext(
        { query },
        {
          taskId: "task",
          subqueryId: "subquery",
          organizationId: "org",
          workspaceId: "workspace",
          opportunityId: opportunity,
          mainAsin: asin(0),
        },
      );
      return [
        [
          {
            payload_json: {
              version: "competitor-title-v1",
              model_fingerprint: "f".repeat(64),
              input_fingerprint: context.fingerprint,
              classifications: context.input.candidates.map((c) => ({
                source_ref: c.source_ref,
                relation: rejectRefs.includes(c.source_ref) ? "different_use" : "substitute",
                primary_excerpt: context.input.primary.title,
                candidate_excerpt: c.title,
                rationale: "Synthetic relation fixture",
              })),
            },
          },
        ],
      ];
    }
    if (sql === automaticPrimaryEvidenceSql)
      return [
        [
          {
            raw_evidence_id: "main-evidence",
            payload_json: facts(0),
            provider_status: "enabled",
            observed_at: new Date(),
          },
        ],
      ];
    if (sql.includes("FROM opportunities o JOIN competitors c")) return [[]];
    if (sql.startsWith("SELECT n.id"))
      return [
        values.map((fields, index) => ({
          id: `record-${index}`,
          provider_id: "source",
          raw_evidence_id: `evidence-${index}`,
          payload_json: fields,
          captured_at: new Date(),
        })),
      ];
    if (sql.startsWith("SELECT id,market FROM opportunities"))
      return [[{ id: opportunity, market: "US" }]];
    if (sql.startsWith("SELECT id,external_id,product_url FROM competitors"))
      return [[{ id: opportunity, external_id: asin(1), product_url: facts(1).canonical_url }]];
    if (sql.startsWith("SELECT id,opportunity_id FROM competitors"))
      return [
        [
          {
            id: `competitor-${args[3]}`,
            opportunity_id: conflict ? "another-opportunity" : opportunity,
          },
        ],
      ];
    return [{ affectedRows: 1 }];
  };
  const connection = {
    query,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  };
  const worker = new CoreCollectionProjectionWorker(
    { query, getConnection: async () => connection },
    "worker",
  );
  return { result: await worker.processOnce(), calls };
}
test("discovery persists ten unique competitors and schedules their real detail pages", async () => {
  const { result, calls } = await project([
    facts(0),
    facts(1),
    facts(1),
    ...Array.from({ length: 13 }, (_, i) => facts(i + 2)),
  ]);
  assert.equal(result.item_count, 10);
  assert.equal(result.discovery_status, "minimum_met");
  const targets = calls
    .filter((c) => c.sql.startsWith("INSERT INTO collection_subqueries"))
    .map((c) => JSON.parse(c.args[5]));
  assert.equal(targets.length, 10);
  assert.equal(new Set(targets.map((t) => t.page_url)).size, 10);
  assert.ok(
    targets.every(
      (t) =>
        t.projection_type === "competitor_snapshot" &&
        t.competitor_id &&
        t.page_url !== facts(0).canonical_url,
    ),
  );
});
test("fewer than five competitors remain explicitly insufficient and never steal another opportunity's target", async () => {
  const partial = await project([facts(1), facts(2), facts(3), facts(4)]);
  assert.equal(partial.result.discovery_status, "insufficient");
  assert.ok(
    partial.calls.find(
      (c) =>
        c.sql.startsWith("UPDATE core_collection_projection_runs") &&
        c.args.includes("competitor_count_below_minimum"),
    ),
  );
  const conflict = await project([facts(1)], { conflict: true });
  assert.equal(conflict.result.item_count, 0);
  assert.equal(
    conflict.calls.filter((c) => c.sql.startsWith("INSERT INTO collection_subqueries")).length,
    0,
  );
});

test("detail projection rejects a different ASIN instead of updating the target with the first returned product", async () => {
  const wrong = await project([facts(2)], { projectionType: "competitor_snapshot" });
  assert.equal(wrong.result.item_count, 0);
  assert.equal(
    wrong.calls.filter((c) => c.sql.includes("INSERT IGNORE INTO competitor_snapshots")).length,
    0,
  );
  const correct = await project([facts(2), facts(1)], { projectionType: "competitor_snapshot" });
  assert.equal(correct.result.item_count, 1);
  assert.equal(
    correct.calls.filter((c) => c.sql.includes("INSERT INTO competitor_snapshot_jobs")).length,
    1,
  );
});

test("unclassified discovery never falls back to the first ten search hits", async () => {
  const missing = await project([facts(1), facts(2)], { proof: false });
  assert.equal(missing.result.item_count, 0);
  assert.equal(
    missing.calls.filter((c) => c.sql.startsWith("INSERT IGNORE INTO competitors")).length,
    0,
  );
  const filtered = await project([facts(1), facts(2), facts(3)], { rejectRefs: ["record-1"] });
  assert.equal(filtered.result.item_count, 2);
  const titles = filtered.calls
    .filter((c) => c.sql.startsWith("INSERT IGNORE INTO competitors"))
    .map((c) => c.args[8]);
  assert.deepEqual(titles, ["Product 1", "Product 3"]);
});

test("classification considers twenty candidates before the final ten-item cap", async () => {
  const values = Array.from({ length: 15 }, (_, i) => facts(i + 1));
  const r = await project(values, {
    rejectRefs: Array.from({ length: 10 }, (_, i) => `record-${i}`),
  });
  assert.equal(r.result.item_count, 5);
  assert.equal(r.result.discovery_status, "minimum_met");
});
