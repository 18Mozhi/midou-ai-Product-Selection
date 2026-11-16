import test from "node:test";
import assert from "node:assert/strict";
import {
  ErpProductImportService,
  accountErpImportReplaySql,
  normalizeErpProductRow,
} from "../../apps/api/dist/erp-product-import-service.js";
import { buildApp } from "../../apps/api/dist/app.js";

const ids = {
  organization: "00000000-0000-4000-8000-000000004201",
  workspace: "00000000-0000-4000-8000-000000004202",
  actor: "00000000-0000-4000-8000-000000004203",
};

const fixtureInput = {
  source_url: "https://medou.medouai.com/#/ProductList",
  items: [{ id: "fixture", last_sync_time: "2026-08-19T08:00:00Z",
    product: { productMultiNameList: [{ productName: "Fixture" }] } }],
};
const fixtureContext = { organizationId: ids.organization, workspaceId: ids.workspace, actorId: ids.actor,
  idempotencyKey: "fixture-key", requestId: "fixture-request", traceId: "fixture-trace" };

test("account ERP replay verifies the sealed original task and never starts a new import", async () => {
  const calls = [];
  let owned = 1, sealed = true, task = "original-task", operation = true;
  const service = new ErpProductImportService({ async getConnection() { return {
    async beginTransaction() {}, async commit() { calls.push("commit"); }, async rollback() { calls.push("rollback"); }, release() {},
    async query(sql, args) {
      if (sql.startsWith("SELECT slot")) return [sealed ? [{ slot: "current" }] : []];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"account_id"}]];
      assert.equal(sql, accountErpImportReplaySql(true));
      assert.doesNotMatch(sql, /organization_id|workspace_id|INSERT|UPDATE/);
      assert.match(sql, /own\.source_id=t\.id AND own\.account_id=o\.actor_id/);
      assert.match(sql, /own\.account_id=cut\.primary_account_id/);
      assert.match(sql, /t\.account_id=own\.account_id/);
      assert.deepEqual(args, [ids.actor, fixtureContext.idempotencyKey]);
      return [operation ? [{ owned, task_id: "original-task", result_json: { task_id: task } }] : []];
    },
  }; } }, "unused", 2_000_000);
  const run = () => service.replayAccountImport(fixtureContext);
  assert.deepEqual(await run(), { task_id: "original-task" });
  owned = 0;
  await assert.rejects(run, /erp_product_import_idempotency_conflict/);
  owned = 1;
  task = "wrong-task";
  await assert.rejects(run, /erp_product_import_idempotency_conflict/);
  operation = false;
  await assert.rejects(run, { code: "erp_account_import_not_ready" });
  sealed = false;
  await assert.rejects(run, { code: "account_ownership_not_ready" });
  assert.deepEqual(calls, ["commit", "rollback", "rollback", "rollback", "rollback"]);
});

test("account ERP route uses the verified session, ignores payload scope and never enters legacy import", async () => {
  let verified = true, calls = 0;
  const app = buildApp({ erpProductImport: {
    accountReadRehearsal: true,
    auth: { authenticate: async () => ({ user: { id: ids.actor, email_verified_at: verified ? new Date() : null } }) },
    authorization: { resolveSession: () => assert.fail("legacy session"), authorize: () => assert.fail("legacy authorize") },
    service: {
      replayAccountImport: async (context) => {
        assert.deepEqual(context, { actorId: ids.actor, idempotencyKey: "fixture-key" });
        calls++;
        return { task_id: "original-task" };
      },
      import: () => assert.fail("new import"),
    },
    secureCookie: false, webOrigin: "http://127.0.0.1:5173",
  } });
  try {
    const run = () => app.inject({ method: "POST", url: "/api/v1/imports/erp-products",
      headers: { origin: "http://127.0.0.1:5173", cookie: "scoutops_session=test", "idempotency-key": "fixture-key" },
      payload: { organization_id: "foreign", workspace_id: "foreign", actor_id: "foreign" },
    });
    const allowed = await run();
    assert.equal(allowed.statusCode, 201, allowed.body);
    assert.deepEqual(allowed.json().data, { task_id: "original-task" });
    verified = false;
    const denied = await run();
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(calls, 1);
  } finally {
    await app.close();
  }
});

test("ERP exact replay binds the original task scope and does not return a cross-scope result", async () => {
  let scope = ids.workspace;
  let resultTaskId = "original-task";
  const queries = [];
  let commits = 0;
  let rollbacks = 0;
  const service = new ErpProductImportService({ async getConnection() { return {
    async beginTransaction() {}, async commit() { commits++; }, async rollback() { rollbacks++; }, release() {},
    async query(sql, args) {
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      queries.push(sql);
      assert.match(sql, /JOIN collection_tasks t ON t.id=o.task_id WHERE o.actor_id=\? AND o.idempotency_key=\?/);
      assert.deepEqual(args, [ids.actor, fixtureContext.idempotencyKey]);
      return [[{ task_id: "original-task", result_json: JSON.stringify({ task_id: resultTaskId }),
        organization_id: ids.organization, workspace_id: scope }]];
    },
  }; } }, "unused", 2_000_000);
  assert.deepEqual(await service.import(fixtureInput, fixtureContext), { task_id: "original-task" });
  scope = "different-space";
  await assert.rejects(service.import(fixtureInput, fixtureContext), /erp_product_import_idempotency_conflict/);
  scope = ids.workspace;
  resultTaskId = "different-task";
  await assert.rejects(service.import(fixtureInput, fixtureContext), /erp_product_import_idempotency_conflict/);
  assert.deepEqual({ commits, rollbacks, reads: queries.length }, { commits: 1, rollbacks: 2, reads: 3 });
});

test("ERP new receipt preserves task, actor and request on either complete schema", async () => {
  for (const fields of [[], ["organization_id", "workspace_id"]]) {
    const queries = [];
    const service = new ErpProductImportService({ async getConnection() { return {
      async beginTransaction() {}, async commit() {}, async rollback() { assert.fail("unexpected rollback"); }, release() {},
      async query(sql, args) {
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        queries.push({ sql, args });
        if (sql.startsWith("SELECT o.result_json")) return [[]];
        if (sql.startsWith("SHOW COLUMNS")) return [fields.map((Field) => ({ Field }))];
        if (sql.startsWith("SELECT id,retention_days")) return [[{ id: "provider", retention_days: 30 }]];
        return [{ affectedRows: 1 }];
      },
    }; } }, "unused", 2_000_000);
    service.createTask = async () => {};
    service.persistEvidence = async () => ({ deduplicated: false });
    service.projectProduct = async () => ({ opportunityCreated: 0, competitorsCreated: 0, sourcingCreated: 0 });
    const result = await service.import(fixtureInput, fixtureContext);
    const { sql, args } = queries.find(({ sql }) => sql.startsWith("INSERT INTO erp_product_import_operations"));
    assert.equal((sql.match(/\?/g) ?? []).length, args.length);
    assert.equal(sql.includes("organization_id,workspace_id,"), fields.length > 0);
    assert.deepEqual(args.slice(1 + fields.length, 4 + fields.length),
      [ids.actor, fixtureContext.idempotencyKey, result.task_id]);
    assert.deepEqual(JSON.parse(args[4 + fields.length]), result);
    assert.deepEqual(args.slice(5 + fields.length, 7 + fields.length), ["fixture-request", "fixture-trace"]);
  }
});

test("ERP rejects a half-migrated sourcing schema before writing any data", async () => {
  let rolledBack = false;
  const service = new ErpProductImportService({ async getConnection() { return {
    async beginTransaction() {}, async commit() { assert.fail("unexpected commit"); },
    async rollback() { rolledBack = true; }, release() {},
    async query(sql) {
      if (sql.startsWith("SELECT o.result_json")) return [[]];
      if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM erp_product_import_operations")) return [[]];
      if (sql.startsWith("SHOW COLUMNS FROM sourcing_searches")) return [[{ Field: "workspace_id" }]];
      assert.fail(sql);
    },
  }; } }, "unused", 2_000_000);
  await assert.rejects(service.import(fixtureInput, fixtureContext), /partial_inherited_scope_schema:sourcing_searches/);
  assert.equal(rolledBack, true);
});

test("ERP sourcing projection preserves parent task and reference cost with or without search scope columns", async () => {
  for (const legacySearchScope of [true, false]) {
    for (const existing of [false, true]) {
      const queries = [];
      const service = new ErpProductImportService({}, "unused", 2_000_000);
      const c = { async query(sql, args) {
        queries.push({ sql, args });
        if (sql.startsWith("SELECT id FROM trend_topics")) return [[{ id: "topic" }]];
        if (sql.startsWith("SELECT id FROM opportunities")) return [[{ id: "opportunity" }]];
        if (sql.startsWith("SELECT id FROM trend_signals")) return [[{ id: "signal" }]];
        if (sql.startsWith("SELECT") && sql.includes("FROM sourcing_searches")) return [existing ? [{ id: "search" }] : []];
        return [{ affectedRows: 1 }];
      } };
      const now = new Date("2026-08-19T08:00:00Z");
      const result = await service.projectProduct(c, {
        legacySearchScope, context: fixtureContext, now, evidenceId: "evidence", recordId: "record",
        providerId: "provider", taskId: "original-task", value: {
          asin_list: [], external_id: "product", observed_at: now.toISOString(),
          source_url: fixtureInput.source_url, title: "Fixture", supplier_code: "supplier", cost_cny: 17,
        },
      });
      const find = queries.find(({ sql }) => sql.startsWith("SELECT") && sql.includes("FROM sourcing_searches"));
      assert.deepEqual(find.args, [ids.organization, ids.workspace, "opportunity"]);
      if (!legacySearchScope) {
        assert.match(find.sql, /JOIN collection_tasks t ON t\.id=s\.collection_task_id/);
        assert.doesNotMatch(find.sql, /s\.(?:organization_id|workspace_id)/);
      }
      const insert = queries.find(({ sql }) => sql.startsWith("INSERT INTO sourcing_searches"));
      assert.equal(result.sourcingCreated, existing ? 0 : 1);
      if (existing) assert.equal(insert, undefined);
      else {
        assert.equal(insert.sql.includes("organization_id,workspace_id,"), legacySearchScope);
        assert.equal((insert.sql.match(/\?/g) ?? []).length, insert.args.length);
        assert.deepEqual(insert.args.slice(1, legacySearchScope ? 5 : 3),
          [...(legacySearchScope ? [ids.organization, ids.workspace] : []), "original-task", "opportunity"]);
      }
      const candidate = queries.find(({ sql }) => sql.startsWith("INSERT IGNORE INTO sourcing_candidates"));
      assert.equal(candidate.args[1], existing ? "search" : insert.args[0]);
      assert.deepEqual(candidate.args.slice(8, 10), [17, "CNY"]);
      assert.equal(candidate.args[4], "evidence");
    }
  }
});

test("ERP product row maps the confirmed title image ASIN supplier and cost contract", () => {
  const result = normalizeErpProductRow(
    {
      id: "row-1",
      spu: "SPU-100",
      store_id: "store-8",
      asin_list: ["B0ABCDEF12"],
      last_sync_time: "2026-08-19T08:00:00.000Z",
      product: {
        productMultiNameList: [{ productName: "Portable product" }],
        spuImageInfoList: [{ imageUrl: "https://cdn.example.com/p.jpg" }],
        skcInfoList: [
          {
            supplierCode: "SUP-88",
            skuInfoList: [
              {
                costInfoList: [
                  { currency: "CNY", costPrice: "25.6" },
                  { currency: "USD", costPrice: 3.55 },
                ],
              },
            ],
          },
        ],
      },
    },
    "https://medou.medouai.com/#/ProductList",
    new Date("2026-08-19T09:00:00.000Z"),
  );
  assert.equal(result.normalized.title, "Portable product");
  assert.equal(result.normalized.image_url, "https://cdn.example.com/p.jpg");
  assert.deepEqual(result.normalized.asin_list, ["B0ABCDEF12"]);
  assert.equal(result.normalized.supplier_code, "SUP-88");
  assert.equal(result.normalized.cost_cny, 25.6);
  assert.equal(result.normalized.cost_usd, 3.55);
});

test("ERP product row rejects missing real identity and title", () => {
  assert.throws(
    () =>
      normalizeErpProductRow(
        { product: {}, last_sync_time: "2026-08-19T08:00:00.000Z" },
        "https://medou.medouai.com/#/ProductList",
        new Date(),
      ),
    /erp_product_row_invalid/,
  );
});

test("ERP A-B-A import reuses immutable evidence and creates a new active normalized version", async () => {
  const queries = [];
  const connection = {
    async query(sql, values = []) {
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      queries.push({ sql, values });
      if (sql.startsWith("SELECT e.id evidence_id")) return [[{ evidence_id: "evidence-a" }], []];
      if (sql.startsWith("SELECT id,raw_evidence_id,record_version"))
        return [
          [
            {
              id: "record-b",
              raw_evidence_id: "evidence-b",
              record_version: 2,
            },
          ],
          [],
        ];
      return [{ affectedRows: 1 }, []];
    },
  };
  const service = new ErpProductImportService({}, "unused", 2_000_000);
  const result = await service.persistEvidence(
    connection,
    {
      taskId: "task-1",
      subqueryId: "subquery-1",
      providerId: "provider-1",
      retentionDays: 30,
      rawContent: Buffer.from("a"),
      value: {
        external_id: "SPU-1",
        spu: "SPU-1",
        store_id: "store-1",
        title: "商品 A",
        image_url: null,
        asin_list: [],
        supplier_code: "SUP-1",
        cost_cny: 10,
        cost_usd: null,
        observed_at: "2026-08-19T01:00:00.000Z",
        source_url: "https://medou.medouai.com/#/ProductList",
      },
      ordinal: 1,
      context: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        actorId: "actor-1",
        idempotencyKey: "key-1",
        requestId: "request-1",
        traceId: "trace-1",
      },
      now: new Date("2026-08-19T02:00:00.000Z"),
    },
    [],
  );
  assert.equal(result.evidenceId, "evidence-a");
  assert.equal(result.deduplicated, true);
  assert.notEqual(result.recordId, "record-b");
  assert.ok(
    queries.some((item) =>
      item.sql.startsWith("UPDATE normalized_records SET status='superseded'"),
    ),
  );
  const insert = queries.find((item) => item.sql.startsWith("INSERT INTO normalized_records"));
  assert.equal(insert.values[4], "evidence-a");
  assert.equal(insert.values[6], 3);
  assert.equal(insert.values[8], "record-b");
  for (const query of queries) {
    assert.equal(
      (query.sql.match(/\?/g) ?? []).length,
      query.values.length,
      `placeholder mismatch: ${query.sql}`,
    );
  }
});

test("ERP product import API derives scope and enforces origin and idempotency", async () => {
  const calls = [];
  const result = {
    task_id: "00000000-0000-4000-8000-000000004204",
    received_count: 1,
    imported_count: 1,
    deduplicated_count: 0,
    opportunity_count: 1,
    competitor_count: 1,
    sourcing_search_count: 1,
    status: "succeeded",
  };
  const service = {
    import: async (value, context) => {
      calls.push(["import", value, context]);
      return result;
    },
  };
  const authorization = {
    resolveSession: async () => ({
      context: {
        organization_id: ids.organization,
        workspace_id: ids.workspace,
      },
    }),
    authorize: async (value) => calls.push(["authorize", value]),
  };
  const auth = {
    authenticate: async () => ({
      user: { id: ids.actor },
      session: { id: "session" },
    }),
  };
  const app = buildApp({
    erpProductImport: {
      service,
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  const payload = {
    source_url: "https://medou.medouai.com/#/ProductList",
    items: [{ id: "row-1" }],
  };
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/imports/erp-products",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "erp-import-1",
      "x-request-id": "erp-request",
      "x-trace-id": "erp-trace",
    },
    payload,
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.deepEqual(response.json().data, result);
  assert.equal(calls[0][1].capability, "opportunity:decide");
  assert.equal(calls[1][2].organizationId, ids.organization);
  assert.equal(calls[1][2].workspaceId, ids.workspace);
  assert.equal(calls[1][2].actorId, ids.actor);
  assert.equal(calls[1][2].idempotencyKey, "erp-import-1");

  const forbidden = await app.inject({
    method: "POST",
    url: "/api/v1/imports/erp-products",
    headers: {
      cookie: "scoutops_session=test",
      origin: "https://evil.example",
      "idempotency-key": "erp-import-2",
    },
    payload,
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "origin_forbidden");

  const missingKey = await app.inject({
    method: "POST",
    url: "/api/v1/imports/erp-products",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
    },
    payload,
  });
  assert.equal(missingKey.statusCode, 400);
  assert.equal(missingKey.json().error.code, "idempotency_key_required");
  await app.close();
});

test("ERP product import API sanitizes known errors and keeps unknown failures internal", async () => {
  const authorization = {
    resolveSession: async () => ({
      context: {
        organization_id: ids.organization,
        workspace_id: ids.workspace,
      },
    }),
    authorize: async () => {},
  };
  const auth = {
    authenticate: async () => ({
      user: { id: ids.actor },
      session: { id: "session" },
    }),
  };
  const makeApp = (message) =>
    buildApp({
      erpProductImport: {
        service: {
          import: async () => {
            throw new Error(message);
          },
        },
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  const headers = {
    cookie: "scoutops_session=test",
    origin: "http://127.0.0.1:5173",
    "idempotency-key": "erp-error",
  };
  const knownApp = makeApp("erp_product_row_invalid");
  const known = await knownApp.inject({
    method: "POST",
    url: "/api/v1/imports/erp-products",
    headers,
    payload: {},
  });
  assert.equal(known.statusCode, 400);
  assert.equal(known.json().error.code, "erp_product_row_invalid");
  await knownApp.close();

  const conflictApp = makeApp("erp_product_import_idempotency_conflict");
  const conflict = await conflictApp.inject({ method: "POST", url: "/api/v1/imports/erp-products", headers, payload: {} });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "erp_product_import_idempotency_conflict");
  assert.equal(conflict.json().data, undefined);
  await conflictApp.close();

  const unknownApp = makeApp("database-secret-detail");
  const unknown = await unknownApp.inject({
    method: "POST",
    url: "/api/v1/imports/erp-products",
    headers,
    payload: {},
  });
  assert.equal(unknown.statusCode, 500);
  assert.equal(unknown.json().error.code, "internal_error");
  assert.doesNotMatch(unknown.body, /database-secret-detail/);
  await unknownApp.close();
});
