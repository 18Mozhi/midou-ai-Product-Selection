import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluateQualityMetric,
  normalizeCanonicalUrl,
  sha256,
  validateEvidenceInput,
} from "../../packages/data-quality/dist/index.js";
import { writeScopedFile } from "../../packages/storage/dist/index.js";
import { DataQualityService } from "../../apps/api/dist/data-quality-service.js";
import { buildApp } from "../../apps/api/dist/app.js";
const ids = {
  actor: "00000000-0000-4000-8000-000000000601",
  org: "00000000-0000-4000-8000-000000000602",
  ws: "00000000-0000-4000-8000-000000000603",
  evidence: "00000000-0000-4000-8000-000000000604",
  issue: "00000000-0000-4000-8000-000000000605",
};
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
      issueDownload: async () => ({ grant: "signed", expires_at: "2026-08-07T00:02:00Z" }),
      download: async () => ({
        content: Buffer.from("ok"),
        contentType: "text/plain",
        sha256: sha256("ok"),
      }),
    },
    authorization = { authorize: async (value) => calls.push(value) },
    auth = { authenticate: async () => ({ user: { id: ids.actor } }) },
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
