import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthError, LocalAuthService, digestOpaqueToken, normalizeEmail, type AuthContext } from '@scoutops/auth';
import { ApiError, requireIdempotencyKey } from './api-foundation.js';

export interface IdempotentResponse<T = unknown> { status: number; body: T; replayed?: boolean }
export interface AuthIdempotency {
  execute<T>(input: { scope: string; route: string; method: 'POST'|'DELETE'; key: string; requestId: string; traceId: string }, work: () => Promise<IdempotentResponse<T>>): Promise<IdempotentResponse<T>>;
}
export interface LocalAuthRouteOptions {
  service: LocalAuthService;
  idempotency: AuthIdempotency;
  webOrigin: string;
  secureCookie: boolean;
}

const cookieName = (secure: boolean) => secure ? '__Host-scoutops_session' : 'scoutops_session';
const bodySchema = (required: string[], properties: Record<string,unknown>) => ({ type:'object', required, properties, additionalProperties:false });
const requestIds = (request: FastifyRequest): AuthContext => ({ requestId: request.headers['x-request-id']!.toString(), traceId: request.headers['x-trace-id']!.toString(), ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}), ipAddress: request.ip });
const envelope = <T>(data: T, request: FastifyRequest) => ({ data, request_id: request.headers['x-request-id']!.toString(), trace_id: request.headers['x-trace-id']!.toString() });
function sessionToken(request: FastifyRequest, secure: boolean) {
  const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter((pair) => pair.length === 2));
  const token = cookies[cookieName(secure)]; if (!token) throw new AuthError('session_invalid', 401, '重新登录后重试。'); return token;
}
function assertOrigin(request: FastifyRequest, expected: string) {
  const origin = request.headers.origin; if (origin && origin !== expected) throw new ApiError(403,'origin_not_allowed','请求来源不受信任。','从 ScoutOps 页面重试。');
}
function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.header('set-cookie', `${cookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`).header('cache-control','no-store');
}
function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.header('set-cookie', `${cookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`).header('cache-control','no-store').header('clear-site-data','"cache", "cookies", "storage"');
}

export function registerLocalAuthRoutes(app: FastifyInstance, options: LocalAuthRouteOptions) {
  const write = async <T>(request: FastifyRequest, scope: string, route: string, method: 'POST'|'DELETE', work: () => Promise<IdempotentResponse<T>>) => options.idempotency.execute({ scope, route, method, key: requireIdempotencyKey(request), requestId: request.headers['x-request-id']!.toString(), traceId: request.headers['x-trace-id']!.toString() }, work);

  app.post('/api/v1/auth/register', { schema:{ body:bodySchema(['email','password'],{email:{type:'string',maxLength:254},password:{type:'string',maxLength:1024}}) } }, async (request, reply) => {
    assertOrigin(request,options.webOrigin); const body=request.body as {email:string;password:string}; const result=await write(request,`email:${normalizeEmail(body.email)}`,'/auth/register','POST',async()=>({status:201,body:envelope(await options.service.register(body,requestIds(request)),request)})); reply.code(result.status); if(result.replayed)reply.header('idempotency-replayed','true'); return result.body;
  });
  app.post('/api/v1/auth/email-verification/confirm',{schema:{body:bodySchema(['token'],{token:{type:'string',minLength:20,maxLength:512}})}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const body=request.body as{token:string};const result=await write(request,`action:${digestOpaqueToken(body.token)}`,'/auth/email-verification/confirm','POST',async()=>({status:200,body:envelope({status:await options.service.verifyEmail(body.token,requestIds(request))},request)}));reply.code(result.status);return result.body;});
  app.post('/api/v1/auth/login',{schema:{body:bodySchema(['email','password'],{email:{type:'string',maxLength:254},password:{type:'string',maxLength:1024}})}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const body=request.body as{email:string;password:string};const login=await options.service.login(body,requestIds(request));setSessionCookie(reply,login.token,options.secureCookie);return envelope({user:login.user,session:login.session},request);});
  app.post('/api/v1/auth/logout',async(request,reply)=>{assertOrigin(request,options.webOrigin);const token=sessionToken(request,options.secureCookie);const result=await write(request,`session:${digestOpaqueToken(token)}`,'/auth/logout','POST',async()=>{await options.service.logout(token,requestIds(request));return{status:204,body:null};});clearSessionCookie(reply,options.secureCookie);reply.code(result.status);return result.body;});
  app.post('/api/v1/auth/password-reset/request',{schema:{body:bodySchema(['email'],{email:{type:'string',maxLength:254}})}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const body=request.body as{email:string};const result=await write(request,`email:${normalizeEmail(body.email)}`,'/auth/password-reset/request','POST',async()=>({status:202,body:envelope(await options.service.requestPasswordReset(body.email,requestIds(request)),request)}));reply.code(result.status);return result.body;});
  app.post('/api/v1/auth/password-reset/confirm',{schema:{body:bodySchema(['token','new_password'],{token:{type:'string',minLength:20,maxLength:512},new_password:{type:'string',maxLength:1024}})}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const body=request.body as{token:string;new_password:string};const result=await write(request,`action:${digestOpaqueToken(body.token)}`,'/auth/password-reset/confirm','POST',async()=>{await options.service.resetPassword(body.token,body.new_password,requestIds(request));return{status:204,body:null};});reply.code(result.status);return result.body;});
  app.post('/api/v1/me/password',{schema:{body:bodySchema(['current_password','new_password'],{current_password:{type:'string',maxLength:1024},new_password:{type:'string',maxLength:1024}})}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const token=sessionToken(request,options.secureCookie);const body=request.body as{current_password:string;new_password:string};const result=await write(request,`session:${digestOpaqueToken(token)}`,'/me/password','POST',async()=>{await options.service.changePassword(token,body.current_password,body.new_password,requestIds(request));return{status:204,body:null};});clearSessionCookie(reply,options.secureCookie);reply.code(result.status);return result.body;});
  app.get('/api/v1/me/sessions',async(request)=>envelope(await options.service.listSessions(sessionToken(request,options.secureCookie)),request));
  app.delete('/api/v1/me/sessions/:sessionId',{schema:{params:{type:'object',required:['sessionId'],properties:{sessionId:{type:'string',format:'uuid'}},additionalProperties:false}}},async(request,reply)=>{assertOrigin(request,options.webOrigin);const token=sessionToken(request,options.secureCookie);const {sessionId}=request.params as{sessionId:string};const result=await write(request,`session:${digestOpaqueToken(token)}`,'/me/sessions/{sessionId}','DELETE',async()=>{await options.service.revokeSession(token,sessionId,requestIds(request));return{status:204,body:null};});reply.code(result.status);return result.body;});
}
