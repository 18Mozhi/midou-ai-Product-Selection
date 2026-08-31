import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError } from "./api-foundation.js";
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
const dependencyFailure = (error: unknown) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code.startsWith("ER_") ||
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(code)
  );
};
const withDependencyBoundary = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (dependencyFailure(error))
      throw new ApiError(
        503,
        "redis_resilience_dependency_unavailable",
        "Redis 运行事实暂不可用。",
        "在宝塔检查 Node API、MySQL 与 Redis 后重新核验。",
      );
    throw error;
  }
};

export function registerRedisResilienceRoutes(
  app: FastifyInstance,
  options: RedisResilienceRouteOptions,
) {
  app.get("/api/v1/platform/operations/redis", async (request, reply) => {
    return withDependencyBoundary(async () => {
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
  });
}
