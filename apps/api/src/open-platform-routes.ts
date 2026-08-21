import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { OpenPlatformService } from "./open-platform-service.js";
export interface OpenPlatformRouteOptions {
  service: OpenPlatformService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  version: string;
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
export function registerOpenPlatformRoutes(app: FastifyInstance, o: OpenPlatformRouteOptions) {
  const actor = async (r: FastifyRequest) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "platform_token:manage",
      surface: "api",
      ...ids(r),
    });
    return a.user.id;
  };
  const write = async (r: FastifyRequest) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return { actorId: await actor(r), idempotencyKey: requireIdempotencyKey(r), ...ids(r) };
  };
  app.get("/api/v1/platform/open", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return env(
      await o.service.overview({
        organizationId: (r.query as any)?.organization_id ?? null,
        ...ids(r),
      }),
      r,
    );
  });
  app.post("/api/v1/platform/open/clients", async (r, reply) => {
    reply.code(201);
    return env(await o.service.createClient({ ...(await write(r)), value: r.body }), r);
  });
  app.post("/api/v1/platform/open/clients/:id/actions", async (r) =>
    env(
      await o.service.clientAction({
        ...(await write(r)),
        clientId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/platform/open/webhooks", async (r, reply) => {
    reply.code(201);
    return env(await o.service.createWebhook({ ...(await write(r)), value: r.body }), r);
  });
  app.patch("/api/v1/platform/open/webhooks/:id", async (r) =>
    env(
      await o.service.updateWebhook({
        ...(await write(r)),
        endpointId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/platform/open/webhooks/:id/rotate", async (r) =>
    env(
      await o.service.rotateWebhook({
        ...(await write(r)),
        endpointId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/platform/open/webhooks/:id/test", async (r, reply) => {
    reply.code(202);
    return env(
      await o.service.enqueue({
        ...(await write(r)),
        endpointId: (r.params as any).id,
        value: r.body,
      }),
      r,
    );
  });
  app.post("/api/v1/platform/open/deliveries/:id/replay", async (r, reply) => {
    reply.code(202);
    return env(
      await o.service.replay({
        ...(await write(r)),
        deliveryId: (r.params as any).id,
        value: r.body,
      }),
      r,
    );
  });
  app.get("/open/v1/status", async (r, reply) => {
    const client = await o.service.authenticate({
        authorization: r.headers.authorization,
        timestamp: r.headers["x-scoutops-timestamp"],
        nonce: r.headers["x-scoutops-nonce"],
        requiredScope: "status:read",
        ...ids(r),
      }),
      data = {
        status: "ok",
        service: "scoutops-open-api",
        version: o.version,
        organization_id: client.organization_id,
      };
    reply.header("cache-control", "no-store");
    return env(data, r);
  });
}
