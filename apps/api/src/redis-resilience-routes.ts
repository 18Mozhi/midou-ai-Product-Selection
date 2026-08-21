import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { RedisResilienceService } from "./redis-resilience-service.js";

export interface RedisResilienceRouteOptions {
  service: Pick<RedisResilienceService, "read">;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}
const ids = (request: FastifyRequest) => ({
  requestId: String(request.headers["x-request-id"]),
  traceId: String(request.headers["x-trace-id"]),
});

export function registerRedisResilienceRoutes(
  app: FastifyInstance,
  options: RedisResilienceRouteOptions,
) {
  app.get("/api/v1/platform/operations/redis", async (request, reply) => {
    const correlation = ids(request);
    const authentication = await options.auth.authenticate(
      sessionToken(request, options.secureCookie),
    );
    await options.authorization.authorize({
      actorId: authentication.user.id,
      capability: "platform:operate",
      surface: "api",
      ...correlation,
    });
    reply.header("cache-control", "private, no-store");
    return {
      data: await options.service.read({ actorId: authentication.user.id, ...correlation }),
      request_id: correlation.requestId,
      trace_id: correlation.traceId,
    };
  });
}
