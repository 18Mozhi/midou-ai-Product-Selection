import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { CapacityBoundaryService } from "./capacity-boundary-service.js";
export interface CapacityBoundaryRouteOptions {
  service: Pick<CapacityBoundaryService, "read" | "attestDrill">;
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
        "capacity_boundary_dependency_unavailable",
        "容量边界事实暂不可用。",
        "在宝塔检查 Node API、MySQL 与容量证据后重新核验。",
      );
    throw error;
  }
};
const ids = (r: FastifyRequest) => ({
  requestId: String(r.headers["x-request-id"]),
  traceId: String(r.headers["x-trace-id"]),
});
export function registerCapacityBoundaryRoutes(
  app: FastifyInstance,
  o: CapacityBoundaryRouteOptions,
) {
  const readTimeoutMs = o.readTimeoutMs ?? 14_000;
  const actor = async (r: FastifyRequest) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "platform:operate",
      surface: "api",
      ...ids(r),
    });
    return a.user.id;
  };
  app.get("/api/v1/platform/operations/capacity", async (r, reply) => {
    const actorId = await actor(r);
    reply.header("cache-control", "private, no-store");
    const controller = new AbortController(),
      requestIds = ids(r),
      onClose = () => {
        if (!reply.raw.writableEnded) controller.abort();
      },
      onFinish = () => reply.raw.off("close", onClose);
    reply.raw.once("close", onClose);
    reply.raw.once("finish", onFinish);
    return withDependencyBoundary(async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const read = o.service.read({ actorId, ...requestIds, signal: controller.signal });
      try {
        const data = await Promise.race([
          read,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              const timeoutError = new ApiError(
                503,
                "capacity_boundary_read_timeout",
                "容量边界事实读取超时。",
                "在宝塔检查 Node API、MySQL 与容量证据后重新核验。",
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
  app.post("/api/v1/platform/operations/capacity/drills", async (r) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const actorId = await actor(r),
      body = (r.body ?? {}) as Record<string, unknown>;
    return {
      data: await o.service.attestDrill({
        actorId,
        idempotencyKey: requireIdempotencyKey(r),
        kind: body.kind,
        reason: body.reason,
        ...ids(r),
      }),
      request_id: ids(r).requestId,
      trace_id: ids(r).traceId,
    };
  });
}
