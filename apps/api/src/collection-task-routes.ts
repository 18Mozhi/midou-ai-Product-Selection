import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import type { CollectionTaskService } from "./collection-task-service.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
export interface CollectionTaskRouteOptions {
  service: CollectionTaskService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: r.headers["x-request-id"]!.toString(),
    traceId: r.headers["x-trace-id"]!.toString(),
  }),
  envelope = (data: unknown, r: FastifyRequest, meta?: unknown) => ({
    data,
    ...(meta ? { meta } : {}),
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerCollectionTaskRoutes(app: FastifyInstance, o: CollectionTaskRouteOptions) {
  const actor = async (r: FastifyRequest) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "collection:replay",
      surface: "api",
      ...ids(r),
    });
    return a.user.id;
  };
  app.get("/api/v1/platform/collection/tasks", async (r, reply) => {
    await actor(r);
    const result = await o.service.list(r.query as any);
    reply.header("cache-control", "private, no-store");
    return envelope(result.items, r, {
      page: result.page,
      page_size: result.page_size,
      total: result.total,
    });
  });
  app.get("/api/v1/platform/collection/tasks/:taskId", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.detail((r.params as { taskId: string }).taskId), r);
  });
  app.post("/api/v1/platform/collection/tasks/:taskId/replay", async (r) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const actorId = await actor(r);
    return envelope(
      await o.service.replay(
        (r.params as { taskId: string }).taskId,
        r.body as { reason?: unknown },
        { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
      ),
      r,
    );
  });
}
