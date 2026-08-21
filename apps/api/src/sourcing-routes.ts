import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { SourcingService } from "./sourcing-service.js";
export interface SourcingRouteOptions {
  service: SourcingService;
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
export function registerSourcingRoutes(app: FastifyInstance, o: SourcingRouteOptions) {
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
    write = async (r: FastifyRequest, capability: Capability) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(r, capability)),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  app.get("/api/v1/sourcing/searches", async (r) =>
    env(await o.service.list(await scope(r, "sourcing:read")), r),
  );
  app.get("/api/v1/sourcing/searches/:id", async (r) =>
    env(
      await o.service.detail({
        ...(await scope(r, "sourcing:read")),
        searchId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.post("/api/v1/sourcing/searches", async (r, reply) => {
    const x = await o.service.createSearch({
      ...(await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(202);
    return env(x, r);
  });
  app.post("/api/v1/sourcing/searches/:id/refresh", async (r, reply) => {
    const x = await o.service.refresh({
      ...(await write(r, "supplier_quote:manage")),
      searchId: (r.params as any).id,
    });
    reply.code(202);
    return env(x, r);
  });
  app.delete("/api/v1/sourcing/searches/:id", async (r) =>
    env(
      await o.service.remove({
        ...(await write(r, "supplier_quote:manage")),
        searchId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/sourcing/quotes", async (r, reply) => {
    const x = await o.service.confirmQuote({
      ...(await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.get("/api/v1/sourcing/comparisons", async (r) =>
    env(await o.service.listComparisons(await scope(r, "sourcing:read")), r),
  );
  app.post("/api/v1/sourcing/comparisons", async (r, reply) => {
    const x = await o.service.createComparison({
      ...(await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/sourcing/purchase-tasks", async (r, reply) => {
    const x = await o.service.createPurchaseTask({
      ...(await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(202);
    return env(x, r);
  });
}
