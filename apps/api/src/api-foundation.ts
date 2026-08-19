import type { FastifyReply, FastifyRequest } from 'fastify';
import { assertOrganizationScope, type OrganizationId, type WorkspaceId } from '@scoutops/contracts';

export class ApiError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string, readonly actionHint: string) {
    super(message);this.name='ApiError';
  }
}

export interface AuthClaims {
  subject_id: string;
  organization_id: string;
  workspace_id?: string;
  scopes: readonly string[];
}

export type TokenVerifier = (token: string) => Promise<AuthClaims | null>;

export function createAuthGuard(verifier: TokenVerifier, requiredScope?: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authorization=request.headers.authorization;
    const match=authorization?.match(/^Bearer ([^\s]+)$/);
    if(!match)throw new ApiError(401,'authentication_required','需要有效登录。','登录后重试。');
    const claims=await verifier(match[1]!);
    if(!claims)throw new ApiError(401,'session_invalid','登录已失效。','重新登录后重试。');
    try{assertOrganizationScope({organization_id:claims.organization_id as OrganizationId,...(claims.workspace_id?{workspace_id:claims.workspace_id as WorkspaceId}:{})});}catch{throw new ApiError(403,'organization_scope_required','缺少组织范围。','切换到有效组织后重试。');}
    if(requiredScope&&!claims.scopes.includes(requiredScope))throw new ApiError(403,'permission_denied','没有执行此操作的权限。','联系组织管理员授予所需权限。');
  };
}

export function requireIdempotencyKey(request: FastifyRequest): string {
  const value=request.headers['idempotency-key']?.toString().trim();
  if(!value||value.length>255)throw new ApiError(400,'idempotency_key_required','缺少有效的 Idempotency-Key。','提供 1–255 字符的幂等键后重试。');
  return value;
}

export function normalizeCorrelationId(value: unknown, fallback: () => string): string {
  const candidate=typeof value==='string'?value.trim():'';
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)?candidate:fallback();
}

export interface ReadinessCheck {
  name: 'mysql' | 'redis' | 'supervisor';
  check(requestId: string, traceId: string): Promise<'available' | 'unavailable'>;
}
