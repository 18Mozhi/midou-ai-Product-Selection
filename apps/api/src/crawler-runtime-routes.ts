import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import type { CrawlerRuntimeService } from "./crawler-runtime-service.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
export interface CrawlerRuntimeRouteOptions {
  service: CrawlerRuntimeService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  serviceToken: string;
  serviceActorId: string;
}
const ids = (r: FastifyRequest) => ({
  requestId: r.headers["x-request-id"]!.toString(),
  traceId: r.headers["x-trace-id"]!.toString(),
});
const envelope = (data: unknown, r: FastifyRequest) => ({
  data,
  request_id: ids(r).requestId,
  trace_id: ids(r).traceId,
});
const digest = (value: string) => createHash("sha256").update(value).digest();
const databaseFailure = (error: unknown) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code.startsWith("ER_") ||
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(code)
  );
};
const withDependencyBoundary = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (databaseFailure(error))
      throw new ApiError(
        503,
        "crawler_runtime_dependency_unavailable",
        "采集运行数据暂不可用。",
        "数据库或采集运行依赖暂不可用，请稍后重试。",
      );
    throw error;
  }
};
export function registerCrawlerRuntimeRoutes(app: FastifyInstance, o: CrawlerRuntimeRouteOptions) {
  const actor = async (r: FastifyRequest) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "collection:replay",
      surface: "api",
      ...ids(r),
    });
    return a.user.id;
  };
  const serviceActor = (r: FastifyRequest) => {
    const authorization = r.headers.authorization ?? "",
      provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!provided || !o.serviceToken || !timingSafeEqual(digest(provided), digest(o.serviceToken)))
      throw new ApiError(
        401,
        "crawler_service_unauthorized",
        "Crawler 服务鉴权失败。",
        "检查 CRAWLER_SERVICE_TOKEN 后重试。",
      );
    return o.serviceActorId;
  };
  app.get("/api/v1/platform/crawler-runtime", async (r, reply) => {
    return withDependencyBoundary(async () => {
      await actor(r);
      reply.header("cache-control", "private, no-store");
      return envelope(await o.service.list(r.query as Record<string, unknown>), r);
    });
  });
  app.post("/api/v1/platform/crawler-runtime/recover-expired", async (r) => {
    return withDependencyBoundary(async () => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      const actorId = await actor(r);
      return envelope(
        await o.service.recoverExpired({
          actorId,
          idempotencyKey: requireIdempotencyKey(r),
          ...ids(r),
        }),
        r,
      );
    });
  });
  app.post("/api/v1/internal/crawler-runtime/acquire", async (r) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>;
    return envelope(
      await o.service.acquire({
        actorId,
        organizationId: String(body.organization_id ?? ""),
        workspaceId: String(body.workspace_id ?? ""),
        profileId: String(body.profile_id ?? ""),
        leaseOwner: String(body.lease_owner ?? ""),
        leaseSeconds: Number(body.lease_seconds ?? 0),
        idempotencyKey: requireIdempotencyKey(r),
        ...ids(r),
      }),
      r,
    );
  });
  app.post("/api/v1/internal/crawler-runtime/:runId/heartbeat", async (r) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>,
      params = r.params as { runId: string };
    await o.service.heartbeat({
      actorId,
      runId: params.runId,
      profileId: String(body.profile_id ?? ""),
      leaseToken: String(body.lease_token ?? ""),
      leaseSeconds: Number(body.lease_seconds ?? 0),
      ...ids(r),
    });
    return envelope({ accepted: true }, r);
  });
  app.post("/api/v1/internal/crawler-runtime/:runId/complete", async (r) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>,
      params = r.params as { runId: string };
    await o.service.finish({
      actorId,
      runId: params.runId,
      profileId: String(body.profile_id ?? ""),
      leaseToken: String(body.lease_token ?? ""),
      status: String(body.status ?? "") as "succeeded",
      pageCount: Number(body.page_count ?? 0),
      itemCount: Number(body.item_count ?? 0),
      detailCount: Number(body.detail_count ?? 0),
      durationMs: Number(body.duration_ms ?? 0),
      errorCode: body.error_code == null ? null : String(body.error_code),
      ...ids(r),
    });
    return envelope({ accepted: true }, r);
  });
  app.post("/api/v1/internal/crawler-runtime/jobs/acquire", async (r, reply) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>,
      assignment = await o.service.acquireJob({
        actorId,
        leaseOwner: String(body.lease_owner ?? ""),
        leaseSeconds: Number(body.lease_seconds ?? 0),
        completionSpool: body.completion_spool,
        ...ids(r),
      });
    if (!assignment) return reply.code(204).send();
    return envelope(assignment, r);
  });
  app.post("/api/v1/internal/crawler-runtime/jobs/:jobId/heartbeat", async (r) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>,
      params = r.params as { jobId: string };
    await o.service.heartbeatJob({
      actorId,
      jobId: params.jobId,
      runId: String(body.run_id ?? ""),
      profileId: String(body.profile_id ?? ""),
      leaseToken: String(body.lease_token ?? ""),
      leaseSeconds: Number(body.lease_seconds ?? 0),
      ...ids(r),
    });
    return envelope({ accepted: true }, r);
  });
  app.post("/api/v1/internal/crawler-runtime/jobs/:jobId/complete", async (r) => {
    const actorId = serviceActor(r),
      body = r.body as Record<string, unknown>,
      params = r.params as { jobId: string };
    await o.service.finishJob({
      actorId,
      jobId: params.jobId,
      runId: String(body.run_id ?? ""),
      profileId: String(body.profile_id ?? ""),
      leaseToken: String(body.lease_token ?? ""),
      status: String(body.status ?? "") as "succeeded",
      pageCount: Number(body.page_count ?? 0),
      itemCount: Number(body.item_count ?? 0),
      detailCount: Number(body.detail_count ?? 0),
      durationMs: Number(body.duration_ms ?? 0),
      errorCode: body.error_code == null ? null : String(body.error_code),
      result:
        body.result && typeof body.result === "object" && !Array.isArray(body.result)
          ? (body.result as Record<string, unknown>)
          : {},
      ...ids(r),
    });
    return envelope({ accepted: true }, r);
  });
}
