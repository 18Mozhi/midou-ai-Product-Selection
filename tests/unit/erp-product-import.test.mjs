import test from "node:test";
import assert from "node:assert/strict";
import {
  ErpProductImportService,
  normalizeErpProductRow,
} from "../../apps/api/dist/erp-product-import-service.js";
import { buildApp } from "../../apps/api/dist/app.js";

const ids = {
  organization: "00000000-0000-4000-8000-000000004201",
  workspace: "00000000-0000-4000-8000-000000004202",
  actor: "00000000-0000-4000-8000-000000004203",
};

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
