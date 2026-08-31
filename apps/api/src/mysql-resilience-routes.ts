import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError } from "./api-foundation.js";
import type { MySqlResilienceService } from "./mysql-resilience-service.js";
export interface MySqlResilienceRouteOptions {
  service: Pick<MySqlResilienceService, "read">;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  readTimeoutMs?: number;
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
        "mysql_resilience_dependency_unavailable",
        "MySQL 运行事实暂不可用。",
        "在宝塔检查 Node API 与 MySQL 后重新核验。",
      );
    throw error;
  }
};
export function registerMySqlResilienceRoutes(
  app: FastifyInstance,
  options: MySqlResilienceRouteOptions,
) {
  const readTimeoutMs = options.readTimeoutMs ?? 14_000;
  app.get("/api/v1/platform/operations/mysql", async (request, reply) => {
    const requestController = new AbortController();
    const onClose = () => {
      if (!reply.raw.writableEnded) requestController.abort();
    };
    const onFinish = () => reply.raw.off("close", onClose);
    reply.raw.once("close", onClose);
    reply.raw.once("finish", onFinish);
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
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const read = options.service.read({
        actorId: authentication.user.id,
        ...correlation,
        signal: requestController.signal,
      });
      try {
        const data = await Promise.race([
          read,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              const timeoutError = new ApiError(
                503,
                "mysql_resilience_read_timeout",
                "MySQL 运行事实读取超时。",
                "在宝塔检查 Node API 与 MySQL 后重新核验。",
              );
              requestController.abort(timeoutError);
              reject(timeoutError);
            }, readTimeoutMs);
          }),
        ]);
        return {
          data,
          request_id: correlation.requestId,
          trace_id: correlation.traceId,
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    });
  });
}
