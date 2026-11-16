import { createHmac, randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { openCredential } from "@scoutops/credentials";
import { appendWebhookDeliveryEvent } from "@scoutops/database";

const deniedIp = (ip: string) => {
  if (!isIP(ip)) return true;
  if (ip.includes(":")) {
    const x = ip.toLowerCase();
    return (
      x === "::1" ||
      x === "::" ||
      x.startsWith("fc") ||
      x.startsWith("fd") ||
      x.startsWith("fe8") ||
      x.startsWith("fe9") ||
      x.startsWith("fea") ||
      x.startsWith("feb") ||
      x.startsWith("ff")
    );
  }
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
};
export async function resolveWebhookTarget(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || u.hash || (u.port && u.port !== "443"))
    throw new Error("webhook_target_forbidden");
  const answers = await dnsLookup(u.hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((x) => deniedIp(x.address)))
    throw new Error("webhook_target_private");
  return { url: u, address: answers[0]!.address, family: answers[0]!.family };
}
export async function postSignedWebhook(input: {
  url: URL;
  address: string;
  family: number;
  body: string;
  deliveryId: string;
  timestamp: number;
  secret: string;
  timeoutMs: number;
}) {
  const signature = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.deliveryId}.${input.body}`)
    .digest("hex");
  return new Promise<number>((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: "https:",
        hostname: input.url.hostname,
        port: 443,
        path: `${input.url.pathname}${input.url.search}`,
        method: "POST",
        servername: input.url.hostname,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(input.body),
          "user-agent": "ScoutOps-Webhook/1.0",
          "x-scoutops-id": input.deliveryId,
          "x-scoutops-timestamp": String(input.timestamp),
          "x-scoutops-signature": `v1=${signature}`,
        },
        lookup: (_host, _options, callback) => callback(null, input.address, input.family as 4 | 6),
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.setTimeout(input.timeoutMs, () => req.destroy(new Error("webhook_timeout")));
    req.on("error", reject);
    req.end(input.body);
  });
}
export class WebhookDeliveryWorker {
  constructor(
    private readonly pool: Pool,
    private readonly o: {
      workerId: string;
      masterKey: string;
      leaseSeconds: number;
      timeoutMs: number;
      retrySeconds: number[];
    },
    private readonly now = () => new Date(),
  ) {}
  async lease() {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT d.id,d.status FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE e.status='active' AND ((d.status IN ('queued','retry_scheduled') AND d.available_at<=?) OR (d.status='leased' AND d.lease_expires_at<=?)) ORDER BY d.available_at,d.id LIMIT 1 FOR UPDATE",
        [this.now(), this.now()],
      );
      if (!rows[0]) {
        await c.commit();
        return null;
      }
      const id = rows[0].id,
        fromStatus = rows[0].status,
        lease = new Date(this.now().getTime() + this.o.leaseSeconds * 1000);
      await c.query(
        "UPDATE webhook_deliveries SET status='leased',lease_owner=?,lease_expires_at=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?",
        [this.o.workerId, lease, this.now(), id],
      );
      const [full] = await c.query<RowDataPacket[]>(
        "SELECT d.*,e.target_url,e.secret_ciphertext,e.secret_nonce,e.secret_auth_tag,e.key_version,e.version endpoint_version FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE d.id=?",
        [id],
      );
      const current = full[0]!;
      await appendWebhookDeliveryEvent(c, {
        id: randomUUID(),
        deliveryId: id,
        fromStatus,
        toStatus: "leased",
        attempts: current.attempt_count,
        reason: null,
        actorId: null,
        requestId: current.request_id,
        traceId: current.trace_id,
        occurredAt: this.now(),
      });
      await c.commit();
      return current;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async finish(
    row: RowDataPacket,
    status: "succeeded" | "retry_scheduled" | "dead_letter",
    responseStatus: number | null,
    errorCode: string | null,
    signatureTimestamp: number | null,
  ) {
    const now = this.now();
    const delay =
        this.o.retrySeconds[Math.max(0, Number(row.attempt_count) - 1)] ??
        this.o.retrySeconds.at(-1) ??
        900,
      available = new Date(now.getTime() + delay * 1000);
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [updated] = await c.query<ResultSetHeader>(
        "UPDATE webhook_deliveries SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL," +
          "response_status=?,last_error_code=?,signature_timestamp=?,updated_at=? " +
          "WHERE id=? AND endpoint_id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
        [
          status,
          available,
          responseStatus,
          errorCode,
          signatureTimestamp,
          now,
          row.id,
          row.endpoint_id,
          this.o.workerId,
          row.attempt_count,
          now,
        ],
      );
      if (updated.affectedRows === 0) {
        await c.commit();
        return false;
      }
      if (updated.affectedRows !== 1) throw new Error("webhook_delivery_finish_scope_invalid");
      await appendWebhookDeliveryEvent(c, {
        id: randomUUID(),
        deliveryId: row.id,
        fromStatus: "leased",
        toStatus: status,
        attempts: row.attempt_count,
        reason: errorCode,
        actorId: null,
        requestId: row.request_id,
        traceId: row.trace_id,
        occurredAt: now,
      });
      await c.commit();
      return true;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async runOnce() {
    const row = await this.lease();
    if (!row) return false;
    let response: number | null = null,
      error: string | null = null,
      signatureTimestamp: number | null = null;
    try {
      const target = await resolveWebhookTarget(row.target_url),
        payload =
          typeof row.payload_json === "string"
            ? row.payload_json
            : JSON.stringify(row.payload_json),
        secret = openCredential(
          {
            assetId: row.endpoint_id,
            assetVersion: Number(row.endpoint_version),
            kind: "webhook_signing",
            keyVersion: row.key_version,
            ciphertext: row.secret_ciphertext,
            nonce: row.secret_nonce,
            authTag: row.secret_auth_tag,
            fingerprint: "",
          },
          this.o.masterKey,
        ).value;
      signatureTimestamp = Math.floor(this.now().getTime() / 1000);
      response = await postSignedWebhook({
        ...target,
        body: payload,
        deliveryId: row.id,
        timestamp: signatureTimestamp,
        secret,
        timeoutMs: this.o.timeoutMs,
      });
      if (response < 200 || response >= 300) error = `http_${response}`;
    } catch (e: any) {
      error = String(e?.message ?? "webhook_delivery_failed").slice(0, 80);
    }
    await this.finish(
      row,
      error === null && response !== null
        ? "succeeded"
        : Number(row.attempt_count) >= 4
          ? "dead_letter"
          : "retry_scheduled",
      response,
      error,
      signatureTimestamp,
    );
    return true;
  }
}
