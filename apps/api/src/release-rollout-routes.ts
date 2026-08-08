import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { ReleaseRolloutService } from "./release-rollout-service.js";
export interface ReleaseRolloutRouteOptions { service: ReleaseRolloutService; authorization: AuthorizationService; auth: LocalAuthService; secureCookie: boolean }
export function registerReleaseRolloutRoutes(app: FastifyInstance, options: ReleaseRolloutRouteOptions) {
  app.get("/api/v1/platform/operations/releases", async (request: FastifyRequest, reply) => {
    const requestId = String(request.headers["x-request-id"]), traceId = String(request.headers["x-trace-id"]), authentication = await options.auth.authenticate(sessionToken(request, options.secureCookie));
    await options.authorization.authorize({ actorId: authentication.user.id, capability: "platform:operate", surface: "api", requestId, traceId });
    reply.header("cache-control", "private, no-store");
    return { data: await options.service.read({ actorId: authentication.user.id, requestId, traceId }), request_id: requestId, trace_id: traceId };
  });
}
