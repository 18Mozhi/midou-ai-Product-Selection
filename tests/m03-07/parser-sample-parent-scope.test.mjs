import assert from "node:assert/strict";
import test from "node:test";
import { MySqlProviderSourceSampleRepository } from "../../apps/api/dist/mysql-provider-source-sample-repository.js";
import { providerSampleEvidenceHash } from "../../apps/api/dist/provider-source-service.js";

const input = {
  actorId: "actor", route: "create", idempotencyKey: "key", providerId: "provider",
  browserJobId: "job", organizationId: "org", workspaceId: "workspace", sampleId: "sample",
  name: "sample", inputSha256: "input-hash", snapshots: [{ kind: "detail" }],
  baselineOutput: { item: "original" }, baselineOutputSha256: "output-hash",
  parserVersion: "parser", now: new Date(), requestId: "request", traceId: "trace",
};

function fixture(fields, allowed = true) {
  const log = [];
  const c = {
    async beginTransaction() {},
    async commit() { log.push("COMMIT"); },
    async rollback() { log.push("ROLLBACK"); },
    release() {},
    async query(sql, args = []) {
      log.push(sql);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT s.*")) return [[]];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SELECT j.id")) {
        assert.match(sql, /job_task.id=j.collection_task_id/);
        assert.deepEqual(args, ["job", "provider", "org", "workspace", "parser"]);
        return [allowed ? [{ id: "job" }] : []];
      }
      if (sql.startsWith("SHOW COLUMNS")) return [fields];
      if (sql.startsWith("INSERT INTO provider_parser_samples")) {
        assert.equal(sql.includes("organization_id,workspace_id"), fields.length === 2);
        assert.deepEqual(args, [
          "sample", ...(fields.length === 2 ? ["org", "workspace"] : []),
          "provider", "job", "sample", "input-hash", '[{"kind":"detail"}]',
          '{"item":"original"}', "output-hash", "parser", "actor", input.now, input.now,
        ]);
      }
      return [{ affectedRows: 1 }];
    },
  };
  return { log, repo: new MySqlProviderSourceSampleRepository({ async getConnection() { return c; } }) };
}

test("parser samples preserve job, provider and payload in either schema", async () => {
  for (const fields of [[], [{ Field: "organization_id" }, { Field: "workspace_id" }]]) {
    const { log, repo } = fixture(fields);
    const result = await repo.createParserSample(input);
    assert.equal(result.id, "sample");
    assert.equal(result.browser_job_id, "job");
    assert.equal(log.at(-1), "COMMIT");
  }
});

for(const mode of ["account","foreign","changed-snapshot"]) test(`native parser samples keep the original browser evidence: ${mode}`,async()=>{
  const calls=[];
  const c={beginTransaction:async()=>{},commit:async()=>calls.push("commit"),
    rollback:async()=>calls.push("rollback"),release:()=>{},
    async query(sql,args=[]) {
      calls.push(sql);
      if (sql.startsWith("INSERT INTO platform_audit_events(id,organization_id")) {
        throw Object.assign(new Error("legacy audit column missing"), {
          code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column 'organization_id' in 'field list'",
        });
      }
      if (sql.startsWith("SHOW COLUMNS FROM platform_audit_events"))
        return [[{ Field: "historical_context" }]];
      if (!sql.startsWith("SHOW COLUMNS")) assert.doesNotMatch(sql,/organization_id|workspace_id/);
      if(sql.startsWith("SELECT s.*")) return [[]];
      if(sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"account_id"}]];
      if(sql.startsWith("SELECT j.id")) {
        assert.match(sql,/ot.account_id=job_task.account_id/);
        assert.match(sql,/oq.account_id=ot.account_id/);
        assert.match(sql,/oa.account_id=job_task.account_id/);
        assert.match(sql,/a.collection_task_id=job_task.id AND a.collection_subquery_id=j.collection_subquery_id AND a.provider_id=j.provider_id/);
        assert.deepEqual(args,["job","provider","owner","parser"]);
        return [mode==="foreign"?[]:[{id:"job",result_json:{snapshots:mode==="changed-snapshot"?[]:input.snapshots}}]];
      }
      if(sql.startsWith("SHOW COLUMNS")) return [[]];
      return [{affectedRows:1}];
    }};
  const repo=new MySqlProviderSourceSampleRepository({getConnection:async()=>c});
  const pending=repo.createParserSample({...input,accountId:"owner",inputSha256:providerSampleEvidenceHash(input.snapshots)});
  if(mode==="account") {
    assert.equal((await pending).browser_job_id,"job");
    assert.ok(calls.some(sql=>sql.startsWith("INSERT INTO provider_parser_samples")));
    assert.ok(calls.some(sql=>sql.startsWith("INSERT INTO platform_audit_events(id,historical_context")));
  } else {
    await assert.rejects(pending,{code:"parser_sample_candidate_changed"});
    assert.ok(!calls.some(sql=>sql.startsWith("INSERT")));
  }
  assert.equal(calls.at(-1),mode==="account"?"commit":"rollback");
});

test("wrong parent scope and partial schema both fail before any write", async () => {
  for (const [fields, allowed, error] of [
    [[], false, { code: "parser_sample_candidate_changed" }],
    [[{ Field: "workspace_id" }], true, /partial_inherited_scope_schema/],
  ]) {
    const { log, repo } = fixture(fields, allowed);
    await assert.rejects(repo.createParserSample(input), error);
    assert.ok(!log.some(sql => sql.startsWith("INSERT")));
    assert.equal(log.at(-1), "ROLLBACK");
  }
});
