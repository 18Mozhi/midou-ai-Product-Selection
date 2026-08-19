import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  CrawlerProfileSummary,
  CredentialAssetSummary,
} from "@scoutops/contracts";
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
export class MySqlCredentialAssetRepository
  implements CredentialAssetRepository
{
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
    if (!rows[0])
      throw new CredentialAssetError(
        "credential_not_found",
        404,
        "刷新凭证列表。",
      );
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
  private async replayAsset(
    c: PoolConnection,
    actorId: string,
    route: string,
    key: string,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT ${assetColumns} FROM credential_asset_operations o JOIN credential_assets a ON a.id=o.credential_asset_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1`,
      [actorId, route, key],
    );
    return rows[0] ? asset(rows[0]) : null;
  }
  async createAsset(
    input: Parameters<CredentialAssetRepository["createAsset"]>[0],
  ) {
    const c = await this.pool.getConnection(),
      route = "/platform/credential-assets";
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(
        c,
        input.actorId,
        route,
        input.idempotencyKey,
      );
      if (replay) {
        await c.commit();
        return replay;
      }
      const [providers] = await c.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE id=?",
        [input.value.provider_id],
      );
      if (!providers[0])
        throw new CredentialAssetError(
          "credential_provider_not_found",
          404,
          "先在来源注册中心登记 Provider。",
        );
      const s = input.sealed;
      await c.query(
        "INSERT INTO credential_assets (id,provider_id,name,kind,payload_ciphertext,payload_nonce,payload_auth_tag,key_version,fingerprint,status,expires_at,rotated_at,revoked_at,revoked_by,revocation_reason,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',?,NULL,NULL,NULL,NULL,1,?,?,?,?)",
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
        "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,'created',?,?,?,?)",
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
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.id,
          input.now,
        ],
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
        throw new CredentialAssetError(
          "credential_conflict",
          409,
          "更换 Idempotency-Key 后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async rotateAsset(
    input: Parameters<CredentialAssetRepository["rotateAsset"]>[0],
  ) {
    const c = await this.pool.getConnection(),
      route = `/platform/credential-assets/${input.id}/rotate`;
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(
        c,
        input.actorId,
        route,
        input.idempotencyKey,
      );
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT ${assetColumns} FROM credential_assets a WHERE a.id=? FOR UPDATE`,
        [input.id],
      );
      if (!rows[0])
        throw new CredentialAssetError(
          "credential_not_found",
          404,
          "刷新凭证列表。",
        );
      if (rows[0].status === "revoked")
        throw new CredentialAssetError(
          "credential_revoked",
          409,
          "已撤销凭证不能轮换。",
        );
      if (Number(rows[0].version) !== input.expectedVersion)
        throw new CredentialAssetError(
          "credential_version_conflict",
          409,
          "刷新最新版本后重新提交。",
        );
      const next = input.expectedVersion + 1,
        s = input.sealed;
      await c.query(
        "UPDATE credential_assets SET payload_ciphertext=?,payload_nonce=?,payload_auth_tag=?,key_version=?,fingerprint=?,expires_at=?,rotated_at=?,version=?,updated_by=?,updated_at=? WHERE id=?",
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
        "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,'rotated',?,?,?,?)",
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
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.id,
          next,
          input.now,
        ],
      );
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
        throw new CredentialAssetError(
          "credential_conflict",
          409,
          "更换 Idempotency-Key 后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async revokeAsset(
    input: Parameters<CredentialAssetRepository["revokeAsset"]>[0],
  ) {
    const c = await this.pool.getConnection(),
      route = `/platform/credential-assets/${input.id}/revoke`;
    try {
      await c.beginTransaction();
      const replay = await this.replayAsset(
        c,
        input.actorId,
        route,
        input.idempotencyKey,
      );
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT ${assetColumns},a.payload_ciphertext,a.payload_nonce,a.payload_auth_tag FROM credential_assets a WHERE a.id=? FOR UPDATE`,
        [input.id],
      );
      if (!rows[0])
        throw new CredentialAssetError(
          "credential_not_found",
          404,
          "刷新凭证列表。",
        );
      if (Number(rows[0].version) !== input.expectedVersion)
        throw new CredentialAssetError(
          "credential_version_conflict",
          409,
          "刷新最新版本后重新提交。",
        );
      if (rows[0].status === "revoked")
        throw new CredentialAssetError(
          "credential_revoked",
          409,
          "凭证已经撤销。",
        );
      const next = input.expectedVersion + 1,
        r = rows[0];
      await c.query(
        "UPDATE credential_assets SET status='revoked',revoked_at=?,revoked_by=?,revocation_reason=?,version=?,updated_by=?,updated_at=? WHERE id=?",
        [
          input.now,
          input.actorId,
          input.reason,
          next,
          input.actorId,
          input.now,
          input.id,
        ],
      );
      await c.query(
        "INSERT INTO credential_asset_versions (id,credential_asset_id,version,payload_ciphertext,payload_nonce,payload_auth_tag,key_version,fingerprint,action,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,'revoked',?,?,?,?)",
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
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.id,
          next,
          input.now,
        ],
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
        throw new CredentialAssetError(
          "credential_conflict",
          409,
          "更换 Idempotency-Key 后重试。",
        );
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
  private async replayProfile(
    c: PoolConnection,
    actorId: string,
    route: string,
    key: string,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT ${profileColumns} FROM crawler_profile_operations o JOIN crawler_profiles p ON p.id=o.crawler_profile_id WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1`,
      [actorId, route, key],
    );
    return rows[0] ? profile(rows[0]) : null;
  }
  async createProfile(
    input: Parameters<CredentialAssetRepository["createProfile"]>[0],
  ) {
    const c = await this.pool.getConnection(),
      route = "/platform/crawler-profiles";
    try {
      await c.beginTransaction();
      const replay = await this.replayProfile(
        c,
        input.actorId,
        route,
        input.idempotencyKey,
      );
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
        "INSERT INTO crawler_profiles (id,provider_id,credential_asset_id,code,name,browser_family,locale,timezone,status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
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
        "INSERT INTO crawler_profile_versions (id,crawler_profile_id,version,snapshot_json,action,actor_id,request_id,trace_id,created_at) VALUES (?,?,1,?,'created',?,?,?,?)",
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
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.id,
          input.now,
        ],
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
