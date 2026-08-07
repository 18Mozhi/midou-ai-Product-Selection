import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ActionTokenPurpose, ActionTokenRecord, AuthRepository, AuthSecurityEvent, SessionRecord, UserRecord } from '@scoutops/auth';
import { AuthError } from '@scoutops/auth';
import { withTransaction } from '@scoutops/database';

const userColumns = 'id,email,email_normalized,password_hash,status,email_verified_at,failed_login_count,locked_until,password_changed_at,must_change_password,must_enroll_mfa,security_setup_completed_at,version,created_at,updated_at';
const sessionColumns = 'id,user_id,token_hash,status,device_label,user_agent_hash,ip_hash,expires_at,last_seen_at,revoked_at,created_at';
const asUser = (row: RowDataPacket) => ({...row,must_change_password:Boolean(row.must_change_password),must_enroll_mfa:Boolean(row.must_enroll_mfa)}) as UserRecord;
const asSession = (row: RowDataPacket) => row as SessionRecord;
const asToken = (row: RowDataPacket) => row as ActionTokenRecord;

export class MySqlAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT ${userColumns} FROM users WHERE email_normalized=? LIMIT 1`, [email]);
    return rows[0] ? asUser(rows[0]) : null;
  }
  async findUserById(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT ${userColumns} FROM users WHERE id=? LIMIT 1`, [id]);
    return rows[0] ? asUser(rows[0]) : null;
  }
  async createUser(user: UserRecord) {
    try {
      await this.pool.query('INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,failed_login_count,locked_until,password_changed_at,must_change_password,must_enroll_mfa,security_setup_completed_at,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [user.id,user.email,user.email_normalized,user.password_hash,user.status,user.email_verified_at,user.failed_login_count,user.locked_until,user.password_changed_at,user.must_change_password,user.must_enroll_mfa,user.security_setup_completed_at,user.version,user.created_at,user.updated_at]);
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AuthError('email_already_registered', 409, '登录或使用密码重置找回账号。');
      throw error;
    }
  }
  async discardPendingRegistration(userId: string) {
    await withTransaction(this.pool, async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>('SELECT status FROM users WHERE id=? LIMIT 1 FOR UPDATE', [userId]);
      if (!rows[0] || rows[0].status !== 'pending_verification') return;
      await connection.query('DELETE FROM auth_delivery_outbox WHERE user_id=?', [userId]);
      await connection.query('DELETE FROM auth_action_tokens WHERE user_id=?', [userId]);
      await connection.query("DELETE FROM users WHERE id=? AND status='pending_verification'", [userId]);
    });
  }
  async saveUser(user: UserRecord) {
    const [result] = await this.pool.query<ResultSetHeader>('UPDATE users SET email=?,email_normalized=?,password_hash=?,status=?,email_verified_at=?,failed_login_count=?,locked_until=?,password_changed_at=?,must_change_password=?,must_enroll_mfa=?,security_setup_completed_at=?,version=?,updated_at=? WHERE id=?', [user.email,user.email_normalized,user.password_hash,user.status,user.email_verified_at,user.failed_login_count,user.locked_until,user.password_changed_at,user.must_change_password,user.must_enroll_mfa,user.security_setup_completed_at,user.version,user.updated_at,user.id]);
    if (result.affectedRows !== 1) throw new Error('user_not_found');
  }
  async createActionToken(token: ActionTokenRecord) {
    await this.pool.query('INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at,consumed_at,created_at) VALUES (?,?,?,?,?,?,?)', [token.id,token.user_id,token.purpose,token.token_hash,token.expires_at,token.consumed_at,token.created_at]);
  }
  async consumeActionToken(tokenHash: string, purpose: ActionTokenPurpose, now: Date) {
    return withTransaction(this.pool, async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>('SELECT id,user_id,purpose,token_hash,expires_at,consumed_at,created_at FROM auth_action_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>? LIMIT 1 FOR UPDATE', [tokenHash,purpose,now]);
      if (!rows[0]) return null;
      await connection.query('UPDATE auth_action_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL', [now,rows[0].id]);
      return asToken({ ...rows[0], consumed_at: now } as RowDataPacket);
    });
  }
  async createSession(session: SessionRecord) {
    await this.pool.query('INSERT INTO user_sessions (id,user_id,token_hash,status,device_label,user_agent_hash,ip_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [session.id,session.user_id,session.token_hash,session.status,session.device_label,session.user_agent_hash,session.ip_hash,session.expires_at,session.last_seen_at,session.revoked_at,session.created_at]);
  }
  async findSessionByTokenHash(hash: string, now: Date) {
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT ${sessionColumns} FROM user_sessions WHERE token_hash=? LIMIT 1`, [hash]); const row = rows[0];
    if (!row || row.status !== 'active') return null;
    if (new Date(row.expires_at) <= now) { await this.pool.query("UPDATE user_sessions SET status='expired' WHERE id=? AND status='active'", [row.id]); return null; }
    await this.pool.query('UPDATE user_sessions SET last_seen_at=? WHERE id=?', [now,row.id]); row.last_seen_at = now; return asSession(row);
  }
  async listSessions(userId: string, now: Date) {
    await this.pool.query("UPDATE user_sessions SET status='expired' WHERE user_id=? AND status='active' AND expires_at<=?", [userId,now]);
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT ${sessionColumns} FROM user_sessions WHERE user_id=? ORDER BY created_at DESC`, [userId]); return rows.map(asSession);
  }
  async revokeSession(userId: string, sessionId: string, now: Date) {
    const [result] = await this.pool.query<ResultSetHeader>("UPDATE user_sessions SET status='revoked',revoked_at=? WHERE id=? AND user_id=? AND status='active'", [now,sessionId,userId]); return result.affectedRows === 1;
  }
  async revokeAllSessions(userId: string, now: Date) { await this.pool.query("UPDATE user_sessions SET status='revoked',revoked_at=? WHERE user_id=? AND status='active'", [now,userId]); }
  async appendSecurityEvent(event: AuthSecurityEvent) {
    await this.pool.query('INSERT INTO auth_security_events (id,user_id,event_type,outcome,request_id,trace_id,ip_hash,user_agent_hash,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?)', [event.id,event.user_id,event.event_type,event.outcome,event.request_id,event.trace_id,event.ip_hash,event.user_agent_hash,event.occurred_at,event.schema_version]);
  }
}
