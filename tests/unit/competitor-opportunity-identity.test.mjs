import test from "node:test";
import assert from "node:assert/strict";
import {
  missingPrimaryProductCandidateSql,
  repairMissingPrimaryProduct,
} from "../../apps/worker/dist/automatic-primary-product-repair.js";
import { automaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";

const candidate = {
  id: "own-opportunity",
  organization_id: "org",
  workspace_id: "ws",
  market: "US",
  created_by: "actor",
  primary_asin: "B000000001",
  missing_primary: 1,
};
const fields = {
  asin: candidate.primary_asin,
  canonical_url: "https://www.amazon.com/dp/B000000001",
  title: "Actual primary title",
};

async function repair(options = {}) {
  const calls = [];
  const c = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql === missingPrimaryProductCandidateSql)
        return [options.noCandidate ? [] : [candidate]];
      if (sql.startsWith("SELECT o.id,o.market")) return [options.ineligible ? [] : [candidate]];
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              provider_status: options.disabled ? "disabled" : "enabled",
              payload_json: options.payload ?? fields,
            },
          ],
        ];
      if (sql.startsWith("SELECT id FROM competitors"))
        return [options.existing ? [{ id: "current" }] : []];
      if (sql.startsWith("INSERT IGNORE INTO competitors"))
        return [{ affectedRows: options.conflict ? 0 : 1 }];
      throw new Error(sql);
    },
  };
  return { result: (await repairMissingPrimaryProduct(c, "amazon", new Date())).repaired, calls };
}

test("missing primary admission is scoped, active, pending and includes deleted identities in exclusion", () => {
  assert.match(missingPrimaryProductCandidateSql, /o.source_type='trend_topic'/);
  assert.match(missingPrimaryProductCandidateSql, /o.decision_status='pending'/);
  assert.match(missingPrimaryProductCandidateSql, /NOT IN \('archived','deleted'\)/);
  assert.match(missingPrimaryProductCandidateSql, /scope_ws.organization_id=scope_org.id/);
  assert.match(missingPrimaryProductCandidateSql, /c.opportunity_id=primary_repair.id/);
  assert.match(missingPrimaryProductCandidateSql, /c.workspace_id=primary_repair.workspace_id/);
  assert.doesNotMatch(missingPrimaryProductCandidateSql, /FOR UPDATE|c.deleted_at/);
  assert.match(missingPrimaryProductCandidateSql, /o.id>\?/);
  assert.match(missingPrimaryProductCandidateSql, /ORDER BY o.id LIMIT 20/);
  assert.match(missingPrimaryProductCandidateSql, /ORDER BY primary_repair.id$/);
});

test("repair locks the current parent and creates an empty independently owned record from its own evidence", async () => {
  const { result, calls } = await repair();
  assert.equal(result, true);
  assert.match(
    calls[1].sql,
    /FORCE INDEX \(PRIMARY\).*o.id=\? AND o.organization_id=\? AND o.workspace_id=\?/,
  );
  assert.match(calls[1].sql, /FOR UPDATE$/);
  assert.deepEqual(calls[2].args, [candidate.id, "org", "ws"]);
  const existing = calls[3];
  assert.match(existing.sql, /opportunity_id=\? LIMIT 1 FOR UPDATE$/);
  assert.deepEqual(existing.args, ["org", "ws", "US", "B000000001", candidate.id]);
  assert.doesNotMatch(existing.sql, /deleted_at/);
  const insert = calls.at(-1);
  assert.deepEqual(insert.args.slice(1, 10), [
    "org",
    "ws",
    candidate.id,
    "amazon",
    "US",
    fields.asin,
    fields.canonical_url,
    fields.title,
    "actor",
  ]);
  assert.match(insert.sql, /'active',NULL,1/);
  assert.ok(
    calls.every(
      ({ sql }) =>
        !sql.startsWith("UPDATE competitors") && !sql.includes("INSERT INTO competitor_snapshots"),
    ),
  );
});

test("repair never revives deleted records, borrows another primary, or bypasses provider and parent changes", async () => {
  for (const options of [
    { noCandidate: true },
    { ineligible: true },
    { disabled: true },
    { existing: true },
    { payload: "invalid" },
    { payload: { ...fields, title: " " } },
    { payload: { ...fields, asin: "B000000002" } },
    { payload: { ...fields, canonical_url: "https://example.test/dp/B000000001" } },
  ]) {
    const { result, calls } = await repair(options);
    assert.equal(result, false);
    assert.ok(calls.every(({ sql }) => !sql.startsWith("INSERT")));
  }
  assert.equal((await repair({ conflict: true })).result, false);
});

test("bounded repair scan advances past complete or invalid products and wraps only at exhaustion", async () => {
  const pages = [
    [
      { id: "a", missing_primary: 0 },
      { id: "b", primary_asin: null, missing_primary: 0 },
    ],
    [],
  ];
  const cursors = [];
  const c = {
    query: async (sql, args) => {
      assert.equal(sql, missingPrimaryProductCandidateSql);
      cursors.push(args);
      return [pages.shift()];
    },
  };
  const first = await repairMissingPrimaryProduct(c, "amazon", new Date(), "");
  assert.deepEqual(first, { afterId: "b", repaired: false });
  const next = await repairMissingPrimaryProduct(c, "amazon", new Date(), first.afterId);
  assert.deepEqual(next, { afterId: "", repaired: false });
  assert.deepEqual(cursors, [[""], ["b"]]);
});

function repository(duplicate) {
  const calls = [];
  const c = {
    beginTransaction: async () => calls.push({ sql: "begin" }),
    commit: async () => calls.push({ sql: "commit" }),
    rollback: async () => calls.push({ sql: "rollback" }),
    release() {},
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith("SELECT id FROM workspaces")) return [[{ id: "ws" }]];
      if (sql.startsWith("SELECT id FROM competitors"))
        return [duplicate ? [{ id: "existing" }] : []];
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlCompetitorRepository({ getConnection: async () => c });
  repo.operation = async () => null;
  repo.provider = repo.enqueueCollection = repo.event = repo.save = async () => {};
  const input = {
    organizationId: "org",
    workspaceId: "ws",
    actorId: "actor",
    id: "new",
    taskId: "task",
    value: {
      opportunity_id: null,
      provider_id: "amazon",
      market: "US",
      source_site: "Amazon",
      external_id: fields.asin,
      product_url: fields.canonical_url,
      title: fields.title,
    },
  };
  return { repo, calls, input };
}

test("unbound creates serialize per authenticated workspace and reject duplicates including tombstones", async () => {
  const { repo, calls, input } = repository(true);
  await assert.rejects(repo.create(input), (e) => e.code === "competitor_identity_conflict");
  assert.deepEqual(calls[1].args, ["ws", "org"]);
  assert.match(calls[1].sql, /FOR UPDATE$/);
  assert.match(calls[2].sql, /opportunity_id IS NULL LIMIT 1 FOR UPDATE$/);
  assert.doesNotMatch(calls[2].sql, /deleted_at/);
  assert.equal(calls.at(-1).sql, "rollback");
  assert.ok(calls.every(({ sql }) => !sql.startsWith("INSERT")));
  const valid = repository(false);
  await valid.repo.create(valid.input);
  assert.equal(valid.calls.at(-1).sql, "commit");
});

test("new primary lookup binds its parent and never schedules a proposed ID absent after INSERT IGNORE", async () => {
  for (const exists of [false, true]) {
    const calls = [],
      tasks = [];
    const c = {
      query: async (sql, args) => {
        calls.push({ sql, args });
        if (sql.startsWith("SELECT id FROM competitors"))
          return [exists ? [{ id: "own-primary" }] : []];
        if (sql.startsWith("SELECT id,code FROM providers"))
          return [[{ id: "amazon", code: "amazon_product" }]];
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new TrendProjectionPersistence({}, "worker", () => new Date());
    worker.scheduleCoreCollection = async (_c, _ctx, _id, queries) => tasks.push(...queries);
    await worker.createDownstreamDiscovery(
      c,
      {
        organizationId: "org",
        workspaceId: "ws",
        actorId: "actor",
        requestId: "r",
        traceId: "t",
        collectionTaskId: "source",
        providerId: "amazon",
        payload: {},
      },
      candidate.id,
      fields.title,
      fields.canonical_url,
      "US",
      new Date(),
    );
    const lookup = calls.find(({ sql }) => sql.startsWith("SELECT id FROM competitors"));
    assert.match(lookup.sql, /AND opportunity_id=\?/);
    assert.equal(lookup.args.at(-1), candidate.id);
    const details = tasks.filter((q) => q.target.projection_type === "competitor_snapshot");
    assert.equal(details.length, exists ? 1 : 0);
    if (exists) assert.equal(details[0].target.competitor_id, "own-primary");
  }
});
