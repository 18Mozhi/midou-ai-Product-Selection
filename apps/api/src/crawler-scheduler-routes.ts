import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { CrawlerSchedulerService } from "./crawler-scheduler-service.js";

export interface CrawlerSchedulerRouteOptions {
  service: Pick<CrawlerSchedulerService, "read" | "recoverExpired" | "recoverProvider">;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  readTimeoutMs?: number;
}
const dependencyFailure = (error: unknown) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code.startsWith("ER_") ||
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "PROTOCOL_CONNECTION_LOST",
      "ENOENT",
      "EACCES",
      "EPERM",
    ].includes(code)
  );
};
const withDependencyBoundary = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (dependencyFailure(error))
      throw new ApiError(
        503,
        "crawler_scheduler_dependency_unavailable",
        "采集调度事实暂不可用。",
        "在宝塔检查 Node API、MySQL 与受控运行目录后重新核验。",
      );
    throw error;
  }
};
const ids = (request: FastifyRequest) => ({
  requestId: String(request.headers["x-request-id"]),
  traceId: String(request.headers["x-trace-id"]),
});
export function registerCrawlerSchedulerRoutes(
  app: FastifyInstance,
  options: CrawlerSchedulerRouteOptions,
) {
  const readTimeoutMs = options.readTimeoutMs ?? 14_000;
  const actor = async (request: FastifyRequest) => {
      const authenticated = await options.auth.authenticate(
        sessionToken(request, options.secureCookie),
      );
      await options.authorization.authorize({
        actorId: authenticated.user.id,
        capability: "platform:operate",
        surface: "api",
        ...ids(request),
      });
      return authenticated.user.id;
    },
    assertOrigin = (request: FastifyRequest) => {
      if (request.headers.origin !== options.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    };
  app.get("/api/v1/platform/operations/crawler-scheduler", async (request, reply) => {
    const actorId = await actor(request);
    reply.header("cache-control", "private, no-store");
    const controller = new AbortController(),
      requestIds = ids(request),
      onClose = () => {
        if (!reply.raw.writableEnded) controller.abort();
      },
      onFinish = () => reply.raw.off("close", onClose);
    reply.raw.once("close", onClose);
    reply.raw.once("finish", onFinish);
    return withDependencyBoundary(async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const read = options.service.read({ actorId, ...requestIds, signal: controller.signal });
      try {
        const data = await Promise.race([
          read,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              const timeoutError = new ApiError(
                503,
                "crawler_scheduler_read_timeout",
                "采集调度事实读取超时。",
                "在宝塔检查 Node API、MySQL 与受控运行目录后重新核验。",
              );
              controller.abort(timeoutError);
              reject(timeoutError);
            }, readTimeoutMs);
          }),
        ]);
        return {
          data,
          request_id: requestIds.requestId,
          trace_id: requestIds.traceId,
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    });
  });
  app.post("/api/v1/platform/operations/crawler-scheduler/recover-expired", async (request) => {
    assertOrigin(request);
    const actorId = await actor(request);
    return {
      data: await options.service.recoverExpired({
        actorId,
        idempotencyKey: requireIdempotencyKey(request),
        ...ids(request),
      }),
      request_id: ids(request).requestId,
      trace_id: ids(request).traceId,
    };
  });
  app.post<{ Params: { providerId: string } }>(
    "/api/v1/platform/operations/crawler-scheduler/providers/:providerId/recover",
    async (request) => {
      assertOrigin(request);
      const actorId = await actor(request);
      return {
        data: await options.service.recoverProvider({
          actorId,
          providerId: request.params.providerId,
          idempotencyKey: requireIdempotencyKey(request),
          ...ids(request),
        }),
        request_id: ids(request).requestId,
        trace_id: ids(request).traceId,
      };
    },
  );
}
