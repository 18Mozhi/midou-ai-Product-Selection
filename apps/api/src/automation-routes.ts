import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { AutomationService } from "./automation-service.js";
export interface AutomationRouteOptions {
  service: AutomationService;
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
export function registerAutomationRoutes(app: FastifyInstance, o: AutomationRouteOptions) {
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
        ...(await scope(r, "team:manage")),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  app.get("/api/v1/automations", async (r) =>
    env(await o.service.list(await scope(r, "team:manage")), r),
  );
  app.post("/api/v1/automations", async (r, reply) => {
    const x = await o.service.create({ ...(await write(r)), value: r.body });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/automations/preview", async (r) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return env(await o.service.preview({ ...(await scope(r, "team:manage")), value: r.body }), r);
  });
  app.patch("/api/v1/automations/:id", async (r) =>
    env(
      await o.service.update({
        ...(await write(r)),
        ruleId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/automations/:id", async (r) =>
    env(
      await o.service.detail({
        ...(await scope(r, "team:manage")),
        ruleId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.post("/api/v1/automations/:id/actions", async (r) =>
    env(
      await o.service.changeStatus({
        ...(await write(r)),
        ruleId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
}
