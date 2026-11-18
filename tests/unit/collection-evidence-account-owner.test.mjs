import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MySqlEvidencePersistence } from "../../apps/worker/dist/evidence-persistence.js";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const content = Buffer.from('{"title":"evidence fixture"}');
const digest = createHash("sha256").update(content).digest("hex");
const input = {
  organizationId:id(1), workspaceId:id(2), taskId:id(3), subqueryId:id(4), providerId:id(5), actorId:id(6),
  sourceUrl:"https://example.test/source", canonicalUrl:"https://example.test/item", dedupeKey:"capture",
  recordKey:"item", contentType:"application/json", content, capturedAt:new Date("2026-10-15T12:00:00Z"),
  parserVersion:"parser-v1", adapterVersion:"adapter-v1", recordSchemaVersion:"schema-v1",
  normalizedPayload:{title:"evidence fixture"}, provenance:[{
    fieldPath:"title", sourcePath:"$.title", transformVersion:"copy-v1", sourceValueHash:digest,
  }], requestId:"fixture-request", traceId:"fixture-trace",
};

test("native evidence accepts absent retired ids only with a valid account and live lease fence", async () => {
  const native = {...input, organizationId:"", workspaceId:""};
  const calls = [];
  const owner = id(8);
  const c = {beginTransaction:async()=>{}, rollback:async()=>{}, release(){},
    async query(sql, args) {
      calls.push(sql);
      assert.match(sql, /t.account_id=\?.*lease_token_hash=UNHEX\(\?\).*FOR UPDATE/);
      assert.deepEqual(args.slice(0, 3), [input.taskId,input.subqueryId,owner]);
      return [[]];
    }};
  const storage = new MySqlEvidencePersistence({getConnection:async()=>c}, "unused", 1024);
  await assert.rejects(storage.persist(native), {code:"evidence_identifier_invalid"});
  await assert.rejects(storage.persist({...native,taskFence:{accountId:"",leaseToken:"fixture"}}),
    {code:"evidence_identifier_invalid"});
  assert.equal(calls.length, 0);
  await assert.rejects(storage.persist({...native,taskFence:{accountId:owner,leaseToken:""}}),
    {code:"evidence_scope_or_task_invalid"});
  assert.equal(calls.length, 0);
  await assert.rejects(storage.persist({...native,taskFence:{accountId:owner,leaseToken:"fixture"}}),
    {code:"evidence_scope_or_task_invalid"});
  assert.equal(calls.length, 1);
});

for (const nativeOwnerMatches of [true, false]) {
  test(`browser capture replay requires the original asset's native owner: ${nativeOwnerMatches}`, async () => {
    const owner = id(8), assetId = id(12), artifactId = id(13), jobId = id(14);
    const actions = [];
    const connection = {
      beginTransaction: async () => actions.push("begin"),
      commit: async () => actions.push("commit"),
      rollback: async () => actions.push("rollback"),
      release: () => actions.push("release"),
      async query(sql, params) {
        if (sql.startsWith("SELECT p.retention_days")) return [[{retention_days: 30}]];
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{Field: "account_id"}, {Field: "historical_context"}]];
        if (sql.startsWith("SELECT cut.primary_account_id"))
          return [[{primary_account_id: owner, account_id: owner, reason: "shared"}]];
        if (sql.startsWith("SHOW COLUMNS FROM browser_evidence_artifacts")) return [[]];
        if (sql.startsWith("SELECT j.id FROM browser_collection_jobs")) {
          assert.deepEqual(params, [jobId, input.taskId, input.subqueryId, input.providerId]);
          return [[{id: jobId}]];
        }
        if (sql.startsWith("SELECT id,content_sha256")) {
          assert.deepEqual(params, [jobId, "dom_fragment"]);
          return [[{id: artifactId, file_asset_id: assetId, content_sha256: digest}]];
        }
        if (sql.startsWith("SELECT source_table,source_id,account_id")) {
          assert.deepEqual(params, [[["browser_evidence_artifacts", artifactId], ["file_assets", assetId]]]);
          return [params[0].map(([source_table, source_id]) => ({source_table, source_id, account_id: owner}))];
        }
        assert.match(sql, /^SELECT id FROM file_assets .*category='evidence' LOCK IN SHARE MODE$/);
        assert.deepEqual(params, [assetId, owner]);
        return [nativeOwnerMatches ? [{id: assetId}] : []];
      },
    };
    const service = new MySqlEvidencePersistence({getConnection: async () => connection}, "unused", 1024);
    const replay = service.persistBrowserArtifact({
      ...input, browserJobId: jobId, kind: "dom_fragment", contentType: "text/html", contentHash: digest,
      taskFence: {accountId: owner, leaseToken: "fixture-lease"},
    });
    if (nativeOwnerMatches) assert.deepEqual(await replay, {artifact_id: artifactId, deduplicated: true});
    else await assert.rejects(replay, {code: "evidence_reference_owner_mismatch"});
    assert.deepEqual(actions, ["begin", nativeOwnerMatches ? "commit" : "rollback", "release"]);
  });
}

for (const mode of ["shared", "exclusive_owner", "unmapped", "invalid_primary", "ledger_failure", "legacy"]) {
  test(`reconciliation preserves exact account ownership: ${mode}`, async () => {
    const writes = [], actions = [];
    const owner = mode === "exclusive_owner" ? id(9) : id(8);
    const reason = mode === "exclusive_owner" ? mode : "shared";
    let ledger = [];
    const c = {
      beginTransaction: async () => actions.push("begin"),
      commit: async () => actions.push("commit"),
      rollback: async () => actions.push("rollback"),
      release: () => actions.push("release"),
      async query(sql, params) {
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          assert.match(sql, /s.run_id=cut.source_run_id AND s.legacy_org_id=\? AND s.legacy_workspace_id=\?/);
          assert.deepEqual(params, [input.organizationId, input.workspaceId]);
          if (mode === "legacy") return [[]];
          return [[{ primary_account_id: id(8), account_id: mode === "unmapped" ? null :
            mode === "invalid_primary" ? id(9) : owner, reason }]];
        }
        if (/^SHOW COLUMNS FROM (reconciliation_runs|data_quality_issues) /.test(sql))
          return [mode === "exclusive_owner" ? [{ Field: "organization_id" }, { Field: "workspace_id" }] :
            [{ Field: "historical_context" }]];
        if (sql.startsWith("SHOW COLUMNS")) return [[]];
        const table = /^INSERT INTO (\w+)/.exec(sql)?.[1];
        assert.ok(table, sql);
        if (table === "reconciliation_runs" || table === "data_quality_issues") {
          assert.equal((sql.match(/\?/g) ?? []).length, params.length);
          if (mode !== "exclusive_owner" && mode !== "legacy") {
            assert.match(sql, /\(id,historical_context,provider_id/);
            assert.deepEqual(JSON.parse(params[1]), { organization_id: input.organizationId, workspace_id: input.workspaceId });
          } else assert.match(sql, /\(id,organization_id,workspace_id,provider_id/);
        }
        if (table === "account_owned_records") {
          if (mode === "ledger_failure") throw Error("fixture_ledger_failure");
          ledger = params[0];
        } else writes.push([table, params[0]]);
        return [{ affectedRows: 1 }];
      },
    };
    const service = new MySqlEvidencePersistence({ getConnection: async () => c }, "unused", 1024);
    const reconcile = () => service.reconcile({ ...input,
      market: "US", windowStartedAt: new Date("2026-10-14"), windowEndedAt: new Date("2026-10-15"),
      metrics: [{ code: "title_accuracy", numerator: 0, denominator: 1 }],
    });
    if (mode === "unmapped" || mode === "invalid_primary" || mode === "ledger_failure") {
      await assert.rejects(reconcile(), mode === "ledger_failure" ? { message: "fixture_ledger_failure" } :
        { code: "reconciliation_owner_mismatch" });
      assert.deepEqual(actions, ["begin", "rollback", "release"]);
      if (mode !== "ledger_failure") assert.deepEqual(writes, []);
      return;
    }
    assert.equal((await reconcile()).status, "failed");
    assert.deepEqual(actions, ["begin", "commit", "release"]);
    assert.deepEqual(writes.map(([table]) => table).sort(),
      ["data_quality_issues", "evidence_data_events", "evidence_data_events", "evidence_data_outbox", "reconciliation_runs"]);
    assert.deepEqual(ledger.sort(), mode === "legacy" ? [] : writes.map(row => [...row, owner, reason]).sort());
  });
}

for (const mode of ["capture", "account_capture", "account_missing", "reuse", "reuse_foreign", "account_reuse",
  "account_reuse_foreign", "version_foreign", "account_version_foreign", "ledger_failure",
  "account_columns_capture", "account_columns_reuse", "account_columns_reuse_foreign",
  "account_columns_reuse_asset_ledger_foreign", "account_columns_reuse_asset_native_foreign",
  "account_columns_version_foreign", "account_partial", "account_columns_fenced", "account_columns_fenced_denied", "account_columns_fenced_old_events"]) {
  test(`evidence task owner: ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "scoutops-evidence-owner-"));
    try {
      const writes = [], entries = [], actions = [];
      const reuse = mode.includes("reuse");
      const accountStorage = mode.startsWith("account_");
      const accountColumns = mode.startsWith("account_columns_");
      const fenced = mode.includes("_fenced");
      const owner = reuse ? id(9) : id(8), reason = reuse ? "exclusive_owner" : "shared";
      const c = {
        beginTransaction: async () => actions.push("begin"),
        commit: async () => actions.push("commit"),
        rollback: async () => actions.push("rollback"),
        release: () => actions.push("release"),
        query: async (sql, v = []) => {
        if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [(mode.startsWith("account_") ? ["account_id","historical_context"] : ["organization_id","workspace_id"]).map(Field => ({Field}))];
          if (sql.startsWith("SELECT p.retention_days")) {
            if (fenced) {
              assert.match(sql, /eo.source_table='collection_tasks'.*eo.source_id=t.id.*eo.account_id=t.account_id AND t.account_id=\?.*LOCK IN SHARE MODE.*t.lease_token_hash=UNHEX\(\?\).*q.provider_id=\? FOR UPDATE/);
              assert.match(sql, /qo.source_table='collection_subqueries'.*qo.account_id=eo.account_id.*qo.source_id=q.id/);
              assert.doesNotMatch(sql, /organization_id|workspace_id/);
              assert.deepEqual(v, [input.taskId,input.subqueryId,owner,createHash("sha256")
                .update("scoutops:collection-task-lease:v1\0fixture-lease").digest("hex"),input.providerId]);
            }
            return [mode.endsWith("_denied") ? [] : [{retention_days:30}]];
          }
          if (mode.endsWith("_old_events") && sql.startsWith("SHOW COLUMNS FROM evidence_data_events"))
            return [[{Field:"organization_id"},{Field:"workspace_id"}]];
          if (sql.startsWith("SELECT cut.primary_account_id")) {
            assert.deepEqual(v, [input.taskId]);
            return [[{ primary_account_id:id(8), account_id:mode === "account_missing" ? null : owner, reason }]];
          }
          if (sql.startsWith("SELECT TABLE_NAME AS table_name")) {
            return [["raw_evidence", "normalized_records"].flatMap(table_name => (
              accountColumns || (mode === "account_partial" && table_name === "raw_evidence")
                ? ["account_id"] : ["organization_id", "workspace_id"]
            ).map(column_name => ({table_name, column_name})))];
          }
          if (sql.startsWith("SELECT e.id evidence_id") || /^SELECT (n\.)?id record_id/.test(sql)) {
            if (accountColumns) {
              assert.match(sql, /WHERE [en]\.account_id=\?/);
              assert.match(sql, /(?:n\.account_id=e\.account_id|e\.account_id=n\.account_id)/);
              assert.doesNotMatch(sql, /organization_id|workspace_id/);
            } else if (accountStorage) {
              assert.match(sql, /JOIN collection_tasks t ON t\.id=e\.collection_task_id/);
              assert.match(sql, /WHERE t\.organization_id=\? AND t\.workspace_id=\?/);
              assert.doesNotMatch(sql, /[en]\.(organization_id|workspace_id)/);
            }
            const scope = accountColumns ? [owner] : [input.organizationId, input.workspaceId];
            assert.deepEqual(v.slice(0, scope.length + 1), [...scope, input.providerId]);
            if (sql.startsWith("SELECT e.id evidence_id")) return [reuse ? [{
              evidence_id:id(10), record_id:id(11), content_sha256:digest, file_asset_id:id(12),
            }] : []];
            return [mode.endsWith("version_foreign") ? [{record_id:id(11), record_version:1}] : []];
          }
          if (sql.startsWith("SELECT source_table,source_id,account_id")) return [v[0].map(([t,i]) => ({
            source_table:t, source_id:i,
            account_id:(t === "normalized_records" && mode.endsWith("foreign") && !mode.includes("_asset_")) ||
              (t === "file_assets" && mode.endsWith("_asset_ledger_foreign")) ? id(77) : owner,
          }))];
          if (sql.startsWith("SELECT id FROM file_assets")) {
            assert.match(sql, /id=\? AND account_id=\? AND category='evidence' LOCK IN SHARE MODE/);
            assert.deepEqual(v, [id(12), owner]);
            return [mode.endsWith("_asset_native_foreign") ? [] : [{id:id(12)}]];
          }
          if (sql.startsWith("SELECT id FROM collection_task_evidence_links") || sql.startsWith("SHOW COLUMNS")) return [[]];
          if (sql.startsWith("INSERT INTO account_owned_records")) {
            if (mode === "ledger_failure" && v[0][0][0] === "file_assets") throw Error("ledger_write_failed");
            entries.push(...v[0]); return [{affectedRows:v[0].length}];
          }
          if (mode === "account_capture" && sql.startsWith("INSERT INTO file_assets")) {
            assert.match(sql,/\(id,account_id,category,/);
            assert.equal(v[1],owner);
            assert.equal(v[2],`accounts/${owner}/evidence/${v[0]}/content.bin`);
          }
          if (sql.startsWith("INSERT INTO ")) {
            if (/^INSERT INTO (raw_evidence|normalized_records) /.test(sql)) {
              assert.equal((sql.match(/\?/g) ?? []).length, v.length);
              if (accountColumns) {
                assert.match(sql, /\(id,account_id,/);
                assert.equal(v[1], owner);
                assert.doesNotMatch(sql, /organization_id|workspace_id/);
              }
            }
            writes.push([sql.split(" ")[2], v[0], v]);
            return [{affectedRows:1}];
          }
          throw Error("Unexpected SQL: " + sql);
        },
      };
      const repo = new MySqlEvidencePersistence({getConnection:async()=>c}, root, 1024, () => input.capturedAt);
      if (mode === "account_missing" || mode === "account_partial") {
        await assert.rejects(repo.persist(input), {code: mode === "account_missing"
          ? "evidence_task_owner_missing" : "evidence_scope_schema_invalid"});
        assert.deepEqual(actions, ["begin","rollback","release"]);
        assert.deepEqual(writes, []);
        return;
      }
      if (mode.endsWith("foreign") || mode === "ledger_failure") {
        await assert.rejects(repo.persist(input), mode === "ledger_failure"
          ? {message:"ledger_write_failed"} : {code:"evidence_reference_owner_mismatch"});
        assert.deepEqual(actions, ["begin", "rollback", "release"]);
        assert.equal((await readdir(root,{recursive:true,withFileTypes:true})).filter(d=>d.isFile()).length,0);
        if (mode.endsWith("foreign")) assert.deepEqual(writes, []);
        return;
      }
      const capture = fenced ? {...input, taskFence:{accountId:owner,leaseToken:"fixture-lease"}} : input;
      if (mode.endsWith("_denied") || mode.endsWith("_old_events")) {
        await assert.rejects(repo.persist(capture), mode.endsWith("_denied")
          ? {code:"evidence_scope_or_task_invalid"} : {message:"account_evidence_inherited_scope_required:evidence_data_events"});
        assert.deepEqual(actions, ["begin","rollback","release"]);
        assert.equal((await readdir(root,{recursive:true,withFileTypes:true})).filter(d=>d.isFile()).length,0);
        if (mode.endsWith("_denied")) assert.deepEqual(writes, []);
        return;
      }
      const result = await repo.persist(capture);
      assert.equal(result.deduplicated, reuse);
      if (fenced) assert.match(writes.find(w=>w[0]==="evidence_data_operations")[2][3], /^evidence-account-v1:[a-f0-9]{64}$/);
      if (reuse) assert.deepEqual([result.evidence_id,result.normalized_record_id], [id(10),id(11)]);
      const expected = reuse ? ["collection_task_evidence_links","evidence_data_events","evidence_data_outbox"] :
        ["file_assets","raw_evidence","normalized_records","field_provenance","collection_task_evidence_links","evidence_data_events","evidence_data_outbox"];
      assert.deepEqual(entries.sort(), expected.map(t => [t,writes.find(w=>w[0]===t)[1],owner,reason]).sort());
      assert.equal(writes.find(w=>w[0]==="evidence_data_events")[2][4],input.actorId);
      assert.deepEqual(actions, ["begin", "commit", "release"]);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
}
