import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { CrawlerProfileSummary, CredentialAssetSummary } from "@scoutops/contracts";
import {
  CredentialAssetError,
  type CredentialAssetRepository,
} from "./credential-asset-service.js";
const assetColumns =
    "a.id,a.provider_id,a.name,a.kind,a.status,a.key_version,a.fingerprint,a.expires_at,a.rotated_at,a.version,a.updated_at",
  profileColumns =
    "p.id,p.provider_id,p.credential_asset_id,p.code,p.name,p.browser_family,p.locale,p.timezone,p.status,p.version,p.updated_at",
  asset = (r: RowDataPacket): CredentialAssetSummary => ({
    id: String(r.id),
    provider_id: String(r.provider_id),
    name: String(r.name),
    kind: r.kind,
    status: r.status,
    key_version: String(r.key_version),
    fingerprint: String(r.fingerprint),
    expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    rotated_at: r.rotated_at ? new Date(r.rotated_at).toISOString() : null,
    version: Number(r.version),
    updated_at: new Date(r.updated_at).toISOString(),
  }),
  profile = (r: RowDataPacket): CrawlerProfileSummary => ({
    id: String(r.id),
    provider_id: String(r.provider_id),
    credential_asset_id: String(r.credential_asset_id),
    code: String(r.code),
    name: String(r.name),
    browser_family: r.browser_family,
    locale: String(r.locale),
    timezone: String(r.timezone),
    status: r.status,
    version: Number(r.version),
    updated_at: new Date(r.updated_at).toISOString(),
  });
export class MySqlCredentialAssetRepository implements CredentialAssetRepository {
  constructor(private readonly pool: Pool) {}
  async listAssets() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${assetColumns} FROM credential_assets a ORDER BY a.status='active' DESC,a.updated_at DESC,a.id`,
    );
    return rows.map(asset);
  }
  async listProviderOptions() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,code,name,target_url,access_mode FROM providers WHERE status<>'draft' ORDER BY name,id",
    );
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      target_url: String(r.target_url),
      access_mode: String(r.access_mode),
    }));
  }
  async getCipherRecord(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${assetColumns},a.payload_ciphertext,a.payload_nonce,a.payload_auth_tag FROM credential_assets a WHERE a.id=?`,
      [id],
    );
    if (!rows[0]) throw new CredentialAssetError("credential_not_found", 404, "刷新凭证列表。");
    const r = rows[0];
    return {
      summary: asset(r),
      assetId: String(r.id),
      assetVersion: Number(r.version),
      kind: String(r.kind),
      keyVersion: String(r.key_version),
      ciphertext: r.payload_ciphertext,
      nonce: r.payload_nonce,
      authTag: r.payload_auth_tag,
      fingerprint: String(r.fingerprint),
    };
  }
  private async replayAsset(c: PoolConnection, actorId: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        `SELECT ${assetColumns} FROM credential_asset_operations o JOIN credential_assets a ON `,
        "a.id=o.credential_asset_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, key],
    );
    return rows[0] ? asset(rows[0]) : null;
  }

  private async replayRenewedProfiles(
    c: PoolConnection,
    input: Parameters<CredentialAssetRepository["rotateAsset"]>[0],
  ) {
    const [profiles] = await c.query<RowDataPacket[]>(
      "SELECT id FROM crawler_profiles WHERE credential_asset_id=? AND status='active' FOR UPDATE",
      [input.id],
    );
    for (const profileRow of profiles) {
      const profileId = String(profileRow.id),
        replayedTaskIds: string[] = [];
      const [jobs] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.id job_id,j.collection_task_id,t.status task_status FROM browser_collection_jobs j ",
          "JOIN collection_tasks t ON t.id=j.collection_task_id WHERE j.crawler_profile_id=? AND ",
          "j.status='blocked' AND j.error_code IN ('credential_expired','blocked_login','session_expired',",
          "'login_required') ORDER BY j.updated_at,j.id FOR UPDATE",
        ].join(""),
        [profileId],
      );
      const handledTasks = new Set<string>();
      for (const job of jobs) {
        const taskId = String(job.collection_task_id),
          status = String(job.task_status);
        if (["leased", "running", "parsing", "validating"].includes(status)) {
          await c.query(
            [
              "UPDATE browser_collection_jobs SET status='queued',crawler_profile_id=NULL,crawler_run_id=NULL,",
              "result_json=NULL,error_code=NULL,lease_owner=NULL,lease_token_hash=NULL,leased_at=NULL,heartbeat_at=NULL,",
              "lease_expires_at=NULL,finished_at=NULL,updated_at=? WHERE id=? AND status='blocked'",
            ].join(""),
            [input.now, job.job_id],
          );
          replayedTaskIds.push(taskId);
          continue;
        }
        if (
          handledTasks.has(taskId) ||
          !["blocked_login", "succeeded_empty", "completed_with_warnings"].includes(status)
        )
          continue;
        handledTasks.add(taskId);
        const replayedTaskId = await this.cloneCredentialBlockedTask(c, input, taskId, status);
        if (replayedTaskId) replayedTaskIds.push(replayedTaskId);
      }
      await this.completeRenewalTask(c, input, profileId, [...new Set(replayedTaskIds)]);
    }
  }

  private async cloneCredentialBlockedTask(
    c: PoolConnection,
    input: Parameters<CredentialAssetRepository["rotateAsset"]>[0],
    sourceTaskId: string,
    sourceStatus: string,
  ) {
    const [tasks] = await c.query<RowDataPacket[]>(
        "SELECT * FROM collection_tasks WHERE id=? FOR UPDATE",
        [sourceTaskId],
      ),
      source = tasks[0];
    if (!source || String(source.status) !== sourceStatus) return null;
    const [subqueries] = await c.query<RowDataPacket[]>(
      "SELECT * FROM collection_subqueries WHERE task_id=? ORDER BY ordinal FOR UPDATE",
      [sourceTaskId],
    );
    if (!subqueries.length) return null;
    const newTaskId = randomUUID(),
      replayReason = "网页登录凭证续期后自动重放";
    await c.query(
      [
        "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,",
        "available_at,leased_at,lease_owner,lease_token_hash,lease_expires_at,started_at,finished_at,attempt_count,",
        "successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,",
        "last_error_code,rate_limit_reset_at,replay_of_task_id,replay_reason,request_id,trace_id,version,created_by,created_at,",
        "updated_at) VALUES (?,?,?,'scheduled',NULL,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,'[]',NULL,NULL,?,?,?,",
        "?,1,?,?,?)",
      ].join(""),
      [
        newTaskId,
        source.organization_id,
        source.workspace_id,
        source.priority,
        input.now,
        input.now,
        sourceTaskId,
        replayReason,
        input.requestId,
        input.traceId,
        input.actorId,
        input.now,
        input.now,
      ],
    );
    for (const subquery of subqueries)
      await c.query(
        [
          "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,",
          "is_required,status,available_result_count,missing_fields_json,error_code,retryable,started_at,finished_at,version,",
          "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'pending',0,'[]',NULL,0,NULL,NULL,1,?,?)",
        ].join(""),
        [
          randomUUID(),
          newTaskId,
          source.organization_id,
          source.workspace_id,
          subquery.provider_id,
          subquery.ordinal,
          JSON.stringify(
            typeof subquery.target_json === "string"
              ? JSON.parse(subquery.target_json)
              : subquery.target_json,
          ),
          subquery.is_required,
          input.now,
          input.now,
        ],
      );
    await c.query(
      "UPDATE collection_tasks SET status='automatically_replayed',version=version+1,updated_at=? WHERE id=? AND status=?",
      [input.now, sourceTaskId, sourceStatus],
    );
    await this.collectionTaskEvent(c, {
      taskId: sourceTaskId,
      organizationId: String(source.organization_id),
      workspaceId: String(source.workspace_id),
      fromStatus: sourceStatus,
      toStatus: "automatically_replayed",
      metadata: { reason: replayReason, replay_task_id: newTaskId },
      input,
    });
    await this.collectionTaskEvent(c, {
      taskId: newTaskId,
      organizationId: String(source.organization_id),
      workspaceId: String(source.workspace_id),
      fromStatus: null,
      toStatus: "scheduled",
      metadata: { replay_of_task_id: sourceTaskId, reason: replayReason },
      input,
    });
    await c.query(
      [
        "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id,event_type,payload_json,status,",
        "attempt_count,available_at,lease_owner,lease_expires_at,request_id,trace_id,created_at,updated_at) VALUES ",
        "(?,?,?,?,? ,?,'queued',0,?,NULL,NULL,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        newTaskId,
        source.organization_id,
        source.workspace_id,
        "collection.task.scheduled",
        JSON.stringify({
          task_id: newTaskId,
          replay_of_task_id: sourceTaskId,
          replay_reason: replayReason,
        }),
        input.now,
        input.requestId,
        input.traceId,
        input.now,
        input.now,
      ],
    );
    return newTaskId;
  }

  private collectionTaskEvent(
    c: PoolConnection,
    value: {
      taskId: string;
      organizationId: string;
      workspaceId: string;
      fromStatus: string | null;
      toStatus: string;
      metadata: Record<string, unknown>;
      input: Parameters<CredentialAssetRepository["rotateAsset"]>[0];
    },
  ) {
    return c.query(
      [
        "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,to_status,",
        "actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?,'system',?,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        value.taskId,
        value.organizationId,
        value.workspaceId,
        `collection.task.${value.toStatus}`,
        value.fromStatus,
        value.toStatus,
        value.input.actorId,
        value.input.requestId,
        value.input.traceId,
        JSON.stringify(value.metadata),
        value.input.now,
      ],
    );
  }

  private async completeRenewalTask(
    c: PoolConnection,
    input: Parameters<CredentialAssetRepository["rotateAsset"]>[0],
    profileId: string,
    replayedTaskIds: string[],
  ) {
    const [tasks] = await c.query<RowDataPacket[]>(
      [
        "SELECT id,organization_id,workspace_id FROM tasks WHERE source_type='collection_followup' AND ",
        "source_ref_id=? AND status IN ('todo','in_progress','paused') FOR UPDATE",
      ].join(""),
      [profileId],
    );
    for (const task of tasks) {
      await c.query(
        "UPDATE tasks SET status='completed',completed_at=?,version=version+1,updated_at=? WHERE id=?",
        [input.now, input.now, task.id],
      );
      await c.query(
        [
          "INSERT INTO task_events (id,organization_id,workspace_id,task_id,event_type,actor_id,payload_json,request_id,",
          "trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          task.organization_id,
          task.workspace_id,
          task.id,
          "task.credential_renewal_completed",
          input.actorId,
          JSON.stringify({ crawler_profile_id: profileId, replayed_task_ids: replayedTaskIds }),
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
    }
  }
  async createAsset(input: Parameters<CredentialAssetRepository["createAsset"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/credential-assets";
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [providers] = await c.query<RowDataPacket[]>("SELECT id FROM providers WHERE id=?", [
        input.value.provider_id,
      ]);
      if (!providers[0])
        throw new CredentialAssetError(
          "credential_provider_not_found",
          404,
          "先在来源注册中心登记 Provider。",
        );
      const s = input.sealed;
      await c.query(
        [
          "INSERT INTO credential_assets (id,provider_id,name,kind,payload_ciphertext,payload_nonce,payload_auth_tag,",
          "key_version,fingerprint,status,expires_at,rotated_at,revoked_at,revoked_by,revocation_reason,version,",
          "created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',?,NULL,NULL,NULL,NULL,1,?,?,?,?)",
        ].join(""),
        [
          input.id,
          input.value.provider_id,
          input.value.name,
          input.value.kind,
          s.ciphertext,
          s.nonce,
          s.authTag,
          input.keyVersion,
          s.fingerprint,
          input.value.expires_at ? new Date(input.value.expires_at) : null,
          input.actorId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,",
          "payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) ",
          "VALUES (?,?,?,?,?,?,?,?,'created',?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.id,
          1,
          s.ciphertext,
          s.nonce,
          s.authTag,
          input.keyVersion,
          s.fingerprint,
          input.actorId,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO credential_asset_operations (id,actor_id,route,idempotency_key,credential_asset_id,result_version,created_at) VALUES (?,?,?,?,?,1,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.id, input.now],
      );
      await c.commit();
      const result: CredentialAssetSummary = {
        id: input.id,
        provider_id: input.value.provider_id,
        name: input.value.name,
        kind: input.value.kind,
        status: "active",
        key_version: input.keyVersion,
        fingerprint: s.fingerprint,
        expires_at: input.value.expires_at,
        rotated_at: null,
        version: 1,
        updated_at: input.now.toISOString(),
      };
      return result;
    } catch (error: any) {
      await c.rollback();
      if (error instanceof CredentialAssetError) throw error;
      if (error?.code === "ER_DUP_ENTRY")
        throw new CredentialAssetError("credential_conflict", 409, "更换 Idempotency-Key 后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async rotateAsset(input: Parameters<CredentialAssetRepository["rotateAsset"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/credential-assets/${input.id}/rotate`;
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT ${assetColumns} FROM credential_assets a WHERE a.id=? FOR UPDATE`,
        [input.id],
      );
      if (!rows[0]) throw new CredentialAssetError("credential_not_found", 404, "刷新凭证列表。");
      if (rows[0].status === "revoked")
        throw new CredentialAssetError("credential_revoked", 409, "已撤销凭证不能轮换。");
      if (Number(rows[0].version) !== input.expectedVersion)
        throw new CredentialAssetError(
          "credential_version_conflict",
          409,
          "刷新最新版本后重新提交。",
        );
      const next = input.expectedVersion + 1,
        s = input.sealed;
      await c.query(
        [
          "UPDATE credential_assets SET payload_ciphertext=?,payload_nonce=?,payload_auth_tag=?,key_version=?,",
          "fingerprint=?,expires_at=?,rotated_at=?,version=?,updated_by=?,updated_at=? WHERE id=?",
        ].join(""),
        [
          s.ciphertext,
          s.nonce,
          s.authTag,
          input.keyVersion,
          s.fingerprint,
          input.expiresAt,
          input.now,
          next,
          input.actorId,
          input.now,
          input.id,
        ],
      );
      await c.query(
        [
          "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,",
          "payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) ",
          "VALUES (?,?,?,?,?,?,?,?,'rotated',?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.id,
          next,
          s.ciphertext,
          s.nonce,
          s.authTag,
          input.keyVersion,
          s.fingerprint,
          input.actorId,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO credential_asset_operations (id,actor_id,route,idempotency_key,credential_asset_id,result_version,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.id, next, input.now],
      );
      await this.replayRenewedProfiles(c, input);
      await c.commit();
      return asset({
        ...rows[0],
        key_version: input.keyVersion,
        fingerprint: s.fingerprint,
        expires_at: input.expiresAt,
        rotated_at: input.now,
        version: next,
        updated_at: input.now,
      } as RowDataPacket);
    } catch (error: any) {
      await c.rollback();
      if (error instanceof CredentialAssetError) throw error;
      if (error?.code === "ER_DUP_ENTRY")
        throw new CredentialAssetError("credential_conflict", 409, "更换 Idempotency-Key 后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async revokeAsset(input: Parameters<CredentialAssetRepository["revokeAsset"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/credential-assets/${input.id}/revoke`;
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT ${assetColumns},a.payload_ciphertext,a.payload_nonce,a.payload_auth_tag FROM credential_assets a WHERE a.id=? FOR UPDATE`,
        [input.id],
      );
      if (!rows[0]) throw new CredentialAssetError("credential_not_found", 404, "刷新凭证列表。");
      if (Number(rows[0].version) !== input.expectedVersion)
        throw new CredentialAssetError(
          "credential_version_conflict",
          409,
          "刷新最新版本后重新提交。",
        );
      if (rows[0].status === "revoked")
        throw new CredentialAssetError("credential_revoked", 409, "凭证已经撤销。");
      const next = input.expectedVersion + 1,
        r = rows[0];
      await c.query(
        "UPDATE credential_assets SET status='revoked',revoked_at=?,revoked_by=?,revocation_reason=?,version=?,updated_by=?,updated_at=? WHERE id=?",
        [input.now, input.actorId, input.reason, next, input.actorId, input.now, input.id],
      );
      await c.query(
        [
          "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,",
          "payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) ",
          "VALUES (?,?,?,?,?,?,?,?,'revoked',?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.id,
          next,
          r.payload_ciphertext,
          r.payload_nonce,
          r.payload_auth_tag,
          r.key_version,
          r.fingerprint,
          input.actorId,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO credential_asset_operations (id,actor_id,route,idempotency_key,credential_asset_id,result_version,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.id, next, input.now],
      );
      await c.commit();
      return asset({
        ...r,
        status: "revoked",
        version: next,
        updated_at: input.now,
      } as RowDataPacket);
    } catch (error: any) {
      await c.rollback();
      if (error instanceof CredentialAssetError) throw error;
      if (error?.code === "ER_DUP_ENTRY")
        throw new CredentialAssetError("credential_conflict", 409, "更换 Idempotency-Key 后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async listProfiles() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${profileColumns} FROM crawler_profiles p ORDER BY p.status='active' DESC,p.name,p.id`,
    );
    return rows.map(profile);
  }
  private async replayProfile(c: PoolConnection, actorId: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        `SELECT ${profileColumns} FROM crawler_profile_operations o JOIN crawler_profiles p ON `,
        "p.id=o.crawler_profile_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(""),
      [actorId, route, key],
    );
    return rows[0] ? profile(rows[0]) : null;
  }
  async createProfile(input: Parameters<CredentialAssetRepository["createProfile"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/crawler-profiles";
    try {
      await c.beginTransaction();
      const replay = await this.replayProfile(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [assets] = await c.query<RowDataPacket[]>(
        "SELECT id FROM credential_assets WHERE id=? AND provider_id=? AND kind IN ('browser_profile','cookie_bundle') AND status='active'",
        [input.value.credential_asset_id, input.value.provider_id],
      );
      if (!assets[0])
        throw new CredentialAssetError(
          "crawler_profile_asset_invalid",
          409,
          "选择同一来源的可用浏览器档案或 Cookie 档案。",
        );
      const v = input.value;
      await c.query(
        [
          "INSERT INTO crawler_profiles (id,provider_id,credential_asset_id,code,name,browser_family,locale,timezone,",
          "status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        ].join(""),
        [
          input.id,
          v.provider_id,
          v.credential_asset_id,
          v.code,
          v.name,
          v.browser_family,
          v.locale,
          v.timezone,
          v.status,
          input.actorId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      const result = {
        id: input.id,
        ...v,
        version: 1,
        updated_at: input.now.toISOString(),
      };
      await c.query(
        [
          "INSERT INTO crawler_profile_versions (id,crawler_profile_id,version,snapshot_json,action,actor_id,",
          "request_id,trace_id,created_at) VALUES (?,?,1,?,'created',?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.id,
          JSON.stringify(result),
          input.actorId,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO crawler_profile_operations (id,actor_id,route,idempotency_key,crawler_profile_id,result_version,created_at) VALUES (?,?,?,?,?,1,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.id, input.now],
      );
      await c.commit();
      return result;
    } catch (error: any) {
      await c.rollback();
      if (error instanceof CredentialAssetError) throw error;
      if (error?.code === "ER_DUP_ENTRY")
        throw new CredentialAssetError(
          "crawler_profile_conflict",
          409,
          "更换 code 或 Idempotency-Key 后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
}
