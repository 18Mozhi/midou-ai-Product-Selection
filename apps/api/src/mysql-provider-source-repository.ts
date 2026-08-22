import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ProviderSourceReplay, ProviderSourceRepository } from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import { MySqlProviderSourceCatalogRepository } from "./mysql-provider-source-catalog-repository.js";
import { MySqlProviderSourceSampleRepository } from "./mysql-provider-source-sample-repository.js";
import { MySqlProviderSourceSampleReviewRepository } from "./mysql-provider-source-sample-review-repository.js";
import { providerSourceReplayFromRow } from "./mysql-provider-source-repository-shared.js";
import { MySqlProviderSourceVersionRepository } from "./mysql-provider-source-version-repository.js";

export class MySqlProviderSourceRepository implements ProviderSourceRepository {
  private readonly catalog: MySqlProviderSourceCatalogRepository;
  private readonly samples: MySqlProviderSourceSampleRepository;
  private readonly sampleReviews: MySqlProviderSourceSampleReviewRepository;
  private readonly versions: MySqlProviderSourceVersionRepository;

  constructor(private readonly pool: Pool) {
    this.catalog = new MySqlProviderSourceCatalogRepository(pool);
    this.samples = new MySqlProviderSourceSampleRepository(pool);
    this.sampleReviews = new MySqlProviderSourceSampleReviewRepository(pool);
    this.versions = new MySqlProviderSourceVersionRepository(pool);
  }

  listProvisioned(codes: string[]) {
    return this.catalog.listProvisioned(codes);
  }
  read1688Acceptance(now: Date) {
    return this.samples.read1688Acceptance(now);
  }
  syncCatalog(input: Parameters<ProviderSourceRepository["syncCatalog"]>[0]) {
    return this.catalog.syncCatalog(input);
  }
  provision(input: Parameters<ProviderSourceRepository["provision"]>[0]) {
    return this.catalog.provision(input);
  }
  configurationVersions(providerId: string) {
    return this.versions.configurationVersions(providerId);
  }
  updateConfiguration(input: Parameters<ProviderSourceRepository["updateConfiguration"]>[0]) {
    return this.versions.updateConfiguration(input);
  }
  rollbackConfiguration(input: Parameters<ProviderSourceRepository["rollbackConfiguration"]>[0]) {
    return this.versions.rollbackConfiguration(input);
  }
  parserSampleOverview(providerId: string, actorId: string) {
    return this.samples.parserSampleOverview(providerId, actorId);
  }
  parserSampleByOperation(actorId: string, route: string, idempotencyKey: string) {
    return this.samples.parserSampleByOperation(actorId, route, idempotencyKey);
  }
  parserReplayByOperation(actorId: string, route: string, idempotencyKey: string) {
    return this.samples.parserReplayByOperation(actorId, route, idempotencyKey);
  }
  parserSampleCandidate(providerId: string, browserJobId: string) {
    return this.samples.parserSampleCandidate(providerId, browserJobId);
  }
  createParserSample(input: Parameters<ProviderSourceRepository["createParserSample"]>[0]) {
    return this.samples.createParserSample(input);
  }
  loadParserSample(providerId: string, sampleId: string) {
    return this.samples.loadParserSample(providerId, sampleId);
  }
  recordParserReplay(input: Parameters<ProviderSourceRepository["recordParserReplay"]>[0]) {
    return this.samples.recordParserReplay(input);
  }
  reviewParserSample(input: Parameters<ProviderSourceRepository["reviewParserSample"]>[0]) {
    return this.sampleReviews.reviewParserSample(input);
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
        (provider.terms_review_status !== "approved" ||
          !provider.terms_reference_url ||
          !provider.terms_version ||
          !provider.terms_expires_at ||
          new Date(provider.terms_expires_at) <= input.now)
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
          "AND terms_reference_url IS NOT NULL AND terms_version IS NOT NULL AND terms_expires_at>NOW(3) AND parser_version IN ",
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
  private async operationReplay(c: PoolConnection, actorId: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        "SELECT r.* FROM provider_source_operations o JOIN provider_source_replay_runs r ON ",
        "r.id=o.replay_run_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, key],
    );
    return rows[0] ? providerSourceReplayFromRow(rows[0]) : null;
  }
}
