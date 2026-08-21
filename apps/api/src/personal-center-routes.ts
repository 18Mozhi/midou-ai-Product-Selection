import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { PersonalCenterService } from "./personal-center-service.js";

export function registerPersonalCenterRoutes(
  app: FastifyInstance,
  options: {
    service: PersonalCenterService;
    authorization: AuthorizationService;
    auth: LocalAuthService;
    secureCookie: boolean;
    webOrigin: string;
  },
) {
  const ids = (request: FastifyRequest) => ({
    requestId: String(request.headers["x-request-id"]),
    traceId: String(request.headers["x-trace-id"]),
  });
  const scope = async (request: FastifyRequest) => {
    const authenticated = await options.auth.authenticate(
      sessionToken(request, options.secureCookie),
    );
    const resolved = await options.authorization.resolveSession(
      authenticated.user.id,
      authenticated.session.id,
    );
    return {
      userId: authenticated.user.id,
      organizationId: resolved.context.organization_id,
      workspaceId: resolved.context.workspace_id,
    };
  };
  const envelope = (data: unknown, request: FastifyRequest) => ({
    data,
    request_id: ids(request).requestId,
    trace_id: ids(request).traceId,
  });
  app.get("/api/v1/me/profile", async (request, reply) => {
    const current = await scope(request);
    reply.header("cache-control", "private, no-store");
    return envelope(await options.service.profile(current.userId), request);
  });
  app.patch("/api/v1/me/profile", async (request) => {
    if (request.headers.origin !== options.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ai选品 个人中心重试。 ");
    const current = await scope(request);
    return envelope(
      await options.service.update(request.body, {
        ...current,
        ...ids(request),
        idempotencyKey: requireIdempotencyKey(request),
      }),
      request,
    );
  });
  app.get("/api/v1/me/assets", async (request, reply) => {
    const current = await scope(request);
    reply.header("cache-control", "private, no-store");
    return envelope(
      await options.service.assets(current.userId, current.organizationId, current.workspaceId),
      request,
    );
  });
}
