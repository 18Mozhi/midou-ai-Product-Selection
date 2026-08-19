import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { PlatformDashboardService } from "./platform-dashboard-service.js";
export interface PlatformDashboardRouteOptions {
  service: PlatformDashboardService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
export function registerPlatformDashboardRoutes(
  app: FastifyInstance,
  o: PlatformDashboardRouteOptions,
) {
  const context = async (r: FastifyRequest) => {
    const requestId = String(r.headers["x-request-id"]),
      traceId = String(r.headers["x-trace-id"]),
      a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "platform:operate",
      surface: "api",
      requestId,
      traceId,
    });
    return { actorId: a.user.id, requestId, traceId };
  };
  app.get("/api/v1/platform/dashboard", async (r: FastifyRequest, reply) => {
    const c = await context(r);
    reply.header("cache-control", "private, no-store");
    return {
      data: await o.service.read({ ...c, window: (r.query as any)?.window }),
      request_id: c.requestId,
      trace_id: c.traceId,
    };
  });
  app.get("/api/v1/platform/management", async (r: FastifyRequest, reply) => {
    const c = await context(r),
      query = r.query as any;
    reply.header("cache-control", "private, no-store");
    return {
      data: await o.service.management({
        ...c,
        domain: query?.domain,
        entity: query?.entity,
        query: query?.query,
        status: query?.status,
      }),
      request_id: c.requestId,
      trace_id: c.traceId,
    };
  });
  app.patch(
    "/api/v1/platform/management/content/:topicId",
    async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r);
      return {
        data: await o.service.moderateTrend((r.params as any).topicId, r.body, {
          ...c,
          idempotencyKey: requireIdempotencyKey(r),
        }),
        request_id: c.requestId,
        trace_id: c.traceId,
      };
    },
  );
  app.post(
    "/api/v1/platform/management/email/:source/:deliveryId/actions",
    async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r),
        params = r.params as any;
      return {
        data: await o.service.manageEmailDelivery(
          params.source,
          params.deliveryId,
          r.body,
          { ...c, idempotencyKey: requireIdempotencyKey(r) },
        ),
        request_id: c.requestId,
        trace_id: c.traceId,
      };
    },
  );
  app.post(
    "/api/v1/platform/management/data/exports",
    async (r: FastifyRequest, reply) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r),
        data: any = await o.service.exportData(r.body, c),
        columns = [
          "id",
          "title",
          "organization_name",
          "workspace_name",
          "category",
          "market",
          "status",
          "metric_primary",
          "metric_secondary",
          "updated_at",
        ],
        csv = [
          columns.join(","),
          ...data.items.map((item: any) =>
            columns
              .map(
                (column) =>
                  `"${String(item[column] ?? "").replaceAll('"', '""')}"`,
              )
              .join(","),
          ),
        ].join("\r\n");
      reply
        .header("content-type", "text/csv; charset=utf-8")
        .header(
          "content-disposition",
          `attachment; filename="platform-${data.entity}-${Date.now()}.csv"`,
        )
        .header("x-request-id", c.requestId)
        .header("x-trace-id", c.traceId);
      return `\ufeff${csv}`;
    },
  );
  app.post(
    "/api/v1/platform/management/messages",
    async (r: FastifyRequest, reply) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r);
      reply.code(201);
      return {
        data: await o.service.createMessage(r.body, {
          ...c,
          idempotencyKey: requireIdempotencyKey(r),
        }),
        request_id: c.requestId,
        trace_id: c.traceId,
      };
    },
  );
  app.patch(
    "/api/v1/platform/management/messages/:messageId",
    async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r);
      return {
        data: await o.service.updateMessage(
          (r.params as any).messageId,
          r.body,
          { ...c, idempotencyKey: requireIdempotencyKey(r) },
        ),
        request_id: c.requestId,
        trace_id: c.traceId,
      };
    },
  );
  app.post(
    "/api/v1/platform/management/messages/:messageId/actions",
    async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 页面重试。",
        );
      const c = await context(r);
      return {
        data: await o.service.messageAction(
          (r.params as any).messageId,
          r.body,
          { ...c, idempotencyKey: requireIdempotencyKey(r) },
        ),
        request_id: c.requestId,
        trace_id: c.traceId,
      };
    },
  );
}
