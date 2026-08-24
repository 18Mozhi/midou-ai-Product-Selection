import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import { AuthorizationError, type AuthorizationService } from "@scoutops/authorization";
import {
  parseProviderSourceRefreshScope,
  type ProviderSourceService,
} from "./provider-source-service.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";

export interface ProviderSourceRouteOptions {
  service: ProviderSourceService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: r.headers["x-request-id"]!.toString(),
    traceId: r.headers["x-trace-id"]!.toString(),
  }),
  envelope = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });

export function registerProviderSourceRoutes(app: FastifyInstance, o: ProviderSourceRouteOptions) {
  const actor = async (
      r: FastifyRequest,
      capability: "provider:configure" | "collection:replay",
    ) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
      await o.authorization.authorize({
        actorId: a.user.id,
        capability,
        surface: "api",
        ...ids(r),
      });
      return a.user.id;
    },
    write = async (r: FastifyRequest, capability: "provider:configure" | "collection:replay") => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ai选品 页面重试。");
      return actor(r, capability);
    },
    refreshScope = async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ai选品 页面重试。");
      const requested = parseProviderSourceRefreshScope(
          r.body as { organization_id?: unknown; workspace_id?: unknown },
        ),
        authenticated = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        resolved = await o.authorization.resolveSession(
          authenticated.user.id,
          authenticated.session.id,
        );
      await o.authorization.authorize({
        actorId: authenticated.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        capability: "trend:read",
        surface: "api",
        ...ids(r),
      });
      if (
        requested.organizationId !== resolved.context.organization_id ||
        requested.workspaceId !== resolved.context.workspace_id
      )
        throw new AuthorizationError("tenancy_context_mismatch", 409, "先切换到目标组织和工作区。");
      return {
        actorId: authenticated.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
      };
    };
  app.get("/api/v1/platform/provider-sources", async (r, reply) => {
    await actor(r, "provider:configure");
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.list(), r);
  });
  app.get("/api/v1/platform/provider-sources/1688-acceptance", async (r, reply) => {
    await actor(r, "provider:configure");
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.acceptance1688(), r);
  });
  app.put("/api/v1/platform/provider-sources/:providerId/configuration", async (r) => {
    const actorId = await write(r, "provider:configure");
    return envelope(
      await o.service.updateConfiguration(
        (r.params as { providerId: string }).providerId,
        r.body as never,
        { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
      ),
      r,
    );
  });
  app.get(
    "/api/v1/platform/provider-sources/:providerId/configuration/versions",
    async (r, reply) => {
      await actor(r, "provider:configure");
      reply.header("cache-control", "private, no-store");
      return envelope(
        await o.service.configurationVersions((r.params as { providerId: string }).providerId),
        r,
      );
    },
  );
  app.post("/api/v1/platform/provider-sources/:providerId/configuration/rollbacks", async (r) => {
    const actorId = await write(r, "provider:configure");
    return envelope(
      await o.service.rollbackConfiguration(
        (r.params as { providerId: string }).providerId,
        r.body as never,
        { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
      ),
      r,
    );
  });
  app.post("/api/v1/platform/provider-sources/:code/provision", async (r, reply) => {
    const actorId = await write(r, "provider:configure"),
      result = await o.service.provision((r.params as { code: string }).code, {
        actorId,
        idempotencyKey: requireIdempotencyKey(r),
        ...ids(r),
      });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/platform/provider-sources/:providerId/replays", async (r, reply) => {
    const actorId = await write(r, "collection:replay"),
      result = await o.service.replay(
        (r.params as { providerId: string }).providerId,
        r.body as never,
        { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
      );
    reply.code(202);
    return envelope(result, r);
  });
  app.get("/api/v1/platform/provider-sources/:providerId/parser-samples", async (r, reply) => {
    const actorId = await actor(r, "provider:configure");
    reply.header("cache-control", "private, no-store");
    return envelope(
      await o.service.parserSamples((r.params as { providerId: string }).providerId, actorId),
      r,
    );
  });
  app.post("/api/v1/platform/provider-sources/:providerId/parser-samples", async (r, reply) => {
    const actorId = await write(r, "provider:configure"),
      result = await o.service.createParserSample(
        (r.params as { providerId: string }).providerId,
        r.body as never,
        { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
      );
    reply.code(201);
    return envelope(result, r);
  });
  app.post(
    "/api/v1/platform/provider-sources/:providerId/parser-samples/:sampleId/replays",
    async (r, reply) => {
      const actorId = await write(r, "collection:replay"),
        params = r.params as { providerId: string; sampleId: string },
        result = await o.service.replayParserSample(params.providerId, params.sampleId, {
          actorId,
          idempotencyKey: requireIdempotencyKey(r),
          ...ids(r),
        });
      reply.code(201);
      return envelope(result, r);
    },
  );
  app.post(
    "/api/v1/platform/provider-sources/:providerId/parser-samples/:sampleId/reviews",
    async (r, reply) => {
      const actorId = await write(r, "provider:configure"),
        params = r.params as { providerId: string; sampleId: string },
        result = await o.service.reviewParserSample(
          params.providerId,
          params.sampleId,
          r.body as never,
          { actorId, idempotencyKey: requireIdempotencyKey(r), ...ids(r) },
        );
      reply.code(201);
      return envelope(result, r);
    },
  );
  app.post("/api/v1/provider-sources/refresh", async (r, reply) => {
    const scope = await refreshScope(r),
      result = await o.service.refresh(
        { organization_id: scope.organizationId, workspace_id: scope.workspaceId },
        {
          actorId: scope.actorId,
          idempotencyKey: requireIdempotencyKey(r),
          ...ids(r),
        },
      );
    reply.code(202);
    return envelope(result, r);
  });
}
