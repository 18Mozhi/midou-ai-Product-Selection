import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LocalAuthService } from '@scoutops/auth';
import type { AuthorizationService } from '@scoutops/authorization';
import type { CrawlerRuntimeService } from './crawler-runtime-service.js';
import { sessionToken } from './auth-routes.js';
import { ApiError, requireIdempotencyKey } from './api-foundation.js';
export interface CrawlerRuntimeRouteOptions{service:CrawlerRuntimeService;authorization:AuthorizationService;auth:LocalAuthService;secureCookie:boolean;webOrigin:string;}
const ids=(r:FastifyRequest)=>({requestId:r.headers['x-request-id']!.toString(),traceId:r.headers['x-trace-id']!.toString()});
const envelope=(data:unknown,r:FastifyRequest)=>({data,request_id:ids(r).requestId,trace_id:ids(r).traceId});
export function registerCrawlerRuntimeRoutes(app:FastifyInstance,o:CrawlerRuntimeRouteOptions){const actor=async(r:FastifyRequest)=>{const a=await o.auth.authenticate(sessionToken(r,o.secureCookie));await o.authorization.authorize({actorId:a.user.id,capability:'collection:replay',surface:'api',...ids(r)});return a.user.id;};app.get('/api/v1/platform/crawler-runtime',async(r,reply)=>{await actor(r);reply.header('cache-control','private, no-store');return envelope(await o.service.list(),r);});app.post('/api/v1/platform/crawler-runtime/recover-expired',async r=>{if(r.headers.origin!==o.webOrigin)throw new ApiError(403,'origin_forbidden','请求来源不允许。','从 ScoutOps 页面重试。');const actorId=await actor(r);return envelope(await o.service.recoverExpired({actorId,idempotencyKey:requireIdempotencyKey(r),...ids(r)}),r);});}
