import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { NotificationService } from "./notification-service.js";
export interface NotificationRouteOptions {
  service: NotificationService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  env = (data: unknown, r: FastifyRequest, meta?: unknown) => ({
    data,
    ...(meta ? { meta } : {}),
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerNotificationRoutes(
  app: FastifyInstance,
  o: NotificationRouteOptions,
) {
  const scope = async (r: FastifyRequest) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        x = await o.authorization.resolveSession(a.user.id, a.session.id);
      await o.authorization.authorize({
        actorId: a.user.id,
        organizationId: x.context.organization_id,
        workspaceId: x.context.workspace_id,
        capability: "notification:read",
        surface: "api",
        ...ids(r),
      });
      return {
        organizationId: x.context.organization_id,
        workspaceId: x.context.workspace_id,
        actorId: a.user.id,
      };
    },
    write = async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ScoutOps 页面重试。",
        );
      return {
        ...(await scope(r)),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  app.get("/api/v1/notifications", async (r) => {
    const q = r.query as any,
      x = await o.service.list({
        ...(await scope(r)),
        page: q.page,
        pageSize: q.page_size,
        unread: q.unread,
        workflowStatus: q.workflow_status,
        category: q.category,
      });
    return env(x.items, r, {
      page: x.page,
      page_size: x.page_size,
      total: x.total,
    });
  });
  app.get("/api/v1/notifications/summary", async (r) =>
    env(await o.service.summary(await scope(r)), r),
  );
  app.get("/api/v1/notifications/:id", async (r) =>
    env(
      await o.service.detail({
        ...(await scope(r)),
        notificationId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.post("/api/v1/notifications/:id/actions", async (r) =>
    env(
      await o.service.action({
        ...(await write(r)),
        notificationId: (r.params as any).id,
        value: r.body,
        route: "POST:/api/v1/notifications/:id/actions",
      }),
      r,
    ),
  );
  app.post("/api/v1/notifications/actions", async (r) =>
    env(
      await o.service.markAll({
        ...(await write(r)),
        route: "POST:/api/v1/notifications/actions",
      }),
      r,
    ),
  );
  app.get("/api/v1/me/notification-preferences", async (r) =>
    env(await o.service.preferences(await scope(r)), r),
  );
  app.put("/api/v1/me/notification-preferences", async (r) =>
    env(
      await o.service.updatePreferences({
        ...(await write(r)),
        value: r.body,
        route: "PUT:/api/v1/me/notification-preferences",
      }),
      r,
    ),
  );
}
