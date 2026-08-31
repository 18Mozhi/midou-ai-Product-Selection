import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError } from "./api-foundation.js";
import type { RuntimeTopologyService } from "./runtime-topology-service.js";

export interface RuntimeTopologyRouteOptions {
  service: RuntimeTopologyService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}

const ids = (request: FastifyRequest) => ({
  requestId: String(request.headers["x-request-id"]),
  traceId: String(request.headers["x-trace-id"]),
});
const databaseFailure = (error: unknown) => {
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
    if (databaseFailure(error))
      throw new ApiError(
        503,
        "runtime_topology_dependency_unavailable",
        "运行拓扑暂不可用。",
        "在宝塔检查 Node API 与 MySQL 后重新核验。",
      );
    throw error;
  }
};

export function registerRuntimeTopologyRoutes(
  app: FastifyInstance,
  options: RuntimeTopologyRouteOptions,
) {
  app.get("/api/v1/health/available", async (request, reply) => {
    const data = await options.service.businessHealth();
    if (data.status === "unavailable") reply.code(503);
    reply.header("cache-control", "no-store");
    return { data, request_id: ids(request).requestId, trace_id: ids(request).traceId };
  });
  app.get("/api/v1/health/nodes", async (request, reply) => {
    const data = await options.service.publicHealth();
    if (data.state !== "ready") reply.code(503);
    reply.header("cache-control", "no-store");
    return { data, request_id: ids(request).requestId, trace_id: ids(request).traceId };
  });
  app.get("/api/v1/platform/operations/topology", async (request, reply) => {
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
