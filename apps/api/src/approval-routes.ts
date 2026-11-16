import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ApprovalService } from "./approval-service.js";
export interface ApprovalRouteOptions {
  service: ApprovalService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  accountReadRehearsal?: boolean;
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
export function registerApprovalRoutes(app: FastifyInstance, o: ApprovalRouteOptions) {
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
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(r, "task:assign")),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  const templateWrite = async (r: FastifyRequest) => {
    if (!o.accountReadRehearsal) return write(r);
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return {
      ...(await authenticatedRehearsalAccount(r, o.auth, o.secureCookie)),
      ...ids(r),
      idempotencyKey: requireIdempotencyKey(r),
    };
  };
  app.get("/api/v1/tasks/approval-templates", async (r, reply) => {
    if (!o.accountReadRehearsal)
      return env(await o.service.listTemplates(await scope(r, "task:read")), r);
    reply.header("cache-control", "private, no-store");
    const account = await authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
    const { items, canManage } = await o.service.accountTemplateOptions(account);
    return env(items, r, { can_manage: canManage });
  });
  app.post("/api/v1/tasks/approval-templates", async (r, reply) => {
    const x = await o.service.createTemplate({
      ...(await templateWrite(r)),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/tasks/approval-templates/:id/actions", async (r) =>
    env(
      await o.service.publishTemplate({
        ...(await templateWrite(r)),
        templateId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/tasks/approvals", async (r, reply) => {
    if (o.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const scopeInput = o.accountReadRehearsal
      ? await authenticatedRehearsalAccount(r, o.auth, o.secureCookie)
      : await scope(r, "task:read");
    const q = r.query as any,
      x = await o.service.listRequests({
        ...scopeInput,
        page: q.page,
        pageSize: q.page_size,
        status: q.status,
        mine: q.mine,
        involvement: q.involvement,
      });
    return env(x.items, r, {
      page: x.page,
      page_size: x.page_size,
      total: x.total,
    });
  });
  app.post("/api/v1/tasks/approvals", async (r, reply) => {
    const x = await o.service.createRequest({
      ...(await templateWrite(r)),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.get("/api/v1/tasks/approvals/:id", async (r, reply) => {
    if (o.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const scopeInput = o.accountReadRehearsal
      ? await authenticatedRehearsalAccount(r, o.auth, o.secureCookie)
      : await scope(r, "task:read");
    return env(
      await o.service.detail({
        ...scopeInput,
        requestIdValue: (r.params as any).id,
      }),
      r,
    );
  });
  app.post("/api/v1/tasks/approvals/:id/actions", async (r) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const context = o.accountReadRehearsal
      ? {
          ...(await authenticatedRehearsalAccount(r, o.auth, o.secureCookie)),
          ...ids(r),
          idempotencyKey: requireIdempotencyKey(r),
        }
      : await write(r);
    return env(
      await o.service.decide({
        ...context,
        requestIdValue: (r.params as any).id,
        value: r.body,
      }),
      r,
    );
  });
}
