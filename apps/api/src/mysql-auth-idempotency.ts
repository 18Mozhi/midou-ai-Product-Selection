import { createHash, randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuthError } from '@scoutops/auth';
import type { AuthIdempotency, IdempotentResponse } from './auth-routes.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export class MySqlAuthIdempotency implements AuthIdempotency {
  constructor(private readonly pool: Pool) {}
  async execute<T>(input: { scope: string; route: string; method: 'POST'|'DELETE'; key: string; requestId: string; traceId: string }, work: () => Promise<IdempotentResponse<T>>): Promise<IdempotentResponse<T>> {
    const now = new Date(); const scopeHash = digest(input.scope); const keyHash = digest(input.key); const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000); const id = randomUUID();
    try {
      await this.pool.query("INSERT INTO auth_idempotency_records (id,scope_hash,route,http_method,idempotency_key_hash,status,response_status,response_json,request_id,trace_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,'processing',NULL,NULL,?,?,?,?,?)", [id,scopeHash,input.route,input.method,keyHash,input.requestId,input.traceId,expiresAt,now,now]);
    } catch (error) {
      if (!(typeof error === 'object' && error && 'code' in error && error.code === 'ER_DUP_ENTRY')) throw error;
      const [rows] = await this.pool.query<RowDataPacket[]>("SELECT status,response_status,response_json FROM auth_idempotency_records WHERE scope_hash=? AND route=? AND http_method=? AND idempotency_key_hash=? AND expires_at>? LIMIT 1", [scopeHash,input.route,input.method,keyHash,now]);
      const row = rows[0];
      if (row?.status === 'succeeded') return { status: Number(row.response_status), body: typeof row.response_json === 'string' ? JSON.parse(row.response_json) : row.response_json as T, replayed: true };
      if (row?.status === 'failed') {
        await this.pool.query("DELETE FROM auth_idempotency_records WHERE scope_hash=? AND route=? AND http_method=? AND idempotency_key_hash=? AND status='failed'", [scopeHash,input.route,input.method,keyHash]);
        return this.execute(input, work);
      }
      throw new AuthError('idempotency_in_progress', 409, '等待原请求完成后重试。');
    }
    try {
      const result = await work();
      await this.pool.query("UPDATE auth_idempotency_records SET status='succeeded',response_status=?,response_json=?,updated_at=? WHERE id=?", [result.status,JSON.stringify(result.body),new Date(),id]);
      return result;
    } catch (error) {
      await this.pool.query("UPDATE auth_idempotency_records SET status='failed',updated_at=? WHERE id=?", [new Date(),id]); throw error;
    }
  }
}
