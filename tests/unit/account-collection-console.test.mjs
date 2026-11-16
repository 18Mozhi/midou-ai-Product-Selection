import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerCollectionConsoleRoutes } from "../../apps/api/dist/collection-console-routes.js";
import { MySqlCollectionConsoleRepository } from "../../apps/api/dist/mysql-collection-console-repository.js";

const base = {
  actorId: "admin",
  window: "all",
  attemptPage: 1,
  deadLetterPage: 1,
  recentLimit: 10,
};

test("account collection console uses sealed task ownership for all task-derived reads", async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{ Field: "account_id" }]];
      assert.doesNotMatch(sql, /\b(?:organizations|workspaces|organization_id|workspace_id)\b/);
      if (sql.startsWith("SELECT id FROM providers")) return [[{id:"provider"}]];
      if (sql.includes("collection_tasks t")) {
        assert.match(sql, /own\.account_id=t\.account_id/);
        assert.match(sql, /own\.account_id=cut\.primary_account_id/);
        assert.match(sql,/sub_owner\.account_id=t\.account_id/);
        if (sql.includes("FROM collection_dead_letters"))
          assert.match(sql,/original_attempt\.id=d\.attempt_id AND original_attempt\.task_id=t\.id/);
      }
      if (sql.includes("SELECT d.id"))
        return [[{ id: "dead", task_id: "original", account_id: "owner" }]];
      if (sql.includes("SELECT a.id"))
        return [[{ id: "attempt", task_id: "original", account_id: "owner" }]];
      return [[]];
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        release() {},
        async query(sql, args) {
          if (sql.includes("INSERT INTO collection_console_views"))
            assert.doesNotMatch(sql, /(?:organization|workspace)_filter_id/);
          if (sql.includes("INSERT INTO platform_audit_events")) {
            assert.equal(args[1], null);
            assert.equal(args[2], null);
            assert.equal(args[4], "platform.collection.console.read");
          }
        },
      };
    },
  };
  const repo = new MySqlCollectionConsoleRepository(pool, undefined, true);
  const report = await repo.read({...base,providerId:"provider"});
  assert.equal(report.attempts[0].account_id, "owner");
  assert.equal(report.dead_letters[0].task_id, "original");
  assert.equal(Object.hasOwn(report.filters, "organization_id"), false);
  assert.equal(calls.filter((sql) => sql.includes("collection_tasks t")).length, 6);
});

test("account collection console does not fall back to unscoped reads on old schema", async () => {
  const reads=[];
  const repo=new MySqlCollectionConsoleRepository({query:async(sql)=>{
    reads.push(sql);
    assert.match(sql,/^SHOW COLUMNS FROM collection_tasks/);
    return [[{Field:"organization_id"},{Field:"workspace_id"}]];
  }},undefined,true);
  await assert.rejects(repo.read(base), {code:"collection_console_account_schema_required",statusCode:503});
  assert.equal(reads.length,1);
});

test("retired collection scope is rejected before any repository query", async () => {
  const repo = new MySqlCollectionConsoleRepository(
    { query: () => assert.fail("database touched") },
    undefined,
    true,
  );
  for (const key of ["organizationId", "workspaceId"])
    await assert.rejects(repo.read({ ...base, [key]: "legacy" }), {
      code: "collection_console_scope_retired",
      statusCode: 400,
    });
});

test("account console HTTP rejects even blank retired query keys after the platform permission check", async () => {
  const app = Fastify();
  let authorized = 0,
    reads = 0;
  registerCollectionConsoleRoutes(app, {
    accountReadRehearsal: true,
    secureCookie: false,
    auth: { authenticate: async () => ({ user: { id: "admin" } }) },
    authorization: {
      authorize: async (input) => {
        assert.equal(input.capability, "platform:operate");
        authorized++;
      },
    },
    service: {
      read: async (input) => {
        reads++;
        return { window: input.window };
      },
    },
  });
  try {
    const headers = { cookie: "scoutops_session=fixture" };
    for (const key of ["organization_id", "workspace_id"]) {
      const response = await app.inject({
        url: `/api/v1/platform/collection/console?${key}=`,
        headers,
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().code, "collection_console_scope_retired");
    }
    const valid = await app.inject({
      url: "/api/v1/platform/collection/console?window=7d",
      headers,
    });
    assert.equal(valid.statusCode, 200);
    assert.deepEqual(valid.json().data, { window: "7d" });
    assert.equal(authorized, 3);
    assert.equal(reads, 1);
  } finally {
    await app.close();
  }
});
