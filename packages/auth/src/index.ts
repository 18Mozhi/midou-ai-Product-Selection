import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';

export type UserStatus = 'pending_verification' | 'active' | 'locked' | 'disabled';
export type SessionStatus = 'active' | 'revoked' | 'expired';
export type ActionTokenPurpose = 'email_verification' | 'password_reset';

export interface AuthPolicy {
  passwordMinLength: number;
  passwordMaxLength: number;
  sessionTtlMinutes: number;
  actionTokenTtlMinutes: number;
  maxFailedAttempts: number;
  lockMinutes: number;
}

export interface AuthContext {
  requestId: string;
  traceId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  status: UserStatus;
  email_verified_at: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
  password_changed_at: Date;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  status: SessionStatus;
  device_label: string;
  user_agent_hash: string | null;
  ip_hash: string | null;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface ActionTokenRecord {
  id: string;
  user_id: string;
  purpose: ActionTokenPurpose;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export interface AuthSecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  outcome: 'succeeded' | 'failed' | 'blocked';
  request_id: string;
  trace_id: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  occurred_at: Date;
  schema_version: 1;
}

export interface AuthRepository {
  findUserByEmail(normalizedEmail: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  discardPendingRegistration(userId: string): Promise<void>;
  saveUser(user: UserRecord): Promise<void>;
  createActionToken(token: ActionTokenRecord): Promise<void>;
  consumeActionToken(tokenHash: string, purpose: ActionTokenPurpose, now: Date): Promise<ActionTokenRecord | null>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  listSessions(userId: string, now: Date): Promise<SessionRecord[]>;
  revokeSession(userId: string, sessionId: string, now: Date): Promise<boolean>;
  revokeAllSessions(userId: string, now: Date): Promise<void>;
  appendSecurityEvent(event: AuthSecurityEvent): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AuthDeliveryMessage {
  userId: string;
  kind: ActionTokenPurpose;
  email: string;
  token: string;
  expiresAt: Date;
  requestId: string;
  traceId: string;
}

export interface AuthDelivery {
  assertAvailable?(): void;
  deliver(message: AuthDeliveryMessage): Promise<void>;
}

export interface AuthOutboxRecord {
  id: string;
  userId: string;
  kind: ActionTokenPurpose;
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  requestId: string;
  traceId: string;
  createdAt: Date;
}

export interface AuthOutboxStore { enqueue(record: AuthOutboxRecord): Promise<void>; }

export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

export function authErrorMessage(code: string): string {
  return ({
    invalid_email: '邮箱格式不正确。', password_policy_failed: '密码不符合安全策略。', email_already_registered: '该邮箱已注册。',
    invalid_or_expired_token: '链接无效或已过期。', invalid_credentials: '邮箱或密码不正确。', account_locked: '账号暂时锁定。',
    account_disabled: '账号已停用。', email_verification_required: '邮箱尚未验证。', session_invalid: '登录已失效。',
    session_not_found: '会话不存在或已结束。', current_password_invalid: '当前密码不正确。', mail_provider_pending: '邮件服务尚未启用。',
    auth_delivery_key_missing: '认证投递配置不可用。', auth_delivery_payload_invalid: '认证投递数据无效。', idempotency_in_progress: '相同请求正在处理中。',
  } as Record<string,string>)[code] ?? '认证请求无法完成。';
}

export function createArgon2PasswordHasher(options: { memoryCost: number; timeCost: number; parallelism: number }): PasswordHasher {
  return {
    hash: (password) => argon2.hash(password, { type: argon2.argon2id, ...options }),
    verify: async (hash, password) => {
      try { return await argon2.verify(hash, password); }
      catch { return false; }
    },
  };
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError('invalid_email', 400, '输入有效邮箱地址后重试。');
  }
  return normalized;
}

export const digestOpaqueToken = (token: string) => createHash('sha256').update(token).digest('hex');
const hashMetadata = (value?: string) => value ? createHash('sha256').update(value).digest('hex') : null;
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);

function validatePolicy(policy: AuthPolicy) {
  if (policy.passwordMinLength < 8 || policy.passwordMaxLength < policy.passwordMinLength || policy.passwordMaxLength > 1024) throw new Error('invalid_password_policy');
  for (const [key, value] of Object.entries(policy)) if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid_auth_policy:${key}`);
}

function validatePassword(password: string, policy: AuthPolicy) {
  if (password.length < policy.passwordMinLength || password.length > policy.passwordMaxLength) {
    throw new AuthError('password_policy_failed', 400, `密码长度必须为 ${policy.passwordMinLength}–${policy.passwordMaxLength} 个字符。`);
  }
}

export class CaptureAuthDelivery implements AuthDelivery {
  readonly messages: AuthDeliveryMessage[] = [];
  async deliver(message: AuthDeliveryMessage) { this.messages.push(structuredClone(message)); }
}

export class PendingAuthDelivery implements AuthDelivery {
  assertAvailable(): void { throw new AuthError('mail_provider_pending', 503, '生产邮件 Provider 确认并在宝塔配置后重试。'); }
  async deliver(): Promise<void> {
    throw new AuthError('mail_provider_pending', 503, '生产邮件 Provider 确认并在宝塔配置后重试。');
  }
}

function deliveryKey(masterKey: string) {
  if (masterKey.length < 32) throw new AuthError('auth_delivery_key_missing', 503, '在宝塔受限环境配置主密钥后重试。');
  return createHash('sha256').update('scoutops:auth-delivery:v1').update(masterKey).digest();
}

export function sealAuthDelivery(message: AuthDeliveryMessage, masterKey: string) {
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', deliveryKey(masterKey), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(message), 'utf8'), cipher.final()]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag() };
}

export function openAuthDelivery(record: Pick<AuthOutboxRecord, 'ciphertext' | 'nonce' | 'authTag'>, masterKey: string): AuthDeliveryMessage {
  try {
    const decipher = createDecipheriv('aes-256-gcm', deliveryKey(masterKey), record.nonce); decipher.setAuthTag(record.authTag);
    const parsed = JSON.parse(Buffer.concat([decipher.update(record.ciphertext), decipher.final()]).toString('utf8')) as Omit<AuthDeliveryMessage, 'expiresAt'> & { expiresAt: string };
    return { ...parsed, expiresAt: new Date(parsed.expiresAt) };
  } catch { throw new AuthError('auth_delivery_payload_invalid', 500, '隔离该投递并携带 trace_id 联系管理员。'); }
}

export class EncryptedOutboxAuthDelivery implements AuthDelivery {
  constructor(private readonly store: AuthOutboxStore, private readonly masterKey: string, private readonly now: () => Date = () => new Date()) { deliveryKey(masterKey); }
  assertAvailable(): void { deliveryKey(this.masterKey); }
  async deliver(message: AuthDeliveryMessage) {
    const sealed = sealAuthDelivery(message, this.masterKey);
    await this.store.enqueue({ id: randomUUID(), userId: message.userId, kind: message.kind, ...sealed, requestId: message.requestId, traceId: message.traceId, createdAt: this.now() });
  }
}

export class InMemoryAuthRepository implements AuthRepository {
  readonly users: UserRecord[] = [];
  readonly sessions: SessionRecord[] = [];
  readonly actionTokens: ActionTokenRecord[] = [];
  readonly securityEvents: AuthSecurityEvent[] = [];
  async findUserByEmail(email: string) { return this.users.find((item) => item.email_normalized === email) ?? null; }
  async findUserById(id: string) { return this.users.find((item) => item.id === id) ?? null; }
  async createUser(user: UserRecord) {
    if (await this.findUserByEmail(user.email_normalized)) throw new AuthError('email_already_registered', 409, '登录或使用密码重置找回账号。');
    this.users.push(user);
  }
  async discardPendingRegistration(userId: string) {
    const userIndex = this.users.findIndex((item) => item.id === userId && item.status === 'pending_verification');
    if (userIndex < 0) return;
    this.actionTokens.splice(0, this.actionTokens.length, ...this.actionTokens.filter((item) => item.user_id !== userId));
    this.users.splice(userIndex, 1);
  }
  async saveUser(user: UserRecord) {
    const index = this.users.findIndex((item) => item.id === user.id);
    if (index < 0) throw new Error('user_not_found');
    this.users[index] = user;
  }
  async createActionToken(token: ActionTokenRecord) { this.actionTokens.push(token); }
  async consumeActionToken(hash: string, purpose: ActionTokenPurpose, now: Date) {
    const token = this.actionTokens.find((item) => item.token_hash === hash && item.purpose === purpose && !item.consumed_at && item.expires_at > now);
    if (!token) return null;
    token.consumed_at = now;
    return token;
  }
  async createSession(session: SessionRecord) { this.sessions.push(session); }
  async findSessionByTokenHash(hash: string, now: Date) {
    const session = this.sessions.find((item) => item.token_hash === hash);
    if (!session || session.status !== 'active') return null;
    if (session.expires_at <= now) { session.status = 'expired'; return null; }
    session.last_seen_at = now;
    return session;
  }
  async listSessions(userId: string, now: Date) {
    for (const item of this.sessions) if (item.user_id === userId && item.status === 'active' && item.expires_at <= now) item.status = 'expired';
    return this.sessions.filter((item) => item.user_id === userId).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }
  async revokeSession(userId: string, sessionId: string, now: Date) {
    const session = this.sessions.find((item) => item.user_id === userId && item.id === sessionId && item.status === 'active');
    if (!session) return false;
    session.status = 'revoked'; session.revoked_at = now; return true;
  }
  async revokeAllSessions(userId: string, now: Date) {
    for (const item of this.sessions) if (item.user_id === userId && item.status === 'active') { item.status = 'revoked'; item.revoked_at = now; }
  }
  async appendSecurityEvent(event: AuthSecurityEvent) { this.securityEvents.push(event); }
}

export class LocalAuthService {
  private readonly repository: AuthRepository;
  private readonly delivery: AuthDelivery;
  private readonly passwordHasher: PasswordHasher;
  private readonly policy: AuthPolicy;
  private readonly now: () => Date;
  private readonly tokenFactory: () => string;
  private dummyPasswordHash?: Promise<string>;

  constructor(input: {
    repository: AuthRepository;
    delivery: AuthDelivery;
    passwordHasher: PasswordHasher;
    policy: AuthPolicy;
    now?: () => Date;
    tokenFactory?: () => string;
  }) {
    validatePolicy(input.policy);
    this.repository = input.repository;
    this.delivery = input.delivery;
    this.passwordHasher = input.passwordHasher;
    this.policy = input.policy;
    this.now = input.now ?? (() => new Date());
    this.tokenFactory = input.tokenFactory ?? (() => randomBytes(32).toString('base64url'));
  }

  private async event(userId: string | null, type: string, outcome: AuthSecurityEvent['outcome'], context: AuthContext) {
    await this.repository.appendSecurityEvent({ id: randomUUID(), user_id: userId, event_type: type, outcome, request_id: context.requestId, trace_id: context.traceId, ip_hash: hashMetadata(context.ipAddress), user_agent_hash: hashMetadata(context.userAgent), occurred_at: this.now(), schema_version: 1 });
  }

  private async issueActionToken(user: UserRecord, purpose: ActionTokenPurpose, context: AuthContext) {
    const raw = this.tokenFactory(); const now = this.now(); const expiresAt = addMinutes(now, this.policy.actionTokenTtlMinutes);
    await this.repository.createActionToken({ id: randomUUID(), user_id: user.id, purpose, token_hash: digestOpaqueToken(raw), expires_at: expiresAt, consumed_at: null, created_at: now });
    await this.delivery.deliver({ userId: user.id, kind: purpose, email: user.email, token: raw, expiresAt, requestId: context.requestId, traceId: context.traceId });
  }

  async register(input: { email: string; password: string }, context: AuthContext) {
    const email = normalizeEmail(input.email); validatePassword(input.password, this.policy);
    this.delivery.assertAvailable?.();
    if (await this.repository.findUserByEmail(email)) throw new AuthError('email_already_registered', 409, '登录或使用密码重置找回账号。');
    const now = this.now();
    const user: UserRecord = { id: randomUUID(), email, email_normalized: email, password_hash: await this.passwordHasher.hash(input.password), status: 'pending_verification', email_verified_at: null, failed_login_count: 0, locked_until: null, password_changed_at: now, version: 1, created_at: now, updated_at: now };
    await this.repository.createUser(user);
    try { await this.issueActionToken(user, 'email_verification', context); }
    catch (error) {
      await this.repository.discardPendingRegistration(user.id);
      await this.event(null, 'registration.delivery_blocked', 'blocked', context);
      throw error;
    }
    await this.event(user.id, 'registration.created', 'succeeded', context);
    return { id: user.id, email: user.email, status: user.status };
  }

  async verifyEmail(token: string, context: AuthContext): Promise<'verified'> {
    const record = await this.repository.consumeActionToken(digestOpaqueToken(token), 'email_verification', this.now());
    if (!record) throw new AuthError('invalid_or_expired_token', 400, '重新申请验证邮件后重试。');
    const user = await this.repository.findUserById(record.user_id);
    if (!user) throw new AuthError('invalid_or_expired_token', 400, '重新申请验证邮件后重试。');
    const now = this.now(); user.status = 'active'; user.email_verified_at = now; user.updated_at = now; user.version += 1;
    await this.repository.saveUser(user); await this.event(user.id, 'email.verified', 'succeeded', context); return 'verified';
  }

  async login(input: { email: string; password: string }, context: AuthContext) {
    const email = normalizeEmail(input.email); const user = await this.repository.findUserByEmail(email); const now = this.now();
    if (!user) {
      this.dummyPasswordHash ??= this.passwordHasher.hash('ScoutOps-dummy-password-not-a-user');
      await this.passwordHasher.verify(await this.dummyPasswordHash, input.password);
      await this.event(null, 'login.failed', 'failed', context);
      throw new AuthError('invalid_credentials', 401, '检查邮箱和密码后重试。');
    }
    if (user.status === 'disabled') throw new AuthError('account_disabled', 403, '联系平台安全管理员。');
    if (user.locked_until && user.locked_until > now) throw new AuthError('account_locked', 423, '锁定期结束后重试或使用密码重置。');
    if (!(await this.passwordHasher.verify(user.password_hash, input.password))) {
      user.failed_login_count += 1; user.updated_at = now;
      if (user.failed_login_count >= this.policy.maxFailedAttempts) { user.locked_until = addMinutes(now, this.policy.lockMinutes); user.status = 'locked'; }
      await this.repository.saveUser(user); await this.event(user.id, 'login.failed', user.locked_until ? 'blocked' : 'failed', context);
      throw new AuthError(user.locked_until ? 'account_locked' : 'invalid_credentials', user.locked_until ? 423 : 401, user.locked_until ? '锁定期结束后重试或使用密码重置。' : '检查邮箱和密码后重试。');
    }
    if (!user.email_verified_at) throw new AuthError('email_verification_required', 403, '完成邮箱验证后登录。');
    user.failed_login_count = 0; user.locked_until = null; user.status = 'active'; user.updated_at = now; await this.repository.saveUser(user);
    const token = this.tokenFactory();
    const session: SessionRecord = { id: randomUUID(), user_id: user.id, token_hash: digestOpaqueToken(token), status: 'active', device_label: context.userAgent?.slice(0, 120) || '未知设备', user_agent_hash: hashMetadata(context.userAgent), ip_hash: hashMetadata(context.ipAddress), expires_at: addMinutes(now, this.policy.sessionTtlMinutes), last_seen_at: now, revoked_at: null, created_at: now };
    await this.repository.createSession(session); await this.event(user.id, 'login.succeeded', 'succeeded', context);
    return { token, user: { id: user.id, email: user.email, status: user.status }, session: this.sessionSummary(session) };
  }

  async authenticate(token: string) {
    const session = await this.repository.findSessionByTokenHash(digestOpaqueToken(token), this.now());
    if (!session) throw new AuthError('session_invalid', 401, '重新登录后重试。');
    const user = await this.repository.findUserById(session.user_id);
    if (!user || user.status !== 'active') throw new AuthError('session_invalid', 401, '重新登录后重试。');
    return { user, session };
  }

  async logout(token: string, context: AuthContext) {
    const authenticated = await this.authenticate(token);
    await this.repository.revokeSession(authenticated.user.id, authenticated.session.id, this.now());
    await this.event(authenticated.user.id, 'logout.succeeded', 'succeeded', context);
  }

  async listSessions(token: string) {
    const authenticated = await this.authenticate(token);
    return (await this.repository.listSessions(authenticated.user.id, this.now())).map((item) => this.sessionSummary(item));
  }

  async revokeSession(token: string, sessionId: string, context: AuthContext) {
    const authenticated = await this.authenticate(token);
    if (!(await this.repository.revokeSession(authenticated.user.id, sessionId, this.now()))) throw new AuthError('session_not_found', 404, '刷新会话列表后重试。');
    await this.event(authenticated.user.id, 'session.revoked', 'succeeded', context);
  }

  async changePassword(token: string, currentPassword: string, newPassword: string, context: AuthContext) {
    validatePassword(newPassword, this.policy); const authenticated = await this.authenticate(token);
    if (!(await this.passwordHasher.verify(authenticated.user.password_hash, currentPassword))) throw new AuthError('current_password_invalid', 401, '检查当前密码后重试。');
    const now = this.now(); authenticated.user.password_hash = await this.passwordHasher.hash(newPassword); authenticated.user.password_changed_at = now; authenticated.user.updated_at = now; authenticated.user.version += 1;
    await this.repository.saveUser(authenticated.user); await this.repository.revokeAllSessions(authenticated.user.id, now); await this.event(authenticated.user.id, 'password.changed', 'succeeded', context);
  }

  async requestPasswordReset(emailInput: string, context: AuthContext): Promise<{ accepted: true }> {
    const email = normalizeEmail(emailInput); this.delivery.assertAvailable?.(); const user = await this.repository.findUserByEmail(email);
    if (user) { await this.issueActionToken(user, 'password_reset', context); await this.event(user.id, 'password_reset.requested', 'succeeded', context); }
    else { this.dummyPasswordHash ??= this.passwordHasher.hash('ScoutOps-dummy-password-not-a-user'); await this.dummyPasswordHash; await this.event(null, 'password_reset.requested', 'succeeded', context); }
    return { accepted: true };
  }

  async resetPassword(token: string, newPassword: string, context: AuthContext) {
    validatePassword(newPassword, this.policy); const record = await this.repository.consumeActionToken(digestOpaqueToken(token), 'password_reset', this.now());
    if (!record) throw new AuthError('invalid_or_expired_token', 400, '重新申请密码重置邮件后重试。');
    const user = await this.repository.findUserById(record.user_id); if (!user) throw new AuthError('invalid_or_expired_token', 400, '重新申请密码重置邮件后重试。');
    const now = this.now(); user.password_hash = await this.passwordHasher.hash(newPassword); user.password_changed_at = now; user.failed_login_count = 0; user.locked_until = null; user.status = user.email_verified_at ? 'active' : 'pending_verification'; user.updated_at = now; user.version += 1;
    await this.repository.saveUser(user); await this.repository.revokeAllSessions(user.id, now); await this.event(user.id, 'password.reset', 'succeeded', context);
  }

  private sessionSummary(session: SessionRecord) {
    return { id: session.id, status: session.status, device_label: session.device_label, expires_at: session.expires_at.toISOString(), last_seen_at: session.last_seen_at.toISOString(), created_at: session.created_at.toISOString() };
  }
}
