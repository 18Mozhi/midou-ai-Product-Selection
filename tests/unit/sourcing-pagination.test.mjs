import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";
import { registerSourcingRoutes } from "../../apps/api/dist/sourcing-routes.js";
const scope = { organizationId: "org-a", workspaceId: "ws-a", actorId: "actor" };
const id = "00000000-0000-4000-8000-000000000083";
const record = {
  id,
  input_type: "opportunity",
  input_ref: "original-reference",
  display_name: "跨页商品",
  status: "queued",
  candidate_count: 0,
  missing_fields_json: "[]",
  created_at: "2026-11-04T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
};
function pool(total = 945) {
  const queries = [];
  return {
    queries,
    query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT COUNT(*) preceding_count")) return [[{ preceding_count: 82 }]];
      if (sql.includes("COALESCE(SUM(status"))
        return [[{ total: 945, running: 138, candidates: 25100, ready: 343 }]];
      if (sql.startsWith("SELECT COUNT(*) total")) return [[{ total }]];
      return [[record]];
    },
  };
}
test("SQL limits record rows before image hydration and retains global scoped summary", async () => {
  const p = pool(),
    repo = new MySqlSourcingRepository(p);
  const result = await repo.listPage({ ...scope, page: 2, pageSize: 20, query: "" });
  assert.deepEqual(result.meta, {
    page: 2,
    page_size: 20,
    total: 945,
    summary: { total: 945, running: 138, candidates: 25100, ready: 343 },
  });
  assert.equal(result.items.length, 1);
  const rows = p.queries.find((x) => x.sql.startsWith("SELECT s.*"));
  assert.match(
    rows.sql,
    /FROM \(SELECT s\.\*,.*display_name.*ORDER BY s.created_at DESC,s.id DESC LIMIT \? OFFSET \?\) s ORDER BY/s,
  );
  assert.deepEqual(rows.values, ["org-a", "ws-a", "org-a", "ws-a", 20, 20]);
  assert.match(rows.sql, /image_query.task_id=s.collection_task_id/);
  assert.match(rows.sql, /image_query.organization_id=s.organization_id/);
  assert.match(rows.sql, /image_query.workspace_id=s.workspace_id/);
});
test("server search is literal, parameterized, scoped, and does not zero global metrics", async () => {
  const p = pool(1),
    repo = new MySqlSourcingRepository(p);
  const q = "%_=' OR 1=1";
  const r = await repo.listPage({ ...scope, page: 99, pageSize: 20, query: q });
  assert.equal(r.meta.page, 1);
  assert.equal(r.meta.total, 1);
  assert.equal(r.meta.summary.total, 945);
  for (const query of p.queries.filter((x) => x.sql.includes("LIKE BINARY"))) {
    assert.ok(!query.sql.includes(q));
    assert.ok(query.values.includes("%=%=_==' or 1==1%"));
    assert.match(query.sql, /ESCAPE '='/);
    assert.match(query.sql, /s.deleted_at IS NULL/);
  }
});
test("deep-linked record locates its page with the same date/id ordering and tenant scope", async () => {
  const p = pool(),
    r = await new MySqlSourcingRepository(p).listPage({
      ...scope,
      page: 1,
      pageSize: 20,
      query: "",
      locateRecord: id,
    });
  assert.equal(r.meta.page, 5);
  const rank = p.queries.find((x) => x.sql.startsWith("SELECT COUNT(*) preceding_count"));
  assert.deepEqual(rank.values, ["org-a", "ws-a", id, "org-a", "ws-a"]);
  assert.match(rank.sql, /target.workspace_id=s.workspace_id/);
  assert.match(
    rank.sql,
    /s.created_at>target.created_at OR \(s.created_at=target.created_at AND s.id>target.id\)/,
  );
});
test("empty filtered pages avoid image reads but preserve the full summary", async () => {
  const p = pool(0),
    r = await new MySqlSourcingRepository(p).listPage({
      ...scope,
      page: 2,
      pageSize: 20,
      query: "none",
    });
  assert.deepEqual(r.items, []);
  assert.equal(r.meta.page, 1);
  assert.equal(r.meta.summary.total, 945);
  assert.equal(p.queries.length, 2);
});
test("invalid paging/search/record values fail before repository access", async () => {
  let reads = 0;
  const service = new SourcingService({
    list: async () => {
      reads++;
      return [];
    },
  });
  for (const query of [
    { page: "0" },
    { page: "-1" },
    { page: "1.5" },
    { page_size: "101" },
    { page_size: ["20"] },
    { q: "x".repeat(201) },
    { q: [] },
    { record: "not-uuid" },
  ])
    await assert.rejects(
      () => service.listPage(scope, query),
      (e) => e.statusCode === 400,
    );
  assert.equal(reads, 0);
});
test("HTTP keeps legacy array envelope and adds meta only to paged reads after authorization", async () => {
  const input = [];
  const app = Fastify();
  const service = new SourcingService({
    list: async (i) => {
      input.push(i);
      return [record];
    },
    listPage: async (i) => {
      input.push(i);
      return {
        items: [record],
        meta: {
          page: i.page,
          page_size: i.pageSize,
          total: 1,
          summary: { total: 1, running: 1, candidates: 0, ready: 0 },
        },
      };
    },
  });
  registerSourcingRoutes(app, {
    service,
    secureCookie: false,
    webOrigin: "http://localhost",
    auth: { authenticate: async () => ({ user: { id: "actor" }, session: { id: "session" } }) },
    authorization: {
      resolveSession: async () => ({ context: { organization_id: "org-a", workspace_id: "ws-a" } }),
      authorize: async () => {},
    },
  });
  try {
    const old = (
      await app.inject({
        headers: { cookie: "scoutops_session=fixture" },
        url: "/api/v1/sourcing/searches",
      })
    ).json();
    assert.ok(Array.isArray(old.data));
    assert.equal(old.meta, undefined);
    const paged = (
      await app.inject({
        headers: { cookie: "scoutops_session=fixture" },
        url: "/api/v1/sourcing/searches?page_size=20&q=商品&organization_id=other",
      })
    ).json();
    assert.equal(paged.meta.page_size, 20);
    assert.equal(paged.meta.total, 1);
    assert.equal(input[1].organizationId, "org-a");
    assert.equal(input[1].workspaceId, "ws-a");
    assert.equal(input[1].query, "商品");
  } finally {
    await app.close();
  }
});

test("legacy non-SQL repositories retain correct global counts and filtered paging", async () => {
  const all = [
    {
      ...record,
      id: "00000000-0000-4000-8000-000000000001",
      display_name: "target one",
      input_ref: "ref1",
      status: "queued",
      candidate_count: 2,
    },
    {
      ...record,
      id: "00000000-0000-4000-8000-000000000002",
      display_name: "target two",
      input_ref: "ref2",
      status: "running",
      candidate_count: 0,
    },
    {
      ...record,
      id: "00000000-0000-4000-8000-000000000003",
      display_name: "unrelated",
      input_ref: "ref3",
      status: "completed",
      candidate_count: 3,
    },
  ];
  const service = new SourcingService({ list: async () => all });
  const result = await service.listPage(scope, { q: "TARGET", page: "2", page_size: "1" });
  assert.equal(result.items[0].id, all[1].id);
  assert.deepEqual(result.meta, {
    page: 2,
    page_size: 1,
    total: 2,
    summary: { total: 3, running: 2, candidates: 5, ready: 2 },
  });
  const located = await service.listPage(scope, { q: "target", record: all[1].id, page_size: "1" });
  assert.equal(located.meta.page, 2);
});
