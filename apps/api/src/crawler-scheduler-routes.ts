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
}
const ids = (request: FastifyRequest) => ({
  requestId: String(request.headers["x-request-id"]),
  traceId: String(request.headers["x-trace-id"]),
});
export function registerCrawlerSchedulerRoutes(
  app: FastifyInstance,
  options: CrawlerSchedulerRouteOptions,
) {
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
    return {
      data: await options.service.read({ actorId, ...ids(request) }),
      request_id: ids(request).requestId,
      trace_id: ids(request).traceId,
    };
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
