import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthContext, AuthRepository, AuthSecurityEvent, AuthSecondFactorGate, PasswordHasher, UserRecord } from './index.js';
import { AuthError, digestOpaqueToken } from './index.js';

export type MfaFactorStatus = 'pending' | 'enabled' | 'disabled';
export interface MfaFactorRecord {
  id: string; user_id: string; type: 'totp'; status: MfaFactorStatus;
  secret_ciphertext: Buffer; secret_nonce: Buffer; secret_auth_tag: Buffer;
  last_used_step: number | null; enrolled_at: Date; confirmed_at: Date | null; disabled_at: Date | null;
  version: number; created_at: Date; updated_at: Date;
}
export interface MfaRecoveryCodeRecord { id: string; user_id: string; factor_id: string; code_hash: string; used_at: Date | null; created_at: Date; }
export interface MfaChallengeRecord {
  id: string; user_id: string; token_hash: string; status: 'active'|'consumed'|'locked'|'expired';
  attempt_count: number; expires_at: Date; consumed_at: Date | null; created_at: Date;
}
export interface MfaRepository {
  findFactor(userId: string, status: MfaFactorStatus): Promise<MfaFactorRecord | null>;
  replacePendingFactor(factor: MfaFactorRecord): Promise<void>;
  enableFactor(factor: MfaFactorRecord, recoveryCodes: MfaRecoveryCodeRecord[]): Promise<void>;
  disableFactor(userId: string, factorId: string, now: Date): Promise<boolean>;
  acceptTotpStep(factorId: string, step: number, now: Date): Promise<boolean>;
  consumeRecoveryCode(userId: string, codeHash: string, now: Date): Promise<boolean>;
  createChallenge(challenge: MfaChallengeRecord): Promise<void>;
  findChallenge(tokenHash: string, now: Date): Promise<MfaChallengeRecord | null>;
  failChallenge(challengeId: string, maxAttempts: number): Promise<number>;
  consumeChallenge(challengeId: string, now: Date): Promise<boolean>;
}

export interface MfaPolicy { issuer: string; periodSeconds: number; digits: number; window: number; challengeTtlMinutes: number; maxAttempts: number; recoveryCodeCount: number; }
export interface MfaLoginCompletion { token:string; user:{id:string;email:string;status:string}; session:{id:string;status:string;device_label:string;expires_at:string;last_seen_at:string;created_at:string}; }
export interface IdentityAdapterCapability { protocol: 'oidc'|'saml2'|'scim2'; status: 'adapter_ready'|'reserved_disabled'; activation: 'requires_approved_provider_and_tenant_mapping'; }
export interface EnterpriseIdentityAdapter {
  readonly capability: IdentityAdapterCapability;
  beginAuthentication(input: { organizationId: string; returnTo: string; requestId: string; traceId: string }): Promise<never>;
}
export class DisabledEnterpriseIdentityAdapter implements EnterpriseIdentityAdapter {
  readonly capability: IdentityAdapterCapability;
  constructor(protocol: IdentityAdapterCapability['protocol']) {
    this.capability = { protocol, status: protocol === 'oidc' ? 'adapter_ready' : 'reserved_disabled', activation: 'requires_approved_provider_and_tenant_mapping' };
  }
  async beginAuthentication(): Promise<never> {
    throw new AuthError('identity_provider_not_configured', 503, '完成 Provider 审批、组织域名和属性映射后再启用。');
  }
}
export const identityAdapterCapabilities = (): IdentityAdapterCapability[] => (['oidc','saml2','scim2'] as const).map((protocol) => new DisabledEnterpriseIdentityAdapter(protocol).capability);

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeBase32(input: Buffer) {
  let bits = 0; let value = 0; let output = '';
  for (const byte of input) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}
export function decodeBase32(input: string) {
  let bits = 0; let value = 0; const output: number[] = [];
  for (const character of input.toUpperCase().replace(/=|\s|-/g, '')) {
    const index = BASE32.indexOf(character); if (index < 0) throw new AuthError('mfa_secret_invalid', 500, '重新发起 MFA 绑定。');
    value = (value << 5) | index; bits += 5; if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}
export function generateTotp(secret: string, timestampMs: number, periodSeconds = 30, digits = 6) {
  const counter = BigInt(Math.floor(timestampMs / 1000 / periodSeconds)); const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest(); const offset = digest[digest.length - 1]! & 15;
  const binary = ((digest[offset]! & 127) << 24) | ((digest[offset + 1]! & 255) << 16) | ((digest[offset + 2]! & 255) << 8) | (digest[offset + 3]! & 255);
  return String(binary % (10 ** digits)).padStart(digits, '0');
}
export function matchingTotpStep(secret: string, code: string, timestampMs: number, policy: Pick<MfaPolicy,'periodSeconds'|'digits'|'window'>) {
  if (!new RegExp(`^\\d{${policy.digits}}$`).test(code)) return null;
  const current = Math.floor(timestampMs / 1000 / policy.periodSeconds);
  for (let offset = -policy.window; offset <= policy.window; offset += 1) {
    const step = current + offset; const expected = generateTotp(secret, step * policy.periodSeconds * 1000, policy.periodSeconds, policy.digits);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
}

function secretKey(masterKey: string) {
  if (masterKey.length < 32) throw new AuthError('mfa_key_missing', 503, '在宝塔受限环境配置主密钥后重试。');
  return createHash('sha256').update('scoutops:mfa-secret:v1').update(masterKey).digest();
}
export function sealMfaSecret(secret: string, masterKey: string) {
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', secretKey(masterKey), nonce);
  const secret_ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { secret_ciphertext, secret_nonce: nonce, secret_auth_tag: cipher.getAuthTag() };
}
export function openMfaSecret(factor: Pick<MfaFactorRecord,'secret_ciphertext'|'secret_nonce'|'secret_auth_tag'>, masterKey: string) {
  try { const decipher = createDecipheriv('aes-256-gcm', secretKey(masterKey), factor.secret_nonce); decipher.setAuthTag(factor.secret_auth_tag); return Buffer.concat([decipher.update(factor.secret_ciphertext), decipher.final()]).toString('utf8'); }
  catch { throw new AuthError('mfa_secret_invalid', 500, '隔离该 MFA 因子并携带 trace_id 联系安全管理员。'); }
}
const recoveryHash = (code: string) => createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

export class InMemoryMfaRepository implements MfaRepository {
  readonly factors: MfaFactorRecord[]=[]; readonly recoveryCodes:MfaRecoveryCodeRecord[]=[]; readonly challenges:MfaChallengeRecord[]=[];
  async findFactor(userId:string,status:MfaFactorStatus){return this.factors.find((item)=>item.user_id===userId&&item.status===status)??null;}
  async replacePendingFactor(factor:MfaFactorRecord){for(const item of this.factors)if(item.user_id===factor.user_id&&item.status==='pending')item.status='disabled';this.factors.push(factor);}
  async enableFactor(factor:MfaFactorRecord,codes:MfaRecoveryCodeRecord[]){for(const item of this.factors)if(item.user_id===factor.user_id&&item.status==='enabled')item.status='disabled';Object.assign(this.factors.find((item)=>item.id===factor.id)!,factor);this.recoveryCodes.push(...codes);}
  async disableFactor(userId:string,factorId:string,now:Date){const factor=this.factors.find((item)=>item.id===factorId&&item.user_id===userId&&item.status==='enabled');if(!factor)return false;factor.status='disabled';factor.disabled_at=now;factor.updated_at=now;return true;}
  async acceptTotpStep(factorId:string,step:number,now:Date){const factor=this.factors.find((item)=>item.id===factorId&&item.status==='enabled');if(!factor||factor.last_used_step!==null&&factor.last_used_step>=step)return false;factor.last_used_step=step;factor.updated_at=now;return true;}
  async consumeRecoveryCode(userId:string,hash:string,now:Date){const code=this.recoveryCodes.find((item)=>item.user_id===userId&&item.code_hash===hash&&!item.used_at);if(!code)return false;code.used_at=now;return true;}
  async createChallenge(challenge:MfaChallengeRecord){this.challenges.push(challenge);}
  async findChallenge(hash:string,now:Date){const item=this.challenges.find((entry)=>entry.token_hash===hash);if(!item||item.status!=='active')return null;if(item.expires_at<=now){item.status='expired';return null;}return item;}
  async failChallenge(id:string,max:number){const item=this.challenges.find((entry)=>entry.id===id&&entry.status==='active');if(!item)return 0;item.attempt_count+=1;if(item.attempt_count>=max)item.status='locked';return Math.max(0,max-item.attempt_count);}
  async consumeChallenge(id:string,now:Date){const item=this.challenges.find((entry)=>entry.id===id&&entry.status==='active'&&entry.expires_at>now);if(!item)return false;item.status='consumed';item.consumed_at=now;return true;}
}

export class MfaService implements AuthSecondFactorGate {
  constructor(private readonly input:{repository:MfaRepository;authRepository:AuthRepository;passwordHasher:PasswordHasher;masterKey:string;policy:MfaPolicy;completeLogin:(userId:string,context:AuthContext)=>Promise<MfaLoginCompletion>;completeEnrollment?:(userId:string)=>Promise<void>;now?:()=>Date;tokenFactory?:()=>string}) {
    if (!input.policy.issuer.trim() || input.policy.periodSeconds < 15 || input.policy.periodSeconds > 120 || input.policy.digits < 6 || input.policy.digits > 8 || input.policy.window < 0 || input.policy.window > 2 || input.policy.challengeTtlMinutes < 1 || input.policy.challengeTtlMinutes > 10 || input.policy.maxAttempts < 2 || input.policy.maxAttempts > 10 || input.policy.recoveryCodeCount < 4 || input.policy.recoveryCodeCount > 20) throw new Error('invalid_mfa_policy');
  }
  private now(){return this.input.now?.()??new Date();} private token(){return this.input.tokenFactory?.()??randomBytes(32).toString('base64url');}
  private async event(userId:string,type:string,outcome:AuthSecurityEvent['outcome'],context:AuthContext){await this.input.authRepository.appendSecurityEvent({id:randomUUID(),user_id:userId,event_type:type,outcome,request_id:context.requestId,trace_id:context.traceId,ip_hash:null,user_agent_hash:null,occurred_at:this.now(),schema_version:1});}
  async begin(user:UserRecord,context:AuthContext){const factor=await this.input.repository.findFactor(user.id,'enabled');if(!factor)return{required:false as const};const raw=this.token();const now=this.now();const expiresAt=addMinutes(now,this.input.policy.challengeTtlMinutes);await this.input.repository.createChallenge({id:randomUUID(),user_id:user.id,token_hash:digestOpaqueToken(raw),status:'active',attempt_count:0,expires_at:expiresAt,consumed_at:null,created_at:now});await this.event(user.id,'mfa.challenge.created','succeeded',context);return{required:true as const,challengeToken:raw,expiresAt};}
  async startEnrollment(user:UserRecord,currentPassword:string,context:AuthContext){if(!(await this.input.passwordHasher.verify(user.password_hash,currentPassword))){await this.event(user.id,'mfa.enrollment.reauth_failed','failed',context);throw new AuthError('current_password_invalid',401,'检查当前密码后重试。');}const now=this.now();const secret=encodeBase32(randomBytes(20));const factor:MfaFactorRecord={id:randomUUID(),user_id:user.id,type:'totp',status:'pending',...sealMfaSecret(secret,this.input.masterKey),last_used_step:null,enrolled_at:now,confirmed_at:null,disabled_at:null,version:1,created_at:now,updated_at:now};await this.input.repository.replacePendingFactor(factor);await this.event(user.id,'mfa.enrollment.started','succeeded',context);const label=encodeURIComponent(`${this.input.policy.issuer}:${user.email}`);const issuer=encodeURIComponent(this.input.policy.issuer);return{factor_id:factor.id,secret,otpauth_uri:`otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${this.input.policy.digits}&period=${this.input.policy.periodSeconds}`};}
  async confirmEnrollment(userId:string,code:string,context:AuthContext){const factor=await this.input.repository.findFactor(userId,'pending');if(!factor)throw new AuthError('mfa_enrollment_not_found',404,'重新发起 MFA 绑定。');const now=this.now();const step=matchingTotpStep(openMfaSecret(factor,this.input.masterKey),code,now.getTime(),this.input.policy);if(step===null){await this.event(userId,'mfa.enrollment.failed','failed',context);throw new AuthError('mfa_code_invalid',401,'等待验证码刷新后重试。');}const plain=Array.from({length:this.input.policy.recoveryCodeCount},()=>encodeBase32(randomBytes(10)).match(/.{1,4}/g)!.join('-'));const enabledFactor:MfaFactorRecord={...factor,status:'enabled',confirmed_at:now,last_used_step:step,updated_at:now,version:factor.version+1};await this.input.repository.enableFactor(enabledFactor,plain.map((value)=>({id:randomUUID(),user_id:userId,factor_id:factor.id,code_hash:recoveryHash(value),used_at:null,created_at:now})));await this.input.completeEnrollment?.(userId);await this.event(userId,'mfa.enrollment.enabled','succeeded',context);return{status:'enabled' as const,recovery_codes:plain};}
  async status(userId:string){const enabled=await this.input.repository.findFactor(userId,'enabled');return{totp_enabled:Boolean(enabled),factor_id:enabled?.id??null,confirmed_at:enabled?.confirmed_at?.toISOString()??null,identity_adapters:identityAdapterCapabilities()};}
  private async verifyFactor(userId:string,code:string,now:Date){const factor=await this.input.repository.findFactor(userId,'enabled');if(!factor)return false;if(/^\d+$/.test(code)){const step=matchingTotpStep(openMfaSecret(factor,this.input.masterKey),code,now.getTime(),this.input.policy);return step!==null&&this.input.repository.acceptTotpStep(factor.id,step,now);}return this.input.repository.consumeRecoveryCode(userId,recoveryHash(code),now);}
  async verifyLogin(challengeToken:string,code:string,context:AuthContext){const now=this.now();const challenge=await this.input.repository.findChallenge(digestOpaqueToken(challengeToken),now);if(!challenge)throw new AuthError('mfa_challenge_invalid',401,'重新输入邮箱和密码后重试。');if(!(await this.verifyFactor(challenge.user_id,code,now))){const remaining=await this.input.repository.failChallenge(challenge.id,this.input.policy.maxAttempts);await this.event(challenge.user_id,'mfa.challenge.failed',remaining?'failed':'blocked',context);throw new AuthError(remaining?'mfa_code_invalid':'mfa_challenge_locked',remaining?401:423,remaining?`验证码无效，还可尝试 ${remaining} 次。`:'重新输入邮箱和密码后重试。');}if(!(await this.input.repository.consumeChallenge(challenge.id,now)))throw new AuthError('mfa_challenge_invalid',401,'重新输入邮箱和密码后重试。');await this.event(challenge.user_id,'mfa.challenge.succeeded','succeeded',context);return this.input.completeLogin(challenge.user_id,context);}
  async disable(user:UserRecord,currentPassword:string,code:string,context:AuthContext){if(!(await this.input.passwordHasher.verify(user.password_hash,currentPassword)))throw new AuthError('current_password_invalid',401,'检查当前密码后重试。');const factor=await this.input.repository.findFactor(user.id,'enabled');if(!factor)throw new AuthError('mfa_factor_not_found',404,'刷新安全设置后重试。');const now=this.now();if(!(await this.verifyFactor(user.id,code,now)))throw new AuthError('mfa_code_invalid',401,'输入当前验证码或一次性恢复码。');if(!(await this.input.repository.disableFactor(user.id,factor.id,now)))throw new AuthError('mfa_factor_not_found',404,'刷新安全设置后重试。');await this.input.authRepository.revokeAllSessions(user.id,now);await this.event(user.id,'mfa.disabled','succeeded',context);}
}
