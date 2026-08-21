import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import type { PlatformAccountService } from "./platform-account-service.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
export interface PlatformAccountRouteOptions {
  service: PlatformAccountService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  envelope = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerPlatformAccountRoutes(
  app: FastifyInstance,
  o: PlatformAccountRouteOptions,
) {
  const actor = async (r: FastifyRequest) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
      await o.authorization.authorize({
        actorId: a.user.id,
        capability: "platform:superadmin",
        surface: "api",
        ...ids(r),
      });
      return a.user.id;
    },
    write = async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ai选品 平台后台重试。");
      return actor(r);
    },
    context = (r: FastifyRequest, actorId: string) => ({
      actorId,
      idempotencyKey: requireIdempotencyKey(r),
      ...ids(r),
    });
  app.get("/api/v1/platform/accounts", async (r, reply) => {
    await actor(r);
    const q = r.query as any;
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.overview(q?.query, q?.status), r);
  });
  app.post("/api/v1/platform/accounts/organizations", async (r, reply) => {
    const actorId = await write(r);
    reply.code(201);
    return envelope(await o.service.createOrganization(r.body, context(r, actorId)), r);
  });
  app.patch("/api/v1/platform/accounts/organizations/:organizationId", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.updateOrganization(
        (r.params as any).organizationId,
        r.body,
        context(r, actorId),
      ),
      r,
    );
  });
  app.post("/api/v1/platform/accounts/organizations/:organizationId/status", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.organizationStatus(
        (r.params as any).organizationId,
        r.body,
        context(r, actorId),
      ),
      r,
    );
  });
  app.post("/api/v1/platform/accounts/users", async (r, reply) => {
    const actorId = await write(r);
    reply.code(201);
    return envelope(await o.service.createUser(r.body, context(r, actorId)), r);
  });
  app.get("/api/v1/platform/accounts/users/:userId", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.userDetail((r.params as any).userId), r);
  });
  app.post("/api/v1/platform/accounts/users/:userId/status", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.userStatus((r.params as any).userId, r.body, context(r, actorId)),
      r,
    );
  });
  app.post("/api/v1/platform/accounts/users/:userId/platform-role", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.platformRole((r.params as any).userId, r.body, context(r, actorId)),
      r,
    );
  });
  app.post("/api/v1/platform/accounts/users/:userId/password", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.resetUserPassword((r.params as any).userId, r.body, context(r, actorId)),
      r,
    );
  });
  app.post("/api/v1/platform/accounts/users/:userId/sessions/revoke", async (r) => {
    const actorId = await write(r);
    return envelope(
      await o.service.revokeUserSessions((r.params as any).userId, r.body, context(r, actorId)),
      r,
    );
  });
}
