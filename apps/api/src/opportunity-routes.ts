import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LocalAuthService } from '@scoutops/auth';
import type { AuthorizationService } from '@scoutops/authorization';
import { sessionToken } from './auth-routes.js';
import { ApiError, requireIdempotencyKey } from './api-foundation.js';
import type { DecisionAction, OpportunityCreateInput, OpportunityDecision, OpportunityService } from './opportunity-service.js';

export interface OpportunityRouteOptions { service:OpportunityService; authorization:AuthorizationService; auth:LocalAuthService; secureCookie:boolean; webOrigin:string }
const ids=(request:FastifyRequest)=>({requestId:request.headers['x-request-id']!.toString(),traceId:request.headers['x-trace-id']!.toString()});
const envelope=(data:unknown,request:FastifyRequest,meta?:unknown)=>({data,...(meta?{meta}:{}),request_id:ids(request).requestId,trace_id:ids(request).traceId});
export function registerOpportunityRoutes(app:FastifyInstance,options:OpportunityRouteOptions){
 const scope=async(request:FastifyRequest,capability:'opportunity:read'|'opportunity:decide')=>{const authenticated=await options.auth.authenticate(sessionToken(request,options.secureCookie));const resolved=await options.authorization.resolveSession(authenticated.user.id,authenticated.session.id);await options.authorization.authorize({actorId:authenticated.user.id,organizationId:resolved.context.organization_id,workspaceId:resolved.context.workspace_id,capability,surface:'api',...ids(request)});return{organizationId:resolved.context.organization_id,workspaceId:resolved.context.workspace_id,actorId:authenticated.user.id};};
 const write=async(request:FastifyRequest)=>{if(request.headers.origin!==options.webOrigin)throw new ApiError(403,'origin_forbidden','请求来源不允许。','从 ScoutOps 页面重试。');return{...await scope(request,'opportunity:decide'),...ids(request),idempotencyKey:requireIdempotencyKey(request)};};
 app.get('/api/v1/opportunities',async request=>{const query=request.query as Record<string,string|undefined>,page=Number(query.page??1),pageSize=Number(query.page_size??20);const result=await options.service.list({...await scope(request,'opportunity:read'),page,pageSize,scope:query.scope==='all'?'all':'product',...(query.q?{query:query.q}:{}),...(query.market?{market:query.market}:{}),...(query.decision_status?{decisionStatus:query.decision_status as OpportunityDecision}:{})} as any);return envelope(result.items,request,{page,page_size:pageSize,total:result.total});});
 app.post('/api/v1/opportunities',async(request,reply)=>{const result=await options.service.create({...await write(request),value:request.body as OpportunityCreateInput});reply.code(201);return envelope(result,request);});
 app.get('/api/v1/opportunities/:id',async request=>envelope(await options.service.get({...await scope(request,'opportunity:read'),opportunityId:(request.params as{id:string}).id}),request));
 app.post('/api/v1/opportunities/:id/decisions',async request=>{const body=request.body as{action:DecisionAction;reason:string;expected_version:number};return envelope(await options.service.decide({...await write(request),opportunityId:(request.params as{id:string}).id,value:body}),request);});
}
