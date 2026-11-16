import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { CompetitorService, CompetitorStatusContext } from "./competitor-service.js";
export interface CompetitorRouteOptions {
  service: CompetitorService;
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
  envelope = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerCompetitorRoutes(app: FastifyInstance, o: CompetitorRouteOptions) {
  const scope = async (r: FastifyRequest, capability: Capability) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
      resolved = await o.authorization.resolveSession(a.user.id, a.session.id);
    await o.authorization.authorize({
      actorId: a.user.id,
      organizationId: resolved.context.organization_id,
      workspaceId: resolved.context.workspace_id,
      capability,
      surface: "api",
      ...ids(r),
    });
    return {
      organizationId: resolved.context.organization_id,
      workspaceId: resolved.context.workspace_id,
      actorId: a.user.id,
    };
  };
  const write = async (r: FastifyRequest) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return {
      ...(await scope(r, "competitor:manage")),
      ...ids(r),
      idempotencyKey: requireIdempotencyKey(r),
    };
  };
  const readScope = (r: FastifyRequest, reply: FastifyReply) => {
    if (!o.accountReadRehearsal) return scope(r, "competitor:read");
    reply.header("cache-control", "private, no-store");
    return authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
  };
  const statusWrite = async (
    r: FastifyRequest,
    reply: FastifyReply,
  ): Promise<CompetitorStatusContext> => {
    if (!o.accountReadRehearsal) return write(r);
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const { accountId } = await authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
    reply.header("cache-control", "private, no-store");
    return {
      actorId: accountId,
      accountOwnedStatus: true,
      ...ids(r),
      idempotencyKey: requireIdempotencyKey(r),
    };
  };
  app.get("/api/v1/competitors", async (r, reply) =>
    envelope(
      await o.service.list({
        ...(await readScope(r, reply)),
        opportunityId: (r.query as Record<string, unknown>).opportunity_id,
      }),
      r,
    ),
  );
  app.get("/api/v1/competitors/:id", async (r, reply) =>
    envelope(
      await o.service.get({
        ...(await readScope(r, reply)),
        competitorId: (r.params as any).id,
      }),
      r,
    ),
  );
  if (!o.accountReadRehearsal) {
    app.post("/api/v1/competitors", async (r, reply) => {
      const result = await o.service.create({ ...(await write(r)), value: r.body });
      reply.code(201);
      return envelope(result, r);
    });
    app.post("/api/v1/competitors/:id/snapshots", async (r, reply) => {
      const result = await o.service.addSnapshot({
        ...(await write(r)),
        competitorId: (r.params as any).id,
        value: r.body,
      });
      reply.code(202);
      return envelope(result, r);
    });
    app.post("/api/v1/competitors/:id/collect", async (r, reply) => {
      const result = await o.service.collect({
        ...(await write(r)),
        competitorId: (r.params as any).id,
      });
      reply.code(202);
      return envelope(result, r);
    });
    app.delete("/api/v1/competitors/:id", async (r) =>
      envelope(
        await o.service.remove({
          ...(await write(r)),
          competitorId: (r.params as any).id,
          value: r.body,
        }),
        r,
      ),
    );
    app.post("/api/v1/opportunities/:id/competitor-discovery", async (r, reply) => {
      const result = await o.service.discover({
        ...(await write(r)),
        opportunityId: (r.params as any).id,
      });
      reply.code(202);
      return envelope(result, r);
    });
  }
  app.post("/api/v1/competitors/:id/actions", async (r, reply) =>
    envelope(
      await o.service.setStatus({
        ...(await statusWrite(r, reply)),
        competitorId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/competitor-monitor-rules", async (r, reply) =>
    envelope(await o.service.listRules(await readScope(r, reply)), r),
  );
  app.post("/api/v1/competitor-monitor-rules", async (r, reply) => {
    if (!o.accountReadRehearsal) {
      const result = await o.service.createRule({ ...(await write(r)), value: r.body });
      reply.code(201);
      return envelope(result, r);
    }
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const { accountId } = await authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
    reply.header("cache-control", "private, no-store");
    const result = await o.service.createRule({
      actorId: accountId,
      accountOwnedRule: true,
      ...ids(r),
      idempotencyKey: requireIdempotencyKey(r),
      value: r.body,
    });
    reply.code(201);
    return envelope(result, r);
  });
}
