import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import { rethrowCommercialDependency, type CommercialService } from "./commercial-service.js";
export interface CommercialRouteOptions {
  service: CommercialService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  env = (data: any, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerCommercialRoutes(app: FastifyInstance, o: CommercialRouteOptions) {
  const actor = async (r: FastifyRequest) => {
      try {
        const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
        await o.authorization.authorize({
          actorId: a.user.id,
          capability: "platform:operate",
          surface: "api",
          ...ids(r),
        });
        return a.user.id;
      } catch (error) {
        rethrowCommercialDependency(error);
      }
    },
    write = async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return { actorId: await actor(r), idempotencyKey: requireIdempotencyKey(r), ...ids(r) };
    };
  app.get("/api/v1/platform/commercial", async (r, reply) => {
    const actorId = await actor(r);
    reply.header("cache-control", "private, no-store");
    return env(
      await o.service.read({
        actorId,
        organizationId: (r.query as any)?.organization_id ?? null,
        query: (r.query as any)?.query,
        status: (r.query as any)?.status,
        page: (r.query as any)?.page,
        pageSize: (r.query as any)?.page_size,
        adjustmentPage: (r.query as any)?.adjustment_page,
        adjustmentPageSize: (r.query as any)?.adjustment_page_size,
        ...ids(r),
      }),
      r,
    );
  });
  app.post("/api/v1/platform/commercial/plans", async (r, reply) => {
    reply.code(201);
    return env(await o.service.createPlan({ ...(await write(r)), value: r.body }), r);
  });
  app.patch("/api/v1/platform/commercial/plans/:id", async (r) =>
    env(
      await o.service.updatePlan({
        ...(await write(r)),
        planId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/platform/commercial/assignments", async (r, reply) => {
    reply.code(201);
    return env(await o.service.assign({ ...(await write(r)), value: r.body }), r);
  });
  app.post("/api/v1/platform/commercial/assignments/:id/actions", async (r) =>
    env(
      await o.service.assignmentAction({
        ...(await write(r)),
        assignmentId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/platform/commercial/adjustments", async (r, reply) => {
    reply.code(201);
    return env(await o.service.adjust({ ...(await write(r)), value: r.body }), r);
  });
  app.post("/api/v1/platform/commercial/adjustments/:id/revoke", async (r) =>
    env(
      await o.service.revokeAdjustment({
        ...(await write(r)),
        adjustmentId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
}
