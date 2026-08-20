import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  ParserSample,
  ParserSampleReplay,
  ProviderConfigurationHistory,
  ProviderSourceReplay,
  ProviderSourceRepository,
  ProvisionedSource,
} from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const provisioned = (row: RowDataPacket): ProvisionedSource => ({
  id: String(row.id),
  code: String(row.code),
  status: row.status,
  version: Number(row.version),
  schedule_minutes: Number(row.schedule_minutes),
  timeout_ms: Number(row.timeout_ms),
  retry_limit: Number(row.retry_limit),
  updated_at: iso(row.updated_at),
  last_success: row.last_success_task_id
    ? {
        task_id: String(row.last_success_task_id),
        status: row.last_success_status,
        available_result_count: Number(row.last_success_result_count),
        finished_at: iso(row.last_success_finished_at),
      }
    : null,
});
const replay = (row: RowDataPacket): ProviderSourceReplay => ({
  id: String(row.id),
  task_id: String(row.task_id),
  provider_id: String(row.provider_id),
  source_code: String(row.source_code),
  status: String(row.status),
  item_count: Number(row.item_count),
  error_code: row.error_code == null ? null : String(row.error_code),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});
const parserSample = (row: RowDataPacket): ParserSample => ({
  id: String(row.id),
  provider_id: String(row.provider_id),
  browser_job_id: String(row.browser_job_id),
  name: String(row.name),
  baseline_parser_version: String(row.baseline_parser_version),
  last_replay_status: row.last_replay_status,
  last_replay_at: row.last_replay_at == null ? null : iso(row.last_replay_at),
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
const configuration = (snapshot: unknown) => {
  const value = json(snapshot) as Record<string, unknown>;
  return {
    schedule_minutes: Number(value.schedule_minutes),
    timeout_ms: Number(value.timeout_ms),
    retry_limit: Number(value.retry_limit),
    status: String(value.status),
  };
};
const configurationChanges = (
  before: ReturnType<typeof configuration> | null,
  after: ReturnType<typeof configuration>,
) =>
  (Object.keys(after) as Array<keyof typeof after>)
    .filter((field) => before?.[field] !== after[field])
    .map((field) => ({ field, before: before?.[field] ?? null, after: after[field] }));
export class MySqlProviderSourceRepository implements ProviderSourceRepository {
  constructor(private readonly pool: Pool) {}
  async listProvisioned(codes: string[]) {
    if (!codes.length) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT p.id,p.code,p.status,p.version,p.schedule_minutes,p.timeout_ms,p.retry_limit,p.updated_at,",
        "last_success.task_id last_success_task_id,last_success.status last_success_status,",
        "last_success.available_result_count last_success_result_count,",
        "last_success.finished_at last_success_finished_at FROM providers p LEFT JOIN collection_subqueries ",
        "last_success ON last_success.id=(SELECT candidate.id FROM collection_subqueries candidate WHERE ",
        "candidate.provider_id=p.id AND candidate.status IN ('succeeded','succeeded_empty') AND ",
        "candidate.finished_at IS NOT NULL ORDER BY candidate.finished_at DESC,candidate.id DESC LIMIT 1) ",
        `WHERE p.code IN (${codes.map(() => "?").join(",")})`,
      ].join(""),
      codes,
    );
    return rows.map(provisioned);
  }
  async configurationVersions(providerId: string): Promise<ProviderConfigurationHistory> {
    const [[provider], [versions]] = await Promise.all([
      this.pool.query<RowDataPacket[]>("SELECT id,version FROM providers WHERE id=? LIMIT 1", [
        providerId,
      ]),
      this.pool.query<RowDataPacket[]>(
        "SELECT version,snapshot_json,action,created_at FROM provider_versions WHERE provider_id=? " +
          "ORDER BY version DESC LIMIT 101",
        [providerId],
      ),
    ]);
    if (!provider[0])
      throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
    const source = provider[0];
    let previous: ReturnType<typeof configuration> | null = null;
    const history = versions.reverse().map((row) => {
      const current = configuration(row.snapshot_json),
        result = {
          version: Number(row.version),
          action: String(row.action),
          created_at: iso(row.created_at),
          current: Number(row.version) === Number(source.version),
          rollback_available: Number(row.version) < Number(source.version),
          changes: configurationChanges(previous, current),
        };
      previous = current;
      return result;
    });
    if (history.length > 100) history.shift();
    return {
      provider_id: String(source.id),
      current_version: Number(source.version),
      versions: history.reverse(),
    };
  }
  async parserSampleOverview(providerId: string) {
    const [samples] = await this.pool.query<RowDataPacket[]>(
        [
          "SELECT id,provider_id,browser_job_id,name,baseline_parser_version,last_replay_status,last_replay_at,",
          "created_at FROM provider_parser_samples WHERE provider_id=? AND status='active' ORDER BY created_at DESC",
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
      samples: samples.map(parserSample),
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
    return rows[0] ? parserSample(rows[0]) : null;
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
        return parserSample(operations[0]);
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
      return parserSample({
        id: input.sampleId,
        provider_id: input.providerId,
        browser_job_id: input.browserJobId,
        name: input.name,
        baseline_parser_version: input.parserVersion,
        last_replay_status: "never",
        last_replay_at: null,
        created_at: input.now,
      } as RowDataPacket);
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
  async syncCatalog(input: Parameters<ProviderSourceRepository["syncCatalog"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [actors] = await c.query<RowDataPacket[]>(
          [
            "SELECT pra.user_id FROM platform_role_assignments pra JOIN users u ON u.id=pra.user_id WHERE ",
            "pra.role_code='platform_super_admin' AND u.status='active' ORDER BY pra.created_at LIMIT 1 FOR ",
            "UPDATE",
          ].join(""),
        ),
        actorId = actors[0]?.user_id ? String(actors[0].user_id) : null;
      if (!actorId) {
        await c.rollback();
        return {
          inserted: 0,
          updated: 0,
          automatic_enabled: 0,
          status: "waiting_for_platform_admin" as const,
        };
      }
      let inserted = 0,
        updated = 0,
        automatic = 0;
      for (const d of input.definitions) {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,status,version FROM providers WHERE code=? FOR UPDATE",
          [d.code],
        );
        const current = rows[0];
        if (current) {
          await c.query(
            [
              "UPDATE providers SET name=?,target_url=?,access_mode=?,markets_json=?,languages_json=?,fields_json=?",
              ",dedupe_key=?,failure_rules_json=?,parser_version=?,healthcheck_url=?,owner_label=?,updated_at=? ",
              "WHERE id=?",
            ].join(""),
            [
              d.name,
              d.target_url,
              d.access_mode,
              JSON.stringify(d.markets),
              JSON.stringify(d.languages),
              JSON.stringify(d.fields),
              d.dedupe_key,
              JSON.stringify(d.failure_rules),
              d.parser_version,
              d.healthcheck_url,
              d.owner_label,
              input.now,
              current.id,
            ],
          );
          updated += 1;
          if (current.status === "enabled" && d.availability === "automatic") automatic += 1;
          continue;
        }
        const id = randomUUID(),
          status = d.status;
        await c.query(
          [
            "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,s",
            "chedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retent",
            "ion_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,upd",
            "ated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
          ].join(""),
          [
            id,
            d.code,
            d.name,
            d.target_url,
            d.access_mode,
            JSON.stringify(d.markets),
            JSON.stringify(d.languages),
            JSON.stringify(d.fields),
            d.schedule_minutes,
            d.concurrency_limit,
            d.timeout_ms,
            d.retry_limit,
            d.circuit_failure_threshold,
            d.dedupe_key,
            d.retention_days,
            JSON.stringify(d.failure_rules),
            d.parser_version,
            d.healthcheck_url,
            d.owner_label,
            status,
            actorId,
            actorId,
            input.now,
            input.now,
          ],
        );
        await c.query(
          [
            "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
            "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          ].join(""),
          [
            randomUUID(),
            id,
            1,
            JSON.stringify({ ...d, id, status, version: 1 }),
            actorId,
            "created",
            "automatic-source-catalog",
            "automatic-source-catalog",
            input.now,
          ],
        );
        inserted += 1;
        if (status === "enabled" && d.availability === "automatic") automatic += 1;
      }
      await c.commit();
      return { inserted, updated, automatic_enabled: automatic, status: "synced" as const };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async provision(input: Parameters<ProviderSourceRepository["provision"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await this.operationProvider(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT id,code,status,version,updated_at FROM providers WHERE code=? FOR UPDATE",
        [input.definition.code],
      );
      if (existing[0])
        throw new ProviderSourceServiceError(
          "provider_source_already_provisioned",
          409,
          "来源已经自动登记，请直接查看状态或手动刷新。",
        );
      const d = input.definition,
        status = d.status;
      await c.query(
        [
          "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,s",
          "chedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retent",
          "ion_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,upd",
          "ated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        ].join(""),
        [
          input.providerId,
          d.code,
          d.name,
          d.target_url,
          d.access_mode,
          JSON.stringify(d.markets),
          JSON.stringify(d.languages),
          JSON.stringify(d.fields),
          d.schedule_minutes,
          d.concurrency_limit,
          d.timeout_ms,
          d.retry_limit,
          d.circuit_failure_threshold,
          d.dedupe_key,
          d.retention_days,
          JSON.stringify(d.failure_rules),
          d.parser_version,
          d.healthcheck_url,
          d.owner_label,
          status,
          input.actorId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      const result: ProvisionedSource = {
        id: input.providerId,
        code: d.code,
        status,
        version: 1,
        schedule_minutes: d.schedule_minutes,
        timeout_ms: d.timeout_ms,
        retry_limit: d.retry_limit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          1,
          JSON.stringify({ ...d, id: input.providerId, status, version: 1 }),
          input.actorId,
          "created",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,NULL,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError("provider_source_conflict", 409, "刷新目录后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async replay(input: Parameters<ProviderSourceRepository["replay"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await this.operationReplay(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [providers] = await c.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        provider = providers[0];
      if (!provider)
        throw new ProviderSourceServiceError("provider_not_found", 404, "刷新首批来源目录。");
      if (
        !["google_news_search", "manual_product_supply_csv", "1688_search"].includes(
          String(provider.code),
        )
      )
        throw new ProviderSourceServiceError(
          "provider_source_not_builtin",
          409,
          "仅已接通执行器的来源可从此入口运行。",
        );
      if (provider.status !== "enabled")
        throw new ProviderSourceServiceError(
          "provider_source_disabled",
          409,
          "先在来源定义页完成所有者复核并显式启用。",
        );
      if (
        ["public_page", "public_rss"].includes(String(provider.access_mode)) &&
        (provider.terms_review_status !== "approved" || !provider.terms_reference_url)
      )
        throw new ProviderSourceServiceError(
          "provider_source_compliance_required",
          409,
          "先在来源定义页批准平台条款并登记 HTTPS 参考地址。",
        );
      if ((provider.code === "manual_product_supply_csv") !== "csv_text" in input.target)
        throw new ProviderSourceServiceError(
          "provider_source_target_mismatch",
          400,
          "目标内容与来源类型不匹配。",
        );
      const [scope] = await c.query<RowDataPacket[]>(
        [
          "SELECT w.id FROM workspaces w JOIN organizations o ON o.id=w.organization_id WHERE w.id=? AND ",
          "w.organization_id=? AND w.status='active' AND o.status='active' FOR UPDATE",
        ].join(""),
        [input.workspaceId, input.organizationId],
      );
      if (!scope[0])
        throw new ProviderSourceServiceError(
          "provider_source_scope_inactive",
          409,
          "选择活动组织与工作区。",
        );
      await c.query(
        [
          "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,schedu",
          "led_at,available_at,leased_at,lease_owner,lease_token_hash,lease_expires_at,started_at,finished_at,a",
          "ttempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result",
          "_count,missing_fields_json,last_error_code,rate_limit_reset_at,replay_of_task_id,replay_reason,reque",
          "st_id,trace_id,version,created_by,created_at,updated_at) VALUES ",
          "(?,?,?,'scheduled',NULL,'normal',?,?,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,'[]',NULL,NULL,NULL,NUL",
          "L,?,?,1,?,?,?)",
        ].join(""),
        [
          input.taskId,
          input.organizationId,
          input.workspaceId,
          input.now,
          input.now,
          input.requestId,
          input.traceId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,targe",
          "t_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,started_at",
          ",finished_at,version,created_at,updated_at) VALUES ",
          "(?,?,?,?,?,1,?,1,'pending',0,'[]',NULL,0,NULL,NULL,1,?,?)",
        ].join(""),
        [
          input.subqueryId,
          input.taskId,
          input.organizationId,
          input.workspaceId,
          input.providerId,
          JSON.stringify(input.target),
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_replay_runs (id,organization_id,workspace_id,provider_id,source_code,tas",
          "k_id,input_sha256,status,item_count,error_code,request_id,trace_id,created_by,created_at,updated_at) ",
          "VALUES (?,?,?,?,?,?,?,'scheduled',0,NULL,?,?,?,?,?)",
        ].join(""),
        [
          input.runId,
          input.organizationId,
          input.workspaceId,
          input.providerId,
          provider.code,
          input.taskId,
          input.inputSha256,
          input.requestId,
          input.traceId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,t",
          "o_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,?,? ",
          ",NULL,'scheduled','user',?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.taskId,
          input.organizationId,
          input.workspaceId,
          "collection.task.scheduled",
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify({ source_code: provider.code, replay_run_id: input.runId }),
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id,event_type,payload_json,",
          "status,attempt_count,available_at,lease_owner,lease_expires_at,request_id,trace_id,created_at,update",
          "d_at) VALUES (?,?,?,?,?,?,'queued',0,?,NULL,NULL,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.taskId,
          input.organizationId,
          input.workspaceId,
          "collection.task.scheduled",
          JSON.stringify({ task_id: input.taskId, source_code: provider.code }),
          input.now,
          input.requestId,
          input.traceId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.runId,
          input.now,
        ],
      );
      const result: ProviderSourceReplay = {
        id: input.runId,
        task_id: input.taskId,
        provider_id: input.providerId,
        source_code: String(provider.code),
        status: "scheduled",
        item_count: 0,
        error_code: null,
        request_id: input.requestId,
        trace_id: input.traceId,
        created_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      };
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_source_replay_conflict",
          409,
          "使用相同 Idempotency-Key 可读取原结果；否则刷新后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async refresh(input: Parameters<ProviderSourceRepository["refresh"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [previous] = await c.query<RowDataPacket[]>(
        "SELECT task_id,source_count FROM provider_refresh_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (previous[0]) {
        await c.commit();
        return {
          task_id: String(previous[0].task_id),
          source_count: Number(previous[0].source_count),
          status: "scheduled" as const,
        };
      }
      const [scope] = await c.query<RowDataPacket[]>(
        [
          "SELECT w.id FROM workspaces w JOIN organizations o ON o.id=w.organization_id WHERE w.id=? AND ",
          "w.organization_id=? AND w.status='active' AND o.status='active' FOR UPDATE",
        ].join(""),
        [input.workspaceId, input.organizationId],
      );
      if (!scope[0])
        throw new ProviderSourceServiceError(
          "provider_source_scope_inactive",
          409,
          "重新选择活动组织与工作区。",
        );
      const [providers] = await c.query<RowDataPacket[]>(
        [
          "SELECT id,code FROM providers WHERE status='enabled' AND terms_review_status='approved' ",
          "AND terms_reference_url IS NOT NULL AND parser_version IN ",
          "('google-news-fixed-rss-v1','syndication-feed-v1','structured-public-page-v1') ORDER BY updated_at ",
          "DESC,code LIMIT 100 FOR UPDATE",
        ].join(""),
      );
      if (!providers.length)
        throw new ProviderSourceServiceError(
          "provider_source_automatic_empty",
          409,
          "平台管理员先同步并启用自动热点来源。",
        );
      const taskId = randomUUID();
      await c.query(
        [
          "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,schedu",
          "led_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_c",
          "ount,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,up",
          "dated_at) VALUES (?,?,?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
        ].join(""),
        [
          taskId,
          input.organizationId,
          input.workspaceId,
          input.now,
          input.now,
          input.requestId,
          input.traceId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      for (let index = 0; index < providers.length; index++) {
        const provider = providers[index]!;
        await c.query(
          [
            "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,targe",
            "t_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,cr",
            "eated_at,updated_at) VALUES (?,?,?,?,?,?,?,0,'pending',0,'[]',NULL,0,1,?,?)",
          ].join(""),
          [
            randomUUID(),
            taskId,
            input.organizationId,
            input.workspaceId,
            provider.id,
            index + 1,
            "{}",
            input.now,
            input.now,
          ],
        );
      }
      await c.query(
        [
          "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,t",
          "o_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES ",
          "(?,?,?,?,?,NULL,'scheduled','user',?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          taskId,
          input.organizationId,
          input.workspaceId,
          "hotspot.refresh.scheduled",
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify({ source_count: providers.length }),
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id,event_type,payload_json,",
          "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES ",
          "(?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          taskId,
          input.organizationId,
          input.workspaceId,
          "hotspot.refresh.scheduled",
          JSON.stringify({ task_id: taskId, source_count: providers.length }),
          input.now,
          input.requestId,
          input.traceId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_refresh_operations (id,actor_id,route,idempotency_key,task_id,source_count,crea",
          "ted_at) VALUES (?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          taskId,
          providers.length,
          input.now,
        ],
      );
      await c.commit();
      return { task_id: taskId, source_count: providers.length, status: "scheduled" as const };
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_refresh_conflict",
          409,
          "刷新页面后查看已创建的热点采集任务。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async updateConfiguration(input: Parameters<ProviderSourceRepository["updateConfiguration"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await this.operationProvider(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        current = rows[0];
      if (!current)
        throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
      if (String(current.code) === "1688_search" && input.status === "enabled") {
        const [acceptance] = await c.query<RowDataPacket[]>(
          [
            "SELECT COUNT(*) count FROM provider_parser_samples s WHERE s.provider_id=? AND ",
            "s.status='active' AND s.last_replay_status='passed' AND EXISTS (SELECT 1 FROM ",
            "provider_parser_sample_replay_runs r WHERE r.sample_id=s.id AND r.parser_version=? AND ",
            "r.status='passed' AND r.created_at=s.last_replay_at)",
          ].join(""),
          [input.providerId, current.parser_version],
        );
        if (Number(acceptance[0]?.count ?? 0) < 1)
          throw new ProviderSourceServiceError(
            "provider_source_setup_required",
            409,
            "先用真实登录档案完成 1688 固定样本字段回放验收；当前来源只能保持停用。",
          );
      }
      if (
        input.status === "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode)) &&
        (current.terms_review_status !== "approved" || !current.terms_reference_url)
      )
        throw new ProviderSourceServiceError(
          "provider_source_compliance_required",
          409,
          "先在来源定义页批准平台条款并登记 HTTPS 参考地址。",
        );
      if (Number(current.version) !== input.expectedVersion)
        throw new ProviderSourceServiceError(
          "provider_version_conflict",
          409,
          "来源已被其他管理员修改，刷新后重试。",
        );
      const nextVersion = Number(current.version) + 1;
      await c.query(
        [
          "UPDATE providers SET schedule_minutes=?,timeout_ms=?,retry_limit=?,status=?,version=?,updated_by=?,u",
          "pdated_at=? WHERE id=?",
        ].join(""),
        [
          input.scheduleMinutes,
          input.timeoutMs,
          input.retryLimit,
          input.status,
          nextVersion,
          input.actorId,
          input.now,
          input.providerId,
        ],
      );
      const snapshot = {
        ...current,
        schedule_minutes: input.scheduleMinutes,
        timeout_ms: input.timeoutMs,
        retry_limit: input.retryLimit,
        status: input.status,
        version: nextVersion,
        updated_by: input.actorId,
        updated_at: input.now,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          nextVersion,
          JSON.stringify(snapshot),
          input.actorId,
          "configuration_updated",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,NULL,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,reso",
          "urce_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) ",
          "VALUES(?,NULL,NULL,?,'provider.configuration.updated','provider',?,'succeeded',?,?,?,?,1)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.providerId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            reason: input.reason,
            from_version: input.expectedVersion,
            to_version: nextVersion,
            schedule_minutes: input.scheduleMinutes,
            timeout_ms: input.timeoutMs,
            retry_limit: input.retryLimit,
            status: input.status,
          }),
          input.now,
        ],
      );
      await c.commit();
      return {
        id: String(current.id),
        code: String(current.code),
        status: input.status,
        version: nextVersion,
        schedule_minutes: input.scheduleMinutes,
        timeout_ms: input.timeoutMs,
        retry_limit: input.retryLimit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_configuration_conflict",
          409,
          "刷新来源版本后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async rollbackConfiguration(
    input: Parameters<ProviderSourceRepository["rollbackConfiguration"]>[0],
  ) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await this.operationProvider(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        current = rows[0];
      if (!current)
        throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
      if (Number(current.version) !== input.expectedVersion)
        throw new ProviderSourceServiceError(
          "provider_version_conflict",
          409,
          "来源已被其他管理员修改，刷新后重试。",
        );
      const [targets] = await c.query<RowDataPacket[]>(
          "SELECT snapshot_json FROM provider_versions WHERE provider_id=? AND version=? LIMIT 1",
          [input.providerId, input.targetVersion],
        ),
        target = targets[0] ? configuration(targets[0].snapshot_json) : null;
      if (!target)
        throw new ProviderSourceServiceError(
          "provider_target_version_not_found",
          404,
          "选择仍存在的历史版本。",
        );
      if (
        !Number.isInteger(target.schedule_minutes) ||
        target.schedule_minutes < 1 ||
        target.schedule_minutes > 10080 ||
        !Number.isInteger(target.timeout_ms) ||
        target.timeout_ms < 1000 ||
        target.timeout_ms > 120000 ||
        !Number.isInteger(target.retry_limit) ||
        target.retry_limit < 0 ||
        target.retry_limit > 10 ||
        !["draft", "disabled", "enabled"].includes(target.status)
      )
        throw new ProviderSourceServiceError(
          "provider_target_version_invalid",
          409,
          "历史版本的采集设置已不符合当前合同，不能回滚。",
        );
      if (target.status === "enabled" && String(current.code) === "1688_search") {
        const [acceptance] = await c.query<RowDataPacket[]>(
          [
            "SELECT COUNT(*) count FROM provider_parser_samples s WHERE s.provider_id=? AND ",
            "s.status='active' AND s.last_replay_status='passed' AND EXISTS (SELECT 1 FROM ",
            "provider_parser_sample_replay_runs r WHERE r.sample_id=s.id AND r.parser_version=? AND ",
            "r.status='passed' AND r.created_at=s.last_replay_at)",
          ].join(""),
          [input.providerId, current.parser_version],
        );
        if (Number(acceptance[0]?.count ?? 0) < 1)
          throw new ProviderSourceServiceError(
            "provider_source_setup_required",
            409,
            "历史版本要求启用 1688，但当前解析验收未通过，不能回滚。",
          );
      }
      if (
        target.status === "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode)) &&
        (current.terms_review_status !== "approved" || !current.terms_reference_url)
      )
        throw new ProviderSourceServiceError(
          "provider_source_compliance_required",
          409,
          "历史版本要求启用公开来源，但当前条款审查未通过，不能回滚。",
        );
      const nextVersion = Number(current.version) + 1;
      await c.query(
        [
          "UPDATE providers SET schedule_minutes=?,timeout_ms=?,retry_limit=?,status=?,version=?,updated_by=?,u",
          "pdated_at=? WHERE id=?",
        ].join(""),
        [
          target.schedule_minutes,
          target.timeout_ms,
          target.retry_limit,
          target.status,
          nextVersion,
          input.actorId,
          input.now,
          input.providerId,
        ],
      );
      const snapshot = {
        ...current,
        ...target,
        version: nextVersion,
        updated_by: input.actorId,
        updated_at: input.now,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          nextVersion,
          JSON.stringify(snapshot),
          input.actorId,
          "configuration_rolled_back",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,NULL,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,reso",
          "urce_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) ",
          "VALUES(?,NULL,NULL,?,'provider.configuration.rolled_back','provider',?,'succeeded',?,?,?,?,1)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.providerId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            reason: input.reason,
            from_version: input.expectedVersion,
            target_version: input.targetVersion,
            to_version: nextVersion,
            changes: configurationChanges(configuration(current), target).map(({ field }) => field),
          }),
          input.now,
        ],
      );
      await c.commit();
      return {
        id: String(current.id),
        code: String(current.code),
        status: target.status as ProvisionedSource["status"],
        version: nextVersion,
        schedule_minutes: target.schedule_minutes,
        timeout_ms: target.timeout_ms,
        retry_limit: target.retry_limit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_configuration_conflict",
          409,
          "刷新来源版本后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  private async operationProvider(c: PoolConnection, actorId: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        "SELECT p.id,p.code,p.status,p.version,p.schedule_minutes,p.timeout_ms,p.retry_limit,p.updated_at ",
        "FROM provider_source_operations o JOIN providers p ON p.id=o.provider_id WHERE o.actor_id=? AND ",
        "o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, key],
    );
    return rows[0] ? provisioned(rows[0]) : null;
  }
  private async operationReplay(c: PoolConnection, actorId: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        "SELECT r.* FROM provider_source_operations o JOIN provider_source_replay_runs r ON ",
        "r.id=o.replay_run_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, key],
    );
    return rows[0] ? replay(rows[0]) : null;
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
