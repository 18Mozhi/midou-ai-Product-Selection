import type{FastifyInstance,FastifyRequest}from"fastify";
import type{LocalAuthService}from"@scoutops/auth";
import type{AuthorizationService}from"@scoutops/authorization";
import{sessionToken}from"./auth-routes.js";
import type{PlatformDashboardService}from"./platform-dashboard-service.js";
export interface PlatformDashboardRouteOptions{service:PlatformDashboardService;authorization:AuthorizationService;auth:LocalAuthService;secureCookie:boolean;}
export function registerPlatformDashboardRoutes(app:FastifyInstance,o:PlatformDashboardRouteOptions){app.get("/api/v1/platform/dashboard",async(r:FastifyRequest,reply)=>{const requestId=String(r.headers["x-request-id"]),traceId=String(r.headers["x-trace-id"]),a=await o.auth.authenticate(sessionToken(r,o.secureCookie));await o.authorization.authorize({actorId:a.user.id,capability:"platform:operate",surface:"api",requestId,traceId});reply.header("cache-control","private, no-store");return{data:await o.service.read({actorId:a.user.id,window:(r.query as any)?.window,requestId,traceId}),request_id:requestId,trace_id:traceId};});}
