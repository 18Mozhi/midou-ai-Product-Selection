import assert from "node:assert/strict";
import test from "node:test";
import { insertCrawlerRun, readCrawlerRunAccount, readCrawlerRunCoordinates } from "../../apps/api/dist/crawler-run-storage.js";

test("crawler run writes and readback preserve coordinates under either schema", async () => {
  const input = { id: "run", organizationId: "org", workspaceId: "space", providerId: "provider",
    profileId: "profile", actorId: "actor", requestId: "request", traceId: "trace", now: new Date() };
  for (const legacy of [true, false]) {
    const fields = legacy ? ["organization_id", "workspace_id"] : ["historical_context"];
    let inserted = 0;
    await insertCrawlerRun({ async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return [fields.map(Field => ({ Field }))];
      assert.match(sql, /^INSERT INTO crawler_browser_runs/);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      assert.equal(sql.includes("historical_context"), !legacy);
      assert.deepEqual(args.slice(1, legacy ? 3 : 2), legacy ? ["org", "space"] :
        ['{"organization_id":"org","workspace_id":"space"}']);
      inserted++;
      return [];
    } }, input);
    assert.equal(inserted, 1);
  }
  assert.deepEqual(readCrawlerRunCoordinates({ organization_id: "org", workspace_id: "space" }), { organizationId: "org", workspaceId: "space" });
  assert.deepEqual(readCrawlerRunCoordinates({ historical_context: '{"organization_id":"org","workspace_id":"space"}' }), { organizationId: "org", workspaceId: "space" });
  assert.throws(() => readCrawlerRunCoordinates({ historical_context: {} }), /crawler_run_coordinates_invalid/);
  assert.throws(() => readCrawlerRunCoordinates({ organization_id: "org", historical_context: { workspace_id: "space" } }), /crawler_run_scope_partial/);
  await assert.rejects(insertCrawlerRun({ async query() { return [[{ Field: "workspace_id" }]]; } }, input), /crawler_run_scope_partial/);
});

test("sealed crawler runs retain only account attribution and reject legacy storage", async () => {
  const input = {id:"run",accountId:"owner",providerId:"provider",profileId:"profile",
    actorId:"actor",requestId:"request",traceId:"trace",now:new Date()};
  for (const legacy of [false,true]) {
    const writes = [];
    const db = {async query(sql,args) {
      if (sql.startsWith("SHOW COLUMNS")) return [(legacy ? ["organization_id","workspace_id"] :
        ["historical_context"]).map(Field => ({Field}))];
      writes.push([sql,args]);
      return [{affectedRows:1}];
    }};
    if (legacy) {
      await assert.rejects(insertCrawlerRun(db,input), {message:"crawler_run_account_schema_required"});
      assert.equal(writes.length,0);
    } else {
      await insertCrawlerRun(db,input);
      assert.doesNotMatch(writes[0][0],/organization_id|workspace_id/);
      assert.equal(readCrawlerRunAccount({historical_context:writes[0][1][1]}),"owner");
    }
  }
  assert.equal(readCrawlerRunAccount({historical_context:{organization_id:"org",workspace_id:"space"}}),null);
  assert.throws(() => readCrawlerRunAccount({historical_context:{account_id:"owner",workspace_id:"space"}}),
    {message:"crawler_run_account_context_invalid"});
});
