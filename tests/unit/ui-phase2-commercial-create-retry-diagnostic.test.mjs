// Diagnostic evidence, not an acceptance gate: these assertions reproduce an unresolved hazard.
// SQL calls are handled by a finite in-memory adapter; this is not a real MySQL/HTTP/transaction test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { previewCommercialCreateFocus } from "../../scripts/lib/ui-phase2-commercial-create-focus-preview.mjs";
import { outcomeState } from "../../scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const source = read("apps/web/src/components/CommercialOperationsCenter.vue");
function sourceModule(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const box = {
    module,
    exports: module.exports,
    ...globals,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `unexpected import ${name}`);
      return imports[name];
    },
  };
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    box,
  );
  return module.exports;
}
const serviceModule = sourceModule("apps/api/src/commercial-service.ts", { "node:crypto": crypto });
const { MySqlCommercialRepository } = sourceModule("apps/api/src/mysql-commercial-repository.ts", {
  "node:crypto": crypto,
  "./commercial-service.js": serviceModule,
});

function memoryRepository() {
  let committed = { operations: new Map(), plans: new Map(), audits: [], events: [] };
  const counters = { begin: 0, commit: 0, rollback: 0, release: 0 };
  const pool = {
    async getConnection() {
      let transaction;
      return {
        async beginTransaction() {
          counters.begin++;
          transaction = structuredClone(committed);
        },
        async commit() {
          counters.commit++;
          committed = transaction;
        },
        async rollback() {
          counters.rollback++;
        },
        release() {
          counters.release++;
        },
        async query(sql, args) {
          assert.ok(transaction, "query outside transaction");
          if (
            sql.startsWith(
              "SELECT result_json FROM commercial_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
            )
          ) {
            const result = transaction.operations.get(JSON.stringify(args));
            return [result ? [{ result_json: JSON.stringify(result) }] : []];
          }
          if (sql.startsWith("INSERT IGNORE INTO commercial_operations(")) {
            const key = JSON.stringify(args.slice(1, 4));
            if (transaction.operations.has(key)) return [{ affectedRows: 0 }];
            transaction.operations.set(key, JSON.parse(args[5]));
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("INSERT INTO commercial_plans(")) {
            if ([...transaction.plans.values()].some((p) => p.code === args[1]))
              throw Object.assign(new Error("local duplicate"), { code: "ER_DUP_ENTRY" });
            transaction.plans.set(args[0], {
              id: args[0],
              code: args[1],
              name: args[2],
              description: args[3],
              quotas: JSON.parse(args[4]),
              status: "draft",
              version: 1,
            });
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("INSERT INTO platform_audit_events(")) {
            transaction.audits.push(args);
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("INSERT INTO commercial_events(")) {
            transaction.events.push(args);
            return [{ affectedRows: 1 }];
          }
          assert.fail(`Unexpected SQL in diagnostic adapter: ${sql}`);
        },
      };
    },
  };
  const repository = new MySqlCommercialRepository(pool, () => new Date("2026-09-12T08:00:00Z"));
  return {
    service: new serviceModule.CommercialService(repository),
    state: () => committed,
    counters,
  };
}
const actorId = "00000000-0000-4000-8000-000000000058";
const input = (value, key = "local-original-key") => ({
  actorId,
  idempotencyKey: key,
  requestId: "local-request",
  traceId: "local-trace",
  value,
});
const draft = (code, name) => ({
  code,
  name,
  description: "local diagnostic",
  quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 },
  reason: "本地重试诊断",
});

test("DIAGNOSTIC actual repository replays the first result for same key even when valid payload changes", async () => {
  const m = memoryRepository(),
    a = await m.service.createPlan(input(draft("alpha", "Alpha")));
  const b = await m.service.createPlan(input(draft("beta", "Beta")));
  assert.equal(b.id, a.id);
  assert.equal(b.idempotent_replay, true);
  assert.equal(b.version, 1);
  assert.equal(m.state().plans.size, 1);
  assert.equal([...m.state().plans.values()][0].code, "alpha");
  assert.equal(m.state().audits.length, 1);
  assert.equal(m.state().events.length, 1);
  assert.equal(m.counters.commit, 2);
  assert.equal(m.counters.release, 2);
  // Replay payload need not contain status: op originally stores { id, version }.
  assert.equal(a.status, "draft");
  assert.equal(b.status, undefined);
});
test("DIAGNOSTIC unchanged payload replay does not duplicate; a new key denotes a new operation", async () => {
  const m = memoryRepository(),
    a = await m.service.createPlan(input(draft("alpha", "Alpha")));
  const replay = await m.service.createPlan(input(draft("alpha", "Alpha")));
  assert.equal(replay.id, a.id);
  assert.equal(m.state().plans.size, 1);
  const b = await m.service.createPlan(input(draft("beta", "Beta"), "local-new-key"));
  assert.notEqual(b.id, a.id);
  assert.equal(m.state().plans.size, 2);
  assert.equal(m.state().audits.length, 2);
});
test("DIAGNOSTIC actual transaction rolls back a failed new operation in the memory adapter", async () => {
  const m = memoryRepository();
  await m.service.createPlan(input(draft("alpha", "Alpha")));
  await assert.rejects(
    m.service.createPlan(input(draft("alpha", "Duplicate"), "local-duplicate-key")),
  );
  assert.equal(m.counters.rollback, 1);
  assert.equal(m.state().operations.size, 1);
  assert.equal(m.state().plans.size, 1);
  await m.service.createPlan(input(draft("beta", "Beta"), "local-duplicate-key"));
  assert.equal(m.state().operations.size, 2);
  assert.equal(m.state().plans.size, 2);
});

function frontendHarness(preview, lossAfterCommit) {
  const m = memoryRepository(),
    posts = [],
    responses = [];
  const fakeFetch = async (url, options) => {
    const target = new URL(url),
      method = options.method ?? "GET";
    assert.equal(target.origin, "http://p58.local.invalid");
    if (method === "POST") {
      assert.equal(target.pathname, "/api/v1/platform/commercial/plans");
      const value = JSON.parse(options.body),
        key = options.headers.get("idempotency-key");
      posts.push({ value, key });
      if (posts.length === 1 && !lossAfterCommit) throw new TypeError("local loss before dispatch");
      const data = await m.service.createPlan(input(value, key));
      responses.push(data);
      if (posts.length === 1) throw new TypeError("local loss after simulated commit");
      return new Response(JSON.stringify({ data, request_id: "local-post-replayed" }), {
        status: 201,
      });
    }
    assert.equal(method, "GET");
    assert.equal(target.pathname, "/api/v1/platform/commercial");
    const all = [...m.state().plans.values()],
      query = target.searchParams.get("query") ?? "";
    // Synthetic GET model for these two plain-letter query samples only; not a SQL read emulation.
    assert.ok(["alpha", "beta"].includes(query));
    const plans = all.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(query));
    return new Response(
      JSON.stringify({
        data: {
          summary: { total: all.length, draft: all.length, active: 0, retired: 0 },
          plans,
          pagination: { page: 1, page_size: 20, total: plans.length, total_pages: 1 },
          adjustment_pagination: { page: 1, page_size: 10, total: 0, total_pages: 1 },
          assignment: null,
        },
        request_id: "local-catalog-read",
      }),
      { status: 200 },
    );
  };
  const api = sourceModule(
    "apps/web/src/api-client.ts",
    {},
    { Headers, Response, crypto, fetch: fakeFetch, window: { setTimeout } },
  );
  const apiFailures = [],
    request = api.createApiClient("http://p58.local.invalid/api/v1");
  const vue = preview ? previewCommercialCreateFocus(source) : source;
  const script = parse(vue).descriptor.scriptSetup.content,
    ast = ts.createSourceFile("p58.ts", script, ts.ScriptTarget.Latest, true);
  const names = new Set(["createPlan", "load", "call", "setNotice", "normalizedData"]);
  const functions = ast.statements
    .filter((n) => ts.isFunctionDeclaration(n) && names.has(n.name.text))
    .map((n) => n.getText(ast));
  assert.equal(functions.length, 5);
  const empties = [];
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === "emptyData")
      empties.push(n.initializer.getText(ast));
    ts.forEachChild(n, visit);
  };
  visit(ast);
  assert.equal(empties.length, 1);
  const ref = (value) => ({ value });
  const box = {
    ref,
    ApiClientError: api.ApiClientError,
    request: async (...args) => {
      try {
        return await request(...args);
      } catch (error) {
        apiFailures.push({ status: error.status, kind: error.kind, hint: error.actionHint });
        throw error;
      }
    },
    window: { setTimeout, clearTimeout },
    AbortController,
    DOMException,
    URLSearchParams,
    crypto,
    refreshing: ref(false),
    loadedOnce: ref(true),
    mutating: ref(false),
    creatingPlan: ref(true),
    state: ref("ready"),
    data: ref({}),
    requestId: ref(""),
    notice: ref(""),
    noticeKind: ref("info"),
    page: ref(1),
    adjustmentPage: ref(1),
    organizationId: ref(""),
    query: ref(""),
    status: ref(""),
    assignment: ref({}),
    draftFeedback: ref(""),
    plan: ref({
      code: "alpha",
      name: "Alpha",
      description: "local diagnostic",
      collection_tasks: 100,
      open_api_requests: 1000,
      report_exports: 20,
      reason: "本地重试诊断",
    }),
    loadSequence: 0,
    loadController: null,
    createPlanIdempotencyKey: "local-original-key",
    localDate: (v) => v,
    syncLocation: () => {},
  };
  const program =
    `const emptyData=${empties[0]};\n` +
    (preview ? outcomeState : "") +
    functions.join("\n") +
    '\nglobalThis.execute=createPlan;globalThis.receipt=()=>typeof draftReceipt === "undefined"?null:draftReceipt.value;';
  vm.runInNewContext(
    ts.transpileModule(program, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    box,
  );
  return { m, box, posts, responses, apiFailures };
}
for (const preview of [false, true])
  test(`DIAGNOSTIC ${preview ? "current C preview" : "production Vue"} can report changed Beta as created while only Alpha was persisted`, async () => {
    const h = frontendHarness(preview, true);
    await h.box.execute();
    assert.equal(h.posts.length, 1);
    assert.equal(h.apiFailures[0].status, 0);
    assert.equal(h.apiFailures[0].kind, "blocked");
    assert.equal(h.m.state().plans.size, 1);
    assert.equal(h.box.noticeKind.value, "error");
    assert.equal(h.box.mutating.value, false);
    assert.equal(h.box.createPlanIdempotencyKey, "local-original-key");
    h.box.plan.value.code = "beta";
    h.box.plan.value.name = "Beta";
    await h.box.execute();
    assert.equal(h.posts.length, 2);
    assert.equal(h.posts[0].key, h.posts[1].key);
    assert.equal(h.posts[0].value.code, "alpha");
    assert.equal(h.posts[1].value.code, "beta");
    assert.equal(h.responses[1].id, h.responses[0].id);
    assert.equal(h.responses[1].idempotent_replay, true);
    assert.equal(h.m.state().plans.size, 1);
    assert.equal([...h.m.state().plans.values()][0].code, "alpha");
    assert.equal(h.box.noticeKind.value, "success");
    assert.equal(h.box.query.value, "beta");
    assert.equal(h.box.data.value.plans.length, 0);
    if (preview) {
      assert.equal(h.box.receipt().name, "Beta");
      assert.equal(h.box.receipt().code, "beta");
      assert.equal(h.box.receipt().readState, "ready");
    }
  });
test("DIAGNOSTIC indistinguishable first network error may instead mean no write, so changing the body is not a reliable retry", async () => {
  const h = frontendHarness(true, false);
  await h.box.execute();
  assert.equal(h.posts.length, 1);
  assert.equal(h.apiFailures[0].status, 0);
  assert.equal(h.apiFailures[0].kind, "blocked");
  assert.equal(h.m.state().plans.size, 0);
  assert.equal(h.box.noticeKind.value, "error");
  assert.equal(h.box.createPlanIdempotencyKey, "local-original-key");
  h.box.plan.value.code = "beta";
  h.box.plan.value.name = "Beta";
  await h.box.execute();
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[0].key, h.posts[1].key);
  assert.equal(h.m.state().plans.size, 1);
  assert.equal([...h.m.state().plans.values()][0].code, "beta");
  assert.equal(h.box.data.value.plans.length, 1);
  assert.equal(h.box.receipt().name, "Beta");
});
