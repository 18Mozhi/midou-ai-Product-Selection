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
}
const ids = (r: FastifyRequest) => ({
  requestId: String(r.headers["x-request-id"]),
  traceId: String(r.headers["x-trace-id"]),
});
export function registerCapacityBoundaryRoutes(
  app: FastifyInstance,
  o: CapacityBoundaryRouteOptions,
) {
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
    return {
      data: await o.service.read({ actorId, ...ids(r) }),
      request_id: ids(r).requestId,
      trace_id: ids(r).traceId,
    };
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
