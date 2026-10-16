import test from "node:test";
import assert from "node:assert/strict";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";

const image = "https://m.media-amazon.com/images/I/primary.jpg";
const row = {
  opportunity_id: "product-1",
  organization_id: "org-1",
  workspace_id: "workspace-1",
  created_by: "user-1",
  name: "Product",
  competitor_task_missing: 0,
  sourcing_task_missing: 1,
  search_id: "search-1",
  primary_image_url: image,
};

function setup(rows, providers = [{ id: "lan", code: "1688_search" }]) {
  const calls = [],
    tasks = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, values) => {
      calls.push([sql, values]);
      if (sql.startsWith("SELECT id,code FROM providers")) return [providers];
      if (sql.startsWith("SELECT o.id opportunity_id")) return [rows];
      if (sql.startsWith("UPDATE sourcing_searches")) return [{ affectedRows: 1 }];
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const worker = new TrendProjectionPersistence(
    { getConnection: async () => connection },
    "worker-1",
    () => new Date("2026-10-17T00:00:00Z"),
  );
  worker.scheduleCoreCollection = async (_connection, context, id, queries, event) =>
    tasks.push({ context, id, queries, event });
  return { worker, calls, tasks };
}

test("historical sourcing repair uses the primary image and schedules a shared search only once", async () => {
  const { worker, calls, tasks } = setup([row, { ...row, competitor_id: "another" }]);
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].queries, [
    {
      providerId: "lan",
      required: false,
      target: {
        query: "Product",
        image_url: image,
        query_contract: "supplier-keywords-v2",
        projection_type: "sourcing_search",
        search_id: "search-1",
      },
    },
  ]);
  const update = calls.find(([sql]) => sql.startsWith("UPDATE sourcing_searches"));
  assert.deepEqual(update[1].slice(3), ["search-1", "org-1", "workspace-1"]);
  assert.equal(update[1][0], tasks[0].id);
  assert.deepEqual(calls.at(-2), ["commit"]);
  assert.deepEqual(calls.at(-1), ["release"]);
});

test("missing image or disabled 1688 cannot silently fall back to unrelated supplier sources", async () => {
  for (const [rows, providers] of [
    [[{ ...row, primary_image_url: null }], [{ id: "lan", code: "1688_search" }]],
    [[row], [{ id: "old", code: "dhgate_supplier_search" }]],
  ]) {
    const { worker, calls, tasks } = setup(rows, providers);
    await worker.enqueueMissingAutomaticDownstream();
    assert.equal(tasks.length, 0);
    assert.equal(
      calls.some(([sql]) => sql.startsWith("UPDATE sourcing_searches")),
      false,
    );
  }
});

test("recovery scans are scoped, exclude retired searches and qualify actionable rows before the batch limit", async () => {
  const { worker, calls } = setup([]);
  await worker.enqueueMissingAutomaticDownstream();
  const [sql, params] = calls.find(([sql]) => sql.startsWith("SELECT o.id opportunity_id"));
  assert.deepEqual(params, [null, "lan"]);
  assert.match(sql, /ss\.workspace_id=o\.workspace_id[\s\S]*ss\.deleted_at IS NULL/);
  assert.match(sql, /p_supply\.code='1688_search'/);
  assert.match(sql, /n_image\.workspace_id=l_image\.workspace_id/);
  assert.match(sql, /BINARY UPPER[\s\S]*n_primary\.payload_json/);
  assert.match(sql, /BINARY o\.primary_asin/);
  assert.match(sql, /primary_asin FROM opportunities o[\s\S]*LIMIT 18446744073709551615/);
  assert.match(sql, /HAVING[\s\S]*primary_image_url IS NOT NULL[\s\S]*LIMIT 20 FOR UPDATE/);
});

test("disabled downstream sources avoid scanning the historical recovery queue", async () => {
  const { worker, calls, tasks } = setup([], []);
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(
    calls.some(([sql]) => sql.startsWith("SELECT o.id opportunity_id")),
    false,
  );
  assert.equal(tasks.length, 0);
  assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
});

test("failed repair rolls back its task and search linkage transaction", async () => {
  const { worker, calls } = setup([row]);
  worker.scheduleCoreCollection = async () => {
    throw new Error("queue unavailable");
  };
  await assert.rejects(worker.enqueueMissingAutomaticDownstream(), /queue unavailable/);
  assert.equal(
    calls.some(([sql]) => sql === "commit"),
    false,
  );
  assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
});

test("first automatic sourcing also uses only 1688 and preserves a missing-image reason", async () => {
  for (const imageUrl of [image, null]) {
    const { worker, tasks } = setup([]);
    const writes = [];
    const connection = {
      query: async (sql, values) => {
        writes.push([sql, values]);
        return sql.startsWith("SELECT id,code FROM providers")
          ? [
              [
                { id: "lan", code: "1688_search" },
                { id: "old", code: "ec21_supplier_search" },
              ],
            ]
          : [[]];
      },
    };
    await worker.createDownstreamDiscovery(
      connection,
      {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        actorId: "user-1",
        requestId: "request-1",
        traceId: "trace-1",
        collectionTaskId: "original-task",
        payload: { image_url: imageUrl },
      },
      "product-1",
      "Product",
      "",
      "US",
      new Date("2026-10-17T00:00:00Z"),
    );
    assert.equal(tasks.length, imageUrl ? 1 : 0);
    if (imageUrl) {
      assert.equal(tasks[0].queries[0].providerId, "lan");
      assert.equal(tasks[0].queries[0].target.image_url, image);
    } else {
      const update = writes.find(([sql]) => sql.startsWith("UPDATE sourcing_searches"));
      assert.ok(JSON.parse(update[1][0]).includes("image_url"));
    }
  }
});
