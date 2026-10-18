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

function setup(
  rows,
  providers = [{ id: "lan", code: "1688_search" }],
  refreshRows = [],
  discoveryRows = [],
) {
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
      if (sql.startsWith("SELECT c.id,c.organization_id")) return [refreshRows];
      if (sql.startsWith("SELECT o.id discovery_opportunity_id")) return [discoveryRows];
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
      required: true,
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
  assert.match(sql, /n_image_seed\.workspace_id=l_image\.workspace_id/);
  assert.match(sql, /n_image\.workspace_id=n_image_seed\.workspace_id/);
  assert.match(sql, /BINARY UPPER[\s\S]*n_primary\.payload_json/);
  assert.match(sql, /BINARY o\.primary_asin/);
  assert.match(
    sql,
    /COALESCE\(\(SELECT[\s\S]*FROM competitors c_detail JOIN competitor_snapshots s_detail/,
  );
  assert.match(sql, /s_detail\.organization_id=c_detail\.organization_id/);
  assert.match(sql, /s_detail\.workspace_id=c_detail\.workspace_id/);
  assert.match(sql, /n_detail\.raw_evidence_id=s_detail\.evidence_id/);
  assert.match(sql, /n_detail\.organization_id=s_detail\.organization_id/);
  assert.match(sql, /n_detail\.workspace_id=s_detail\.workspace_id/);
  assert.match(sql, /c_detail\.opportunity_id=o\.id[\s\S]*c_detail\.deleted_at IS NULL/);
  assert.match(sql, /BINARY UPPER\(c_detail\.external_id\)=BINARY o\.primary_asin/);
  assert.match(
    sql,
    /BINARY UPPER\(JSON_UNQUOTE\(JSON_EXTRACT\(n_detail\.payload_json,'\$\.asin'\)\)\)=BINARY o\.primary_asin/,
  );
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

const refreshRow = {
  id: "competitor-1",
  organization_id: "org-1",
  workspace_id: "workspace-1",
  created_by: "user-1",
  external_id: "B000000001",
  product_url: "https://www.amazon.com/dp/B000000001",
};
test("stale primary or competitor refresh uses the existing detail queue with scoped cooldown and backpressure", async () => {
  const { worker, calls, tasks } = setup(
    [],
    [{ id: "amazon", code: "amazon_product" }],
    [refreshRow],
  );
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].queries, [
    {
      providerId: "amazon",
      required: true,
      target: {
        page_url: refreshRow.product_url,
        asin: refreshRow.external_id,
        projection_type: "competitor_snapshot",
        competitor_id: refreshRow.id,
      },
    },
  ]);
  assert.equal(tasks[0].context.organizationId, "org-1");
  assert.equal(tasks[0].context.workspaceId, "workspace-1");
  const read = calls.find(([sql]) => sql.startsWith("SELECT c.id,c.organization_id"));
  assert.deepEqual(read[1], [
    new Date("2026-10-16T23:00:00Z"),
    new Date("2026-10-16T23:00:00Z"),
    1000,
  ]);
  assert.match(
    read[0],
    /s\.organization_id=c\.organization_id AND s\.workspace_id=c\.workspace_id/,
  );
  assert.match(read[0], /busy\.organization_id=c\.organization_id/);
  assert.match(
    read[0],
    /recent\.organization_id=c\.organization_id AND recent\.workspace_id=c\.workspace_id/,
  );
  assert.match(read[0], /q\.created_at>\?/);
  assert.match(read[0], /ORDER BY s\.captured_at,c\.id LIMIT 1 FOR UPDATE/);
  assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
});
test("missing downstream work is served before periodic refresh", async () => {
  const { worker, calls } = setup(
    [row],
    [
      { id: "amazon", code: "amazon_product" },
      { id: "lan", code: "1688_search" },
    ],
    [refreshRow],
  );
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(
    calls.some(([sql]) => sql.startsWith("SELECT c.id,c.organization_id")),
    false,
  );
});
test("refresh queue failure rolls back atomically", async () => {
  const { worker, calls } = setup([], [{ id: "amazon", code: "amazon_product" }], [refreshRow]);
  worker.scheduleCoreCollection = async () => {
    throw Error("queue unavailable");
  };
  await assert.rejects(worker.enqueueMissingAutomaticDownstream(), /queue unavailable/);
  assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
});
test("refresh defensively rejects a different Amazon product identity", async () => {
  const { worker, tasks } = setup(
    [],
    [{ id: "amazon", code: "amazon_product" }],
    [{ ...refreshRow, product_url: "https://www.amazon.com/dp/B000000002" }],
  );
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 0);
});

const discoveryRow = {
  discovery_opportunity_id: "opportunity-1",
  organization_id: "org-1",
  workspace_id: "workspace-1",
  created_by: "user-1",
  name: "Editable unrelated label",
  discovery_query: "Handheld portable fan",
  primary_asin: "B000000001",
};

test("insufficient or unclassified competitors get a cooled-down discovery through the existing queue", async () => {
  const { worker, calls, tasks } = setup(
    [],
    [{ id: "amazon", code: "amazon_product" }],
    [],
    [discoveryRow],
  );
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].event, "competitor.discovery.auto_scheduled");
  assert.deepEqual(tasks[0].queries, [
    {
      providerId: "amazon",
      required: true,
      target: {
        query: discoveryRow.discovery_query,
        projection_type: "opportunity_competitors",
        opportunity_id: discoveryRow.discovery_opportunity_id,
        main_asin: discoveryRow.primary_asin,
      },
    },
  ]);
  assert.equal(tasks[0].context.organizationId, discoveryRow.organization_id);
  assert.equal(tasks[0].context.workspaceId, discoveryRow.workspace_id);
  const [sql, values] = calls.find(([sql]) =>
    String(sql).startsWith("SELECT o.id discovery_opportunity_id"),
  );
  assert.deepEqual(values, [new Date("2026-10-16T23:00:00Z"), 1000]);
  for (const term of [
    "recent.organization_id=o.organization_id",
    "recent.workspace_id=o.workspace_id",
    "busy.active_count IS NULL",
    "recent.last_discovery_at<=?",
    "competitors_classified",
    "COUNT(DISTINCT UPPER(c_sample.external_id))",
    "active_org.status='active'",
    "active_workspace.status='active'",
    "JOIN opportunities locked_opportunity",
    "n_title.payload_json",
    "HAVING LENGTH(TRIM(discovery_query))>0",
    "LIMIT 1 FOR UPDATE",
  ])
    assert.ok(sql.includes(term), term);
  assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
});

test("periodic details and incomplete discovery alternate without scheduling both in one transaction", async () => {
  const { worker, tasks } = setup(
    [],
    [{ id: "amazon", code: "amazon_product" }],
    [refreshRow],
    [discoveryRow],
  );
  let tick = Date.parse("2026-10-17T00:00:00Z");
  worker.now = () => new Date(tick);
  for (let i = 0; i < 4; i++) {
    await worker.enqueueMissingAutomaticDownstream();
    tick += 60_000;
  }
  assert.deepEqual(
    tasks.map((t) => t.queries[0].target.projection_type),
    [
      "competitor_snapshot",
      "opportunity_competitors",
      "competitor_snapshot",
      "opportunity_competitors",
    ],
  );
});

for (const invalid of [
  { ...discoveryRow, primary_asin: "invalid" },
  { ...discoveryRow, discovery_query: " " },
]) {
  test(
    "discovery rejects invalid primary or empty query before enqueuing: " +
      invalid.primary_asin +
      invalid.name,
    async () => {
      const { worker, tasks } = setup(
        [],
        [{ id: "amazon", code: "amazon_product" }],
        [],
        [invalid],
      );
      await worker.enqueueMissingAutomaticDownstream();
      assert.equal(tasks.length, 0);
    },
  );
}

test("discovery task failure rolls back and does not consume the detail turn", async () => {
  const details = [],
    { worker, calls, tasks } = setup([], [{ id: "amazon", code: "amazon_product" }], details, [
      discoveryRow,
    ]);
  const schedule = worker.scheduleCoreCollection;
  worker.scheduleCoreCollection = async () => {
    throw Error("discovery queue unavailable");
  };
  await assert.rejects(worker.enqueueMissingAutomaticDownstream(), /discovery queue unavailable/);
  assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
  details.push(refreshRow);
  worker.scheduleCoreCollection = schedule;
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].queries[0].target.projection_type, "competitor_snapshot");
});

test("initial missing work keeps precedence over both periodic chains", async () => {
  const { worker, calls } = setup(
    [row],
    [
      { id: "amazon", code: "amazon_product" },
      { id: "lan", code: "1688_search" },
    ],
    [refreshRow],
    [discoveryRow],
  );
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(
    calls.some(([sql]) => String(sql).startsWith("SELECT o.id discovery_opportunity_id")),
    false,
  );
});

test("empty discovery scans are bounded to one minute without stopping existing repair or detail reads", async () => {
  const { worker, calls } = setup([], [{ id: "amazon", code: "amazon_product" }]);
  let tick = Date.parse("2026-10-17T00:00:00Z");
  worker.now = () => new Date(tick);
  await worker.enqueueMissingAutomaticDownstream();
  await worker.enqueueMissingAutomaticDownstream();
  tick += 59_999;
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(
    calls.filter(([sql]) => String(sql).startsWith("SELECT o.id discovery_opportunity_id")).length,
    1,
  );
  assert.equal(
    calls.filter(([sql]) => String(sql).startsWith("SELECT c.id,c.organization_id")).length,
    3,
  );
  tick += 1;
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(
    calls.filter(([sql]) => String(sql).startsWith("SELECT o.id discovery_opportunity_id")).length,
    2,
  );
});
