import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { openCredential } from "@scoutops/credentials";
import { anonymousAmazonFingerprint } from "@scoutops/provider-sources";
import { parseCookieBundle, validAmazonAdministratorCookies } from "@scoutops/playwright-crawler";
import { CredentialAssetError } from "./credential-asset-service.js";

export interface AmazonCookieSessionSummary {
  profile_id: string;
  profile_version: number;
  provider_id: string;
  asset_id: string;
  asset_version: number;
  asset_name: string;
  mode: "anonymous" | "administrator_cookie";
  available: boolean;
  expires_at: string | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (code: string, status: number, hint: string): never => {
  throw new CredentialAssetError(code, status, hint);
};

/** A single explicitly configured project profile; no fallback to another account. */
export class AmazonCookieSessionService {
  constructor(
    private readonly pool: Pool,
    private readonly profileId: string,
    private readonly masterKey: string,
    private readonly now = () => new Date(),
  ) {}
  async get(): Promise<AmazonCookieSessionSummary> {
    if (!uuid.test(this.profileId))
      return fail(
        "amazon_session_unconfigured",
        409,
        "先配置现有 AMAZON_PUBLIC_BROWSER_PROFILE_ID，不能自动选择其他档案。",
      );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT p.id,p.version profile_version,p.provider_id,p.status profile_status,a.id asset_id,a.version asset_version,a.name asset_name,a.kind,a.fingerprint,a.status asset_status,a.expires_at FROM crawler_profiles p JOIN providers v ON v.id=p.provider_id AND v.code='amazon_product' JOIN credential_assets a ON a.id=p.credential_asset_id AND a.provider_id=p.provider_id WHERE p.id=?",
      [this.profileId],
    );
    const r = rows[0];
    if (!r) return fail("amazon_session_unavailable", 409, "Amazon 档案或凭证不可用。");
    const cookie = r.kind === "cookie_bundle";
    const permitted =
      cookie || (r.kind === "browser_profile" && r.fingerprint === anonymousAmazonFingerprint());
    return {
      profile_id: this.profileId,
      profile_version: Number(r.profile_version),
      provider_id: String(r.provider_id),
      asset_id: String(r.asset_id),
      asset_version: Number(r.asset_version),
      asset_name: String(r.asset_name),
      mode: cookie ? "administrator_cookie" : "anonymous",
      available:
        permitted &&
        r.profile_status === "active" &&
        r.asset_status === "active" &&
        (!r.expires_at || new Date(r.expires_at) > this.now()),
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    };
  }
  async activate(
    value: { asset_id: string; expected_asset_version: number; expected_profile_version: number },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (
      !uuid.test(this.profileId) ||
      !value ||
      !uuid.test(value.asset_id) ||
      Object.keys(value).some(
        (key) => !["asset_id", "expected_asset_version", "expected_profile_version"].includes(key),
      ) ||
      ![value.expected_asset_version, value.expected_profile_version].every(
        (v) => Number.isInteger(v) && v > 0,
      )
    )
      return fail("amazon_session_invalid", 400, "选择已保存的 Amazon 凭证并刷新版本后提交。");
    const c = await this.pool.getConnection(),
      now = this.now(),
      route = "/platform/amazon-session";
    try {
      await c.beginTransaction();
      const [replays] = await c.query<RowDataPacket[]>(
        "SELECT crawler_profile_id,result_version FROM crawler_profile_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [context.actorId, route, context.idempotencyKey],
      );
      const [profiles] = await c.query<RowDataPacket[]>(
        "SELECT p.* FROM crawler_profiles p JOIN providers v ON v.id=p.provider_id AND v.code='amazon_product' WHERE p.id=? AND p.status='active' FOR UPDATE",
        [this.profileId],
      );
      const p = profiles[0];
      if (!p) return fail("amazon_session_unavailable", 409, "Amazon 档案未启用。");
      if (replays[0]) {
        if (
          replays[0].crawler_profile_id !== this.profileId ||
          Number(replays[0].result_version) !== Number(p.version) ||
          p.credential_asset_id !== value.asset_id
        )
          return fail(
            "amazon_session_conflict",
            409,
            "此前请求后配置已改变，请刷新，不要重放旧操作。",
          );
        await c.commit();
        return this.get();
      }
      if (Number(p.version) !== value.expected_profile_version)
        return fail("amazon_session_conflict", 409, "档案版本已改变，请刷新。");
      const [leases] = await c.query<RowDataPacket[]>(
        "SELECT run_id FROM crawler_profile_leases WHERE crawler_profile_id=? AND expires_at>? LIMIT 1",
        [this.profileId, now],
      );
      if (leases[0])
        return fail(
          "amazon_session_busy",
          409,
          "当前会话正在采集，请等待租约自然结束；不会强制终止任务。",
        );
      const [assets] = await c.query<RowDataPacket[]>(
        "SELECT * FROM credential_assets WHERE id=? AND provider_id=? AND status='active' FOR UPDATE",
        [value.asset_id, p.provider_id],
      );
      const a = assets[0];
      if (
        !a ||
        Number(a.version) !== value.expected_asset_version ||
        (a.expires_at && new Date(a.expires_at) <= now)
      )
        return fail("amazon_cookie_unavailable", 409, "凭证已过期、撤销或版本改变，请更新后重试。");
      if (a.kind === "cookie_bundle") {
        if (this.masterKey.length < 32)
          return fail(
            "credential_master_key_unavailable",
            503,
            "服务端受限密钥未就绪，请管理员检查配置。",
          );
        try {
          const payload = openCredential(
            {
              assetId: String(a.id),
              assetVersion: Number(a.version),
              kind: String(a.kind),
              keyVersion: String(a.key_version),
              ciphertext: a.payload_ciphertext,
              nonce: a.payload_nonce,
              authTag: a.payload_auth_tag,
              fingerprint: String(a.fingerprint),
            },
            this.masterKey,
          );
          const cookies = parseCookieBundle(
            payload.encoding === "base64"
              ? Buffer.from(payload.value, "base64").toString("utf8")
              : payload.value,
          );
          if (!validAmazonAdministratorCookies(cookies, now.getTime())) throw new Error();
        } catch {
          return fail(
            "amazon_cookie_invalid",
            400,
            "需要同一 Amazon 美国站的有效登录 Cookie；不接受外域、缺失登录字段或过期内容。",
          );
        }
      } else if (a.kind !== "browser_profile" || a.fingerprint !== anonymousAmazonFingerprint())
        return fail("amazon_cookie_invalid", 400, "仅支持管理员 Cookie 或项目原匿名档案。");
      const version = Number(p.version) + 1;
      await c.query(
        "UPDATE crawler_profiles SET credential_asset_id=?,version=?,updated_by=?,updated_at=? WHERE id=? AND version=?",
        [a.id, version, context.actorId, now, this.profileId, p.version],
      );
      const snapshot = {
        id: this.profileId,
        provider_id: p.provider_id,
        credential_asset_id: a.id,
        code: p.code,
        name: p.name,
        browser_family: p.browser_family,
        locale: p.locale,
        timezone: p.timezone,
        status: p.status,
        version,
        updated_at: now.toISOString(),
      };
      await c.query(
        "INSERT INTO crawler_profile_versions (id,crawler_profile_id,version,snapshot_json,action,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,?,'updated',?,?,?,?)",
        [
          randomUUID(),
          this.profileId,
          version,
          JSON.stringify(snapshot),
          context.actorId,
          context.requestId,
          context.traceId,
          now,
        ],
      );
      await c.query(
        "INSERT INTO crawler_profile_operations (id,actor_id,route,idempotency_key,crawler_profile_id,result_version,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          context.actorId,
          route,
          context.idempotencyKey,
          this.profileId,
          version,
          now,
        ],
      );
      // No source/circuit/task/lease mutation, and no automatic replay.
      await c.commit();
      return this.get();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
}
