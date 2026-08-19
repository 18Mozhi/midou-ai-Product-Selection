import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import type {
  CrawlerProfileInput,
  CredentialAssetCreateInput,
  CredentialSecretInput,
} from "@scoutops/contracts";
import type { CredentialAssetService } from "./credential-asset-service.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
export interface CredentialAssetRouteOptions {
  service: CredentialAssetService;
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
export function registerCredentialAssetRoutes(
  app: FastifyInstance,
  o: CredentialAssetRouteOptions,
) {
  const actor = async (r: FastifyRequest) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
      await o.authorization.authorize({
        actorId: a.user.id,
        capability: "key_rotation:manage",
        surface: "api",
        ...ids(r),
      });
      return a.user.id;
    },
    write = async (r: FastifyRequest) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return actor(r);
    },
    context = (r: FastifyRequest, actorId: string) => ({
      actorId,
      idempotencyKey: requireIdempotencyKey(r),
      ...ids(r),
    });
  app.get("/api/v1/platform/credential-provider-options", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.listProviderOptions(), r);
  });
  app.get("/api/v1/platform/credential-assets", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.listAssets(), r);
  });
  app.post("/api/v1/platform/credential-assets", { bodyLimit: 10_000_000 }, async (r, reply) => {
    const actorId = await write(r),
      data = await o.service.createAsset(r.body as CredentialAssetCreateInput, context(r, actorId));
    reply.code(201).header("cache-control", "no-store");
    return envelope(data, r);
  });
  app.post(
    "/api/v1/platform/credential-assets/:assetId/rotate",
    { bodyLimit: 10_000_000 },
    async (r, reply) => {
      const actorId = await write(r),
        assetId = (r.params as { assetId: string }).assetId;
      reply.header("cache-control", "no-store");
      return envelope(
        await o.service.rotateAsset(
          assetId,
          r.body as {
            secret_payload: CredentialSecretInput;
            expected_version: number;
            expires_at?: string | null;
          },
          context(r, actorId),
        ),
        r,
      );
    },
  );
  app.post("/api/v1/platform/credential-assets/:assetId/revoke", async (r, reply) => {
    const actorId = await write(r),
      assetId = (r.params as { assetId: string }).assetId;
    reply.header("cache-control", "no-store");
    return envelope(
      await o.service.revokeAsset(
        assetId,
        r.body as { expected_version: number; reason: string },
        context(r, actorId),
      ),
      r,
    );
  });
  app.get("/api/v1/platform/crawler-profiles", async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    return envelope(await o.service.listProfiles(), r);
  });
  app.post("/api/v1/platform/crawler-profiles", async (r, reply) => {
    const actorId = await write(r),
      data = await o.service.createProfile(r.body as CrawlerProfileInput, context(r, actorId));
    reply.code(201);
    return envelope(data, r);
  });
}
