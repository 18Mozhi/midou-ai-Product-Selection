import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ParserSample, ProviderSourceRepository } from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import { iso } from "./mysql-provider-source-repository-shared.js";

const sampleView = (row: RowDataPacket, actorId: string): ParserSample => ({
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

export class MySqlProviderSourceSampleReviewRepository {
  constructor(private readonly pool: Pool) {}

  async reviewParserSample(input: Parameters<ProviderSourceRepository["reviewParserSample"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        "SELECT s.* FROM provider_parser_sample_operations o JOIN provider_parser_samples s ON " +
          "s.id=o.sample_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        return sampleView(operations[0], input.actorId);
      }
      const [samples] = await c.query<RowDataPacket[]>(
          "SELECT * FROM provider_parser_samples WHERE id=? AND provider_id=? AND status='active' FOR UPDATE",
          [input.sampleId, input.providerId],
        ),
        sample = samples[0];
      if (!sample)
        throw new ProviderSourceServiceError(
          "parser_sample_not_found",
          404,
          "刷新固定样本后重试。",
        );
      if (String(sample.created_by) === input.actorId)
        throw new ProviderSourceServiceError(
          "parser_sample_self_review_forbidden",
          403,
          "固定样本创建人与审批人必须是两个不同的来源管理员。",
        );
      if (
        sample.review_status !== "pending" ||
        Number(sample.review_version) !== input.expectedVersion
      )
        throw new ProviderSourceServiceError(
          "parser_sample_review_conflict",
          409,
          "该固定样本已审批或版本已变化，请刷新后重试。",
        );
      await c.query(
        "UPDATE provider_parser_samples SET review_status=?,reviewed_by=?,review_reason=?," +
          "reviewed_at=?,review_version=review_version+1,updated_at=? WHERE id=?",
        [input.decision, input.actorId, input.reason, input.now, input.now, input.sampleId],
      );
      await c.query(
        "INSERT INTO provider_parser_sample_operations (id,actor_id,route,idempotency_key," +
          "sample_id,replay_run_id,created_at) VALUES (?,?,?,?,?,NULL,?)",
        [randomUUID(), input.actorId, input.route, input.idempotencyKey, input.sampleId, input.now],
      );
      await c.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type," +
          "resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) " +
          "VALUES(?,NULL,NULL,?,?,'provider_parser_sample',?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          `provider.parser_sample.${input.decision}`,
          input.sampleId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            provider_id: input.providerId,
            decision: input.decision,
            reason: input.reason,
            review_version: input.expectedVersion + 1,
          }),
          input.now,
        ],
      );
      await c.commit();
      return sampleView(
        {
          ...sample,
          review_status: input.decision,
          reviewed_by: input.actorId,
          review_reason: input.reason,
          reviewed_at: input.now,
          review_version: input.expectedVersion + 1,
          updated_at: input.now,
        } as RowDataPacket,
        input.actorId,
      );
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "parser_sample_review_conflict",
          409,
          "使用原 Idempotency-Key 读取审批结果，或刷新后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
}
