import type { FastifyInstance,FastifyRequest } from 'fastify';
import type { LocalAuthService } from '@scoutops/auth';
import type { AuthorizationService,Capability } from '@scoutops/authorization';
import { sessionToken } from './auth-routes.js';
import { ApiError,requireIdempotencyKey } from './api-foundation.js';
import type { CompetitorService } from './competitor-service.js';
export interface CompetitorRouteOptions{service:CompetitorService;authorization:AuthorizationService;auth:LocalAuthService;secureCookie:boolean;webOrigin:string}
const ids=(r:FastifyRequest)=>({requestId:String(r.headers['x-request-id']),traceId:String(r.headers['x-trace-id'])}),envelope=(data:unknown,r:FastifyRequest)=>({data,request_id:ids(r).requestId,trace_id:ids(r).traceId});
export function registerCompetitorRoutes(app:FastifyInstance,o:CompetitorRouteOptions){
 const scope=async(r:FastifyRequest,capability:Capability)=>{const a=await o.auth.authenticate(sessionToken(r,o.secureCookie)),resolved=await o.authorization.resolveSession(a.user.id,a.session.id);await o.authorization.authorize({actorId:a.user.id,organizationId:resolved.context.organization_id,workspaceId:resolved.context.workspace_id,capability,surface:'api',...ids(r)});return{organizationId:resolved.context.organization_id,workspaceId:resolved.context.workspace_id,actorId:a.user.id};};
 const write=async(r:FastifyRequest)=>{if(r.headers.origin!==o.webOrigin)throw new ApiError(403,'origin_forbidden','请求来源不允许。','从 ScoutOps 页面重试。');return{...(await scope(r,'competitor:manage')),...ids(r),idempotencyKey:requireIdempotencyKey(r)};};
 app.get('/api/v1/competitors',async r=>envelope(await o.service.list(await scope(r,'competitor:read')),r));
 app.get('/api/v1/competitors/:id',async r=>envelope(await o.service.get({...await scope(r,'competitor:read'),competitorId:(r.params as any).id}),r));
 app.post('/api/v1/competitors',async(r,reply)=>{const result=await o.service.create({...await write(r),value:r.body});reply.code(201);return envelope(result,r);});
 app.post('/api/v1/competitors/:id/snapshots',async(r,reply)=>{const result=await o.service.addSnapshot({...await write(r),competitorId:(r.params as any).id,value:r.body});reply.code(202);return envelope(result,r);});
 app.post('/api/v1/competitors/:id/collect',async(r,reply)=>{const result=await o.service.collect({...await write(r),competitorId:(r.params as any).id});reply.code(202);return envelope(result,r);});
 app.delete('/api/v1/competitors/:id',async r=>envelope(await o.service.remove({...await write(r),competitorId:(r.params as any).id,value:r.body}),r));
 app.post('/api/v1/opportunities/:id/competitor-discovery',async(r,reply)=>{const result=await o.service.discover({...await write(r),opportunityId:(r.params as any).id});reply.code(202);return envelope(result,r);});
 app.post('/api/v1/competitors/:id/actions',async r=>envelope(await o.service.setStatus({...await write(r),competitorId:(r.params as any).id,value:r.body}),r));
 app.get('/api/v1/competitor-monitor-rules',async r=>envelope(await o.service.listRules(await scope(r,'competitor:read')),r));
 app.post('/api/v1/competitor-monitor-rules',async(r,reply)=>{const result=await o.service.createRule({...await write(r),value:r.body});reply.code(201);return envelope(result,r);});
}
