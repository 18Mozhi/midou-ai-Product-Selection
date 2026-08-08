import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ApprovalService } from "./approval-service.js";
export interface ApprovalRouteOptions {
  service: ApprovalService;
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
export function registerApprovalRoutes(
  app: FastifyInstance,
  o: ApprovalRouteOptions,
) {
  const scope = async (r: FastifyRequest, capability: Capability) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        x = await o.authorization.resolveSession(a.user.id, a.session.id);
      await o.authorization.authorize({
        actorId: a.user.id,
        organizationId: x.context.organization_id,
        workspaceId: x.context.workspace_id,
        capability,
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
        ...(await scope(r, "task:assign")),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  app.get("/api/v1/tasks/approval-templates", async (r) =>
    env(await o.service.listTemplates(await scope(r, "task:read")), r),
  );
  app.post("/api/v1/tasks/approval-templates", async (r, reply) => {
    const x = await o.service.createTemplate({
      ...(await write(r)),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/tasks/approval-templates/:id/actions", async (r) =>
    env(
      await o.service.publishTemplate({
        ...(await write(r)),
        templateId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/tasks/approvals", async (r) => {
    const q = r.query as any,
      x = await o.service.listRequests({
        ...(await scope(r, "task:read")),
        page: q.page,
        pageSize: q.page_size,
        status: q.status,
        mine: q.mine,
      });
    return env(x.items, r, {
      page: x.page,
      page_size: x.page_size,
      total: x.total,
    });
  });
  app.post("/api/v1/tasks/approvals", async (r, reply) => {
    const x = await o.service.createRequest({
      ...(await write(r)),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.get("/api/v1/tasks/approvals/:id", async (r) =>
    env(
      await o.service.detail({
        ...(await scope(r, "task:read")),
        requestIdValue: (r.params as any).id,
      }),
      r,
    ),
  );
  app.post("/api/v1/tasks/approvals/:id/actions", async (r) =>
    env(
      await o.service.decide({
        ...(await write(r)),
        requestIdValue: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
}
