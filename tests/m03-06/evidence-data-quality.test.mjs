import test from "node:test";
import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluateQualityMetric,
  normalizeCanonicalUrl,
  sha256,
  validateEvidenceInput,
} from "../../packages/data-quality/dist/index.js";
import {
  issueAccountEvidenceDownloadGrant,
  verifyAccountEvidenceDownloadGrant,
  writeScopedFile,
} from "../../packages/storage/dist/index.js";
import { DataQualityService } from "../../apps/api/dist/data-quality-service.js";
import { MySqlDataQualityRepository } from "../../apps/api/dist/mysql-data-quality-repository.js";
import { buildApp } from "../../apps/api/dist/app.js";
const ids = {
  actor: "00000000-0000-4000-8000-000000000601",
  org: "00000000-0000-4000-8000-000000000602",
  ws: "00000000-0000-4000-8000-000000000603",
  evidence: "00000000-0000-4000-8000-000000000604",
  issue: "00000000-0000-4000-8000-000000000605",
  topic: "00000000-0000-4000-8000-000000000606",
  signal: "00000000-0000-4000-8000-000000000607",
};
test("platform reconciliation filters keep their contract after the legacy scope columns are removed", async () => {
  const calls = [];
  const pool = { async query(sql, args = []) {
    calls.push([sql, args]);
    if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
    return [sql.includes("historical_assignee_membership_id") && sql.startsWith("SHOW COLUMNS") ?
      [{Field:"historical_assignee_membership_id"},{Field:"assigned_account_id"}] :
      sql.startsWith("SHOW COLUMNS") ? [{ Field: "historical_context" }] : []];
  } };
  const repo = new MySqlDataQualityRepository(pool, true);
  const result = await repo.dashboard({ organizationId: ids.org, workspaceId: ids.ws, page: 1, pageSize: 10 });
  assert.equal(result.membershipAssignmentAvailable, false);
  assert.deepEqual(result.memberOptions, []);
  const [sql, args] = calls.find(([query]) => query.includes("FROM reconciliation_runs r JOIN providers"));
  assert.doesNotMatch(sql, /r\.(organization_id|workspace_id)/);
  assert.match(sql, /WHERE CONVERT\(JSON_UNQUOTE\(JSON_EXTRACT\(r.historical_context,'\$\.organization_id'\)\) USING ascii\)=\?/);
  assert.deepEqual(args, [ids.org, ids.ws]);
  const [issueQuery, issueArgs] = calls.find(([query]) => query.includes("FROM data_quality_issues i JOIN providers"));
  assert.doesNotMatch(issueQuery, /i\.(organization_id|workspace_id)/);
  assert.match(issueQuery, /JSON_EXTRACT\(i.historical_context/);
  assert.deepEqual(issueArgs, [ids.org, ids.ws, 10, 0]);
  assert.match(issueQuery,/LEFT JOIN users u ON u.id=i.assigned_account_id/);
  for (const [sql, params] of calls.filter(([query]) => query.includes("FROM raw_evidence e"))) {
    assert.match(sql, /JOIN collection_tasks et ON et\.id=e\.collection_task_id/);
    assert.match(sql, /WHERE et\.organization_id=\? AND et\.workspace_id=\?/);
    assert.doesNotMatch(sql, /e\.(organization_id|workspace_id)/);
    assert.deepEqual(params.slice(0, 2), [ids.org, ids.ws]);
  }
  assert.ok(calls.every(([sql])=>! /FROM memberships|JOIN memberships/.test(sql)));
});
test("0192 evidence detail, download metadata, owner and audit do not read removed columns", async () => {
  const calls = [];
  const now = new Date("2026-10-15T12:00:00Z");
  let allowNative = true, rollbacks = 0;
  const row = { id: ids.evidence, organization_id: ids.org, workspace_id: ids.ws,
    captured_at: now, retention_until: now, status: "active", account_id: ids.actor, reason: "shared" };
  const db = {
    async beginTransaction() {}, async commit() {}, async rollback() { rollbacks++; }, release() {},
    async query(sql, args) {
      calls.push([sql, args]);
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"account_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM file_assets")) return [[{Field:"account_id"},{Field:"historical_context"}]];
      if (sql.startsWith("SHOW COLUMNS FROM data_quality_issues")) return [sql.includes("assigned_account_id")
        ? [{Field:"assigned_account_id"},{Field:"historical_assignee_membership_id"}] : [{Field:"historical_context"}]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.includes("FROM raw_evidence e")) {
        assert.match(sql, /JOIN collection_tasks et ON et\.id=e\.collection_task_id AND et\.account_id=e\.account_id/);
        assert.match(sql, /sealed_task\.run_id=cut\.source_run_id/);
        assert.doesNotMatch(sql, /(?:e|et)\.(organization_id|workspace_id)/);
        return [allowNative ? [row] : []];
      }
      if (sql.startsWith("INSERT INTO evidence_data_events")) {
        assert.ok(args.includes(ids.evidence));
        assert.ok(args.includes(ids.actor));
      }
      if (sql.startsWith("INSERT INTO account_owned_records")) {
        assert.deepEqual(args.slice(1),[ids.actor,"shared"]);
        assert.equal(calls.at(-2)[1][0],args[0]);
      }
      return [[]];
    },
  };
  const repo = new MySqlDataQualityRepository({...db, getConnection: async () => db}, true);
  assert.equal((await repo.evidenceDetail(ids.evidence)).evidence.workspace_id, ids.ws);
  const [normalized] = calls.find(([sql]) => sql.includes("FROM normalized_records") && sql.includes("record_version DESC"));
  const [field] = calls.find(([sql]) => sql.includes("FROM field_provenance f"));
  for (const sql of [normalized, field]) {
    assert.match(sql, /source_table='normalized_records'/);
    assert.match(sql, /child\.account_id=n\.account_id/);
    assert.match(sql, /child\.account_id=cut\.primary_account_id/);
    assert.match(sql, /x\.account_id=n\.account_id AND x\.provider_id=n\.provider_id/);
  }
  assert.match(field, /source_table='field_provenance'/);
  assert.equal((await repo.fileInfo(ids.evidence)).organization_id, ids.org);
  assert.equal(await repo.accountEvidenceOwner(ids.evidence, ids.issue), ids.actor);
  const binding={accountId:ids.actor,assetId:ids.issue,relativePath:"accounts/fixture/content.bin",sizeBytes:8,sha256:"f".repeat(64)};
  const input = { evidenceId: ids.evidence, actorId: ids.actor, requestId:"r", traceId:"t", now, binding };
  const result = {grant:"fixture", expires_at:now.toISOString()};
  assert.deepEqual(await repo.saveDownloadGrant({...input, idempotencyKey:"key", result}), result);
  await repo.recordDownload(input);
  assert.equal(calls.filter(([sql]) => sql.startsWith("INSERT INTO evidence_data_events")).length, 2);
  const [ownerSql] = calls.find(([sql]) => sql.startsWith("SELECT fo.account_id"));
  assert.match(ownerSql, /f\.account_id=fo\.account_id/);
  assert.match(ownerSql, /f\.size_bytes=e\.size_bytes AND f\.content_sha256=e\.content_sha256/);
  assert.equal(calls.filter(([sql])=>sql.startsWith("INSERT INTO account_owned_records")).length,2);
  allowNative=false;
  const beforeRejectedDetail = calls.length;
  assert.equal(await repo.evidenceDetail(ids.evidence), null);
  assert.ok(calls.slice(beforeRejectedDetail).every(([sql]) => !/FROM (normalized_records|field_provenance|data_quality_issues i)/.test(sql)));
  assert.equal(await repo.fileInfo(ids.evidence),null);
  await assert.rejects(repo.saveDownloadGrant({...input,idempotencyKey:"key",result}),{code:"evidence_not_found"});
  await assert.rejects(repo.recordDownload(input),{code:"evidence_not_found"});
  assert.equal(rollbacks,2);
  assert.equal(calls.filter(([sql])=>sql.startsWith("INSERT INTO evidence_data_events")).length,2);
  allowNative=true;
  await assert.rejects(repo.recordDownload({...input,binding:undefined}),{code:"evidence_not_found"});
  const [locked, bound] = calls.find(([sql,args])=>sql.includes("FROM raw_evidence e")&&args?.includes(binding.relativePath));
  assert.match(locked,/f\.id=\?.*BINARY f\.relative_path=BINARY \?.*f\.size_bytes=\?.*f\.content_sha256=\?.*e\.account_id=\?.*FOR UPDATE/s);
  assert.deepEqual(bound,[ids.evidence,ids.issue,binding.relativePath,8,binding.sha256,ids.actor]);
});

test("migrated quality issues do not accept new legacy membership assignments", async () => {
  const calls=[];
  const c={ async beginTransaction(){}, async rollback(){calls.push("rollback");}, release(){},
    async query(sql){
      calls.push(sql);
      if (sql.startsWith("SHOW COLUMNS")) return [sql.includes("assigned_account_id")
        ? [{Field:"assigned_account_id"},{Field:"historical_assignee_membership_id"}]
        : [{Field:"historical_context"}]];
      return [[]];
    } };
  const repo=new MySqlDataQualityRepository({getConnection:async()=>c},true);
  await assert.rejects(()=>repo.batchIssues({items:[{id:ids.issue,expectedVersion:1}],action:"assign",
    actorId:ids.actor,assigneeMembershipId:ids.actor,idempotencyKey:"fixture",requestId:"r",traceId:"t"}),
    {code:"quality_issue_assignee_scope_retired"});
  assert.ok(calls.every(sql=>! /FROM memberships|JOIN memberships|^(UPDATE|INSERT)/.test(sql)));
  assert.equal(calls.at(-1),"rollback");
});
test("trend quality issue writes historical coordinates and keeps raw evidence and outbox links", async () => {
  const calls = [];
  const now = new Date("2026-10-15T12:00:00Z");
  const connection = {
    beginTransaction: async () => calls.push(["BEGIN"]),
    commit: async () => calls.push(["COMMIT"]),
    rollback: async () => calls.push(["ROLLBACK"]),
    release: () => calls.push(["RELEASE"]),
    async query(sql, params = []) {
      calls.push([sql, params]);
      if (sql.startsWith("SHOW COLUMNS FROM data_quality_issues"))
        return [[{ Field: sql.includes("assigned_account_id") ? "assigned_membership_id" : "historical_context" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.includes("FROM trend_signals s")) return [[{
        organization_id: ids.org, workspace_id: ids.ws, provider_id: ids.actor, provider_name: "fixture",
        raw_evidence_id: ids.evidence, normalized_record_id: ids.signal, parser_version: "fixture-v1",
      }]];
      if (sql.trimStart().startsWith("INSERT")) assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      return [[]];
    },
  };
  const repo = new MySqlDataQualityRepository({ getConnection: async () => connection }, true);
  const result = await repo.createFromTrendEvidence({
    organizationId: ids.org, workspaceId: ids.ws, topicId: ids.topic, evidenceId: ids.signal,
    actorId: ids.actor, severity: "critical", reason: "fixture anomaly", idempotencyKey: "fixture",
    requestId: "fixture-request", traceId: "fixture-trace", now,
  });
  assert.equal(result.created, true);
  assert.equal(result.issue.raw_evidence_id, ids.evidence);
  assert.equal(result.issue.organization_id, ids.org);
  const [insert, params] = calls.find(([sql]) => sql.startsWith("INSERT INTO data_quality_issues"));
  assert.match(insert, /\(id,historical_context,provider_id/);
  assert.deepEqual(JSON.parse(params[1]), { organization_id: ids.org, workspace_id: ids.ws });
  for (const table of ["evidence_data_events", "evidence_data_outbox"]) {
    const [, args] = calls.find(([sql]) => sql.startsWith("INSERT INTO " + table));
    assert.ok(args.includes(result.issue.id));
  }
  assert.deepEqual(calls.slice(-2).map(([sql]) => sql), ["COMMIT", "RELEASE"]);
});

test("account evidence grants require the original asset, owner, evidence and a strong key", () => {
  const scope = { account_id: ids.actor, asset_id: ids.issue, evidence_id: ids.evidence };
  const key = Buffer.alloc(32, 4);
  const token = issueAccountEvidenceDownloadGrant(scope, key, 120, 500);
  assert.doesNotThrow(() => verifyAccountEvidenceDownloadGrant(token, key, scope, 501));
  for (const field of Object.keys(scope)) {
    assert.throws(
      () => verifyAccountEvidenceDownloadGrant(token, key, { ...scope, [field]: ids.topic }, 501),
      { code: "invalid_grant" },
    );
  }
  assert.throws(() => verifyAccountEvidenceDownloadGrant(token, key, scope, 621), {
    code: "invalid_grant",
  });
  assert.throws(() => verifyAccountEvidenceDownloadGrant(token, Buffer.alloc(8), scope, 501), {
    code: "invalid_grant",
  });
});
for (const historical of [false,true]) test(`account evidence returns verified original bytes after audit (historical=${historical})`, async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-account-evidence-"));
  try {
    const evidenceRoot = await realpath(root);
    const nativePath=`accounts/${ids.actor}/evidence/${ids.issue}/content.bin`;
    const historicalPath=`organizations/${ids.org}/workspaces/${ids.ws}/evidence/${ids.evidence}/${ids.evidence}.bin`;
    const file = { id:ids.evidence, asset_id:ids.issue, organization_id:ids.org, workspace_id:ids.ws,
      relative_path:historical ? historicalPath : nativePath, content_type:"text/plain", status:"active" };
    const content = Buffer.from("original");
    file.size_bytes=content.length;
    file.content_sha256=sha256(content);
    const path=join(evidenceRoot,file.relative_path), other=join(evidenceRoot,"extra-link");
    await mkdir(join(path,".."),{recursive:true});
    await writeFile(path,content);
    const records=[];
    let conflict=false, owner=ids.actor;
    const repo={async fileInfo(){return file},async accountEvidenceOwner(){return owner},
      async saveDownloadGrant(input){ records.push(input.binding); return input.result; },
      async recordDownload(input){ if(conflict) throw new Error("file_binding_changed"); records.push(input.binding); }};
    const now=new Date("2026-10-15T00:00:00Z");
    const service=new DataQualityService(repo,{evidenceRoot,accountReadRehearsal:true,downloadSigningKey:"k".repeat(32),downloadGrantSeconds:120},()=>now);
    const context={actorId:ids.actor,requestId:"r",traceId:"t",idempotencyKey:"grant"};
    const {grant}=await service.issueDownload(ids.evidence,context);
    const actual=await service.download(ids.evidence,grant,context);
    assert.deepEqual(actual.content,content);
    assert.deepEqual(records,[{accountId:ids.actor,assetId:ids.issue,relativePath:file.relative_path,sizeBytes:8,sha256:file.content_sha256},records[0]]);
    owner=null;
    await assert.rejects(service.issueDownload(ids.evidence,context),{code:"evidence_not_found"});
    await assert.rejects(service.download(ids.evidence,grant,context),{code:"evidence_not_found"});
    owner=ids.actor;
    file.relative_path=historical ? nativePath : historicalPath;
    await assert.rejects(service.download(ids.evidence,grant,context),{code:"evidence_download_grant_invalid"});
    file.relative_path=historical ? historicalPath : nativePath;
    await link(path,other);
    await assert.rejects(service.download(ids.evidence,grant,context),{code:"evidence_integrity_failed"});
    await unlink(other);
    await writeFile(path,"tampered");
    await assert.rejects(service.download(ids.evidence,grant,context),{code:"evidence_integrity_failed"});
    await writeFile(path,content);
    conflict=true;
    await assert.rejects(service.download(ids.evidence,grant,context),/file_binding_changed/);
    assert.equal(records.length,2);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("M03-06.A03 scopes evidence operation idempotency by tenant and provider", async () => {
  const { evidenceOperationIdempotencyKey } =
      await import("../../apps/worker/dist/evidence-persistence.js"),
    base = {
      organizationId: ids.org,
      workspaceId: ids.ws,
      providerId: ids.actor,
      dedupeKey: "shared-external-id",
    },
    same = evidenceOperationIdempotencyKey(base),
    replay = evidenceOperationIdempotencyKey(base),
    otherProvider = evidenceOperationIdempotencyKey({
      ...base,
      providerId: "00000000-0000-4000-8000-000000000699",
    }),
    otherWorkspace = evidenceOperationIdempotencyKey({
      ...base,
      workspaceId: "00000000-0000-4000-8000-000000000698",
    });
  assert.equal(same, replay);
  assert.notEqual(same, otherProvider);
  assert.notEqual(same, otherWorkspace);
  assert.match(same, /^evidence-v2:[a-f0-9]{64}$/);
  assert.ok(same.length <= 255);
});
test("M03-06.A01/A02/A12 validates evidence boundaries, canonical URL, hashes and frozen thresholds", () => {
  assert.equal(
    normalizeCanonicalUrl("HTTPS://Example.COM/path?q=1"),
    "https://example.com/path?q=1",
  );
  assert.throws(
    () => normalizeCanonicalUrl("https://user:pass@example.com/#x"),
    /canonical_url_invalid/,
  );
  assert.equal(sha256(Buffer.from("evidence")).length, 64);
  const input = {
    organizationId: ids.org,
    workspaceId: ids.ws,
    taskId: ids.evidence,
    subqueryId: ids.issue,
    providerId: ids.actor,
    sourceUrl: "https://example.test/raw",
    canonicalUrl: "https://example.test/item/1",
    dedupeKey: "item-1:2026-08-07",
    contentType: "application/json",
    content: Buffer.from("{}"),
    capturedAt: new Date(),
    parserVersion: "parser-v1",
    adapterVersion: "adapter-v1",
    recordKey: "item-1",
    recordSchemaVersion: "v1",
    normalizedPayload: { title: "Desk" },
    provenance: [
      {
        fieldPath: "title",
        sourcePath: "$.title",
        transformVersion: "copy-v1",
        sourceValueHash: sha256("Desk"),
      },
    ],
    requestId: "request-1",
    traceId: "trace-1",
    actorId: ids.actor,
  };
  assert.equal(validateEvidenceInput(input, 1024).contentHash, sha256("{}"));
  const browserLocator = 'a[data-tracker="offer"][href*="offerId="] @href query:offerId';
  assert.equal(
    validateEvidenceInput(
      {
        ...input,
        provenance: [{ ...input.provenance[0], sourcePath: browserLocator }],
      },
      1024,
    ).provenance[0].sourcePath,
    browserLocator,
  );
  for (const sourcePath of ["selector\nscript", "选择器", "x".repeat(201)])
    assert.throws(
      () =>
        validateEvidenceInput(
          { ...input, provenance: [{ ...input.provenance[0], sourcePath }] },
          1024,
        ),
      /field_provenance_invalid/,
    );
  assert.throws(
    () => validateEvidenceInput({ ...input, content: Buffer.alloc(1025) }, 1024),
    /evidence_content_size_invalid/,
  );
  assert.equal(evaluateQualityMetric("title_accuracy", 98, 100).status, "passed");
  assert.equal(evaluateQualityMetric("duplicate_ratio", 3, 100).status, "failed");
  assert.equal(evaluateQualityMetric("source_success_rate", 18, 19).status, "insufficient_sample");
});
test("M03-06.A06/A09/A13 platform API enforces capability, origin, idempotency and controlled binary response", async () => {
  const calls = [],
    repository = {
      dashboard: async () => ({
        evidence: [],
        issues: [],
        reconciliationRuns: [],
        totalEvidence: 0,
        totalIssues: 0,
      }),
      evidenceDetail: async () => ({ evidence: { id: ids.evidence } }),
      resolveIssue: async (input) => (calls.push(input), { id: ids.issue }),
      fileInfo: async () => null,
      recordDownload: async () => {},
    },
    service = {
      dashboard: (...v) => repository.dashboard(...v),
      detail: (...v) => repository.evidenceDetail(...v),
      resolveIssue: async (...v) => (calls.push(v), { id: ids.issue }),
      batchIssues: async (...v) => (calls.push(v), [{ id: ids.issue }]),
      createFromTrendEvidence: async (...v) => (
        calls.push(v),
        { issue: { id: ids.issue }, created: true }
      ),
      issueDownload: async () => ({ grant: "signed", expires_at: "2026-08-07T00:02:00Z" }),
      download: async () => ({
        content: Buffer.from("ok"),
        contentType: "text/plain",
        sha256: sha256("ok"),
      }),
    },
    authorization = {
      authorize: async (value) => calls.push(value),
      resolveSession: async () => ({
        context: { organization_id: ids.org, workspace_id: ids.ws },
      }),
    },
    auth = { authenticate: async () => ({ user: { id: ids.actor }, session: { id: "session" } }) },
    app = buildApp({
      dataQuality: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/data-quality",
    headers: { cookie: "scoutops_session=x", "x-request-id": "dq-read", "x-trace-id": "dq-trace" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(calls[0], {
    actorId: ids.actor,
    capability: "platform:operate",
    surface: "api",
    requestId: "dq-read",
    traceId: "dq-trace",
  });
  response = await app.inject({
    method: "POST",
    url: `/api/v1/trends/${ids.topic}/evidence/${ids.signal}/quality-issues`,
    headers: {
      cookie: "scoutops_session=x",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "trend-quality-1",
    },
    payload: { severity: "critical", reason: "页面字段与原始证据不一致" },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.issue.id, ids.issue);
  assert.ok(
    calls.some(
      (value) =>
        value?.capability === "trend:manage" &&
        value.organizationId === ids.org &&
        value.workspaceId === ids.ws,
    ),
  );
  response = await app.inject({
    method: "POST",
    url: `/api/v1/platform/data/evidence/${ids.evidence}/download-grant`,
    headers: {
      cookie: "scoutops_session=x",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "grant-1",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/platform/data-quality/issues/${ids.issue}/resolve`,
        headers: {
          cookie: "scoutops_session=x",
          origin: "https://evil.test",
          "idempotency-key": "x",
        },
        payload: { reason: "已修复", expected_version: 1 },
      })
    ).statusCode,
    403,
  );
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/data-quality/issues/batch",
    headers: {
      cookie: "scoutops_session=x",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "batch-1",
    },
    payload: {
      items: [{ id: ids.issue, expected_version: 1 }],
      action: "attribute",
      reason: "解析字段漂移",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/platform/data-quality/issues/${ids.issue}/resolve`,
        headers: { cookie: "scoutops_session=x", origin: "http://127.0.0.1:5173" },
        payload: { reason: "已修复", expected_version: 1 },
      })
    ).statusCode,
    400,
  );
  response = await app.inject({
    method: "GET",
    url: `/api/v1/platform/data/evidence/${ids.evidence}/download?grant=signed`,
    headers: { cookie: "scoutops_session=x" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-content-sha256"], sha256("ok"));
  await app.close();
});
test("trend evidence anomaly validates scope and reuses the data-quality workflow", async () => {
  const calls = [],
    service = new DataQualityService(
      {
        createFromTrendEvidence: async (input) => (
          calls.push(input),
          { issue: { id: ids.issue }, created: true }
        ),
      },
      { evidenceRoot: "", downloadSigningKey: "", downloadGrantSeconds: 120 },
      () => new Date("2026-08-22T00:00:00.000Z"),
    ),
    context = {
      organizationId: ids.org,
      workspaceId: ids.ws,
      actorId: ids.actor,
      idempotencyKey: "trend-quality-1",
      requestId: "request-trend-quality",
      traceId: "trace-trend-quality",
    };
  const result = await service.createFromTrendEvidence(
    ids.topic,
    ids.signal,
    { severity: "warning", reason: " 标题解析异常 " },
    context,
  );
  assert.equal(result.created, true);
  assert.equal(calls[0].reason, "标题解析异常");
  assert.equal(calls[0].now.toISOString(), "2026-08-22T00:00:00.000Z");
  await assert.rejects(
    () =>
      service.createFromTrendEvidence(
        ids.topic,
        ids.signal,
        { severity: "low", reason: "错误等级" },
        context,
      ),
    /trend_evidence_issue_invalid/,
  );
});
test("M03-06.A09/A16 short download grants are scoped, idempotent and content integrity is verified", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-m03-06-unit-")),
    signing = "x".repeat(32),
    content = Buffer.from("immutable evidence"),
    relative = `organizations/${ids.org}/workspaces/${ids.ws}/evidence/${ids.evidence}/${ids.evidence}.bin`,
    events = [],
    operations = new Map();
  try {
    await writeScopedFile(
      root,
      {
        organization_id: ids.org,
        workspace_id: ids.ws,
        category: "evidence",
        resource_id: ids.evidence,
        filename: `${ids.evidence}.bin`,
      },
      content,
    );
    const repository = {
      dashboard: async () => ({
        evidence: [],
        issues: [],
        reconciliationRuns: [],
        totalEvidence: 0,
        totalIssues: 0,
      }),
      evidenceDetail: async () => null,
      resolveIssue: async () => {
        throw new Error("unused");
      },
      fileInfo: async () => ({
        id: ids.evidence,
        organization_id: ids.org,
        workspace_id: ids.ws,
        relative_path: relative,
        content_sha256: sha256(content),
        content_type: "application/json",
        size_bytes: content.length,
        status: "active",
      }),
      saveDownloadGrant: async (input) => {
        if (operations.has(input.idempotencyKey)) return operations.get(input.idempotencyKey);
        operations.set(input.idempotencyKey, input.result);
        events.push("evidence.download.granted");
        return input.result;
      },
      recordDownload: async () => events.push("evidence.download.accessed"),
    };
    const service = new DataQualityService(
        repository,
        { evidenceRoot: root, downloadSigningKey: signing, downloadGrantSeconds: 120 },
        () => new Date("2026-08-07T00:00:00Z"),
      ),
      context = { actorId: ids.actor, idempotencyKey: "grant-1", requestId: "r", traceId: "t" },
      grant = await service.issueDownload(ids.evidence, context),
      replay = await service.issueDownload(ids.evidence, context),
      download = await service.download(ids.evidence, grant.grant, context);
    assert.deepEqual(replay, grant);
    assert.deepEqual(download.content, content);
    assert.deepEqual(events, ["evidence.download.granted", "evidence.download.accessed"]);
    await assert.rejects(
      () => service.download(ids.evidence, `${grant.grant}x`, context),
      (error) => error.code === "evidence_download_grant_invalid",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("M03-06.A03-A05/A07-A11/A14-A17 delivery evidence is complete and Baota bounded", async () => {
  const paths = [
    "database/migrations/0016f_evidence_quality_m03_06.up.sql",
    "database/migrations/0016f_evidence_quality_m03_06.down.sql",
    "database/migrations/0057_data_quality_issue_workflow.up.sql",
    "packages/data-quality/src/index.ts",
    "apps/worker/src/evidence-persistence.ts",
    "apps/api/src/mysql-data-quality-repository.ts",
    "apps/api/src/data-quality-routes.ts",
    "apps/web/src/components/DataQualityCenter.vue",
    "apps/web/src/data-quality.css",
    "docs/openapi.yaml",
    "config/env.example",
    "config/schema.json",
    "docs/architecture/m03-06-evidence-data-quality.md",
    "docs/runbooks/m03-06-evidence-data-quality.md",
    "docs/feature-map.json",
    "tests/e2e/m03-06-evidence-data-quality.spec.ts",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      workflow,
      domain,
      worker,
      repo,
      routes,
      web,
      css,
      openapi,
      env,
      schema,
      architecture,
      runbook,
      feature,
      e2e,
      blueprint,
    ] = values;
  for (const table of [
    "raw_evidence",
    "normalized_records",
    "field_provenance",
    "reconciliation_runs",
    "data_quality_issues",
    "evidence_data_events",
    "evidence_data_outbox",
    "evidence_data_operations",
  ])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.match(down, /DROP TABLE IF EXISTS `raw_evidence`/);
  assert.match(workflow, /assigned_membership_id/);
  assert.match(domain, /QUALITY_THRESHOLDS/);
  assert.match(worker, /writeScopedFile/);
  assert.match(repo, /FOR UPDATE/);
  assert.match(routes, /platform:operate/);
  assert.match(web, /loading.*ready.*empty.*error.*expired.*forbidden.*blocked/);
  assert.match(web, /批量处理开放问题/);
  assert.match(web, /查看关联证据/);
  assert.match(web, /selectedRunId[\s\S]*查看异常字段与样本[\s\S]*字段溯源/);
  assert.match(web, /retentionRisks[\s\S]*即将到期[\s\S]*retentionStatus/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(openapi, /\/platform\/data-quality:/);
  assert.match(env, /EVIDENCE_DOWNLOAD_SIGNING_KEY/);
  assert.match(schema, /EVIDENCE_MAX_RAW_BYTES/);
  assert.match(architecture, /M03-07/);
  assert.match(runbook, /宝塔.*Node Worker/s);
  assert.match(feature, /evidenceDataQuality/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(blueprint, /M03-06/);
});
test("采集质量分别展示准确率、重复率和新鲜度且不伪造总分", async () => {
  const web = await readFile("apps/web/src/components/DataQualityCenter.vue", "utf8");
  for (const code of [
    "title_accuracy",
    "price_accuracy",
    "currency_accuracy",
    "external_id_accuracy",
    "canonical_url_accuracy",
    "duplicate_ratio",
    "source_freshness",
  ])
    assert.match(web, new RegExp(code));
  assert.match(web, /采集质量指标/);
  assert.match(web, /暂无核对数据/);
  assert.match(web, /样本不足/);
  assert.doesNotMatch(web, /总准确率/);
});
