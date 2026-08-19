import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { RuntimeTopologyService } from "./runtime-topology-service.js";

export interface RuntimeTopologyRouteOptions {
  service: RuntimeTopologyService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}

const ids = (request: FastifyRequest) => ({requestId: String(request.headers["x-request-id"]), traceId: String(request.headers["x-trace-id"])});

export function registerRuntimeTopologyRoutes(app: FastifyInstance, options: RuntimeTopologyRouteOptions) {
  app.get("/api/v1/health/available", async (request, reply) => {
    const data = await options.service.businessHealth();
    if (data.status === "unavailable") reply.code(503);
    reply.header("cache-control", "no-store");
    return {data, request_id: ids(request).requestId, trace_id: ids(request).traceId};
  });
  app.get("/api/v1/health/nodes", async (request, reply) => {
    const data = await options.service.publicHealth();
    if (data.state !== "ready") reply.code(503);
    reply.header("cache-control", "no-store");
    return {data, request_id: ids(request).requestId, trace_id: ids(request).traceId};
  });
  app.get("/api/v1/platform/operations/topology", async (request, reply) => {
    const correlation = ids(request);
    const authentication = await options.auth.authenticate(sessionToken(request, options.secureCookie));
    await options.authorization.authorize({actorId: authentication.user.id, capability: "platform:operate", surface: "api", ...correlation});
    reply.header("cache-control", "private, no-store");
    return {data: await options.service.read({actorId: authentication.user.id, ...correlation}), request_id: correlation.requestId, trace_id: correlation.traceId};
  });
}
