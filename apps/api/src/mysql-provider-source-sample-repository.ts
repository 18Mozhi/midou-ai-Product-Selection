import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  ALIBABA_1688_BROWSER_PARSER_VERSION,
  ALIBABA_1688_SNAPSHOT_SCHEMAS,
  parse1688OfferDetailSnapshot,
  parse1688SearchSnapshot,
} from "@scoutops/provider-sources";
import type {
  ParserSample,
  ParserSampleReplay,
  Provider1688Acceptance,
  ProviderSourceRepository,
} from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import { iso } from "./mysql-provider-source-repository-shared.js";

const parserSample = (row: RowDataPacket, actorId = ""): ParserSample => ({
  id: String(row.id),
  provider_id: String(row.provider_id),
  browser_job_id: String(row.browser_job_id),
  name: String(row.name),
  baseline_parser_version: String(row.baseline_parser_version),
  last_replay_status: row.last_replay_status,
  last_replay_at: row.last_replay_at == null ? null : iso(row.last_replay_at),
  review_status: row.review_status ?? "pending",
  reviewed_by: row.reviewed_by == null ? null : String(row.reviewed_by),
  review_reason: row.review_reason == null ? null : String(row.review_reason),
  reviewed_at: row.reviewed_at == null ? null : iso(row.reviewed_at),
  review_version: Number(row.review_version ?? 1),
  created_by: String(row.created_by ?? ""),
  can_review:
    (row.review_status ?? "pending") === "pending" && String(row.created_by ?? "") !== actorId,
  created_at: iso(row.created_at),
});
const parserReplay = (row: RowDataPacket): ParserSampleReplay => ({
  id: String(row.id),
  sample_id: String(row.sample_id),
  provider_id: String(row.provider_id),
  parser_version: String(row.parser_version),
  status: row.status,
  diff: typeof row.diff_json === "string" ? JSON.parse(row.diff_json) : row.diff_json,
  error_code: row.error_code == null ? null : String(row.error_code),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
  created_at: iso(row.created_at),
});
const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
const coverageMatrix = (
  row: RowDataPacket | undefined,
  parserVersion: string,
): Provider1688Acceptance["coverage_matrix"] => {
  const rows: Provider1688Acceptance["coverage_matrix"]["rows"] = [],
    observedAt = row?.finished_at == null ? null : iso(row.finished_at);
  if (!row)
    return {
      parser_version: parserVersion,
      observed_at: null,
      rows: [
        {
          key: "search",
          contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证搜索覆盖。",
        },
        {
          key: "detail",
          contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证详情覆盖。",
        },
        {
          key: "pagination",
          contract: "browser-plan-pagination-v1",
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证翻页覆盖。",
        },
      ],
    };
  let execution: Record<string, unknown> = {},
    result: Record<string, unknown> = {},
    snapshots: Record<string, unknown> = {};
  try {
    execution = (json(row?.execution_request_json) ?? {}) as Record<string, unknown>;
    result = (json(row?.result_json) ?? {}) as Record<string, unknown>;
    const rawSnapshots = result.snapshots;
    if (rawSnapshots != null && (typeof rawSnapshots !== "object" || Array.isArray(rawSnapshots)))
      throw new Error("browser_snapshots_invalid");
    snapshots = (rawSnapshots ?? {}) as Record<string, unknown>;
  } catch {
    return {
      parser_version: parserVersion,
      observed_at: observedAt,
      rows: [
        {
          key: "search",
          contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
          state: "invalid",
          observed_count: 0,
          reason: "最近浏览器作业的结构化结果无法读取。",
        },
        {
          key: "detail",
          contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
          state: "invalid",
          observed_count: 0,
          reason: "最近浏览器作业的结构化结果无法读取。",
        },
        {
          key: "pagination",
          contract: "browser-plan-pagination-v1",
          state: "invalid",
          observed_count: 0,
          reason: "最近浏览器作业的执行计划无法读取。",
        },
      ],
    };
  }
  if (snapshots.search === undefined)
    rows.push({
      key: "search",
      contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
      state: "not_observed",
      observed_count: 0,
      reason: "最近作业没有搜索快照。",
    });
  else
    try {
      const records = parse1688SearchSnapshot(snapshots.search, 100);
      rows.push({
        key: "search",
        contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
        state: "covered",
        observed_count: records.length,
        reason: `搜索快照通过当前合同，共 ${records.length} 条。`,
      });
    } catch {
      rows.push({
        key: "search",
        contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
        state: "invalid",
        observed_count: 0,
        reason: "搜索快照未通过当前合同。",
      });
    }
  const details = snapshots.offer_details;
  if (!Array.isArray(details) || !details.length)
    rows.push({
      key: "detail",
      contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
      state: "not_observed",
      observed_count: 0,
      reason: "最近作业没有商品详情快照。",
    });
  else
    try {
      for (const detail of details) parse1688OfferDetailSnapshot(detail);
      rows.push({
        key: "detail",
        contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
        state: "covered",
        observed_count: details.length,
        reason: `商品详情快照全部通过当前合同，共 ${details.length} 条。`,
      });
    } catch {
      rows.push({
        key: "detail",
        contract: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
        state: "invalid",
        observed_count: details.length,
        reason: "至少一条商品详情快照未通过当前合同。",
      });
    }
  const plan = (execution.plan ?? {}) as Record<string, unknown>,
    plannedPages = Number(plan.max_pages),
    observedPages = Number(row?.page_count ?? 0);
  rows.push(
    !Number.isSafeInteger(plannedPages) || plannedPages < 1
      ? {
          key: "pagination",
          contract: "browser-plan-pagination-v1",
          state: "invalid",
          observed_count: observedPages,
          reason: "最近作业没有有效的分页上限。",
        }
      : plannedPages === 1
        ? {
            key: "pagination",
            contract: "browser-plan-pagination-v1",
            state: "not_exercised",
            observed_count: observedPages,
            reason: "执行计划只允许 1 页，本次未演练翻页。",
          }
        : observedPages > 1
          ? {
              key: "pagination",
              contract: "browser-plan-pagination-v1",
              state: "covered",
              observed_count: observedPages,
              reason: `计划最多 ${plannedPages} 页，实际完成 ${observedPages} 页。`,
            }
          : {
              key: "pagination",
              contract: "browser-plan-pagination-v1",
              state: "not_observed",
              observed_count: observedPages,
              reason: `计划最多 ${plannedPages} 页，但未观测到翻页结果。`,
            },
  );
  return { parser_version: parserVersion, observed_at: observedAt, rows };
};

export class MySqlProviderSourceSampleRepository {
  constructor(private readonly pool: Pool) {}
  async read1688Acceptance(now: Date): Promise<Provider1688Acceptance> {
    const [providers] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,status,owner_label,parser_version FROM providers WHERE code='1688_search' LIMIT 1",
      ),
      provider = providers[0];
    if (!provider)
      throw new ProviderSourceServiceError(
        "provider_source_not_provisioned",
        409,
        "先在来源目录登记 1688 来源，并明确负责人。",
      );
    const [[[profile]], [[latestRun]], [[parser]], [[latestJob]]] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) active_count,MAX(cp.updated_at) evidence_at FROM crawler_profiles cp JOIN credential_assets ca ON ca.id=cp.credential_asset_id AND ca.provider_id=cp.provider_id WHERE cp.provider_id=? AND cp.status='active' AND ca.status='active' AND (ca.expires_at IS NULL OR ca.expires_at>?)",
          [provider.id, now],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT status,error_code,started_at,finished_at FROM crawler_browser_runs WHERE provider_id=? ORDER BY started_at DESC,id DESC LIMIT 1",
          [provider.id],
        ),
        this.pool.query<RowDataPacket[]>(
          [
            "SELECT s.last_replay_status,s.last_replay_at,s.baseline_parser_version,s.review_status,",
            "r.parser_version replay_parser_version,r.status replay_status,",
            "IF(s.review_status='approved' AND s.last_replay_status='passed' AND r.parser_version=? ",
            "AND r.status='passed' AND r.created_at=s.last_replay_at,1,0) current_parser_passed ",
            "FROM provider_parser_samples s LEFT JOIN provider_parser_sample_replay_runs r ON r.id=(SELECT rr.id ",
            "FROM provider_parser_sample_replay_runs rr WHERE rr.sample_id=s.id ORDER BY rr.created_at DESC,rr.id DESC LIMIT 1) ",
            "WHERE s.provider_id=? AND s.status='active' ORDER BY current_parser_passed DESC,",
            "(r.parser_version=?) DESC,s.last_replay_at IS NULL,s.last_replay_at DESC,s.created_at DESC LIMIT 1",
          ].join(""),
          [provider.parser_version, provider.id, provider.parser_version],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT j.execution_request_json,j.result_json,j.finished_at,COALESCE(r.page_count,0) page_count FROM browser_collection_jobs j LEFT JOIN crawler_browser_runs r ON r.id=j.crawler_run_id WHERE j.provider_id=? ORDER BY j.created_at DESC,j.id DESC LIMIT 1",
          [provider.id],
        ),
      ]),
      runSucceeded = ["succeeded", "succeeded_empty"].includes(String(latestRun?.status)),
      loginBlocked = ["login_required", "session_expired"].includes(String(latestRun?.error_code)),
      captchaBlocked = ["captcha", "blocked_captcha"].includes(String(latestRun?.error_code)),
      profileReady = Number(profile?.active_count ?? 0) > 0,
      parserVersionCurrent =
        parser?.replay_parser_version != null &&
        String(parser.replay_parser_version) === String(provider.parser_version),
      parserPassed = Number(parser?.current_parser_passed ?? 0) === 1,
      gates: Provider1688Acceptance["gates"] = [
        {
          key: "login",
          state: profileReady && runSucceeded ? "passed" : loginBlocked ? "blocked" : "pending",
          evidence_at: latestRun?.finished_at
            ? iso(latestRun.finished_at)
            : profile?.evidence_at
              ? iso(profile.evidence_at)
              : null,
          reason:
            profileReady && runSucceeded
              ? "当前有效浏览器档案已完成一次登录态运行。"
              : loginBlocked
                ? "最近运行返回登录失效，需要续期档案后重试。"
                : "需要有效浏览器档案并完成一次登录态运行。",
        },
        {
          key: "captcha",
          state: runSucceeded ? "passed" : captchaBlocked ? "blocked" : "pending",
          evidence_at: latestRun?.finished_at ? iso(latestRun.finished_at) : null,
          reason: runSucceeded
            ? "最近登录态运行未被验证码阻断。"
            : captchaBlocked
              ? "最近运行被验证码阻断，需要人工完成验证后重试。"
              : "尚无可证明验证码未阻断的成功登录态运行。",
        },
        {
          key: "parser",
          state: parserPassed
            ? "passed"
            : parserVersionCurrent &&
                ["changed", "failed"].includes(String(parser?.last_replay_status))
              ? "blocked"
              : "pending",
          evidence_at: parser?.last_replay_at ? iso(parser.last_replay_at) : null,
          reason: parserPassed
            ? "当前解析器版本的固定样本回放和人工审批均已通过。"
            : !parserVersionCurrent && parser?.replay_parser_version
              ? `现有固定样本最近回放使用 ${String(parser.replay_parser_version)}，需要用真实登录作业创建并回放当前 ${String(provider.parser_version)} 样本，再由另一名来源管理员审批。`
              : parser?.last_replay_status === "passed" && parser?.review_status !== "approved"
                ? "当前解析器版本的固定样本回放已通过，仍需另一名来源管理员完成人工审批。"
                : "需要用真实登录样本完成当前解析器版本回放并通过人工审批。",
        },
      ],
      pendingReasons = gates.filter((gate) => gate.state !== "passed").map((gate) => gate.reason),
      allPassed = pendingReasons.length === 0;
    return {
      provider_id: String(provider.id),
      source_status: provider.status,
      owner_label: String(provider.owner_label),
      overall: allPassed
        ? provider.status === "enabled"
          ? "production_ready"
          : "ready_for_enable"
        : "setup_required",
      gates,
      latest_run: latestRun
        ? {
            status: String(latestRun.status),
            error_code: latestRun.error_code == null ? null : String(latestRun.error_code),
            started_at: iso(latestRun.started_at),
            finished_at: latestRun.finished_at == null ? null : iso(latestRun.finished_at),
          }
        : null,
      coverage_matrix: coverageMatrix(latestJob, String(provider.parser_version)),
      pending_reasons: pendingReasons,
    };
  }
  async parserSampleOverview(providerId: string, actorId: string) {
    const [samples] = await this.pool.query<RowDataPacket[]>(
        [
          "SELECT id,provider_id,browser_job_id,name,baseline_parser_version,last_replay_status,last_replay_at,",
          "review_status,reviewed_by,review_reason,reviewed_at,review_version,created_by,created_at FROM provider_parser_samples WHERE provider_id=? AND status='active' ORDER BY created_at DESC",
        ].join(""),
        [providerId],
      ),
      [candidates] = await this.pool.query<RowDataPacket[]>(
        [
          "SELECT j.id browser_job_id,j.organization_id,j.workspace_id,MIN(a.captured_at) captured_at,",
          "r.item_count,MIN(a.parser_version) parser_version FROM browser_collection_jobs j JOIN ",
          "crawler_browser_runs r ON r.id=j.crawler_run_id JOIN browser_evidence_artifacts a ON ",
          "a.browser_job_id=j.id AND a.status='active' LEFT JOIN provider_parser_samples s ON ",
          "s.browser_job_id=j.id WHERE j.provider_id=? AND j.status='succeeded' AND s.id IS NULL AND ",
          "JSON_EXTRACT(j.result_json,'$.snapshots') IS NOT NULL GROUP BY j.id,j.organization_id,j.workspace_id,",
          "r.item_count HAVING COUNT(DISTINCT a.kind)=2 AND COUNT(DISTINCT a.parser_version)=1 ",
          "ORDER BY captured_at DESC LIMIT 20",
        ].join(""),
        [providerId],
      );
    return {
      samples: samples.map((row) => parserSample(row, actorId)),
      candidates: candidates.map((row) => ({
        browser_job_id: String(row.browser_job_id),
        organization_id: String(row.organization_id),
        workspace_id: String(row.workspace_id),
        captured_at: iso(row.captured_at),
        item_count: Number(row.item_count),
        parser_version: String(row.parser_version),
      })),
    };
  }
  async parserSampleByOperation(actorId: string, route: string, idempotencyKey: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT s.* FROM provider_parser_sample_operations o JOIN provider_parser_samples s ON ",
        "s.id=o.sample_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, idempotencyKey],
    );
    return rows[0] ? parserSample(rows[0], actorId) : null;
  }
  async parserReplayByOperation(actorId: string, route: string, idempotencyKey: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT r.* FROM provider_parser_sample_operations o JOIN provider_parser_sample_replay_runs r ON ",
        "r.id=o.replay_run_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, idempotencyKey],
    );
    return rows[0] ? parserReplay(rows[0]) : null;
  }
  async parserSampleCandidate(providerId: string, browserJobId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT j.id browser_job_id,j.organization_id,j.workspace_id,j.result_json,MIN(a.captured_at) captured_at,",
        "r.item_count,MIN(a.parser_version) parser_version FROM browser_collection_jobs j JOIN ",
        "crawler_browser_runs r ON r.id=j.crawler_run_id JOIN browser_evidence_artifacts a ON ",
        "a.browser_job_id=j.id AND a.status='active' LEFT JOIN provider_parser_samples s ON ",
        "s.browser_job_id=j.id WHERE j.provider_id=? AND j.id=? AND j.status='succeeded' AND s.id IS NULL AND ",
        "JSON_EXTRACT(j.result_json,'$.snapshots') IS NOT NULL GROUP BY j.id,j.organization_id,j.workspace_id,",
        "j.result_json,r.item_count HAVING COUNT(DISTINCT a.kind)=2 AND ",
        "COUNT(DISTINCT a.parser_version)=1 LIMIT 1",
      ].join(""),
      [providerId, browserJobId],
    );
    const row = rows[0];
    if (!row) return null;
    const result = json(row.result_json) as Record<string, unknown>;
    return {
      browser_job_id: String(row.browser_job_id),
      organization_id: String(row.organization_id),
      workspace_id: String(row.workspace_id),
      captured_at: iso(row.captured_at),
      item_count: Number(row.item_count),
      parser_version: String(row.parser_version),
      snapshots: result.snapshots,
    };
  }
  async createParserSample(input: Parameters<ProviderSourceRepository["createParserSample"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        [
          "SELECT s.* FROM provider_parser_sample_operations o JOIN provider_parser_samples s ON s.id=o.sample_id ",
          "WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
        ].join(""),
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        return parserSample(operations[0], input.actorId);
      }
      const [jobs] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.id FROM browser_collection_jobs j WHERE j.id=? AND j.provider_id=? AND ",
          "j.organization_id=? AND j.workspace_id=? AND j.status='succeeded' AND ",
          "JSON_EXTRACT(j.result_json,'$.snapshots') IS NOT NULL AND ",
          "(SELECT COUNT(DISTINCT a.kind) FROM browser_evidence_artifacts a WHERE ",
          "a.browser_job_id=j.id AND a.status='active')=2 AND ",
          "(SELECT COUNT(DISTINCT a.parser_version) FROM browser_evidence_artifacts a WHERE ",
          "a.browser_job_id=j.id AND a.status='active')=1 AND ",
          "(SELECT MIN(a.parser_version) FROM browser_evidence_artifacts a WHERE ",
          "a.browser_job_id=j.id AND a.status='active')=? FOR UPDATE",
        ].join(""),
        [
          input.browserJobId,
          input.providerId,
          input.organizationId,
          input.workspaceId,
          input.parserVersion,
        ],
      );
      if (!jobs[0])
        throw new ProviderSourceServiceError(
          "parser_sample_candidate_changed",
          409,
          "候选采集已变化，刷新后重新选择。",
        );
      await c.query(
        [
          "INSERT INTO provider_parser_samples (id,organization_id,workspace_id,provider_id,browser_job_id,name,",
          "input_sha256,snapshots_json,baseline_output_json,baseline_output_sha256,baseline_parser_version,",
          "last_replay_status,last_replay_at,status,created_by,created_at,updated_at) VALUES ",
          "(?,?,?,?,?,?,?,?,?,?,?,'never',NULL,'active',?,?,?)",
        ].join(""),
        [
          input.sampleId,
          input.organizationId,
          input.workspaceId,
          input.providerId,
          input.browserJobId,
          input.name,
          input.inputSha256,
          JSON.stringify(input.snapshots),
          JSON.stringify(input.baselineOutput),
          input.baselineOutputSha256,
          input.parserVersion,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO provider_parser_sample_operations (id,actor_id,route,idempotency_key," +
          "sample_id,replay_run_id,created_at) VALUES (?,?,?,?,?,NULL,?)",
        [randomUUID(), input.actorId, input.route, input.idempotencyKey, input.sampleId, input.now],
      );
      await this.parserSampleAudit(c, input, "provider.parser_sample.created", input.sampleId, {
        browser_job_id: input.browserJobId,
        parser_version: input.parserVersion,
      });
      await c.commit();
      return parserSample(
        {
          id: input.sampleId,
          provider_id: input.providerId,
          browser_job_id: input.browserJobId,
          name: input.name,
          baseline_parser_version: input.parserVersion,
          last_replay_status: "never",
          last_replay_at: null,
          review_status: "pending",
          reviewed_by: null,
          review_reason: null,
          reviewed_at: null,
          review_version: 1,
          created_by: input.actorId,
          created_at: input.now,
        } as RowDataPacket,
        input.actorId,
      );
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "parser_sample_duplicate",
          409,
          "该真实采集已固定为样本，刷新列表后查看。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async loadParserSample(providerId: string, sampleId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT s.*,p.code provider_code,p.parser_version current_parser_version FROM provider_parser_samples s ",
        "JOIN providers p ON p.id=s.provider_id WHERE s.id=? AND s.provider_id=? AND s.status='active' LIMIT 1",
      ].join(""),
      [sampleId, providerId],
    );
    const row = rows[0];
    return row
      ? {
          sample: parserSample(row),
          snapshots: json(row.snapshots_json),
          baselineOutput: json(row.baseline_output_json),
          providerCode: String(row.provider_code),
          parserVersion: String(row.current_parser_version),
        }
      : null;
  }
  async recordParserReplay(input: Parameters<ProviderSourceRepository["recordParserReplay"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        [
          "SELECT r.* FROM provider_parser_sample_operations o JOIN provider_parser_sample_replay_runs r ON ",
          "r.id=o.replay_run_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
        ].join(""),
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        return parserReplay(operations[0]);
      }
      const [samples] = await c.query<RowDataPacket[]>(
        "SELECT id FROM provider_parser_samples WHERE id=? AND provider_id=? AND status='active' FOR UPDATE",
        [input.sampleId, input.providerId],
      );
      if (!samples[0])
        throw new ProviderSourceServiceError(
          "parser_sample_not_found",
          404,
          "刷新固定样本后重试。",
        );
      await c.query(
        [
          "INSERT INTO provider_parser_sample_replay_runs (id,sample_id,provider_id,parser_version,status,",
          "output_sha256,diff_json,error_code,request_id,trace_id,created_by,created_at) ",
          "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          input.runId,
          input.sampleId,
          input.providerId,
          input.parserVersion,
          input.status,
          input.outputSha256,
          JSON.stringify(input.diff),
          input.errorCode,
          input.requestId,
          input.traceId,
          input.actorId,
          input.now,
        ],
      );
      await c.query(
        "UPDATE provider_parser_samples SET last_replay_status=?,last_replay_at=?,updated_at=? WHERE id=?",
        [input.status, input.now, input.now, input.sampleId],
      );
      await c.query(
        "INSERT INTO provider_parser_sample_operations (id,actor_id,route,idempotency_key," +
          "sample_id,replay_run_id,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.sampleId,
          input.runId,
          input.now,
        ],
      );
      await this.parserSampleAudit(c, input, "provider.parser_sample.replayed", input.sampleId, {
        replay_run_id: input.runId,
        parser_version: input.parserVersion,
        status: input.status,
        difference_count: input.diff.length,
        error_code: input.errorCode,
      });
      await c.commit();
      return parserReplay({
        id: input.runId,
        sample_id: input.sampleId,
        provider_id: input.providerId,
        parser_version: input.parserVersion,
        status: input.status,
        diff_json: input.diff,
        error_code: input.errorCode,
        request_id: input.requestId,
        trace_id: input.traceId,
        created_at: input.now,
      } as RowDataPacket);
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "parser_sample_replay_conflict",
          409,
          "使用原 Idempotency-Key 读取结果，或刷新后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  private parserSampleAudit(
    c: PoolConnection,
    input: {
      actorId: string;
      providerId: string;
      requestId: string;
      traceId: string;
      now: Date;
    },
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    return c.query(
      [
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,",
        "resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) ",
        "VALUES(?,NULL,NULL,?,?,'provider_parser_sample',?,'succeeded',?,?,?,?,1)",
      ].join(""),
      [
        randomUUID(),
        input.actorId,
        action,
        resourceId,
        input.requestId,
        input.traceId,
        JSON.stringify({ provider_id: input.providerId, ...metadata }),
        input.now,
      ],
    );
  }
}
