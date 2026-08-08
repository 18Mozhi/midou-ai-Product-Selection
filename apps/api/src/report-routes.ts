import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ReportService } from "./report-service.js";
export interface ReportRouteOptions {
  service: ReportService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  env = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerReportRoutes(
  app: FastifyInstance,
  o: ReportRouteOptions,
) {
  const scope = async (r: FastifyRequest) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        x = await o.authorization.resolveSession(a.user.id, a.session.id);
      await o.authorization.authorize({
        actorId: a.user.id,
        organizationId: x.context.organization_id,
        workspaceId: x.context.workspace_id,
        capability: "report:read",
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
  app.get("/api/v1/reports/:type", async (r) =>
    env(
      await o.service.report({
        ...(await scope(r)),
        reportType: (r.params as any).type,
      }),
      r,
    ),
  );
  app.get("/api/v1/report-exports", async (r) =>
    env(await o.service.listExports(await scope(r)), r),
  );
  app.post("/api/v1/report-exports", async (r, reply) => {
    const x = await o.service.createExport({
      ...(await write(r)),
      value: r.body,
    });
    reply.code(202);
    return env(x, r);
  });
  app.get("/api/v1/report-exports/:id", async (r) =>
    env(
      await o.service.detail({
        ...(await scope(r)),
        exportId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.get("/api/v1/report-exports/:id/download", async (r, reply) => {
    const x = await o.service.download({
      ...(await scope(r)),
      exportId: (r.params as any).id,
    });
    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header(
        "content-disposition",
        `attachment; filename="${x.item.filename}"`,
      )
      .header("cache-control", "private, no-store");
    return reply.send(x.content);
  });
}
