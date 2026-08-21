import type { Pool } from "mysql2/promise";
import type { AuthOutboxRecord, AuthOutboxStore } from "@scoutops/auth";

export class MySqlAuthOutboxStore implements AuthOutboxStore {
  constructor(private readonly pool: Pool) {}
  async enqueue(record: AuthOutboxRecord) {
    await this.pool.query(
      "INSERT INTO auth_delivery_outbox (id,user_id,kind,payload_ciphertext,payload_nonce,payload_auth_tag,status,attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'queued',0,?,NULL,NULL,NULL,?,?,?,?)",
      [
        record.id,
        record.userId,
        record.kind,
        record.ciphertext,
        record.nonce,
        record.authTag,
        record.createdAt,
        record.requestId,
        record.traceId,
        record.createdAt,
        record.createdAt,
      ],
    );
  }
}
