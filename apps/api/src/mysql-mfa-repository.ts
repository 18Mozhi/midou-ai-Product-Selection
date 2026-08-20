import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  MfaChallengeRecord,
  MfaFactorRecord,
  MfaFactorStatus,
  MfaRecoveryCodeRecord,
  MfaRepository,
} from "@scoutops/auth";
import { withTransaction } from "@scoutops/database";

const factorColumns =
  "id,user_id,type,status,secret_ciphertext,secret_nonce,secret_auth_tag,last_used_step,enrolled_at,confirmed_at,disabled_at,version,created_at,updated_at";
export class MySqlMfaRepository implements MfaRepository {
  constructor(private readonly pool: Pool) {}
  async findFactor(userId: string, status: MfaFactorStatus) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${factorColumns} FROM user_mfa_factors WHERE user_id=? AND status=? ORDER BY created_at DESC LIMIT 1`,
      [userId, status],
    );
    return (rows[0] as MfaFactorRecord | undefined) ?? null;
  }
  async replacePendingFactor(factor: MfaFactorRecord) {
    await withTransaction(this.pool, async (connection) => {
      await connection.query(
        "UPDATE user_mfa_factors SET status='disabled',disabled_at=?,updated_at=?," +
          "version=version+1 WHERE user_id=? AND status='pending'",
        [factor.created_at, factor.created_at, factor.user_id],
      );
      await connection.query(
        "INSERT INTO user_mfa_factors (id,user_id,type,status,secret_ciphertext,secret_nonce," +
          "secret_auth_tag,last_used_step,enrolled_at,confirmed_at,disabled_at,version," +
          "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          factor.id,
          factor.user_id,
          factor.type,
          factor.status,
          factor.secret_ciphertext,
          factor.secret_nonce,
          factor.secret_auth_tag,
          factor.last_used_step,
          factor.enrolled_at,
          factor.confirmed_at,
          factor.disabled_at,
          factor.version,
          factor.created_at,
          factor.updated_at,
        ],
      );
    });
  }
  async enableFactor(factor: MfaFactorRecord, codes: MfaRecoveryCodeRecord[]) {
    await withTransaction(this.pool, async (connection) => {
      await connection.query(
        "UPDATE user_mfa_factors SET status='disabled',disabled_at=?,updated_at=?," +
          "version=version+1 WHERE user_id=? AND status='enabled' AND id<>?",
        [factor.updated_at, factor.updated_at, factor.user_id, factor.id],
      );
      const [result] = await connection.query<ResultSetHeader>(
        "UPDATE user_mfa_factors SET status='enabled',confirmed_at=?,last_used_step=?," +
          "version=?,updated_at=? WHERE id=? AND user_id=? AND status='pending'",
        [
          factor.confirmed_at,
          factor.last_used_step,
          factor.version,
          factor.updated_at,
          factor.id,
          factor.user_id,
        ],
      );
      if (result.affectedRows !== 1) throw new Error("mfa_enrollment_conflict");
      for (const code of codes)
        await connection.query(
          "INSERT INTO user_mfa_recovery_codes (id,user_id,factor_id,code_hash,used_at,created_at) VALUES (?,?,?,?,?,?)",
          [code.id, code.user_id, code.factor_id, code.code_hash, code.used_at, code.created_at],
        );
    });
  }
  async disableFactor(userId: string, factorId: string, now: Date) {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE user_mfa_factors SET status='disabled',disabled_at=?,updated_at=?," +
        "version=version+1 WHERE id=? AND user_id=? AND status='enabled'",
      [now, now, factorId, userId],
    );
    return result.affectedRows === 1;
  }
  async acceptTotpStep(factorId: string, step: number, now: Date) {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE user_mfa_factors SET last_used_step=?,updated_at=?,version=version+1 WHERE id=? " +
        "AND status='enabled' AND (last_used_step IS NULL OR last_used_step<?)",
      [step, now, factorId, step],
    );
    return result.affectedRows === 1;
  }
  async consumeRecoveryCode(userId: string, codeHash: string, now: Date) {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE user_mfa_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL",
      [now, userId, codeHash],
    );
    return result.affectedRows === 1;
  }
  async createChallenge(challenge: MfaChallengeRecord) {
    await this.pool.query(
      "INSERT INTO user_mfa_challenges (id,user_id,token_hash,status,attempt_count," +
        "expires_at,consumed_at,created_at) VALUES (?,?,?,?,?,?,?,?)",
      [
        challenge.id,
        challenge.user_id,
        challenge.token_hash,
        challenge.status,
        challenge.attempt_count,
        challenge.expires_at,
        challenge.consumed_at,
        challenge.created_at,
      ],
    );
  }
  async findChallenge(hash: string, now: Date) {
    await this.pool.query(
      "UPDATE user_mfa_challenges SET status='expired' WHERE token_hash=? AND status='active' AND expires_at<=?",
      [hash, now],
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,user_id,token_hash,status,attempt_count,expires_at,consumed_at," +
        "created_at FROM user_mfa_challenges WHERE token_hash=? AND status='active' AND expires_at>? " +
        "LIMIT 1",
      [hash, now],
    );
    return (rows[0] as MfaChallengeRecord | undefined) ?? null;
  }
  async failChallenge(id: string, max: number) {
    return withTransaction(this.pool, async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT attempt_count FROM user_mfa_challenges WHERE id=? AND status='active' LIMIT 1 FOR UPDATE",
        [id],
      );
      if (!rows[0]) return 0;
      const count = Number(rows[0].attempt_count) + 1;
      await connection.query(
        "UPDATE user_mfa_challenges SET attempt_count=?,status=? WHERE id=? AND status='active'",
        [count, count >= max ? "locked" : "active", id],
      );
      return Math.max(0, max - count);
    });
  }
  async consumeChallenge(id: string, now: Date) {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE user_mfa_challenges SET status='consumed',consumed_at=? WHERE id=? AND status='active' AND expires_at>?",
      [now, id, now],
    );
    return result.affectedRows === 1;
  }
}
