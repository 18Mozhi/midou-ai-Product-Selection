import assert from "node:assert/strict";
import test from "node:test";
import {
  providerEvidenceRecordKey,
  providerEvidenceDedupeKey,
} from "../../apps/worker/dist/provider-source-executor.js";
import {
  primaryProductEvidence,
  automaticPrimaryDetailEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import {
  competitorDetailEvidenceSql,
  latestCompetitorDetailSnapshotSql,
} from "../../packages/database/dist/index.js";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";

const provider = { code: "amazon_product" },
  asin = "B0F7Z4QZTT";
test("search observations cannot supersede a priced detail or another search task", () => {
  const detail = providerEvidenceRecordKey(provider, asin, "detail-task", {
    page_url: `https://www.amazon.com/dp/${asin}`,
  });
  const search = providerEvidenceRecordKey(provider, asin, "search-task", { query: "product" });
  assert.notEqual(detail, search);
  assert.notEqual(
    search,
    providerEvidenceRecordKey(provider, asin, "another-search-task", { query: "product" }),
  );
  assert.equal(
    detail,
    providerEvidenceRecordKey(provider, asin.toLowerCase(), "new-detail-task", {
      page_url: `https://www.amazon.com/title/gp/product/${asin}`,
    }),
  );
  assert.equal(
    search,
    providerEvidenceRecordKey(provider, asin, "search-task", {
      query: "product",
      projection_type: "competitor_snapshot",
    }),
  );
  assert.equal(providerEvidenceRecordKey({ code: "1688_search" }, "123", "task", {}), "123");
});

test("typed observations cannot collide with legacy raw evidence for identical retry bytes", () => {
  const p = { ...provider, parserVersion: "amazon-public-product-v5" };
  const key = providerEvidenceRecordKey(p, asin, "task", { query: "product" });
  const legacy = providerEvidenceDedupeKey(p, asin, "task", "identical bytes");
  const current = providerEvidenceDedupeKey(p, asin, "task", "identical bytes", key);
  assert.notEqual(current, legacy);
  assert.equal(current, providerEvidenceDedupeKey(p, asin, "task", "identical bytes", key));
  assert.notEqual(
    current,
    providerEvidenceDedupeKey(p, asin, "task", "identical bytes", `amazon:detail:${asin}`),
  );
});
for (const page_url of [
  `https://other.example/dp/${asin}`,
  "https://www.amazon.com/dp/B000000001",
  `https://user:pass@www.amazon.com/dp/${asin}`,
])
  test(
    "unverified page URL cannot claim detail lineage: " + page_url.replace("user:pass@", ""),
    () => {
      assert.throws(() => providerEvidenceRecordKey(provider, asin, "task", { page_url }));
    },
  );

test("an immutable verified detail preserves its own quote and capture time", () => {
  const detail = {
    payload_json: { price: 69.99, currency: "USD" },
    observed_at: "2026-10-17T22:06:32Z",
    raw_evidence_id: "actual-detail",
  };
  const search = {
    payload_json: { price: null, currency: null },
    observed_at: "2026-10-17T23:10:11Z",
    raw_evidence_id: "later-search",
  };
  assert.equal(primaryProductEvidence(search, detail), detail);
  assert.equal(
    primaryProductEvidence(search, { ...detail, payload_json: { price: null, currency: null } })
      .payload_json.price,
    null,
  );
  const newerQuote = { ...search, payload_json: { price: 65, currency: "USD" } };
  assert.equal(primaryProductEvidence(newerQuote, detail), newerQuote);
  for (const price of [null, -1, NaN, Infinity, "65"])
    assert.equal(
      primaryProductEvidence({ ...search, payload_json: { price, currency: "USD" } }, detail),
      detail,
    );
  const realZero = { ...search, payload_json: { price: 0, currency: "USD" } };
  assert.equal(primaryProductEvidence(realZero, detail), realZero);
  for (const currency of [null, "", "usd"])
    assert.equal(
      primaryProductEvidence({ ...search, payload_json: { price: 65, currency } }, detail),
      detail,
    );
  assert.equal(primaryProductEvidence(search, undefined), search);
  assert.ok(automaticPrimaryDetailEvidenceSql.includes(competitorDetailEvidenceSql("s")));
  assert.ok(automaticPrimaryDetailEvidenceSql.includes("n.status IN ('active','superseded')"));
  assert.ok(automaticPrimaryDetailEvidenceSql.includes("n.raw_evidence_id=s.evidence_id"));
  assert.doesNotMatch(automaticPrimaryDetailEvidenceSql, /n_seed|quarantined/);
});

test("latest detail lookup does not fall back to an older priced snapshot or accept quarantined evidence", () => {
  const sql = latestCompetitorDetailSnapshotSql("c_sample");
  assert.ok(sql.includes("s.competitor_id=c_sample.id"));
  assert.ok(sql.includes("s.organization_id=c_sample.organization_id"));
  assert.ok(sql.includes("s.workspace_id=c_sample.workspace_id"));
  assert.ok(sql.includes("n_detail.raw_evidence_id=l_detail.raw_evidence_id"));
  assert.ok(sql.includes("n_detail.status IN ('active','superseded')"));
  assert.ok(sql.endsWith("ORDER BY s.captured_at DESC,s.id DESC LIMIT 1)"));
  assert.doesNotMatch(sql, /current_price|latest_snapshot_id|currency IS NOT NULL/);
});

const job = {
  taskId: "task",
  organizationId: "org",
  workspaceId: "workspace",
  requestId: "request",
  traceId: "trace",
};
const record = {
  id: "record",
  provider_id: "provider",
  raw_evidence_id: "search-evidence",
  captured_at: new Date("2026-10-18T00:00:00Z"),
};
for (const latest of [null, false, true])
  test(`search snapshot is retained without replacing an existing verified detail: ${latest}`, async () => {
    const calls = [];
    const c = {
      query: async (sql, args) => {
        calls.push({ sql, args });
        if (sql.startsWith("SELECT latest_snapshot_id"))
          return [[{ latest_snapshot_id: latest === null ? null : "old" }]];
        if (sql.includes("detail_verified FROM competitor_snapshots"))
          return [[{ detail_verified: Number(latest) }]];
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new CoreCollectionProjectionWorker({}, "worker");
    assert.equal(
      await worker.insertSnapshot(c, job, "competitor", record, { price: null }, new Date(), false),
      true,
    );
    assert.ok(calls.some((c) => c.sql.includes("INSERT IGNORE INTO competitor_snapshots")));
    const writes = calls.filter((c) => c.sql.startsWith("UPDATE competitors"));
    assert.equal(writes.length, latest === true ? 0 : 1);
    for (const w of writes) assert.deepEqual(w.args.slice(-3), ["competitor", "org", "workspace"]);
    assert.deepEqual(calls.find((c) => c.sql.startsWith("SELECT latest_snapshot_id")).args, [
      "competitor",
      "org",
      "workspace",
    ]);
  });

test("detail snapshots continue through the existing comparison job", async () => {
  const calls = [];
  const c = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      return [{ affectedRows: 1 }];
    },
  };
  const worker = new CoreCollectionProjectionWorker({}, "worker");
  await worker.insertSnapshot(c, job, "competitor", record, { price: 69.99 }, new Date(), true);
  assert.ok(calls.some((c) => c.sql.includes("INSERT INTO competitor_snapshot_jobs")));
  assert.ok(!calls.some((c) => c.sql.startsWith("UPDATE competitors")));
});
