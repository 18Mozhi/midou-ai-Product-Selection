import type{FastifyInstance,FastifyRequest}from"fastify";
import type{LocalAuthService}from"@scoutops/auth";
import type{AuthorizationService,Capability}from"@scoutops/authorization";
import{sessionToken}from"./auth-routes.js";
import{ApiError,requireIdempotencyKey}from"./api-foundation.js";
import type{SelectionJourneyService}from"./selection-journey-service.js";
export interface SelectionJourneyRouteOptions{service:SelectionJourneyService;authorization:AuthorizationService;auth:LocalAuthService;secureCookie:boolean;webOrigin:string}
const ids=(r:FastifyRequest)=>({requestId:r.headers["x-request-id"]!.toString(),traceId:r.headers["x-trace-id"]!.toString()}),envelope=(data:unknown,r:FastifyRequest)=>({data,request_id:ids(r).requestId,trace_id:ids(r).traceId});
export function registerSelectionJourneyRoutes(app:FastifyInstance,o:SelectionJourneyRouteOptions){
 const scope=async(r:FastifyRequest,capability:Capability)=>{const a=await o.auth.authenticate(sessionToken(r,o.secureCookie)),x=await o.authorization.resolveSession(a.user.id,a.session.id);await o.authorization.authorize({actorId:a.user.id,organizationId:x.context.organization_id,workspaceId:x.context.workspace_id,capability,surface:"api",...ids(r)});return{organizationId:x.context.organization_id,workspaceId:x.context.workspace_id,actorId:a.user.id};};
 const write=async(r:FastifyRequest,capability:Capability)=>{if(r.headers.origin!==o.webOrigin)throw new ApiError(403,"origin_forbidden","请求来源不允许。","从 ScoutOps 页面重试。");return{...await scope(r,capability),...ids(r),idempotencyKey:requireIdempotencyKey(r)};};
 app.post("/api/v1/selection-journeys",async(r,reply)=>{const result=await o.service.create({...await write(r,"task:create"),value:r.body as any});reply.code(202);reply.header("cache-control","private, no-store");return envelope(result,r);});
 app.get("/api/v1/selection-journeys/:id",async(r,reply)=>{const result=await o.service.get({...await scope(r,"opportunity:read"),...ids(r),journeyId:(r.params as{id:string}).id});reply.header("cache-control","private, no-store");return envelope(result,r);});
 app.post("/api/v1/selection-journeys/:id/decisions",async(r,reply)=>{const result=await o.service.decide({...await write(r,"opportunity:decide"),journeyId:(r.params as{id:string}).id,value:r.body as any});reply.code(201);reply.header("cache-control","private, no-store");return envelope(result,r);});
}
