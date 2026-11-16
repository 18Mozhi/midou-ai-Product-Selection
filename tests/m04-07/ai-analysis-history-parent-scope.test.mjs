import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MySqlAiAnalysisRepository } from "../../apps/api/dist/mysql-ai-analysis-repository.js";
import { createHash } from "node:crypto";
import { appendAiAnalysisDelivery } from "../../packages/database/dist/index.js";
import { buildApp } from "../../apps/api/dist/app.js";
import { AiAnalysisService } from "../../apps/api/dist/ai-analysis-service.js";

const input = {
  id: "review", resultId: "result", organizationId: "org", workspaceId: "workspace",
  actorId: "reviewer", route: "review", idempotencyKey: "key", requestId: "request",
  traceId: "trace", value: { outcome: "approved", notes: "checked" },
};
test("retired Worker does not register legacy analysis generation", () => {
  const entry = readFileSync(new URL("../../apps/worker/src/index.ts", import.meta.url), "utf8");
  assert.match(entry, /if \(config\.app\.accountScopeMode === "retired" && queue\.name === "ai_analysis"\) continue;\s+scheduler\.register\(queue\)/);
});

test("account history follows the exact sealed opportunity and preserves old results and signatures", async () => {
  const opportunity = "00000000-0000-4000-8000-000000000701";
  const owner = "00000000-0000-4000-8000-000000000702";
  const foreign = "00000000-0000-4000-8000-000000000703";
  const date = new Date("2026-10-15T08:30:00Z");
  const accountRow = {
    id: "old-request", status: "succeeded", attempt_count: 1, created_at: date,
    input_sha256: "old-hash", prompt_contract_version: "opportunity-assist-v1",
    result_id: "old-result", result_json: { source_refs: ["evidence:original"] },
    ai_generated: true, review_status: "approved", review_outcome: "approved",
    reviewed_by: "original-reviewer", reviewed_at: date, review_notes: "original notes",
  };
  const reads = [];
  let seal = true;
  let matchesNative = true;
  const db = { async query(sql, args = []) {
    reads.push(sql);
    assert.match(sql, /^(SELECT|SHOW) /);
    if (sql.startsWith("SELECT slot")) return [seal ? [{ slot: "current" }] : []];
    if (sql.startsWith("SHOW COLUMNS FROM ??")) return [[]];
    if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [[{ Field: "account_id" }]];
    assert.match(sql, /owned.source_id=o.id/);
    assert.match(sql, /owned.reason IN \('shared','unassigned'\) AND owned.account_id=seal.primary_account_id/);
    assert.match(sql, /o.account_id=owned.account_id/);
    if (sql.startsWith("SELECT o.id")) {
      assert.equal(args[0], opportunity);
      return [matchesNative && args[1] === owner ? [{ id: opportunity }] : []];
    }
    assert.match(sql, /r.request_id_fk=q.id AND r.opportunity_id=q.opportunity_id/);
    assert.match(sql, /rv.result_id=r.id/);
    assert.deepEqual(args, [owner, opportunity]);
    return [[accountRow]];
  } };
  const app = buildApp({ aiAnalysis: {
    accountReadRehearsal: true, secureCookie: false, webOrigin: "http://127.0.0.1:5173",
    auth: { async authenticate(token) {
      return { user: { id: token === "foreign" ? foreign : owner, email_verified_at: token === "unverified" ? null : date } };
    } },
    authorization: { resolveSession: assert.fail, authorize: assert.fail },
    service: new AiAnalysisService(new MySqlAiAnalysisRepository(db)),
  } });
  const read = (token) => app.inject({
    url: `/api/v1/opportunities/${opportunity}/ai-analyses`,
    headers: { cookie: `scoutops_session=${token}` },
  });
  try {
    const reply = await read("owner");
    assert.equal(reply.statusCode, 200, reply.body);
    assert.equal(reply.headers["cache-control"], "private, no-store");
    assert.equal(reply.json().data[0].id, "old-request");
    assert.deepEqual(reply.json().data[0].result.content.source_refs, ["evidence:original"]);
    assert.deepEqual(reply.json().data[0].result.review, {
      outcome: "approved", notes: "original notes", reviewed_by: "original-reviewer",
      reviewed_at: date.toISOString(),
    });
    assert.equal((await read("foreign")).statusCode, 404);
    matchesNative = false;
    assert.equal((await read("owner")).statusCode, 404);
    seal = false;
    assert.equal((await read("owner")).statusCode, 503);
    const priorReads = reads.length;
    assert.equal((await read("unverified")).statusCode, 403);
    assert.equal(reads.length, priorReads);
    assert.equal(reads.filter((sql) => sql.startsWith("SELECT q.id")).length, 1);
    assert.equal((await app.inject({method:"POST",url:`/api/v1/opportunities/${opportunity}/ai-analyses`})).statusCode,404);
    assert.equal((await app.inject({method:"POST",url:"/api/v1/ai-analyses/old-result/reviews"})).statusCode,404);
    assert.equal(reads.length,priorReads);
  } finally {
    await app.close();
  }
});

test("AI event and outbox use the same typed resource, event ID and unmodified payload", async () => {
  const now = new Date();
  for (const legacy of [false, true]) {
    const writes = [];
    const db = { async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return [legacy ? [{}, {}] : []];
      assert.equal(sql.includes("organization_id,workspace_id"), legacy);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      writes.push([sql, args]);
    } };
    await appendAiAnalysisDelivery(db, {
      id: "event", type: "ai.analysis.completed", resourceId: "result", actorId: "worker",
      payload: { source_refs: ["source"] }, requestId: "request", traceId: "trace", now,
      organizationId: "org", workspaceId: "workspace",
    });
    const base = ["event", ...(legacy ? ["org", "workspace"] : []), "ai.analysis.completed", "result"];
    const encoded = '{"source_refs":["source"]}';
    assert.deepEqual(writes.map(([, args]) => args), [
      [...base, "worker", encoded, "request", "trace", now], [...base, encoded, now, now],
    ]);
    assert.match(writes[1][0], /'queued'/);
  }
});

test("mismatched AI event/outbox schemas fail before either insert", async () => {
  const db = { async query(sql, [table]) {
    assert.match(sql, /^SHOW COLUMNS/);
    return [table === "ai_analysis_events" ? [{}, {}] : []];
  } };
  await assert.rejects(appendAiAnalysisDelivery(db, {}), /partial_inherited_scope_schema:ai_analysis_delivery/);
});

test("AI history review writes the same actor and exact parent in both layouts", async () => {
  for (const legacy of [false, true]) {
    const calls = [];
    const db = {
      async beginTransaction() {},
      async commit() { calls.push("commit"); },
      async rollback() { assert.fail("unexpected rollback"); },
      release() {},
      async query(sql, args) {
        assert.equal((sql.match(/\?/g) ?? []).length + (sql.includes("??") ? -1 : 0), args.length);
        if (sql.startsWith("SELECT r.id")) {
          assert.match(sql, /q.id=r.request_id_fk AND q.opportunity_id=r.opportunity_id/);
          assert.deepEqual(args, ["result", "org", "workspace"]);
          return [[{ id: "result", review_status: "pending" }]];
        }
        if (sql.startsWith("SELECT result_json")) {
          assert.deepEqual(args, ["reviewer", "review", "key", "result"]);
          return [[]];
        }
        if (sql.startsWith("SHOW COLUMNS"))
          return [legacy ? [{ Field: "organization_id" }, { Field: "workspace_id" }] : []];
        if (sql.startsWith("INSERT INTO ai_analysis_reviews")) {
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          assert.deepEqual(args.slice(0, -1), [
            "review", ...(legacy ? ["org", "workspace"] : []),
            "result", "approved", "checked", "reviewer", "request", "trace",
          ]);
          calls.push("review");
        }
        return [{ affectedRows: 1 }];
      },
    };
    const repo = new MySqlAiAnalysisRepository({ async getConnection() { return db; } });
    assert.equal((await repo.review(input)).reviewed_by, "reviewer");
    assert.deepEqual(calls, ["review", "commit"]);
  }
});

test("a request outside the exact parent scope cannot replay a saved AI review", async () => {
  let rolledBack = false;
  const db = {
    async beginTransaction() {},
    async rollback() { rolledBack = true; },
    release() {},
    async query(sql) {
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      assert.match(sql, /^SELECT r.id,r.review_status/);
      return [[]];
    },
  };
  const repo = new MySqlAiAnalysisRepository({ async getConnection() { return db; } });
  await assert.rejects(repo.review({ ...input, workspaceId: "foreign" }),
    { code: "ai_analysis_result_not_found" });
  assert.equal(rolledBack, true);
});

test("AI requests keep the exact opportunity, version and snapshot hash in both schemas", async () => {
  for (const legacy of [true, false]) {
    let stored;
    const db = {
      async beginTransaction() {},
      async commit() {},
      async rollback() { assert.fail("unexpected rollback"); },
      release() {},
      async query(sql, args) {
        if (sql.includes("FROM opportunities")) return [[{
          id: "opportunity", version: 3, updated_at: "2026-11-13T00:00:00.000Z",
        }]];
        if (sql.startsWith("SHOW COLUMNS")) return [legacy ? [{}, {}] : []];
        if (sql.startsWith("SELECT")) return [[]];
        if (sql.startsWith("INSERT INTO ai_analysis_requests")) {
          assert.equal(sql.includes("organization_id,workspace_id"), legacy);
          assert.equal((sql.match(/\?/g) ?? []).length, args.length);
          const [id, opportunity, version, , snapshot, hash] = legacy
            ? [args[0], ...args.slice(3)] : args;
          assert.deepEqual([id, opportunity, version], ["analysis", "opportunity", 3]);
          assert.deepEqual(JSON.parse(snapshot).source_refs, ["opportunity:opportunity"]);
          assert.equal(hash, createHash("sha256").update(snapshot).digest("hex"));
          stored = hash;
        }
        return [{ affectedRows: 1 }];
      },
    };
    const repo = new MySqlAiAnalysisRepository({ async getConnection() { return db; } });
    const result = await repo.queue({
      ...input, id: "analysis", opportunityId: "opportunity", value: { expected_version: 3 },
    });
    assert.ok(stored);
    assert.equal(result.input_sha256, stored);
  }
});
